const { pool } = require('../config/database');

const seedLeaveData = async () => {
  console.log('--- Seeding Phase 5 Leave Types and Employee Balances ---');

  const connection = await pool.getConnection();

  try {
    // 1. Ensure Leave Types exist
    console.log('1. Ensuring leave types exist...');
    const leaveTypes = [
      { name: 'Casual Leave', code: 'CL', description: 'Casual leave for personal and emergency matters', default_days: 12 },
      { name: 'Sick Leave', code: 'SL', description: 'Sick leave for medical illness and health recovery', default_days: 10 },
      { name: 'Earned Leave', code: 'EL', description: 'Earned annual privilege leave', default_days: 15 }
    ];

    for (const lt of leaveTypes) {
      await connection.query(`
        INSERT INTO leave_types (name, code, description, default_days, status)
        VALUES (?, ?, ?, ?, 'active')
        ON DUPLICATE KEY UPDATE 
          name = VALUES(name),
          description = VALUES(description),
          default_days = VALUES(default_days),
          status = 'active'
      `, [lt.name, lt.code, lt.description, lt.default_days]);
    }

    // 2. Find existing test employee
    console.log('2. Finding existing test employee (employee@example.com)...');
    const [employees] = await connection.query(`
      SELECT id, employee_code, email, first_name, last_name 
      FROM employees 
      WHERE email = 'employee@example.com' OR employee_code = 'EMP001'
      LIMIT 1
    `);

    if (employees.length === 0) {
      throw new Error('Test employee (employee@example.com / EMP001) not found! Run npm run seed:employee first.');
    }

    const testEmployee = employees[0];
    console.log(`Found employee: ${testEmployee.first_name} ${testEmployee.last_name} (ID: ${testEmployee.id}, Code: ${testEmployee.employee_code})`);

    // 3. Fetch all active leave types
    const [dbLeaveTypes] = await connection.query(`
      SELECT id, code, default_days FROM leave_types WHERE status = 'active'
    `);

    // 4. Seed balances for current year (2026)
    const currentYear = new Date().getFullYear(); // e.g. 2026
    console.log(`3. Seeding leave balances for Year ${currentYear}...`);

    for (const lt of dbLeaveTypes) {
      const totalDays = lt.default_days;
      await connection.query(`
        INSERT INTO employee_leave_balances (employee_id, leave_type_id, total_days, used_days, pending_days, remaining_days, year)
        VALUES (?, ?, ?, 0.0, 0.0, ?, ?)
        ON DUPLICATE KEY UPDATE
          total_days = VALUES(total_days),
          remaining_days = VALUES(total_days) - used_days - pending_days
      `, [testEmployee.id, lt.id, totalDays, totalDays, currentYear]);
    }

    // 5. Query and display seeded balances
    const [balances] = await connection.query(`
      SELECT 
        b.id,
        lt.name AS leave_type_name,
        lt.code AS leave_type_code,
        b.total_days,
        b.used_days,
        b.pending_days,
        b.remaining_days,
        b.year
      FROM employee_leave_balances b
      JOIN leave_types lt ON b.leave_type_id = lt.id
      WHERE b.employee_id = ? AND b.year = ?
    `, [testEmployee.id, currentYear]);

    console.log(`\n✅ Leave balances successfully seeded for ${testEmployee.email} (Year ${currentYear}):`);
    console.table(balances);

    return balances;
  } catch (error) {
    console.error('❌ Failed to seed leave data:', error);
    throw error;
  } finally {
    connection.release();
  }
};

if (require.main === module) {
  seedLeaveData()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

module.exports = { seedLeaveData };
