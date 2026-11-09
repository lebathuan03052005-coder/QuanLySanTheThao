import { Router } from 'express';
import { verifyToken, authorize } from '../../core/middlewares/auth.js';
import {
  getRevenueDashboard,
  getOccupancyAnalytics,
} from './analytics.controller.js';

const router = Router();

// Phân quyền nghiêm ngặt (TC04): Chỉ Chủ sân (owner) và Admin được xem Dashboard Doanh thu & Lấp đầy sân.
// Nhân viên (staff) sẽ bị từ chối với HTTP 403 Forbidden.
router.use(verifyToken, authorize('owner', 'admin'));

router.get('/revenue', getRevenueDashboard);
router.get('/occupancy', getOccupancyAnalytics);

export default router;

