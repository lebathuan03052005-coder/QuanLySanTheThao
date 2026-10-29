import { Router } from 'express';
import { register, login, logout, getProfile } from './auth.controller.js';
import { verifyToken } from '../../core/middlewares/auth.js';

const router = Router();

router.post('/register', register);
router.post('/login', login);
router.post('/logout', verifyToken, logout);
router.get('/profile', verifyToken, getProfile);

export default router;
