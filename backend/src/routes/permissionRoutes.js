const express = require('express');
const router = express.Router();
const { authenticate } = require('../middlewares/authMiddleware');
const {
  applyPermissionController,
  getPermissionHistoryController,
  getPermissionDetailsController,
  cancelPermissionController
} = require('../controllers/permissionController');

// All permission routes require authenticated JWT
router.use(authenticate);

router.post('/', applyPermissionController);
router.get('/', getPermissionHistoryController);
router.get('/:id', getPermissionDetailsController);
router.patch('/:id/cancel', cancelPermissionController);
router.put('/:id/cancel', cancelPermissionController);

module.exports = router;
