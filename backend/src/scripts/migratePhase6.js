const { pool } = require('../config/database');

const migratePhase6 = async () => {
  console.log('--- Migrating Phase 6 Notifications Table to MySQL Database: attendanceApp ---');

  const connection = await pool.getConnection();

  try {
    console.log('Creating notifications table...');
    await connection.query(`
      CREATE TABLE IF NOT EXISTS \`notifications\` (
        \`id\` INT AUTO_INCREMENT PRIMARY KEY,
        \`employee_id\` INT NOT NULL,
        \`title\` VARCHAR(150) NOT NULL,
        \`message\` TEXT NOT NULL,
        \`type\` VARCHAR(50) NOT NULL DEFAULT 'system',
        \`reference_id\` VARCHAR(50) NULL,
        \`is_read\` BOOLEAN NOT NULL DEFAULT FALSE,
        \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        \`updated_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        CONSTRAINT \`fk_notifications_employee\` FOREIGN KEY (\`employee_id\`) REFERENCES \`employees\` (\`id\`) ON DELETE CASCADE,
        INDEX \`idx_notifications_employee\` (\`employee_id\`),
        INDEX \`idx_notifications_is_read\` (\`is_read\`),
        INDEX \`idx_notifications_created_at\` (\`created_at\`),
        INDEX \`idx_notifications_type\` (\`type\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    console.log('✅ Phase 6 notifications table migrated successfully!');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    connection.release();
  }
};

if (require.main === module) {
  migratePhase6()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

module.exports = { migratePhase6 };
