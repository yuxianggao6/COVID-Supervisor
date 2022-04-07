CREATE TABLE user
(
  user_id INT AUTO_INCREMENT,
  given_name VARCHAR(50) NOT NULL,
  family_name VARCHAR(50) NOT NULL,
  email VARCHAR(100) NOT NULL UNIQUE,
  phone VARCHAR(16) NOT NULL,
  password_hash VARCHAR(128) NOT NULL,
  account_type VARCHAR(16) NOT NULL,
  PRIMARY KEY (user_id)
);

CREATE TABLE venue
(
  venue_id INT AUTO_INCREMENT,
  name VARCHAR(100) NOT NULL,
  owner INT,
  latitude FLOAT NOT NULL,
  longitude FLOAT NOT NULL,
  state VARCHAR(3) NOT NULL,
  city VARCHAR(50) NOT NULL,
  postcode INT NOT NULL,
  street_name VARCHAR(50) NOT NULL,
  street_number VARCHAR(20) NOT NULL,
  PRIMARY KEY (venue_id),
  FOREIGN KEY (owner) REFERENCES user(user_id) ON DELETE SET NULL,
  CONSTRAINT latitude_check CHECK (latitude <= 90 AND latitude >= -90),
  CONSTRAINT longitude_check CHECK (longitude <= 180 AND longitude >= -180)
);

CREATE TABLE check_in
(
  check_in_id INT AUTO_INCREMENT,
  user INT NOT NULL,
  venue INT NOT NULL,
  timestamp DATETIME DEFAULT NOW(),
  PRIMARY KEY (check_in_id),
  FOREIGN KEY (user) REFERENCES user(user_id) ON DELETE NO ACTION,
  FOREIGN KEY (venue) REFERENCES venue(venue_id) ON DELETE NO ACTION
);

CREATE TABLE city
(
  city_id INT AUTO_INCREMENT,
  state VARCHAR(3) NOT NULL,
  name VARCHAR(64) NOT NULL,
  polygon JSON,
  PRIMARY KEY (city_id)
);

CREATE TABLE hotspot_area
(
  hotspot_id INT AUTO_INCREMENT,
  start_time DATETIME NOT NULL,
  end_time DATETIME NOT NULL,
  city INT NOT NULL,
  PRIMARY KEY (hotspot_id),
  FOREIGN KEY (city) REFERENCES city(city_id) ON DELETE CASCADE,
  CONSTRAINT area_timeframe_check CHECK (start_time < end_time)
);

CREATE TABLE hotspot_venue
(
  hotspot_id INT AUTO_INCREMENT,
  venue INT NOT NULL,
  start_time DATETIME NOT NULL,
  end_time DATETIME NOT NULL,
  PRIMARY KEY (hotspot_id),
  FOREIGN KEY (venue) REFERENCES venue(venue_id) ON DELETE CASCADE,
  CONSTRAINT venue_timeframe_check CHECK (start_time < end_time)
);

CREATE TABLE pending_admin
(
  email VARCHAR(100),
  code_hash VARCHAR(128),
  PRIMARY KEY (email)
);

CREATE TABLE password_reset
(
  user INT,
  code_hash VARCHAR(128),
  expiry DATETIME DEFAULT NOW() ON UPDATE NOW(),
  PRIMARY KEY (user),
  FOREIGN KEY (user) REFERENCES user(user_id) ON DELETE CASCADE
);