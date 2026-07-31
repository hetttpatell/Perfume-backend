import express from 'express';
import { getCart, addToCart, removeFromCart, cartItemSchema, removeCartItemSchema } from '../controllers/cartController.js';
import { validate } from '../middleware/validator.js';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();

router.use(requireAuth);

// Enforce POST method for all cart actions
router.post('/get', getCart);
router.post('/add', validate(cartItemSchema), addToCart);
router.post('/remove', validate(removeCartItemSchema), removeFromCart);

export default router;
