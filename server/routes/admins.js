var express = require('express');
var router = express.Router();
var nodemailer = require("nodemailer");
var crypto = require('crypto');
var argon2 = require('argon2');
var XMLHttpRequest = require("xmlhttprequest").XMLHttpRequest;

// Ensure the user is a health official before proceeding:
router.use(function(req, res, next) {
    if ('user' in req.session && req.session.user.account_type == 'health-official') {
        next();
    } else {
        res.sendStatus(403);
    }
});

// Get the email addresses of all pending health official/admin registrations.
function getPendingAdmins(req, res) {
    req.pool.getConnection(function(err, connection) {
        if (err) {
           console.log(err);
           res.sendStatus(500);
           return;
        }
        var query = "SELECT email FROM pending_admin;";
        connection.query(query, function(err, rows, fields) {
            connection.release();
            if (err) {
               console.log(err);
               res.sendStatus(500);
               return;
            }

            res.json(rows);
        });
    });
}

// Send a health official registration email to the given address.
router.post('/register-health-official', function(req, res, next) {
    if ('email' in req.body) {
        let email = req.body.email;
        // Generate admin login code:
        crypto.randomBytes(16, async function(err, code){
            crypto.randomBytes(16, async function(err, salt){
                // Hash and salt code, before storing in database:
                let codeHash = await argon2.hash(code.toString('hex'), salt);
                req.pool.getConnection(function(err, connection) {
                    if (err) {
                       console.log(err);
                       res.sendStatus(500);
                       return;
                    }
                    var query = "INSERT INTO pending_admin (email, code_hash) VALUES (?, ?);";
                    connection.query(query, [email, codeHash], function(err, rows, fields) {
                        connection.release();
                        if (err) {
                           console.log(err);
                           res.sendStatus(500);
                           return;
                        }

                        // Send email to new admin:
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
                            subject: "Health Official Registration",
                            text: "https://ide-b2bf5c12a96f4fd3b0c8ae63b7575fc1-8080.cs50.ws/login.html#register?code=" + code.toString('hex') + "&email=" + email,
                            html: `<a href="https://ide-b2bf5c12a96f4fd3b0c8ae63b7575fc1-8080.cs50.ws/login.html#register?code=${code.toString('hex')}&email=${email}">https://ide-b2bf5c12a96f4fd3b0c8ae63b7575fc1-8080.cs50.ws/login.html#register?code=${code.toString('hex')}&email=${email}</a>`
                        });

                        console.log("Admin registration email sent to: " + email);

                        // Return the list of pending admin accounts:
                        getPendingAdmins(req, res);
                    });
                });
            });
        });
    } else {
        // No email provided:
        res.sendStatus(400);
    }
});

// Get the list of pending health official accounts.
router.get('/pending-health-officials', function(req, res, next) {
    getPendingAdmins(req, res);
});

// Cancel a pending health official registration.
router.post('/cancel-pending', function(req, res, next) {
    if ('email' in req.body) {
        req.pool.getConnection(function(err, connection) {
            if (err) {
               console.log(err);
               res.sendStatus(500);
               return;
            }
            var query = "DELETE FROM pending_admin WHERE email = ?;";
            connection.query(query, [req.body.email], function(err, rows, fields) {
                connection.release();
                if (err) {
                   console.log(err);
                   res.sendStatus(500);
                   return;
                }

                getPendingAdmins(req, res);
            });
        });
    } else {
        // No email supplied:
        res.sendStatus(400);
    }
});

// Search for users matching the given search criteria.
router.get('/users', function(req, res, next) {
    if ('search_by' in req.query && 'search_term' in req.query && 'num' in req.query && 'page' in req.query) {
        let searchBy = req.query.search_by;
        let searchTerm = req.query.search_term;
        let num = Number(req.query.num);
        let page = Number(req.query.page) - 1;
        var searchQuery;

        // Select the query, based on the searchBy parameter:
        switch (searchBy) {
            case "givenName":
                searchQuery = "SELECT user_id, given_name AS givenName, family_name AS familyName, email, phone FROM user WHERE given_name LIKE CONCAT('%', ?, '%') LIMIT ?, ?;";
                break;

            case "familyName":
                searchQuery = "SELECT user_id, given_name AS givenName, family_name AS familyName, email, phone FROM user WHERE family_name LIKE CONCAT('%', ?, '%') LIMIT ?, ?;";
                break;

            case "phone":
                searchQuery = "SELECT user_id, given_name AS givenName, family_name AS familyName, email, phone FROM user WHERE phone LIKE CONCAT('%', ?, '%') LIMIT ?, ?;";
                break;

            case "email":
                searchQuery = "SELECT user_id, given_name AS givenName, family_name AS familyName, email, phone FROM user WHERE email LIKE CONCAT('%', ?, '%') LIMIT ?, ?;";
                break;

            default:
                res.sendStatus(400);
                return;
        }

        req.pool.getConnection(function(err, connection) {
            if (err) {
               console.log(err);
               res.sendStatus(500);
               return;
            }
            connection.query(searchQuery, [searchTerm, page * num, num], function(err, rows, fields) {
                connection.release();
                if (err) {
                   console.log(err);
                   res.sendStatus(500);
                   return;
                }

                // Return the results of the search:
                res.json(rows);
            });
        });
    } else {
        // Invalid search criteria:
        res.sendStatus(400);
    }
});

// Search for venues matching the given search criteria.
router.get('/venues', function(req, res, next) {
    if ('search_by' in req.query && 'search_term' in req.query && 'num' in req.query && 'page' in req.query) {
        let searchBy = req.query.search_by;
        let searchTerm = req.query.search_term;
        let num = Number(req.query.num);
        let page = Number(req.query.page) - 1;
        var searchQuery;

        // Select the query, based on the searchBy parameter:
        switch (searchBy) {
            case "name":
                searchQuery = "SELECT venue_id, name, street_name AS streetName, street_number AS streetNo, city, postcode, state, owner FROM venue WHERE name LIKE CONCAT('%', ?, '%') LIMIT ?, ?;";
                break;

            case "streetName":
                searchQuery = "SELECT venue_id, name, street_name AS streetName, street_number AS streetNo, city, postcode, state, owner FROM venue WHERE street_name LIKE CONCAT('%', ?, '%') LIMIT ?, ?;";
                break;

            case "city":
                searchQuery = "SELECT venue_id, name, street_name AS streetName, street_number AS streetNo, city, postcode, state, owner FROM venue WHERE city LIKE CONCAT('%', ?, '%') LIMIT ?, ?;";
                break;

            case "postcode":
                searchTerm = Number(searchTerm);
                searchQuery = "SELECT venue_id, name, street_name AS streetName, street_number AS streetNo, city, postcode, state, owner FROM venue WHERE postcode = ? LIMIT ?, ?;";
                break;

            case "state":
                searchQuery = "SELECT venue_id, name, street_name AS streetName, street_number AS streetNo, city, postcode, state, owner FROM venue WHERE state = ? LIMIT ?, ?;";
                break;

            default:
                res.sendStatus(400);
                return;
        }

        req.pool.getConnection(function(err, connection) {
            if (err) {
               console.log(err);
               res.sendStatus(500);
               return;
            }
            connection.query(searchQuery, [searchTerm, page * num, num], function(err, rows, fields) {
                connection.release();
                if (err) {
                   console.log(err);
                   res.sendStatus(500);
                   return;
                }

                // Return the results of the search:
                res.json(rows);
            });
        });
    } else {
        // Invalid search criteria:
        res.sendStatus(400);
    }
});

// Get the check-in history for the given venue.
router.get('/venue-check-in-history', function(req, res, next) {
    if ('id' in req.query) {
        req.pool.getConnection(function(err, connection) {
           if (err) {
               console.log(err);
               res.sendStatus(500);
               return;
           }

           var query = "SELECT given_name AS givenName, family_name AS familyName, DATE(timestamp) AS date, TIME(timestamp) AS time FROM check_in INNER JOIN user ON check_in.user = user.user_id WHERE venue = ?;";
           connection.query(query, [req.query.id], function(err, rows, fields) {
               connection.release();
               if (err) {
                   console.log(err);
                   res.sendStatus(500);
                   return;
                }

                res.json(rows);
            });
        });
    } else {
        // No venue id supplied:
        res.sendStatus(400);
    }
});

// Get the details for the given user.
function getUserDetails(req, res, id) {
    req.pool.getConnection(function(err, connection) {
       if (err) {
           console.log(err);
           res.sendStatus(500);
           return;
       }

       var query = "SELECT given_name AS givenName, family_name AS familyName, email, phone FROM user WHERE user_id = ?;";
       connection.query(query, [id], function(err, rows, fields) {
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
}

// Get the owner of the given venue.
router.get('/venue-owner', function(req, res, next) {
    if ('id' in req.query) {
        req.pool.getConnection(function(err, connection) {
           if (err) {
               console.log(err);
               res.sendStatus(500);
               return;
           }

           var query = "SELECT owner FROM venue WHERE venue_id = ?;";
           connection.query(query, [Number(req.query.id)], function(err, rows, fields) {
               connection.release();
               if (err) {
                   console.log(err);
                   res.sendStatus(500);
                   return;
                }

                if (rows.length > 0) {
                    // Send the user details of the owner:
                    getUserDetails(req, res, rows[0].owner);
                }
            });
        });
    } else {
        // No venue id supplied:
        res.sendStatus(400);
    }
});

// Get the check-in history for the given user.
router.get('/user-check-in-history', function(req, res, next) {
    if ('id' in req.query) {
        req.pool.getConnection(function(err, connection) {
           if (err) {
               console.log(err);
               res.sendStatus(500);
               return;
           }

           var loginQuery = "SELECT name, CONCAT(street_number, ' ', street_name, ', ', city, ' ', postcode, ' ', state) AS address, DATE(timestamp) AS date, TIME(timestamp) AS time FROM check_in INNER JOIN venue ON venue = venue_id WHERE user = ?;";
           connection.query(loginQuery, [Number(req.query.id)], async function(err, rows, fields) {
               connection.release();
               if (err) {
                   console.log(err);
                   res.sendStatus(500);
                   return;
                }

                res.json(rows);
            });
        });
    } else {
        // No user id supplied:
        res.sendStatus(400);
    }
});

// Get all hotspot areas and venues.
router.get('/hotspots', function(req, res, next) {
    req.pool.getConnection(function(err, connection) {
        if (err) {
           console.log(err);
           res.sendStatus(500);
           return;
        }
        // Get hotspot areas:
        var hotspotAreaQuery = "SELECT hotspot_id, state, name, DATE(start_time) AS start_date, TIME(start_time) AS start_time, DATE(end_time) AS end_date, TIME(end_time) AS end_time FROM city INNER JOIN hotspot_area ON city.city_id = hotspot_area.city;";
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
                // Get hotspot venues:
                var hotspotVenueQuery = "SELECT hotspot_id, name, CONCAT(street_number, ' ', street_name, ', ', city, ' ', postcode, ' ', state) AS address, DATE(start_time) AS start_date, TIME(start_time) AS start_time, DATE(end_time) AS end_date, TIME(end_time) AS end_time FROM hotspot_venue INNER JOIN venue ON hotspot_venue.venue = venue.venue_id;";
                connection.query(hotspotVenueQuery, function(err, rows, fields) {
                   connection.release();
                   if (err) {
                       console.log(err);
                       res.sendStatus(500);
                       return;
                    }

                    hotspotVenues = rows;

                    // Send hotspots to the client:
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

// Remove a hotspot area declaration.
router.post('/remove-hotspot-area', function(req, res, next) {
    if ('id' in req.body) {
        req.pool.getConnection(function(err, connection) {
            if (err) {
               console.log(err);
               res.sendStatus(500);
               return;
            }
            var deleteQuery = "DELETE FROM hotspot_area WHERE hotspot_id = ?;";
            connection.query(deleteQuery, [req.body.id], function(err, rows, fields) {
                connection.release();
                if (err) {
                   console.log(err);
                   res.sendStatus(500);
                   return;
                }

                req.pool.getConnection(function(err, connection) {
                   var hotspotQuery = "SELECT hotspot_id, state, name, DATE(start_time) AS start_date, TIME(start_time) AS start_time, DATE(end_time) AS end_date, TIME(end_time) AS end_time FROM city INNER JOIN hotspot_area ON city.city_id = hotspot_area.city;";
                   connection.query(hotspotQuery, function(err, rows, fields) {
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
        });
    } else {
        // No hotspot id supplied:
        res.sendStatus(400);
    }
});

// Remove a hotspot venue declaration.
router.post('/remove-hotspot-venue', function(req, res, next) {
    if ('id' in req.body) {
        req.pool.getConnection(function(err, connection) {
            var deleteQuery = "DELETE FROM hotspot_venue WHERE hotspot_id = ?;";
            connection.query(deleteQuery, [req.body.id], function(err, rows, fields) {
                connection.release();
                if (err) {
                   console.log(err);
                   res.sendStatus(500);
                   return;
                }

                req.pool.getConnection(function(err, connection) {
                   var hotspotQuery = "SELECT hotspot_id, name, CONCAT(street_number, ' ', street_name, ', ', city, ' ', postcode, ' ', state) AS address, DATE(start_time) AS start_date, TIME(start_time) AS start_time, DATE(end_time) AS end_date, TIME(end_time) AS end_time FROM hotspot_venue INNER JOIN venue ON hotspot_venue.venue = venue.venue_id;";
                   connection.query(hotspotQuery, function(err, rows, fields) {
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
        });
    } else {
        // No hotspot id supplied:
        res.sendStatus(400);
    }
});

// Create a hotspot venue declaration.
router.post('/create-hotspot-venue', function(req, res, next) {
    if ('venue' in req.body && 'start_date' in req.body && 'start_time' in req.body && 'end_date' in req.body && 'end_time' in req.body) {
        req.pool.getConnection(function(err, connection) {
            if (err) {
                console.log(err);
                res.sendStatus(500);
                return;
            }
            var insertQuery = "INSERT INTO hotspot_venue (venue, start_time, end_time) VALUES (?, ?, ?);";
            connection.query(insertQuery, [req.body.venue, req.body.start_date + " " + req.body.start_time, req.body.end_date + " " + req.body.end_time], function(err, rows, fields) {
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
                   var hotspotQuery = "SELECT hotspot_id, name, CONCAT(street_number, ' ', street_name, ', ', city, ' ', postcode, ' ', state) AS address, DATE(start_time) AS start_date, TIME(start_time) AS start_time, DATE(end_time) AS end_date, TIME(end_time) AS end_time FROM hotspot_venue INNER JOIN venue ON hotspot_venue.venue = venue.venue_id;";
                   connection.query(hotspotQuery, function(err, rows, fields) {
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
        });
    } else {
        // Invalid hotspot details:
        res.sendStatus(400);
    }
});

// Create a hotspot area declaration.
router.post('/create-hotspot-area', function(req, res, next) {
    if ('city' in req.body && 'state' in req.body && 'start_date' in req.body && 'start_time' in req.body && 'end_date' in req.body && 'end_time' in req.body) {
        req.pool.getConnection(function(err, connection) {
            if (err) {
               console.log(err);
               res.sendStatus(500);
               return;
            }
            var cityQuery = "SELECT city_id FROM city WHERE name = ? AND state = ?;";
            connection.query(cityQuery, [req.body.city, req.body.state], function(err, rows, fields) {
                connection.release();
                if (err) {
                   console.log(err);
                   res.sendStatus(500);
                   return;
                }
                if (rows.length > 0) {
                    req.pool.getConnection(function(err, connection) {
                        if (err) {
                           console.log(err);
                           res.sendStatus(500);
                           return;
                        }
                        var insertQuery = "INSERT INTO hotspot_area (city, start_time, end_time) VALUES (?, ?, ?);";
                        connection.query(insertQuery, [rows[0].city_id, req.body.start_date + " " + req.body.start_time, req.body.end_date + " " + req.body.end_time], function(err, rows, fields) {
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
                                var hotspotQuery = "SELECT hotspot_id, state, name, DATE(start_time) AS start_date, TIME(start_time) AS start_time, DATE(end_time) AS end_date, TIME(end_time) AS end_time FROM city INNER JOIN hotspot_area ON city.city_id = hotspot_area.city;";
                                connection.query(hotspotQuery, function(err, rows, fields) {
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
                    });
                } else {
                    // Invalid city and/or state:
                    res.sendStatus(400);
                }
            });
        });
    } else {
        // Invalid hotspot details:
        res.sendStatus(400);
    }
});

// Update the details for the given user.
router.post('/update-user', function(req, res, next) {
    if ('givenName' in req.body && 'familyName' in req.body && 'email' in req.body && 'phone' in req.body && 'user_id' in req.body) {
        req.pool.getConnection(function(err, connection) {
           if (err) {
               console.log(err);
               res.sendStatus(500);
               return;
           }

           var updateQuery = "UPDATE user SET given_name = ?, family_name = ?, email = ?, phone = ? WHERE user_id = ?;";
           connection.query(updateQuery, [req.body.givenName, req.body.familyName, req.body.email, req.body.phone, req.body.user_id], function(err, rows, fields) {
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
        // Invalid user details:
        res.sendStatus(400);
    }
});

// Update the details for the given venue.
router.post('/update-venue', function(req, res, next) {
    if ('street_number' in req.body && 'street_name' in req.body && 'city' in req.body && 'postcode' in req.body && 'state' in req.body && 'name' in req.body && 'venue_id' in req.body) {
        let address = encodeURIComponent(`${req.body.street_number} ${req.body.street_name}, ${req.body.city} ${req.body.postcode} ${req.body.state}`);

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

                   var query = "UPDATE venue SET name = ?, street_number = ?, street_name = ?, city = ?, postcode = ?, state = ?, latitude = ?, longitude = ? WHERE venue_id = ?;";
                   connection.query(query, [req.body.name, req.body.street_number, req.body.street_name, req.body.city, req.body.postcode, req.body.state, mapboxData.features[0].center[1], mapboxData.features[0].center[0], req.body.venue_id], function(err, rows, fields) {
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
                // Failed to obtain venue latitude and longitude:
                res.sendStatus(400);
            }
        };

        // Obtain venue latitude and longitude:
        xhttp.open("GET", "https://api.mapbox.com/geocoding/v5/mapbox.places/" + address + ".json?limit=1&access_token=pk.eyJ1Ijoid2RjLXByb2plY3QiLCJhIjoiY2tvYzlsNW54MHNqZTMwb3k1ZjJlM3d2YyJ9.uD5DPRQ6JiUzECtpkOw8LA", true);
        xhttp.send();
    } else {
        // Invalid venue details:
        res.sendStatus(400);
    }
});

// Get hotspot venues matching the given search criteria.
router.get('/hotspot-venues', function(req, res, next) {
    if ('search_by' in req.query && 'search_term' in req.query && 'num' in req.query && 'page' in req.query) {
        let searchBy = req.query.search_by;
        let searchTerm = req.query.search_term;
        let num = Number(req.query.num);
        let page = Number(req.query.page) - 1;
        var searchQuery;

        // Select the query, based on the searchBy parameter:
        switch (searchBy) {
            case "name":
                searchQuery = "SELECT hotspot_id, name, CONCAT(street_number, ' ', street_name, ', ', city, ' ', postcode, ' ', state) AS address, DATE(start_time) AS start_date, TIME(start_time) AS start_time, DATE(end_time) AS end_date, TIME(end_time) AS end_time FROM hotspot_venue INNER JOIN venue ON hotspot_venue.venue = venue.venue_id WHERE name LIKE CONCAT('%', ?, '%') LIMIT ?, ?;";
                break;

            case "streetName":
                searchQuery = "SELECT hotspot_id, name, CONCAT(street_number, ' ', street_name, ', ', city, ' ', postcode, ' ', state) AS address, DATE(start_time) AS start_date, TIME(start_time) AS start_time, DATE(end_time) AS end_date, TIME(end_time) AS end_time FROM hotspot_venue INNER JOIN venue ON hotspot_venue.venue = venue.venue_id WHERE street_name LIKE CONCAT('%', ?, '%') LIMIT ?, ?;";
                break;

            case "city":
                searchQuery = "SELECT hotspot_id, name, CONCAT(street_number, ' ', street_name, ', ', city, ' ', postcode, ' ', state) AS address, DATE(start_time) AS start_date, TIME(start_time) AS start_time, DATE(end_time) AS end_date, TIME(end_time) AS end_time FROM hotspot_venue INNER JOIN venue ON hotspot_venue.venue = venue.venue_id WHERE city LIKE CONCAT('%', ?, '%') LIMIT ?, ?;";
                break;

            case "postcode":
                searchTerm = Number(searchTerm);
                searchQuery = "SELECT hotspot_id, name, CONCAT(street_number, ' ', street_name, ', ', city, ' ', postcode, ' ', state) AS address, DATE(start_time) AS start_date, TIME(start_time) AS start_time, DATE(end_time) AS end_date, TIME(end_time) AS end_time FROM hotspot_venue INNER JOIN venue ON hotspot_venue.venue = venue.venue_id WHERE postcode = ? LIMIT ?, ?;";
                break;

            case "state":
                searchQuery = "SELECT hotspot_id, name, CONCAT(street_number, ' ', street_name, ', ', city, ' ', postcode, ' ', state) AS address, DATE(start_time) AS start_date, TIME(start_time) AS start_time, DATE(end_time) AS end_date, TIME(end_time) AS end_time FROM hotspot_venue INNER JOIN venue ON hotspot_venue.venue = venue.venue_id WHERE state = ? LIMIT ?, ?;";
                break;

            default:
                res.sendStatus(400);
                return;
        }

        req.pool.getConnection(function(err, connection) {
            if (err) {
               console.log(err);
               res.sendStatus(500);
               return;
            }
            connection.query(searchQuery, [searchTerm, page * num, num], function(err, rows, fields) {
               connection.release();
               if (err) {
                   console.log(err);
                   res.sendStatus(500);
                   return;
                }

                // Return the results of the search:
                res.json(rows);
            });
        });
    } else {
        // Invalid search criteria:
        res.sendStatus(400);
    }
});

// Update the timeframe of the supplied hotspot.
router.post('/update-hotspot', function(req, res, next) {
    if ('id' in req.body && 'start_date' in req.body && 'start_time' in req.body && 'end_date' in req.body && 'end_time' in req.body) {
        req.pool.getConnection(function(err, connection) {
            if (err) {
                console.log(err);
                res.sendStatus(500);
                return;
            }
            var query;
            // Select query depending on whether a hotspot area or venue is being updated:
            if (req.body.is_venue) {
                query = "UPDATE hotspot_venue SET start_time = ?, end_time = ? WHERE hotspot_id = ?;";
            } else {
                query = "UPDATE hotspot_area SET start_time = ?, end_time = ? WHERE hotspot_id = ?;";
            }
            connection.query(query, [req.body.start_date + " " + req.body.start_time, req.body.end_date + " " + req.body.end_time, req.body.id], function(err, rows, fields) {
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
        // Invalid hotspot details:
        res.sendStatus(400);
    }
});

module.exports = router;