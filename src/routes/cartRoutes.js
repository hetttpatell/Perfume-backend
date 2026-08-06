import express from 'express';
import { getCart, addToCart, updateCartQuantity, removeFromCart, clearCart, cartItemSchema, updateCartItemSchema, removeCartItemSchema } from '../controllers/cartController.js';
import { validate } from '../middleware/validator.js';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();

// All cart operations require authentication — the 401 interceptor 
// on the frontend automatically refreshes expired tokens and retries
router.use(requireAuth);

// Enforce POST method for all cart actions
router.post('/get', getCart);
router.post('/add', validate(cartItemSchema), addToCart);
router.post('/update', validate(updateCartItemSchema), updateCartQuantity);
router.post('/remove', validate(removeCartItemSchema), removeFromCart);
router.post('/clear', clearCart);

export default router;
