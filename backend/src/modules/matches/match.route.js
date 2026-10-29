import { Router } from 'express';
import { verifyToken } from '../../core/middlewares/auth.js';
import {
  getMatches,
  getMatchById,
  createMatch,
  joinMatch,
  cancelMatch,
} from './match.controller.js';

const router = Router();

router.get('/', getMatches);
router.get('/:id', getMatchById);
router.post('/', verifyToken, createMatch);
router.post('/:id/join', verifyToken, joinMatch);
router.delete('/:id', verifyToken, cancelMatch);

export default router;
