const express = require('express');
const router = express.Router();
const { authenticate } = require('../middlewares/authMiddleware');
const {
  applyHalfDayController,
  getHalfDayHistoryController,
  getHalfDayDetailsController,
  cancelHalfDayController
} = require('../controllers/halfDayController');

// All half-day routes require authenticated JWT
router.use(authenticate);

router.post('/', applyHalfDayController);
router.get('/', getHalfDayHistoryController);
router.get('/:id', getHalfDayDetailsController);
router.patch('/:id/cancel', cancelHalfDayController);
router.put('/:id/cancel', cancelHalfDayController);

module.exports = router;
