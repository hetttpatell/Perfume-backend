import express from 'express';
import { register, login, getMe, refreshSession, registerSchema, loginSchema } from '../controllers/authController.js';
import { validate } from '../middleware/validator.js';
import { requireAuth } from '../middleware/auth.js';
import { authLimiter } from '../middleware/rateLimiter.js';

const router = express.Router();

router.post('/register', authLimiter, validate(registerSchema), register);
router.post('/login', authLimiter, validate(loginSchema), login);
router.post('/refresh', refreshSession);
router.post('/me', requireAuth, getMe);
router.get('/me', requireAuth, getMe);

export default router;
