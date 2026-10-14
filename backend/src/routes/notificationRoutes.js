const express = require('express');
const router = express.Router();
const { authenticate } = require('../middlewares/authMiddleware');
const {
  getNotificationsController,
  getUnreadCountController,
  markAsReadController,
  markAllAsReadController
} = require('../controllers/notificationController');

// All notification routes require JWT authentication
router.use(authenticate);

router.get('/', getNotificationsController);
router.get('/unread-count', getUnreadCountController);
router.patch('/read-all', markAllAsReadController);
router.patch('/:id/read', markAsReadController);

module.exports = router;
