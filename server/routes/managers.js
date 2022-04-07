var express = require('express');
var router = express.Router();
var path = require('path');
var XMLHttpRequest = require("xmlhttprequest").XMLHttpRequest;

// Ensure the user is a venue manager.
router.use(function(req, res, next) {
    if ('user' in req.session && req.session.user.account_type == 'venue-owner') {
        next();
    } else {
        res.sendStatus(403);
    }
});

// Get the printable check-in page for this venue.
router.get('/check-in-printable.html', function(req, res, next) {
    res.sendFile(path.join(__dirname, '../pages/check-in(printable).html'));
});

// Get the check-in history for the venue owned by the logged-in user.
router.get('/check-in-history', function(req, res, next) {
    req.pool.getConnection(function(err, connection) {
       if (err) {
           console.log(err);
           res.sendStatus(500);
           return;
       }

       var query = "SELECT given_name AS givenName, family_name AS familyName, DATE(timestamp) AS date, TIME(timestamp) AS time FROM check_in INNER JOIN user ON check_in.user = user.user_id WHERE venue = ? ORDER BY timestamp DESC;";
       connection.query(query, [req.session.user.venue_id], function(err, rows, fields) {
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

// Get the venue details for the venue owned by the logged-in user.
router.get('/details', function(req, res, next) {
    req.pool.getConnection(function(err, connection) {
       if (err) {
           console.log(err);
           res.sendStatus(500);
           return;
       }

       var query = "SELECT * FROM venue WHERE venue_id = ?;";
       connection.query(query, [req.session.user.venue_id], function(err, rows, fields) {
           connection.release();
           if (err) {
               console.log(err);
               res.sendStatus(500);
               return;
            }

            if (rows.length > 0) {
                res.json(rows[0]);
            } else {
                res.sendStatus(500);
            }
        });
    });
});

// Update the details of a venue.
router.post('/details', function(req, res, next) {
    if ('street_number' in req.body && 'street_name' in req.body && 'city' in req.body && 'postcode' in req.body && 'state' in req.body && 'name' in req.body) {
        // Get venue address string:
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

                    // Update venue details
                    var query = "UPDATE venue SET name = ?, street_number = ?, street_name = ?, city = ?, postcode = ?, state = ?, latitude = ?, longitude = ? WHERE venue_id = ?;";
                    connection.query(query, [req.body.name, req.body.street_number, req.body.street_name, req.body.city, req.body.postcode, req.body.state, mapboxData.features[0].center[1], mapboxData.features[0].center[0], req.session.user.venue_id], function(err, rows, fields) {
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
                // Failed to obtain latitude and longitude for the provided address:
                res.sendStatus(400);
            }
        };

        // Get new venue latitude and longitude:
        xhttp.open("GET", "https://api.mapbox.com/geocoding/v5/mapbox.places/" + address + ".json?limit=1&access_token=pk.eyJ1Ijoid2RjLXByb2plY3QiLCJhIjoiY2tvYzlsNW54MHNqZTMwb3k1ZjJlM3d2YyJ9.uD5DPRQ6JiUzECtpkOw8LA", true);
        xhttp.send();
    } else {
        // Invalid venue details:
        res.sendStatus(400);
    }
});

// Get the venue check-in code corresponding to the given venue id.
function getVenueCode(id) {
    code = "";
    for (let i = 0; i < 5; i++) {
        let charCode = id % 36;

        if (charCode < 26) {
            charCode += 65;
        } else {
            charCode += 22;
        }
        code += String.fromCharCode(charCode);

        id /= 36;
    }
    return code;
}

// Get details about the venue, to display on the printable check-in page.
router.get('/check-in-printable', function(req, res, next) {
    let user = req.session.user.user_id;

    req.pool.getConnection(function(err, connection) {
       if (err) {
           console.log(err);
           res.sendStatus(500);
           return;
       }

        // Get details for the venue:
        var query = "SELECT * FROM venue WHERE owner = ?;";
        connection.query(query, [user], function(err, rows, fields) {
            connection.release();
            if (err) {
               console.log(err);
               res.sendStatus(500);
               return;
            }

            if (rows.length > 0) {
                // Send venue details to the client:
                res.json({
                    address: `${rows[0].street_number} ${rows[0].street_name}, ${rows[0].city} ${rows[0].postcode} ${rows[0].state}`,
                    name: rows[0].name,
                    code: getVenueCode(rows[0].venue_id.toString())
                });
            } else {
                res.sendStatus(500);
            }
        });
    });
});

module.exports = router;