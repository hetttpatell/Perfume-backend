import express from 'express';
import { createOrder, getUserOrders, createOrderSchema } from '../controllers/orderController.js';
import { validate } from '../middleware/validator.js';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();

router.use(requireAuth);

router.post('/create', validate(createOrderSchema), createOrder);
router.post('/list', getUserOrders);

export default router;
