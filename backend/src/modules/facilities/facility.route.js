import { Router } from 'express';
import * as facilityController from './facility.controller.js';
import { verifyToken, authorize } from '../../core/middlewares/auth.js';
import {
  uploadFacilityImageMiddleware,
  uploadCourtImageMiddleware,
} from '../../core/middlewares/upload.js';

const router = Router();

// Xem danh sách cơ sở công khai cho người chơi (không yêu cầu token)
router.get('/public', facilityController.getPublicFacilities);
router.get('/public/:id', facilityController.getPublicFacilityDetail);

// Tất cả các route quản lý cơ sở và sân con yêu cầu quyền OWNER hoặc ADMIN
router.use(verifyToken, authorize('owner', 'admin'));

// Quản lý cơ sở sân (FACILITY)
router.get('/', facilityController.getOwnerFacilities);
router.post('/', facilityController.createFacility);
router.get('/:id', facilityController.getFacilityById);
router.put('/:id', facilityController.updateFacility);
router.patch('/:id/status', facilityController.updateFacilityStatus);

// Quản lý ảnh cơ sở sân mẹ (hỗ trợ cả 1 ảnh lẫn nhiều ảnh cùng lúc)
router.post('/:id/images', uploadFacilityImageMiddleware.any(), facilityController.uploadFacilityImage);
router.delete('/:id/images', facilityController.deleteFacilityImage);

// Quản lý danh sách sân con trực thuộc cơ sở (SUB-COURTS)
router.get('/:facilityId/courts', facilityController.getCourtsByFacility);
router.post('/:facilityId/courts', facilityController.createCourtInFacility);
router.put('/courts/:courtId', facilityController.updateCourtInFacility);
router.patch('/courts/:courtId/status', facilityController.updateCourtStatus);

// Quản lý ảnh sân con
router.post('/courts/:courtId/image', uploadCourtImageMiddleware.single('image'), facilityController.uploadCourtImage);
router.delete('/courts/:courtId/image', facilityController.deleteCourtImage);

export default router;

