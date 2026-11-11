import { Router } from 'express';
import * as facilityController from './facility.controller.js';
import { verifyToken, authorize } from '../../core/middlewares/auth.js';

const router = Router();

// Tất cả các route quản lý cơ sở và sân con yêu cầu quyền OWNER hoặc ADMIN
router.use(verifyToken, authorize('owner', 'admin'));

// Quản lý cơ sở sân (FACILITY)
router.get('/', facilityController.getOwnerFacilities);
router.post('/', facilityController.createFacility);
router.get('/:id', facilityController.getFacilityById);
router.put('/:id', facilityController.updateFacility);
router.patch('/:id/status', facilityController.updateFacilityStatus);

// Quản lý danh sách sân con trực thuộc cơ sở (SUB-COURTS)
router.get('/:facilityId/courts', facilityController.getCourtsByFacility);
router.post('/:facilityId/courts', facilityController.createCourtInFacility);
router.put('/courts/:courtId', facilityController.updateCourtInFacility);
router.patch('/courts/:courtId/status', facilityController.updateCourtStatus);

export default router;

