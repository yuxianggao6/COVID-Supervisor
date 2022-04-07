var express = require('express');
var router = express.Router();
var path = require('path');
var argon2 = require('argon2');
var crypto = require('crypto');
var XMLHttpRequest = require("xmlhttprequest").XMLHttpRequest;
var nodemailer = require("nodemailer");

var googleClientId = "236702098774-31knb831of37746gcs9js747kuneh8df.apps.googleusercontent.com";

// Redirect the user to the login page, if they are not logged in.
router.get('/', function(req, res, next) {
    if ('user' in req.session) {
        res.sendFile(path.join(__dirname, '../pages/index.html'));
    } else {
        res.redirect('/login.html');
    }
});

// Log a user into the system.
router.post('/login', function(req, res, next) {
    if ('email' in req.body && 'password' in req.body) {
        req.pool.getConnection(function(err, connection) {
           if (err) {
               console.log(err);
               res.sendStatus(500);
               return;
           }

           var loginQuery = "SELECT * FROM user WHERE email = ?;";
           connection.query(loginQuery, [req.body.email], async function(err, rows, fields) {
               connection.release();
               if (err) {
                   console.log(err);
                   res.sendStatus(500);
                   return;
                }

                if (rows.length > 0) {
                    // Validate password:
                    let validate = await argon2.verify(rows[0].password_hash, req.body.password);

                    if (validate) {
                        delete rows[0].password_hash;
                        req.session.user = rows[0];
                        // If user wants to stay logged in, set cookie to never expire:
                        if ('remember' in req.body && req.body.remember == true) {
                            req.session.cookie.expires = new Date('9999-12-31T23:59:59');
                        }

                        // If the user is a venue owner, get the details for their venue and send them to the client:
                        if (req.session.user.account_type == 'venue-owner') {
                            getVenueDetails(req, res);
                        } else {
                            // Send the user's details to the client:
                            let userObject = JSON.parse(JSON.stringify(req.session.user));
                            delete userObject.user_id;
                            res.send(userObject);
                        }
                    } else {
                        // Invalid password:
                        res.sendStatus(400);
                    }
                } else {
                    // Invalid email address:
                    res.sendStatus(400);
                }
            });
        });
    } else if ('token' in req.body) {
        // Verify OpenID token.
        const {OAuth2Client} = require('google-auth-library');
        const client = new OAuth2Client(googleClientId);
        async function verify() {
            const ticket = await client.verifyIdToken({
                idToken: req.body.token,
                audience: googleClientId
            });
            const payload = ticket.getPayload();
            const userid = payload['sub'];

            req.pool.getConnection(function(err, connection) {
                if (err) {
                    console.log(err);
                    res.sendStatus(500);
                    return;
                }

                var loginQuery = "SELECT * FROM user WHERE email = ?;";
                connection.query(loginQuery, [payload.email], function(err, rows, fields) {
                    connection.release();
                    if (err) {
                        console.log(err);
                        res.sendStatus(500);
                        return;
                    }

                    if (rows.length > 0) {
                        req.session.user = rows[0];

                        if (req.session.user.account_type == 'venue-owner') {
                            getVenueDetails(req, res);
                        } else {
                            let userObject = JSON.parse(JSON.stringify(req.session.user));
                            delete userObject.user_id;
                            res.send(userObject);
                        }
                    } else {
                        // Invalid email:
                        res.sendStatus(400);
                    }
                });
            });
        }
        verify().catch(function() {res.sendStatus(500)});   // Login failed.
    }
});

// Get details about the venue owned by the logged-in user.
function getVenueDetails(req, res) {
    req.pool.getConnection(function(err, connection) {
        if (err) {
            console.log(err);
            res.sendStatus(500);
            return;
        }

        var venueQuery = "SELECT * FROM venue WHERE owner = ?;";
        connection.query(venueQuery, [req.session.user.user_id], function(err, rows, fields) {
            connection.release();
            if (err) {
                 console.log(err);
                 res.sendStatus(500);
                 return;
             }

             if (rows.length > 0) {
                 // Send user and venue details to the client:
                 req.session.user.venue_id = rows[0].venue_id;
                 let userObject = JSON.parse(JSON.stringify(req.session.user));
                 delete userObject.user_id;
                 delete userObject.venue_id;
                 res.send(userObject);
             } else {
                 // No venue found (invalid owner):
                 res.sendStatus(400);
             }
        });
    });
}

// Register a new user account.
router.post('/register', function(req, res, next) {
    if ('email' in req.body && 'givenName' in req.body && 'familyName' in req.body && 'phone' in req.body && 'password' in req.body) {
        let userType = 'user';
        if ('venue' in req.body) {
            if ('name' in req.body.venue && 'streetNo' in req.body.venue && 'streetName' in req.body.venue && 'city' in req.body.venue && 'postcode' in req.body.venue) {
                userType = 'venue-owner';
            } else {
                // Invalid registration details:
                res.sendStatus(400);
                return;
            }
        } else if ('adminCode' in req.body) {
            req.pool.getConnection(function(err, connection) {
                if (err) {
                    console.log(err);
                    res.sendStatus(500);
                    return;
                }

                // Verify health official/admin registration code:
                var verifyCodeQuery = "SELECT * FROM pending_admin WHERE email = ?;";
                connection.query(verifyCodeQuery, [req.body.email], async function(err, rows, fields) {
                    connection.release();
                    if (err) {
                       console.log(err);
                       res.sendStatus(500);
                       return;
                    }

                    if (rows.length > 0) {
                        // Validate health official registration code:
                        let validate = await argon2.verify(rows[0].code_hash, req.body.adminCode);
                        if (validate) {
                            userType = 'health-official';

                            req.pool.getConnection(function(err, connection) {
                                if (err) {
                                    console.log(err);
                                    res.sendStatus(500);
                                    return;
                                }

                                // Remove email address from pending registrations:
                                var query = "DELETE FROM pending_admin WHERE email = ?;";
                                connection.query(query, [req.body.email], function(err, rows, fields) {
                                    connection.release();
                                    if (err) {
                                       console.log(err);
                                       res.sendStatus(500);
                                       return;
                                    }
                                });
                            });
                        } else {
                            // Invalid registration code:
                            res.sendStatus(400);
                            return;
                        }
                    } else {
                        // Invalid email address:
                        res.sendStatus(400);
                        return;
                    }
                });
            });
        }

        req.pool.getConnection(function(err, connection) {
            if (err) {
                console.log(err);
                res.sendStatus(500);
                return;
            }

            // If no password supplied (openID registration), generate a random password:
            if (req.body.password == "") {
                req.body.password = crypto.randomBytes(128);
            }

            crypto.randomBytes(16, async function(err, salt) {
                if (err) {
                    console.log(err);
                    res.sendStatus(500);
                    return;
                }
                // Hash and salt the user's password:
                let passwordHash = await argon2.hash(req.body.password, salt);

                var registerQuery = "INSERT INTO user (given_name, family_name, email, phone, password_hash, account_type) VALUES (?, ?, ?, ?, ?, ?);";
                connection.query(registerQuery, [req.body.givenName, req.body.familyName, req.body.email, req.body.phone, passwordHash, userType], function(err, rows, fields) {
                    connection.release();
                    if (err) {
                       console.log(err);
                       res.sendStatus(500);
                       return;
                    }

                    if (userType == 'venue-owner') {
                        let venue = req.body.venue;
                        // Get venue address string to obtain latitude and longitude:
                        let address = encodeURIComponent(`${venue.streetNo} ${venue.streetName}, ${venue.city} ${venue.postcode} ${venue.state}`);

                        var xhttp = new XMLHttpRequest();

                        xhttp.onreadystatechange = function() {
                            if (this.readyState == 4 && this.status == 200) {
                                let mapboxData = JSON.parse(this.responseText);

                                req.pool.getConnection(function(err, connection) {
                                    if (err) {
                                        console.log(err);
                                        res.sendStatus(500);
                                        return;
                                    }

                                    var createVenueQuery = "INSERT INTO venue (name, owner, latitude, longitude, state, city, postcode, street_name, street_number) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);";
                                    connection.query(createVenueQuery, [venue.name, rows.insertId, mapboxData.features[0].center[1], mapboxData.features[0].center[0], venue.state, venue.city, venue.postcode, venue.streetName, venue.streetNo], function(err, rows, fields) {
                                        connection.release();
                                        if (err) {
                                            console.log(err);
                                            res.sendStatus(500);
                                            return;
                                        }

                                        res.sendStatus(200);
                                    });
                                });
                            } else if (this.readyState == 4) {
                                // Failed to obtain venue coordinates (likely invalid address):
                                res.sendStatus(400);
                            }
                        };

                        // Send request to MapBox api to get coordinates of venue:
                        xhttp.open("GET", "https://api.mapbox.com/geocoding/v5/mapbox.places/" + address + ".json?limit=1&access_token=pk.eyJ1Ijoid2RjLXByb2plY3QiLCJhIjoiY2tvYzlsNW54MHNqZTMwb3k1ZjJlM3d2YyJ9.uD5DPRQ6JiUzECtpkOw8LA", true);
                        xhttp.send();
                    } else {
                        // The user is not a venue owner, so registration is complete:
                        res.sendStatus(200);
                    }
                });
           });
        });
    } else {
        // Missing registration details:
        res.sendStatus(400);
    }
});

// Request a password reset.
router.post('/password-reset', function(req, res, next) {
    if ('email' in req.body) {
        let email = req.body.email;
        // Generate password reset code:
        crypto.randomBytes(16, async function(err, code){
            crypto.randomBytes(16, async function(err, salt){
                // Hash and salt code, to store in database:
                let codeHash = await argon2.hash(code.toString('hex'), salt);
                req.pool.getConnection(function(err, connection) {
                    if (err) {
                       console.log(err);
                       res.sendStatus(500);
                       return;
                    }

                    // Get the user's id:
                    var query = "SELECT user_id FROM user WHERE email = ?;";
                    connection.query(query, [email], function(err, rows, fields) {
                        connection.release();
                        if (err) {
                           console.log(err);
                           res.sendStatus(500);
                           return;
                        }

                        if (rows.length < 1) {
                            // Invalid email address:
                            res.sendStatus(400);
                            return;
                        }

                        req.pool.getConnection(function(err, connection) {
                            if (err) {
                               console.log(err);
                               res.sendStatus(500);
                               return;
                            }

                            // Insert password reset into database:
                            var resetQuery = "INSERT INTO password_reset (user, code_hash) VALUES (?, ?) ON DUPLICATE KEY UPDATE user = ?, code_hash = ?;";
                            connection.query(resetQuery, [rows[0].user_id, codeHash, rows[0].user_id, codeHash], function(err, rows, fields) {
                                connection.release();
                                if (err) {
                                   console.log(err);
                                   res.sendStatus(500);
                                   return;
                                }

                                // Send email to user:
                                let transporter = nodemailer.createTransport({
                                    service: 'gmail',
                                    host: "smtp.gmail.com",
                                    port: 587,
                                    secure: false,
                                    auth: {
                                        user: 'wdcproject2@gmail.com',
                                        pass: 'lixlwypwdzxvmnne',
                                    }
                                });

                                let info = transporter.sendMail({
                                    from: '"wdc group" <wdcproject2@gmail.com>',
                                    to: email,
                                    subject: "Password Reset",
                                    text: "Your password reset code is: " + code.toString('hex'),
                                    html: `<p>Your password reset code is:</p><strong><pre>${code.toString('hex')}</pre></strong><hr /><p>Note: If you received this email and you are not testing our web application, please ignore it.</p>`
                                });

                                console.log("Password reset email sent to: " + email);
                                res.sendStatus(200);
                            });
                        });
                    });
                });
            });
        });
    } else {
        // No email supplied:
        res.sendStatus(400);
    }
});

// Verify the password reset code.
router.post('/password-reset-verify', function(req, res, next) {
    if ('email' in req.body && 'code' in req.body) {
        req.pool.getConnection(function(err, connection) {
            if (err) {
               console.log(err);
               res.sendStatus(500);
               return;
            }
            var verifyCodeQuery = "SELECT * FROM password_reset INNER JOIN user ON password_reset.user = user.user_id WHERE email = ? AND DATE_ADD(expiry, INTERVAL 1 HOUR) > NOW();";
            connection.query(verifyCodeQuery, [req.body.email], async function(err, rows, fields) {
                connection.release();
                if (err) {
                   console.log(err);
                   res.sendStatus(500);
                   return;
                }

                if (rows.length > 0) {
                    // Verify password reset code:
                    let validate = await argon2.verify(rows[0].code_hash, req.body.code);
                    if (validate) {
                        res.sendStatus(200);
                    } else {
                       res.sendStatus(400);
                       return;
                    }
                } else {
                    res.sendStatus(400);
                    return;
                }
            });
        });
    } else {
        // No email or code supplied:
        res.sendStatus(400);
    }
});

// Update the password for a user.
router.post('/password-reset-apply', function(req, res, next) {
    if ('email' in req.body && 'code' in req.body && 'password' in req.body) {
        req.pool.getConnection(function(err, connection) {
            if (err) {
               console.log(err);
               res.sendStatus(500);
               return;
            }

            var verifyCodeQuery = "SELECT * FROM password_reset INNER JOIN user ON password_reset.user = user.user_id WHERE email = ? AND DATE_ADD(expiry, INTERVAL 1 HOUR) > NOW();";
            connection.query(verifyCodeQuery, [req.body.email], async function(err, rows, fields) {
                connection.release();
                if (err) {
                   console.log(err);
                   res.sendStatus(500);
                   return;
                }

                if (rows.length > 0) {
                    // Verify password reset code:
                    let validate = await argon2.verify(rows[0].code_hash, req.body.code);
                    if (validate) {
                        crypto.randomBytes(16, async function(err, salt) {
                            if (err) {
                                console.log(err);
                                res.sendStatus(500);
                                return;
                            }

                            // Hash and salt the user's new password:
                            let passwordHash = await argon2.hash(req.body.password, salt);
                            let userId = rows[0].user_id;
                            req.pool.getConnection(function(err, connection) {
                                if (err) {
                                   console.log(err);
                                   res.sendStatus(500);
                                   return;
                                }

                                // Update the user's password
                                var updatePasswordQuery = "UPDATE user SET password_hash = ? WHERE user_id = ?;";
                                connection.query(updatePasswordQuery, [passwordHash, userId], function(err, rows, fields) {
                                    connection.release();
                                    if (err) {
                                       console.log(err);
                                       res.sendStatus(500);
                                       return;
                                    }

                                    req.pool.getConnection(function(err, connection) {
                                        if (err) {
                                           console.log(err);
                                           res.sendStatus(500);
                                           return;
                                        }

                                        // Delete reset password entry from database:
                                        var verifyCodeQuery = "DELETE FROM password_reset WHERE user = ?;";
                                        connection.query(verifyCodeQuery, [userId], function(err, rows, fields) {
                                            connection.release();
                                            if (err) {
                                               console.log(err);
                                               res.sendStatus(500);
                                               return;
                                            }

                                            res.sendStatus(200);
                                        });
                                    });
                                });
                            });
                        });
                    } else {
                        // Invalid reset code:
                        res.sendStatus(400);
                        return;
                    }
                } else {
                    // Invalid email address:
                    res.sendStatus(400);
                    return;
                }
            });
        });
    } else {
        // No email, password or code supplied:
        res.sendStatus(400);
    }
});

module.exports = router;
