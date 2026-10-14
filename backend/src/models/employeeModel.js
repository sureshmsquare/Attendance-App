const { pool } = require('../config/database');

/**
 * Remove sensitive fields like password_hash from employee object
 */
const sanitizeEmployee = (employee) => {
  if (!employee) return null;
  const { password_hash, ...sanitized } = employee;
  return sanitized;
};

/**
 * Find employee by email (includes password_hash for authentication)
 */
const findByEmailWithPassword = async (email) => {
  const query = `
    SELECT id, employee_code, first_name, last_name, email, phone, 
           password_hash, department, designation, profile_image, status, 
           created_at, updated_at
    FROM employees
    WHERE LOWER(email) = LOWER(?)
    LIMIT 1
  `;
  const [rows] = await pool.query(query, [email.trim()]);
  return rows.length > 0 ? rows[0] : null;
};

/**
 * Find employee by ID (sanitized)
 */
const findById = async (id) => {
  const query = `
    SELECT id, employee_code, first_name, last_name, email, phone, 
           department, designation, profile_image, status, created_at, updated_at
    FROM employees
    WHERE id = ?
    LIMIT 1
  `;
  const [rows] = await pool.query(query, [id]);
  return rows.length > 0 ? rows[0] : null;
};

/**
 * Find employee by employee_code
 */
const findByEmployeeCode = async (employeeCode) => {
  const query = `
    SELECT id, employee_code, first_name, last_name, email, phone, 
           department, designation, profile_image, status, created_at, updated_at
    FROM employees
    WHERE employee_code = ?
    LIMIT 1
  `;
  const [rows] = await pool.query(query, [employeeCode.trim()]);
  return rows.length > 0 ? rows[0] : null;
};

/**
 * Create a new employee
 */
const createEmployee = async ({
  employee_code,
  first_name,
  last_name,
  email,
  phone = null,
  password_hash,
  department = null,
  designation = null,
  profile_image = null,
  status = 'active'
}) => {
  const query = `
    INSERT INTO employees (
      employee_code, first_name, last_name, email, phone,
      password_hash, department, designation, profile_image, status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;
  const [result] = await pool.query(query, [
    employee_code.trim(),
    first_name.trim(),
    last_name.trim(),
    email.trim().toLowerCase(),
    phone ? phone.trim() : null,
    password_hash,
    department ? department.trim() : null,
    designation ? designation.trim() : null,
    profile_image ? profile_image.trim() : null,
    status
  ]);

  return findById(result.insertId);
};

/**
 * Update allowed profile fields for an employee
 * Employees cannot update employee_code, email, password, or status
 */
const updateProfile = async (id, { first_name, last_name, phone, profile_image }) => {
  const fields = [];
  const values = [];

  if (first_name !== undefined) {
    fields.push('first_name = ?');
    values.push(first_name.trim());
  }
  if (last_name !== undefined) {
    fields.push('last_name = ?');
    values.push(last_name.trim());
  }
  if (phone !== undefined) {
    fields.push('phone = ?');
    values.push(phone ? phone.trim() : null);
  }
  if (profile_image !== undefined) {
    fields.push('profile_image = ?');
    values.push(profile_image ? profile_image.trim() : null);
  }

  if (fields.length === 0) {
    return findById(id);
  }

  values.push(id);
  const query = `UPDATE employees SET ${fields.join(', ')} WHERE id = ?`;
  await pool.query(query, values);

  return findById(id);
};

module.exports = {
  sanitizeEmployee,
  findByEmailWithPassword,
  findById,
  findByEmployeeCode,
  createEmployee,
  updateProfile
};
