var express = require('express');
var router = express.Router();
var argon2 = require('argon2');
var crypto = require('crypto');

// Ensure the user is logged in.
router.use(function(req, res, next) {
    if ('user' in req.session) {
        next();
    } else {
        res.sendStatus(403);
    }
});

// Parse a venue code into the corresponding venue id.
function parseVenueCode(code) {
    code = code.toUpperCase();
    let result = 0;
    let scale = 1;
    for (let i = 0; i < code.length; i++) {
        let charCode = code.charCodeAt(i);
        if (charCode > 64) {
            charCode -= 65;
        } else {
            charCode -= 22;
        }
        result += charCode * scale;
        scale *= 36;
    }
    return result;
}

// Log the current user out.
router.post('/logout', function(req, res, next) {
    delete req.session.user;
    res.sendStatus(200);
});

// Check-in to a venue.
router.post('/check-in', function(req, res, next) {
    if ('code' in req.body) {
        var checkInCode = req.body.code;
        if (checkInCode === undefined) {
            res.sendStatus(400);
        } else {
            // Parse the venue check-in code:
            let code = parseVenueCode(checkInCode.toString());

            req.pool.getConnection(function(err, connection) {
               if (err) {
                   console.log(err);
                   res.sendStatus(500);
                   return;
               }

               var checkInVenueQuery = "SELECT * FROM venue WHERE venue_id = ?;";
               connection.query(checkInVenueQuery, [code], function(err, rows, fields) {
                   connection.release();
                   if (err) {
                       console.log(err);
                       res.sendStatus(500);
                       return;
                    }

                    if (rows.length > 0) {
                        // Venue exists, so send venue details:
                        res.json({venue: rows[0].name, address: `${rows[0].street_number} ${rows[0].street_name}, ${rows[0].city} ${rows[0].postcode}, ${rows[0].state}`, id: rows[0].venue_id});
                    } else {
                        // Venues does not exist:
                        res.sendStatus(400);
                    }
                });
            });
        }
    } else {
        // No check-in code supplied:
        res.sendStatus(400);
    }
});

// Confirm check-in to venue.
router.post('/confirm-check-in', function(req, res, next) {
    if ('venue_id' in req.body) {
        req.pool.getConnection(function(err, connection) {
           if (err) {
               console.log(err);
               res.sendStatus(500);
               return;
            }
            // Add check-in to database:
            var checkInQuery = "INSERT INTO check_in (user, venue) VALUES (?, ?);";
            connection.query(checkInQuery, [req.session.user.user_id, req.body.venue_id], function(err, row, fields) {
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
                    // Retrieve details about the user's check-in:
                    var checkInQuery = "SELECT timestamp, name, state, city, postcode, street_name, street_number FROM check_in INNER JOIN venue ON venue_id = venue WHERE check_in_id = ?;";
                    connection.query(checkInQuery, [row.insertId], function(err, rows, fields) {
                        connection.release();
                        if (err) {
                           console.log(err);
                           res.sendStatus(500);
                           return;
                        }

                        res.json({venue: rows[0].name, address: `${rows[0].street_number} ${rows[0].street_name}, ${rows[0].city} ${rows[0].postcode}, ${rows[0].state}`, time: rows[0].timestamp});
                    });
                });
            });
        });
    } else {
        // No venue id supplied:
        res.sendStatus(400);
    }
});

// Get all hotspot venues and areas.
router.get('/hotspots', function(req, res, next) {
    req.pool.getConnection(function(err, connection) {
        if (err) {
            console.log(err);
            res.sendStatus(500);
            return;
        }
        // Obtain hotspot areas:
        var hotspotAreaQuery = "SELECT * FROM city INNER JOIN hotspot_area ON city.city_id = hotspot_area.city;";
        connection.query(hotspotAreaQuery, function(err, rows, fields) {
           connection.release();
            if (err) {
                console.log(err);
                res.sendStatus(500);
                return;
            }

            hotspotAreas = rows;

            req.pool.getConnection(function(err, connection) {
                if (err) {
                    console.log(err);
                    res.sendStatus(500);
                    return;
                }
                // Obtain hotspot venues:
                var hotspotVenueQuery = "SELECT hotspot_id, name, CONCAT(street_number, ' ', street_name, ', ', city, ' ', postcode, ' ', state) AS address, start_time AS start, end_time AS end, latitude, longitude FROM hotspot_venue INNER JOIN venue ON hotspot_venue.venue = venue.venue_id;";
                connection.query(hotspotVenueQuery, function(err, rows, fields) {
                    connection.release();
                    if (err) {
                        console.log(err);
                        res.sendStatus(500);
                        return;
                    }

                    hotspotVenues = rows;

                    // Send hotspots to client:
                    var hotspots = {
                        areas: hotspotAreas,
                        venues: hotspotVenues
                    };
                    res.json(hotspots);
                });
            });
        });
    });
});

// Check if the user has visited a hotspot.
router.get('/visit-hotspot', function(req, res, next) {
   req.pool.getConnection(function(err, connection) {
       if (err) {
           console.log(err);
           res.sendStatus(500);
           return;
       }

       var hotspotQuery = "SELECT * FROM hotspot_venue INNER JOIN check_in ON hotspot_venue.venue = check_in.venue WHERE user = ? AND check_in.timestamp > hotspot_venue.start_time AND check_in.timestamp < hotspot_venue.end_time;";
       connection.query(hotspotQuery, [req.session.user.user_id], function(err, rows, fields) {
           connection.release();
           if (err) {
               console.log(err);
               res.sendStatus(500);
               return;
            }

            if (rows.length > 0) {
                // An active hotspot has been visited:
                res.json({status: 1});
            } else {
                // No active hotspots were visited:
                res.json({status: 0});
            }
        });
    });
});

// Get the check-in history for the user.
router.get('/check-in-history', function(req, res, next) {
    req.pool.getConnection(function(err, connection) {
       if (err) {
           console.log(err);
           res.sendStatus(500);
           return;
       }

       var checkInQuery = "SELECT name, street_number, street_name, city, postcode, state, DATE(timestamp) AS date, TIME(timestamp) AS time, latitude, longitude FROM check_in INNER JOIN venue ON venue = venue_id WHERE user = ? ORDER BY timestamp DESC;";
       connection.query(checkInQuery, [req.session.user.user_id], function(err, rows, fields) {
           connection.release();
           if (err) {
               console.log(err);
               res.sendStatus(500);
               return;
            }

            res.json(rows);
        });
    });
});

// Get the account details for the user.
router.get('/details', function(req, res, next) {
    req.pool.getConnection(function(err, connection) {
       if (err) {
           console.log(err);
           res.sendStatus(500);
           return;
       }

       var userQuery = "SELECT given_name AS givenName, family_name AS familyName, email, phone, account_type AS accountType FROM user WHERE user_id = ?;";
       connection.query(userQuery, [req.session.user.user_id], function(err, rows, fields) {
           connection.release();
           if (err) {
               console.log(err);
               res.sendStatus(500);
               return;
            }

            if (rows.length > 0) {
                res.json(rows[0]);
            }
        });
    });
});

// Update the user's account details.
router.post('/details', function(req, res, next) {
    if ('givenName' in req.body && 'familyName' in req.body && 'email' in req.body && 'phone' in req.body) {
        req.pool.getConnection(function(err, connection) {
           if (err) {
               console.log(err);
               res.sendStatus(500);
               return;
           }

           var userQuery = "UPDATE user SET given_name = ?, family_name = ?, email = ?, phone = ? WHERE user_id = ?;";
           connection.query(userQuery, [req.body.givenName, req.body.familyName, req.body.email, req.body.phone, req.session.user.user_id], function(err, rows, fields) {
               connection.release();
               if (err) {
                   console.log(err);
                   res.sendStatus(500);
                   return;
                }

                res.sendStatus(200);
            });
        });
    } else {
        // Missing account details:
        res.sendStatus(400);
    }
});

// Update the user's password.
router.post('/password', function(req, res, next) {
    if ('password' in req.body) {
        req.pool.getConnection(function(err, connection) {
            if (err) {
                console.log(err);
                res.sendStatus(500);
                return;
            }

            crypto.randomBytes(16, async function(err, salt) {
                if (err) {
                    console.log(err);
                    res.sendStatus(500);
                    return;
                }
                // Hash and salt the new password:
                let passwordHash = await argon2.hash(req.body.password, salt);

                var passwordQuery = "UPDATE user SET password_hash = ? WHERE user_id = ?;";
                connection.query(passwordQuery, [passwordHash, req.session.user.user_id], async function(err, rows, fields) {
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
    } else {
        // No password supplied:
        res.sendStatus(400);
    }
});

module.exports = router;