const express = require('express');
const router = express.Router();
const { authenticate } = require('../middlewares/authMiddleware');
const {
  applyLeaveController,
  getLeaveHistoryController,
  getLeaveBalanceController,
  getLeaveTypesController,
  getLeaveDetailsController,
  cancelLeaveController
} = require('../controllers/leaveController');

// All leave routes require authenticated JWT
router.use(authenticate);

// Leave Types and Balances
router.get('/types', getLeaveTypesController);
router.get('/balance', getLeaveBalanceController);

// Leave Requests CRUD
router.post('/', applyLeaveController);
router.get('/', getLeaveHistoryController);
router.get('/:id', getLeaveDetailsController);
router.patch('/:id/cancel', cancelLeaveController);
router.put('/:id/cancel', cancelLeaveController);

module.exports = router;
