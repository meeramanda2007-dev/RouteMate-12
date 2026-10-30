CREATE DATABASE IF NOT EXISTS routemate;
USE routemate;

CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  full_name VARCHAR(100) NOT NULL,
  email VARCHAR(150) NOT NULL UNIQUE,
  phone VARCHAR(20),
  password_hash VARCHAR(255) NOT NULL,
  bio VARCHAR(500),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS trips (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  start_location VARCHAR(180) NOT NULL,
  destination VARCHAR(180) NOT NULL,
  travel_date DATE NOT NULL,
  departure_time TIME NOT NULL,
  transport VARCHAR(40) NOT NULL,
  seats_available INT NOT NULL DEFAULT 1,
  notes VARCHAR(500),
  status ENUM('open','full','cancelled','completed') DEFAULT 'open',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_trips_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_trip_date_status (travel_date, status)
);

CREATE TABLE IF NOT EXISTS join_requests (
  id INT AUTO_INCREMENT PRIMARY KEY,
  trip_id INT NOT NULL,
  requester_id INT NOT NULL,
  message VARCHAR(500),
  status ENUM('pending','accepted','rejected') DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY unique_trip_request (trip_id, requester_id),
  FOREIGN KEY (trip_id) REFERENCES trips(id) ON DELETE CASCADE,
  FOREIGN KEY (requester_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS messages (
  id INT AUTO_INCREMENT PRIMARY KEY,
  request_id INT NOT NULL,
  sender_id INT NOT NULL,
  message_text TEXT NOT NULL,
  sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (request_id) REFERENCES join_requests(id) ON DELETE CASCADE,
  FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS ratings (
  id INT AUTO_INCREMENT PRIMARY KEY,
  trip_id INT NOT NULL,
  reviewer_id INT NOT NULL,
  reviewee_id INT NOT NULL,
  rating TINYINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment VARCHAR(500),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY unique_trip_review (trip_id, reviewer_id, reviewee_id),
  FOREIGN KEY (trip_id) REFERENCES trips(id) ON DELETE CASCADE,
  FOREIGN KEY (reviewer_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (reviewee_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Useful DBMS demonstration queries:
-- SELECT t.*, u.full_name FROM trips t JOIN users u ON t.user_id=u.id;
-- SELECT status, COUNT(*) FROM join_requests GROUP BY status;
-- UPDATE trips SET seats_available=2 WHERE id=1;
-- DELETE FROM trips WHERE id=1;
