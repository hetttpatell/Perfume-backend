import express from 'express';
import { createOrder, getUserOrders, createOrderSchema } from '../controllers/orderController.js';
import { validate } from '../middleware/validator.js';
import { requireAuth, optionalAuth } from '../middleware/auth.js';

const router = express.Router();

// Guest checkout: /create uses optionalAuth (attaches req.user if logged in, allows guests through)
router.post('/create', optionalAuth, validate(createOrderSchema), createOrder);

// Order history: /list requires authentication (only account holders can view history)
router.post('/list', requireAuth, getUserOrders);

export default router;
