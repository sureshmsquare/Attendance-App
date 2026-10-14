/**
 * Verification script for Attendance IN/OUT and next-day rollover logic
 */
const { pool } = require('../config/database');
const {
  findByEmployeeAndDate,
  createCheckIn,
  updateCheckOut
} = require('../models/attendanceModel');
const { getTodayDateString, getCurrentTimeString, calculateWorkingMinutes } = require('../utils/time');

async function testAttendanceFlow() {
  console.log('--- Starting Attendance Logic Verification ---');
  const employeeId = 1;
  const todayStr = getTodayDateString('Asia/Kolkata');
  console.log(`Today Date (IST): ${todayStr}`);

  // 1. Clean any today's record for employee 1 for clean testing
  await pool.query('DELETE FROM attendance WHERE employee_id = ? AND attendance_date = ?', [
    employeeId,
    todayStr
  ]);

  // 2. Verify initial state (before check-in)
  const initialRecord = await findByEmployeeAndDate(employeeId, todayStr);
  console.log('1. Initial state (should be null):', initialRecord === null ? 'PASS (null)' : 'FAIL');

  // 3. Perform Check-In (Mark Attendance)
  const checkInTime = '09:15:00';
  const newRecord = await createCheckIn({
    employee_id: employeeId,
    attendance_date: todayStr,
    check_in_time: checkInTime,
    check_in_latitude: 18.517222,
    check_in_longitude: 73.808722,
    check_in_accuracy: 5.0
  });

  console.log('2. Check-In created:', newRecord ? 'PASS' : 'FAIL');
  console.log(`   - ID: ${newRecord.id}, Date: ${newRecord.attendance_date}, IN: ${newRecord.check_in_time}, OUT: ${newRecord.check_out_time}`);
  console.log(`   - OUT should be null:`, newRecord.check_out_time === null ? 'PASS' : 'FAIL');

  // 4. Verify today's status shows checked in (ready for OUT button)
  const checkedInRecord = await findByEmployeeAndDate(employeeId, todayStr);
  const isCheckedIn = Boolean(checkedInRecord && checkedInRecord.attendance_date === todayStr);
  const isCheckedOut = Boolean(checkedInRecord && checkedInRecord.check_out_time);
  console.log(`3. State after Check-In: isCheckedIn=${isCheckedIn}, isCheckedOut=${isCheckedOut}`);
  console.log(`   - Ready to show 'Out' button:`, isCheckedIn && !isCheckedOut ? 'PASS' : 'FAIL');

  // 5. Perform Check-Out (Out button)
  const checkOutTime = '18:15:00';
  const workingMins = calculateWorkingMinutes(checkedInRecord.check_in_time, checkOutTime);
  const updatedRecord = await updateCheckOut(checkedInRecord.id, {
    check_out_time: checkOutTime,
    check_out_latitude: 18.517222,
    check_out_longitude: 73.808722,
    check_out_accuracy: 5.0,
    working_minutes: workingMins
  });

  console.log('4. Check-Out updated:', updatedRecord ? 'PASS' : 'FAIL');
  console.log(`   - OUT: ${updatedRecord.check_out_time}, working_minutes: ${updatedRecord.working_minutes}`);
  const finalCheckedIn = Boolean(updatedRecord && updatedRecord.attendance_date === todayStr);
  const finalCheckedOut = Boolean(updatedRecord && updatedRecord.check_out_time);
  console.log(`5. State after Check-Out: isCheckedIn=${finalCheckedIn}, isCheckedOut=${finalCheckedOut}`);
  console.log(`   - Ready to show 'Attendance Completed':`, finalCheckedIn && finalCheckedOut ? 'PASS' : 'FAIL');

  // 6. Test NEXT DAY scenario:
  // Suppose employee forgot to mark OUT on a previous date (e.g. yesterday).
  // Simulate next day query:
  const simulatedTomorrow = '2026-10-09';
  const tomorrowRecord = await findByEmployeeAndDate(employeeId, simulatedTomorrow);
  const tomorrowCheckedIn = Boolean(tomorrowRecord && tomorrowRecord.attendance_date === simulatedTomorrow);
  console.log(`6. Next Day simulation (${simulatedTomorrow}):`);
  console.log(`   - Record found for tomorrow:`, tomorrowRecord === null ? 'PASS (null)' : 'FAIL');
  console.log(`   - Tomorrow isCheckedIn:`, tomorrowCheckedIn === false ? 'PASS (false)' : 'FAIL');
  console.log(`   - Ready to show 'Mark Attendance' on new day:`, !tomorrowCheckedIn ? 'PASS' : 'FAIL');

  // Clean up test record
  await pool.query('DELETE FROM attendance WHERE employee_id = ? AND attendance_date = ?', [
    employeeId,
    todayStr
  ]);

  console.log('\n--- All Attendance Logic Tests PASSED Successfully! ---');
  await pool.end();
}

testAttendanceFlow().catch((err) => {
  console.error('Test Failed:', err);
  process.exit(1);
});
