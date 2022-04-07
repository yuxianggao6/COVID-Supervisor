-- Select user details on login:
SELECT * FROM user WHERE email = ?;

-- Get details of venue owned by current user:
SELECT * FROM venue WHERE owner = ?;

-- Add new user to database (on account registration):
INSERT INTO user (given_name, family_name, email, phone, password_hash, account_type)
VALUES (?, ?, ?, ?, ?, ?);

-- Check if user should be registered as a health official:
SELECT * FROM pending_admin WHERE email = ?;
DELETE FROM pending_admin WHERE email = ?; -- Delete once user is registered.

-- Create new venue (when venue owner creates account):
INSERT INTO venue (name, owner, latitude, longitude, state, city, postcode, street_name, street_number)
VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);

-- Create reset password request for user:
INSERT INTO password_reset (user, code_hash)
VALUES (?, ?)
ON DUPLICATE KEY UPDATE user = ?, code_hash = ?;

-- Ensure that user password reset request has not expired:
SELECT * FROM password_reset INNER JOIN user
ON password_reset.user = user.user_id
WHERE email = ? AND DATE_ADD(expiry, INTERVAL 1 HOUR) > NOW();

-- Apply user password change:
UPDATE user SET password_hash = ? WHERE user_id = ?;
DELETE FROM password_reset WHERE user = ?;

-- Check-in user to venue:
INSERT INTO check_in (user, venue) VALUES (?, ?);

-- Get details about last user check-in:
SELECT timestamp, name, state, city, postcode, street_name, street_number FROM check_in INNER JOIN venue
ON venue_id = venue WHERE check_in_id = ?;

-- Get hotspot areas:
SELECT * FROM city INNER JOIN hotspot_area
ON city.city_id = hotspot_area.city;

-- Get hotspot venues:
SELECT hotspot_id, name,
CONCAT(street_number, ' ', street_name, ', ', city, ' ', postcode, ' ', state) AS address,
start_time AS start, end_time AS end, latitude, longitude
FROM hotspot_venue INNER JOIN venue
ON hotspot_venue.venue = venue.venue_id;

-- Check if user has been to an active hotspot venue:
SELECT * FROM hotspot_venue INNER JOIN check_in ON
hotspot_venue.venue = check_in.venue
WHERE user = ?
AND check_in.timestamp > hotspot_venue.start_time
AND check_in.timestamp < hotspot_venue.end_time;

-- Get check-in history for current user:
SELECT name, CONCAT(street_number, ' ', street_name, ', ', city, ' ', postcode, ' ', state) AS address,
DATE(timestamp) AS date, TIME(timestamp) AS time
FROM check_in INNER JOIN venue
ON venue = venue_id
WHERE user = ?;

-- Get account details for current user:
SELECT given_name AS givenName, family_name AS familyName, email, phone, account_type AS accountType
FROM user WHERE user_id = ?;

-- Update user account details:
UPDATE user
SET given_name = ?, family_name = ?, email = ?, phone = ?
WHERE user_id = ?;

-- Update user account password:
UPDATE user SET password_hash = ? WHERE user_id = ?;

-- Get check-in history for a venue:
SELECT given_name AS givenName, family_name AS familyName,
DATE(timestamp) AS date, TIME(timestamp) AS time
FROM check_in INNER JOIN user
ON check_in.user = user.user_id
WHERE venue = ?
ORDER BY timestamp DESC;

-- Get venue details:
SELECT * FROM venue WHERE venue_id = ?;

-- Update venue details:
UPDATE venue
SET name = ?,
    street_number = ?,
    street_name = ?,
    city = ?,
    postcode = ?,
    state = ?,
    latitude = ?,
    longitude = ?
WHERE venue_id = ?;

-- Get pending health official email addresses:
SELECT email FROM pending_admin;

-- Add an email address and corresponding code for a new health official:
INSERT INTO pending_admin (email, code_hash) VALUES (?, ?);

-- Revoke pending health official registration:
DELETE FROM pending_admin WHERE email = ?;

-- Search for users:
-- By given name:
SELECT user_id, given_name AS givenName, family_name AS familyName, email, phone FROM user
WHERE given_name LIKE CONCAT('%', ?, '%') LIMIT ?, ?;

-- By family name:
SELECT user_id, given_name AS givenName, family_name AS familyName, email, phone FROM user
WHERE family_name LIKE CONCAT('%', ?, '%') LIMIT ?, ?;";

-- By phone number:
SELECT user_id, given_name AS givenName, family_name AS familyName, email, phone FROM user
WHERE phone LIKE CONCAT('%', ?, '%') LIMIT ?, ?;

-- By email address:
SELECT user_id, given_name AS givenName, family_name AS familyName, email, phone FROM user
WHERE email LIKE CONCAT('%', ?, '%') LIMIT ?, ?;

-- Search for venues:
-- By venue name:
SELECT venue_id, name, street_name AS streetName, street_number AS streetNo, city, postcode, state, owner FROM venue
WHERE name LIKE CONCAT('%', ?, '%') LIMIT ?, ?;

-- By street name:
SELECT venue_id, name, street_name AS streetName, street_number AS streetNo, city, postcode, state, owner FROM venue
WHERE street_name LIKE CONCAT('%', ?, '%') LIMIT ?, ?;

-- By city/suburb:
SELECT venue_id, name, street_name AS streetName, street_number AS streetNo, city, postcode, state, owner FROM venue
WHERE city LIKE CONCAT('%', ?, '%') LIMIT ?, ?;

-- By postcode:
SELECT venue_id, name, street_name AS streetName, street_number AS streetNo, city, postcode, state, owner FROM venue
WHERE postcode = ? LIMIT ?, ?;

-- By state:
SELECT venue_id, name, street_name AS streetName, street_number AS streetNo, city, postcode, state, owner FROM venue
WHERE state = ? LIMIT ?, ?;

-- Get owner of a venue:
SELECT owner FROM venue WHERE venue_id = ?;

-- Delete hotspot area:
DELETE FROM hotspot_area WHERE hotspot_id = ?;

-- Delete hotspot venue:
DELETE FROM hotspot_venue WHERE hotspot_id = ?;

-- Create hotspot venue:
INSERT INTO hotspot_venue (venue, start_time, end_time) VALUES (?, ?, ?);

-- Create hotspot area:
SELECT city_id FROM city WHERE name = ? AND state = ?; -- Get city id from name
INSERT INTO hotspot_area (city, start_time, end_time) VALUES (?, ?, ?);

-- Update hotspot declaration timeframe:
UPDATE hotspot_venue
SET start_time = ?, end_time = ?
WHERE hotspot_id = ?;

-- Search for hotspot area by name:
SELECT hotspot_id,
    name,
    CONCAT(street_number, ' ', street_name, ', ', city, ' ', postcode, ' ', state) AS address,
    DATE(start_time) AS start_date,
    TIME(start_time) AS start_time,
    DATE(end_time) AS end_date,
    TIME(end_time) AS end_time
FROM hotspot_venue INNER JOIN venue
ON hotspot_venue.venue = venue.venue_id
WHERE name LIKE CONCAT('%', ?, '%')
LIMIT ?, ?;