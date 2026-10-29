import { Router } from 'express';
import { verifyToken, authorize } from '../../core/middlewares/auth.js';
import {
  getCourts,
  getCourtById,
  createCourt,
  updateCourt,
  deleteCourt,
} from './court.controller.js';

const router = Router();

router.get('/', getCourts);
router.get('/:id', getCourtById);
router.post('/', verifyToken, authorize('owner'), createCourt);
router.put('/:id', verifyToken, authorize('owner'), updateCourt);
router.delete('/:id', verifyToken, authorize('owner'), deleteCourt);

export default router;
