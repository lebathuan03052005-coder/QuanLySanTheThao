import { Router } from 'express';
import { verifyToken } from '../../core/middlewares/auth.js';
import {
  getBookings,
  getBookingById,
  createBooking,
  updateBooking,
  deleteBooking,
} from './booking.controller.js';

const router = Router();

router.get('/', verifyToken, getBookings);
router.get('/:id', verifyToken, getBookingById);
router.post('/', verifyToken, createBooking);
router.put('/:id', verifyToken, updateBooking);
router.delete('/:id', verifyToken, deleteBooking);

export default router;
