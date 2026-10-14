-- Attendance App - Cumulative Database Schema
-- Database: attendanceApp

USE attendanceApp;

-- ==============================================
-- PHASE 1: System Settings Table
-- ==============================================
CREATE TABLE IF NOT EXISTS `system_settings` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `setting_key` VARCHAR(100) NOT NULL UNIQUE,
  `setting_value` TEXT NULL,
  `description` VARCHAR(255) NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO `system_settings` (`setting_key`, `setting_value`, `description`)
VALUES 
  ('app_name', 'Employee Attendance App', 'Application title'),
  ('api_version', '1.0.0', 'Backend API version'),
  ('system_status', 'active', 'System operating status'),
  ('organization_latitude', '18.517222', 'Organization office GPS latitude'),
  ('organization_longitude', '73.808722', 'Organization office GPS longitude'),
  ('attendance_radius_meters', '10', 'Permitted attendance radius in meters'),
  ('organization_timezone', 'Asia/Kolkata', 'System attendance timezone'),
  ('organization_start_time', '09:00:00', 'Official work shift start time for late calculation (default: 09:00:00)'),
  ('organization_end_time', '18:00:00', 'Official work shift end time for early checkout calculation (default: 18:00:00)')
ON DUPLICATE KEY UPDATE `updated_at` = CURRENT_TIMESTAMP;

-- ==============================================
-- PHASE 2: Employees Table
-- ==============================================
CREATE TABLE IF NOT EXISTS `employees` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `employee_code` VARCHAR(50) NOT NULL UNIQUE,
  `first_name` VARCHAR(100) NOT NULL,
  `last_name` VARCHAR(100) NOT NULL,
  `email` VARCHAR(150) NOT NULL UNIQUE,
  `phone` VARCHAR(20) DEFAULT NULL,
  `password_hash` VARCHAR(255) NOT NULL,
  `department` VARCHAR(100) DEFAULT NULL,
  `designation` VARCHAR(100) DEFAULT NULL,
  `profile_image` VARCHAR(255) DEFAULT NULL,
  `status` ENUM('active', 'inactive') NOT NULL DEFAULT 'active',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_employees_status (`status`),
  INDEX idx_employees_department (`department`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==============================================
-- PHASE 3 & 4: Attendance Table
-- ==============================================
CREATE TABLE IF NOT EXISTS `attendance` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `employee_id` INT NOT NULL,
  `attendance_date` DATE NOT NULL,
  `check_in_time` TIME NOT NULL,
  `check_out_time` TIME DEFAULT NULL,
  `check_in_latitude` DECIMAL(10, 8) NOT NULL,
  `check_in_longitude` DECIMAL(11, 8) NOT NULL,
  `check_in_accuracy` DECIMAL(8, 2) DEFAULT NULL,
  `check_out_latitude` DECIMAL(10, 8) DEFAULT NULL,
  `check_out_longitude` DECIMAL(11, 8) DEFAULT NULL,
  `check_out_accuracy` DECIMAL(8, 2) DEFAULT NULL,
  `working_minutes` INT DEFAULT NULL,
  `status` ENUM('present', 'completed') NOT NULL DEFAULT 'present',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `fk_attendance_employee` FOREIGN KEY (`employee_id`) REFERENCES `employees` (`id`) ON DELETE CASCADE,
  UNIQUE KEY `uk_employee_date` (`employee_id`, `attendance_date`),
  INDEX `idx_attendance_employee` (`employee_id`),
  INDEX `idx_attendance_date` (`attendance_date`),
  INDEX `idx_attendance_status` (`status`),
  INDEX `idx_employee_status` (`employee_id`, `status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==============================================
-- PHASE 5: Leave, Half-Day & Permission Tables
-- ==============================================

-- 1. Leave Types
CREATE TABLE IF NOT EXISTS `leave_types` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `name` VARCHAR(100) NOT NULL,
  `code` VARCHAR(20) NOT NULL UNIQUE,
  `description` VARCHAR(255) NULL,
  `default_days` INT NOT NULL DEFAULT 0,
  `status` ENUM('active', 'inactive') NOT NULL DEFAULT 'active',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_leave_types_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Default Leave Types Seed
INSERT INTO `leave_types` (`name`, `code`, `description`, `default_days`, `status`)
VALUES 
  ('Casual Leave', 'CL', 'Casual leave for personal and emergency matters', 12, 'active'),
  ('Sick Leave', 'SL', 'Sick leave for medical illness and health recovery', 10, 'active'),
  ('Earned Leave', 'EL', 'Earned annual privilege leave', 15, 'active')
ON DUPLICATE KEY UPDATE `name` = VALUES(`name`), `description` = VALUES(`description`), `default_days` = VALUES(`default_days`);

-- 2. Employee Leave Balances
CREATE TABLE IF NOT EXISTS `employee_leave_balances` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `employee_id` INT NOT NULL,
  `leave_type_id` INT NOT NULL,
  `total_days` DECIMAL(5, 1) NOT NULL DEFAULT 0.0,
  `used_days` DECIMAL(5, 1) NOT NULL DEFAULT 0.0,
  `pending_days` DECIMAL(5, 1) NOT NULL DEFAULT 0.0,
  `remaining_days` DECIMAL(5, 1) NOT NULL DEFAULT 0.0,
  `year` INT NOT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `fk_leave_balances_employee` FOREIGN KEY (`employee_id`) REFERENCES `employees` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_leave_balances_type` FOREIGN KEY (`leave_type_id`) REFERENCES `leave_types` (`id`) ON DELETE CASCADE,
  UNIQUE KEY `uk_employee_leave_year` (`employee_id`, `leave_type_id`, `year`),
  INDEX `idx_leave_balances_employee` (`employee_id`),
  INDEX `idx_leave_balances_year` (`year`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. Leave Requests
CREATE TABLE IF NOT EXISTS `leave_requests` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `employee_id` INT NOT NULL,
  `leave_type_id` INT NOT NULL,
  `from_date` DATE NOT NULL,
  `to_date` DATE NOT NULL,
  `total_days` INT NOT NULL,
  `reason` TEXT NOT NULL,
  `status` ENUM('pending', 'approved', 'rejected', 'cancelled') NOT NULL DEFAULT 'pending',
  `applied_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `reviewed_at` TIMESTAMP NULL DEFAULT NULL,
  `reviewed_by` INT NULL DEFAULT NULL,
  `remarks` TEXT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `fk_leave_requests_employee` FOREIGN KEY (`employee_id`) REFERENCES `employees` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_leave_requests_type` FOREIGN KEY (`leave_type_id`) REFERENCES `leave_types` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_leave_requests_reviewer` FOREIGN KEY (`reviewed_by`) REFERENCES `employees` (`id`) ON DELETE SET NULL,
  INDEX `idx_leave_employee` (`employee_id`),
  INDEX `idx_leave_status` (`status`),
  INDEX `idx_leave_dates` (`from_date`, `to_date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. Half Day Requests
CREATE TABLE IF NOT EXISTS `half_day_requests` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `employee_id` INT NOT NULL,
  `request_date` DATE NOT NULL,
  `session` ENUM('first_half', 'second_half') NOT NULL,
  `reason` TEXT NOT NULL,
  `status` ENUM('pending', 'approved', 'rejected', 'cancelled') NOT NULL DEFAULT 'pending',
  `applied_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `reviewed_at` TIMESTAMP NULL DEFAULT NULL,
  `reviewed_by` INT NULL DEFAULT NULL,
  `remarks` TEXT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `fk_half_day_employee` FOREIGN KEY (`employee_id`) REFERENCES `employees` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_half_day_reviewer` FOREIGN KEY (`reviewed_by`) REFERENCES `employees` (`id`) ON DELETE SET NULL,
  INDEX `idx_halfday_employee` (`employee_id`),
  INDEX `idx_halfday_date` (`request_date`),
  INDEX `idx_halfday_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. Permission Requests
CREATE TABLE IF NOT EXISTS `permission_requests` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `employee_id` INT NOT NULL,
  `permission_date` DATE NOT NULL,
  `from_time` TIME NOT NULL,
  `to_time` TIME NOT NULL,
  `total_minutes` INT NOT NULL,
  `reason` TEXT NOT NULL,
  `status` ENUM('pending', 'approved', 'rejected', 'cancelled') NOT NULL DEFAULT 'pending',
  `applied_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `reviewed_at` TIMESTAMP NULL DEFAULT NULL,
  `reviewed_by` INT NULL DEFAULT NULL,
  `remarks` TEXT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `fk_permission_employee` FOREIGN KEY (`employee_id`) REFERENCES `employees` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_permission_reviewer` FOREIGN KEY (`reviewed_by`) REFERENCES `employees` (`id`) ON DELETE SET NULL,
  INDEX `idx_permission_employee` (`employee_id`),
  INDEX `idx_permission_date` (`permission_date`),
  INDEX `idx_permission_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==============================================
-- PHASE 6: Notifications Table
-- ==============================================
CREATE TABLE IF NOT EXISTS `notifications` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `employee_id` INT NOT NULL,
  `title` VARCHAR(150) NOT NULL,
  `message` TEXT NOT NULL,
  `type` VARCHAR(50) NOT NULL DEFAULT 'system',
  `reference_id` VARCHAR(50) NULL,
  `is_read` BOOLEAN NOT NULL DEFAULT FALSE,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `fk_notifications_employee` FOREIGN KEY (`employee_id`) REFERENCES `employees` (`id`) ON DELETE CASCADE,
  INDEX `idx_notifications_employee` (`employee_id`),
  INDEX `idx_notifications_is_read` (`is_read`),
  INDEX `idx_notifications_created_at` (`created_at`),
  INDEX `idx_notifications_type` (`type`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

