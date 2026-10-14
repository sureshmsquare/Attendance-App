const { pool } = require('../config/database');

const migratePhase5 = async () => {
  console.log('--- Migrating Phase 5 Tables to MySQL Database: attendanceApp ---');

  const connection = await pool.getConnection();

  try {
    // 1. Leave Types
    console.log('1. Creating leave_types table...');
    await connection.query(`
      CREATE TABLE IF NOT EXISTS \`leave_types\` (
        \`id\` INT AUTO_INCREMENT PRIMARY KEY,
        \`name\` VARCHAR(100) NOT NULL,
        \`code\` VARCHAR(20) NOT NULL UNIQUE,
        \`description\` VARCHAR(255) NULL,
        \`default_days\` INT NOT NULL DEFAULT 0,
        \`status\` ENUM('active', 'inactive') NOT NULL DEFAULT 'active',
        \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        \`updated_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX \`idx_leave_types_status\` (\`status\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // Insert Default Leave Types
    console.log('Seeding default leave types (CL, SL, EL)...');
    await connection.query(`
      INSERT INTO \`leave_types\` (\`name\`, \`code\`, \`description\`, \`default_days\`, \`status\`)
      VALUES 
        ('Casual Leave', 'CL', 'Casual leave for personal and emergency matters', 12, 'active'),
        ('Sick Leave', 'SL', 'Sick leave for medical illness and health recovery', 10, 'active'),
        ('Earned Leave', 'EL', 'Earned annual privilege leave', 15, 'active')
      ON DUPLICATE KEY UPDATE 
        \`name\` = VALUES(\`name\`), 
        \`description\` = VALUES(\`description\`), 
        \`default_days\` = VALUES(\`default_days\`);
    `);

    // 2. Employee Leave Balances
    console.log('2. Creating employee_leave_balances table...');
    await connection.query(`
      CREATE TABLE IF NOT EXISTS \`employee_leave_balances\` (
        \`id\` INT AUTO_INCREMENT PRIMARY KEY,
        \`employee_id\` INT NOT NULL,
        \`leave_type_id\` INT NOT NULL,
        \`total_days\` DECIMAL(5, 1) NOT NULL DEFAULT 0.0,
        \`used_days\` DECIMAL(5, 1) NOT NULL DEFAULT 0.0,
        \`pending_days\` DECIMAL(5, 1) NOT NULL DEFAULT 0.0,
        \`remaining_days\` DECIMAL(5, 1) NOT NULL DEFAULT 0.0,
        \`year\` INT NOT NULL,
        \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        \`updated_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        CONSTRAINT \`fk_leave_balances_employee\` FOREIGN KEY (\`employee_id\`) REFERENCES \`employees\` (\`id\`) ON DELETE CASCADE,
        CONSTRAINT \`fk_leave_balances_type\` FOREIGN KEY (\`leave_type_id\`) REFERENCES \`leave_types\` (\`id\`) ON DELETE CASCADE,
        UNIQUE KEY \`uk_employee_leave_year\` (\`employee_id\`, \`leave_type_id\`, \`year\`),
        INDEX \`idx_leave_balances_employee\` (\`employee_id\`),
        INDEX \`idx_leave_balances_year\` (\`year\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 3. Leave Requests
    console.log('3. Creating leave_requests table...');
    await connection.query(`
      CREATE TABLE IF NOT EXISTS \`leave_requests\` (
        \`id\` INT AUTO_INCREMENT PRIMARY KEY,
        \`employee_id\` INT NOT NULL,
        \`leave_type_id\` INT NOT NULL,
        \`from_date\` DATE NOT NULL,
        \`to_date\` DATE NOT NULL,
        \`total_days\` INT NOT NULL,
        \`reason\` TEXT NOT NULL,
        \`status\` ENUM('pending', 'approved', 'rejected', 'cancelled') NOT NULL DEFAULT 'pending',
        \`applied_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        \`reviewed_at\` TIMESTAMP NULL DEFAULT NULL,
        \`reviewed_by\` INT NULL DEFAULT NULL,
        \`remarks\` TEXT NULL,
        \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        \`updated_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        CONSTRAINT \`fk_leave_requests_employee\` FOREIGN KEY (\`employee_id\`) REFERENCES \`employees\` (\`id\`) ON DELETE CASCADE,
        CONSTRAINT \`fk_leave_requests_type\` FOREIGN KEY (\`leave_type_id\`) REFERENCES \`leave_types\` (\`id\`) ON DELETE CASCADE,
        CONSTRAINT \`fk_leave_requests_reviewer\` FOREIGN KEY (\`reviewed_by\`) REFERENCES \`employees\` (\`id\`) ON DELETE SET NULL,
        INDEX \`idx_leave_employee\` (\`employee_id\`),
        INDEX \`idx_leave_status\` (\`status\`),
        INDEX \`idx_leave_dates\` (\`from_date\`, \`to_date\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 4. Half Day Requests
    console.log('4. Creating half_day_requests table...');
    await connection.query(`
      CREATE TABLE IF NOT EXISTS \`half_day_requests\` (
        \`id\` INT AUTO_INCREMENT PRIMARY KEY,
        \`employee_id\` INT NOT NULL,
        \`request_date\` DATE NOT NULL,
        \`session\` ENUM('first_half', 'second_half') NOT NULL,
        \`reason\` TEXT NOT NULL,
        \`status\` ENUM('pending', 'approved', 'rejected', 'cancelled') NOT NULL DEFAULT 'pending',
        \`applied_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        \`reviewed_at\` TIMESTAMP NULL DEFAULT NULL,
        \`reviewed_by\` INT NULL DEFAULT NULL,
        \`remarks\` TEXT NULL,
        \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        \`updated_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        CONSTRAINT \`fk_half_day_employee\` FOREIGN KEY (\`employee_id\`) REFERENCES \`employees\` (\`id\`) ON DELETE CASCADE,
        CONSTRAINT \`fk_half_day_reviewer\` FOREIGN KEY (\`reviewed_by\`) REFERENCES \`employees\` (\`id\`) ON DELETE SET NULL,
        INDEX \`idx_halfday_employee\` (\`employee_id\`),
        INDEX \`idx_halfday_date\` (\`request_date\`),
        INDEX \`idx_halfday_status\` (\`status\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 5. Permission Requests
    console.log('5. Creating permission_requests table...');
    await connection.query(`
      CREATE TABLE IF NOT EXISTS \`permission_requests\` (
        \`id\` INT AUTO_INCREMENT PRIMARY KEY,
        \`employee_id\` INT NOT NULL,
        \`permission_date\` DATE NOT NULL,
        \`from_time\` TIME NOT NULL,
        \`to_time\` TIME NOT NULL,
        \`total_minutes\` INT NOT NULL,
        \`reason\` TEXT NOT NULL,
        \`status\` ENUM('pending', 'approved', 'rejected', 'cancelled') NOT NULL DEFAULT 'pending',
        \`applied_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        \`reviewed_at\` TIMESTAMP NULL DEFAULT NULL,
        \`reviewed_by\` INT NULL DEFAULT NULL,
        \`remarks\` TEXT NULL,
        \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        \`updated_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        CONSTRAINT \`fk_permission_employee\` FOREIGN KEY (\`employee_id\`) REFERENCES \`employees\` (\`id\`) ON DELETE CASCADE,
        CONSTRAINT \`fk_permission_reviewer\` FOREIGN KEY (\`reviewed_by\`) REFERENCES \`employees\` (\`id\`) ON DELETE SET NULL,
        INDEX \`idx_permission_employee\` (\`employee_id\`),
        INDEX \`idx_permission_date\` (\`permission_date\`),
        INDEX \`idx_permission_status\` (\`status\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    console.log('✅ Phase 5 tables migrated successfully!');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    connection.release();
  }
};

if (require.main === module) {
  migratePhase5()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

module.exports = { migratePhase5 };
