require('dotenv').config();
const bcrypt = require('bcryptjs');
const { pool } = require('../config/database');
const { findByEmailWithPassword, findByEmployeeCode, createEmployee } = require('../models/employeeModel');

const DEFAULT_EMPLOYEE = {
  employee_code: 'EMP001',
  first_name: 'Alex',
  last_name: 'Johnson',
  email: 'employee@example.com',
  phone: '+1 555-0142',
  password: 'password123',
  department: 'Engineering',
  designation: 'Software Engineer',
  status: 'active'
};

const seedEmployee = async () => {
  try {
    console.log('--- Starting Development Employee Seeder ---');

    const existingByEmail = await findByEmailWithPassword(DEFAULT_EMPLOYEE.email);
    if (existingByEmail) {
      console.log(`[Seed] Test employee with email "${DEFAULT_EMPLOYEE.email}" already exists (ID: ${existingByEmail.id}).`);
      console.log('Credentials:');
      console.log(`  Email    : ${DEFAULT_EMPLOYEE.email}`);
      console.log(`  Password : ${DEFAULT_EMPLOYEE.password}`);
      console.log(`  Code     : ${existingByEmail.employee_code}`);
      return;
    }

    const existingByCode = await findByEmployeeCode(DEFAULT_EMPLOYEE.employee_code);
    if (existingByCode) {
      console.log(`[Seed] Test employee with code "${DEFAULT_EMPLOYEE.employee_code}" already exists.`);
      return;
    }

    // Hash password
    const saltRounds = 10;
    const password_hash = await bcrypt.hash(DEFAULT_EMPLOYEE.password, saltRounds);

    const created = await createEmployee({
      employee_code: DEFAULT_EMPLOYEE.employee_code,
      first_name: DEFAULT_EMPLOYEE.first_name,
      last_name: DEFAULT_EMPLOYEE.last_name,
      email: DEFAULT_EMPLOYEE.email,
      phone: DEFAULT_EMPLOYEE.phone,
      password_hash,
      department: DEFAULT_EMPLOYEE.department,
      designation: DEFAULT_EMPLOYEE.designation,
      status: DEFAULT_EMPLOYEE.status
    });

    console.log('[Seed] Successfully created test employee:');
    console.log(`  ID         : ${created.id}`);
    console.log(`  Name       : ${created.first_name} ${created.last_name}`);
    console.log(`  Email      : ${created.email}`);
    console.log(`  Password   : ${DEFAULT_EMPLOYEE.password}`);
    console.log(`  Code       : ${created.employee_code}`);
    console.log(`  Department : ${created.department}`);
    console.log(`  Designation: ${created.designation}`);
    console.log(`  Status     : ${created.status}`);
  } catch (error) {
    console.error('[Seed Error] Failed to seed employee:', error);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
};

seedEmployee();
