const http = require('http');
const app = require('../app');
const { pool } = require('../config/database');
const { getOrganizationConfig } = require('../services/organizationConfigService');
const { checkIsLate, checkIsEarlyCheckout } = require('../utils/time');

async function runRegressionSuite() {
  console.log('================================================================');
  console.log('   PHASE 4 SHIFT TIMINGS & REGRESSION VERIFICATION SUITE       ');
  console.log('================================================================\n');

  let passedTests = 0;
  let totalTests = 0;

  function assert(condition, message) {
    totalTests++;
    if (condition) {
      console.log(`  [PASS] ${message}`);
      passedTests++;
    } else {
      console.error(`  [FAIL] ${message}`);
      throw new Error(`Assertion failed: ${message}`);
    }
  }

  // -------------------------------------------------------------
  // STEP 1: Verify & Update system_settings table
  // -------------------------------------------------------------
  console.log('STEP 1: Checking & Updating system_settings table in MySQL...');
  await pool.query(`
    UPDATE system_settings 
    SET setting_value = '09:00:00',
        description = 'Official work shift start time for late calculation (default: 09:00:00)'
    WHERE setting_key = 'organization_start_time'
  `);
  await pool.query(`
    UPDATE system_settings 
    SET setting_value = '18:00:00',
        description = 'Official work shift end time for early checkout calculation (default: 18:00:00)'
    WHERE setting_key = 'organization_end_time'
  `);

  const [settings] = await pool.query(`
    SELECT id, setting_key, setting_value, description, updated_at 
    FROM system_settings 
    WHERE setting_key IN ('organization_start_time', 'organization_end_time')
  `);
  
  const startTimeRow = settings.find(s => s.setting_key === 'organization_start_time');
  const endTimeRow = settings.find(s => s.setting_key === 'organization_end_time');

  assert(startTimeRow && startTimeRow.setting_value === '09:00:00', 'system_settings organization_start_time is 09:00:00');
  assert(endTimeRow && endTimeRow.setting_value === '18:00:00', 'system_settings organization_end_time is 18:00:00');

  // -------------------------------------------------------------
  // STEP 2: Verify Dynamic Reading via organizationConfigService
  // -------------------------------------------------------------
  console.log('\nSTEP 2: Verifying dynamic reading via organizationConfigService...');
  const orgConfig = await getOrganizationConfig(true);

  assert(orgConfig.startTime === '09:00:00', `Dynamic config startTime equals '09:00:00' (actual: ${orgConfig.startTime})`);
  assert(orgConfig.endTime === '18:00:00', `Dynamic config endTime equals '18:00:00' (actual: ${orgConfig.endTime})`);
  assert(orgConfig.latitude === 18.517222, `Coordinates unchanged: latitude = 18.517222 (actual: ${orgConfig.latitude})`);
  assert(orgConfig.longitude === 73.808722, `Coordinates unchanged: longitude = 73.808722 (actual: ${orgConfig.longitude})`);
  assert(orgConfig.radiusMeters === 10, `Radius unchanged: 10 meters (actual: ${orgConfig.radiusMeters})`);
  assert(orgConfig.timezone === 'Asia/Kolkata', `Timezone unchanged: Asia/Kolkata (actual: ${orgConfig.timezone})`);

  // -------------------------------------------------------------
  // STEP 3: Verify Late Calculation (checkIsLate)
  // -------------------------------------------------------------
  console.log('\nSTEP 3: Verifying Late Calculation (check-in vs 09:00:00)...');
  // At or before 09:00:00 -> false
  assert(checkIsLate('08:50:00', orgConfig.startTime) === false, 'Check-in at 08:50:00 before 09:00:00 -> isLate = false');
  assert(checkIsLate('08:59:59', orgConfig.startTime) === false, 'Check-in at 08:59:59 before 09:00:00 -> isLate = false');
  assert(checkIsLate('09:00:00', orgConfig.startTime) === false, 'Check-in at 09:00:00 exact -> isLate = false');

  // After 09:00:00 -> true
  assert(checkIsLate('09:00:01', orgConfig.startTime) === true, 'Check-in at 09:00:01 after 09:00:00 -> isLate = true');
  assert(checkIsLate('09:01:00', orgConfig.startTime) === true, 'Check-in at 09:01:00 after 09:00:00 -> isLate = true');
  assert(checkIsLate('09:15:00', orgConfig.startTime) === true, 'Check-in at 09:15:00 after 09:00:00 -> isLate = true');

  // -------------------------------------------------------------
  // STEP 4: Verify Early Checkout Calculation (checkIsEarlyCheckout)
  // -------------------------------------------------------------
  console.log('\nSTEP 4: Verifying Early Checkout Calculation (check-out vs 18:00:00)...');
  // Before 18:00:00 -> true
  assert(checkIsEarlyCheckout('17:45:00', orgConfig.endTime) === true, 'Check-out at 17:45:00 before 18:00:00 -> isEarlyCheckout = true');
  assert(checkIsEarlyCheckout('17:59:59', orgConfig.endTime) === true, 'Check-out at 17:59:59 before 18:00:00 -> isEarlyCheckout = true');

  // At or after 18:00:00 -> false
  assert(checkIsEarlyCheckout('18:00:00', orgConfig.endTime) === false, 'Check-out at 18:00:00 exact -> isEarlyCheckout = false');
  assert(checkIsEarlyCheckout('18:00:01', orgConfig.endTime) === false, 'Check-out at 18:00:01 after 18:00:00 -> isEarlyCheckout = false');
  assert(checkIsEarlyCheckout('18:30:00', orgConfig.endTime) === false, 'Check-out at 18:30:00 after 18:00:00 -> isEarlyCheckout = false');

  // -------------------------------------------------------------
  // STEP 5: Verify Dynamic Config Changability (Admin Portal Proof)
  // -------------------------------------------------------------
  console.log('\nSTEP 5: Verifying Dynamic Reconfigurability (Admin Portal scenario)...');
  // Temporarily update DB to 10:00:00 and 19:00:00
  await pool.query("UPDATE system_settings SET setting_value = '10:00:00' WHERE setting_key = 'organization_start_time'");
  await pool.query("UPDATE system_settings SET setting_value = '19:00:00' WHERE setting_key = 'organization_end_time'");
  
  const testModifiedConfig = await getOrganizationConfig(true);
  assert(testModifiedConfig.startTime === '10:00:00', 'Dynamically read modified startTime: 10:00:00');
  assert(testModifiedConfig.endTime === '19:00:00', 'Dynamically read modified endTime: 19:00:00');
  assert(checkIsLate('09:15:00', testModifiedConfig.startTime) === false, 'Check-in 09:15 with 10:00 shift -> isLate = false');
  assert(checkIsEarlyCheckout('18:15:00', testModifiedConfig.endTime) === true, 'Checkout 18:15 with 19:00 shift -> isEarlyCheckout = true');

  // Restore back to 09:00:00 and 18:00:00
  await pool.query("UPDATE system_settings SET setting_value = '09:00:00' WHERE setting_key = 'organization_start_time'");
  await pool.query("UPDATE system_settings SET setting_value = '18:00:00' WHERE setting_key = 'organization_end_time'");
  const restoredConfig = await getOrganizationConfig(true);
  assert(restoredConfig.startTime === '09:00:00', 'Restored startTime: 09:00:00');
  assert(restoredConfig.endTime === '18:00:00', 'Restored endTime: 18:00:00');

  // -------------------------------------------------------------
  // STEP 6: Run Full API Regression Tests on Endpoints
  // -------------------------------------------------------------
  console.log('\nSTEP 6: Starting test HTTP server for API regression tests...');
  const TEST_PORT = 5055;
  const server = http.createServer(app);

  await new Promise((resolve) => server.listen(TEST_PORT, '127.0.0.1', resolve));
  const baseUrl = `http://127.0.0.1:${TEST_PORT}`;

  try {
    // 6.1: Health Endpoint
    console.log('\n--- 6.1: Testing GET /api/v1/health ---');
    const healthRes = await fetch(`${baseUrl}/api/v1/health`);
    assert(healthRes.status === 200, `Health check status is 200 (actual: ${healthRes.status})`);
    const healthJson = await healthRes.json();
    assert(healthJson.success === true, 'Health check response success is true');
    assert(healthJson.data.database === 'connected', 'Database connection status is connected');

    // 6.2: Authentication Endpoint
    console.log('\n--- 6.2: Testing POST /api/v1/auth/login ---');
    const loginRes = await fetch(`${baseUrl}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'employee@example.com',
        password: 'password123'
      })
    });
    assert(loginRes.status === 200, `Login status is 200 (actual: ${loginRes.status})`);
    const loginJson = await loginRes.json();
    assert(loginJson.success === true, 'Login response success is true');
    assert(Boolean(loginJson.data.token), 'JWT token returned successfully');
    assert(loginJson.data.employee.email === 'employee@example.com', 'Employee email matches');
    const token = loginJson.data.token;
    const authHeaders = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    };

    // 6.3: Today's Attendance Endpoint
    console.log('\n--- 6.3: Testing GET /api/v1/attendance/today ---');
    const todayRes = await fetch(`${baseUrl}/api/v1/attendance/today`, {
      headers: authHeaders
    });
    assert(todayRes.status === 200, `Today attendance status is 200 (actual: ${todayRes.status})`);
    const todayJson = await todayRes.json();
    assert(todayJson.success === true, 'Today attendance response success is true');
    assert(todayJson.data.organization.startTime === '09:00:00', 'Today API reports organization.startTime = 09:00:00');
    assert(todayJson.data.organization.endTime === '18:00:00', 'Today API reports organization.endTime = 18:00:00');
    assert(todayJson.data.organization.latitude === 18.517222, 'Today API reports organization.latitude = 18.517222');
    assert(todayJson.data.organization.longitude === 73.808722, 'Today API reports organization.longitude = 73.808722');
    assert(todayJson.data.organization.radiusMeters === 10, 'Today API reports organization.radiusMeters = 10');

    // 6.4: Attendance History Endpoint
    console.log('\n--- 6.4: Testing GET /api/v1/attendance/history ---');
    const historyRes = await fetch(`${baseUrl}/api/v1/attendance/history?limit=10`, {
      headers: authHeaders
    });
    assert(historyRes.status === 200, `History status is 200 (actual: ${historyRes.status})`);
    const historyJson = await historyRes.json();
    assert(historyJson.success === true, 'History response success is true');
    assert(Array.isArray(historyJson.data.records), 'History returns an array of records');
    assert(Boolean(historyJson.data.pagination), 'History returns pagination information');
    if (historyJson.data.records.length > 0) {
      const sample = historyJson.data.records[0];
      assert('isLate' in sample, 'History record contains isLate field');
      assert('isEarlyCheckout' in sample, 'History record contains isEarlyCheckout field');
      assert('workingHoursFormatted' in sample, 'History record contains workingHoursFormatted');
    }

    // 6.5: Monthly Attendance Endpoint
    console.log('\n--- 6.5: Testing GET /api/v1/attendance/monthly ---');
    const monthlyRes = await fetch(`${baseUrl}/api/v1/attendance/monthly?year=2026&month=10`, {
      headers: authHeaders
    });
    assert(monthlyRes.status === 200, `Monthly attendance status is 200 (actual: ${monthlyRes.status})`);
    const monthlyJson = await monthlyRes.json();
    assert(monthlyJson.success === true, 'Monthly attendance response success is true');
    assert(Array.isArray(monthlyJson.data.records), 'Monthly returns records array');
    assert(monthlyJson.data.summary !== undefined, 'Monthly returns summary object');
    assert(typeof monthlyJson.data.summary.lateDays === 'number', 'Summary contains numeric lateDays');
    assert(typeof monthlyJson.data.summary.earlyCheckoutDays === 'number', 'Summary contains numeric earlyCheckoutDays');

    // 6.6: Attendance Summary Endpoint
    console.log('\n--- 6.6: Testing GET /api/v1/attendance/summary ---');
    const summaryRes = await fetch(`${baseUrl}/api/v1/attendance/summary`, {
      headers: authHeaders
    });
    assert(summaryRes.status === 200, `Summary status is 200 (actual: ${summaryRes.status})`);
    const summaryJson = await summaryRes.json();
    assert(summaryJson.success === true, 'Summary response success is true');
    assert(typeof summaryJson.data.summary.lateCount === 'number', 'Summary data has lateCount number');
    assert(typeof summaryJson.data.summary.earlyCheckoutCount === 'number', 'Summary data has earlyCheckoutCount number');
    assert(typeof summaryJson.data.summary.totalWorkingMinutes === 'number', 'Summary data has totalWorkingMinutes');
    assert(typeof summaryJson.data.summary.averageWorkingMinutes === 'number', 'Summary data has averageWorkingMinutes');

  } finally {
    server.close();
  }

  // -------------------------------------------------------------
  // STEP 7: Report Exact Values in system_settings
  // -------------------------------------------------------------
  console.log('\n================================================================');
  console.log('   CURRENT EXACT VALUES IN MySQL system_settings TABLE          ');
  console.log('================================================================');
  const [allSettings] = await pool.query(`
    SELECT id, setting_key, setting_value, description, updated_at 
    FROM system_settings 
    ORDER BY id ASC
  `);
  console.table(allSettings);

  console.log(`\nAll ${totalTests} tests PASSED successfully!`);
}

runRegressionSuite()
  .then(() => {
    process.exit(0);
  })
  .catch((err) => {
    console.error('\nVerification failed:', err);
    process.exit(1);
  });
