import { Router } from 'express';
import {
  verifyToken,
  authorize,
  checkAccountStatus,
} from '../../core/middlewares/auth.js';
import {
  getRevenueDashboard,
  getOccupancyAnalytics,
} from './analytics.controller.js';

const router = Router();

// Phân quyền RBAC nghiêm ngặt (TC04): Chỉ OWNER và ADMIN được xem báo cáo doanh thu & tỷ lệ lấp đầy
router.use(verifyToken, checkAccountStatus, authorize('owner', 'admin'));

router.get('/revenue', getRevenueDashboard);
router.get('/occupancy', getOccupancyAnalytics);

export default router;

