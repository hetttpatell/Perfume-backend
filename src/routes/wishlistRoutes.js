import express from 'express';
import { getWishlist, addToWishlist, removeFromWishlist } from '../controllers/wishlistController.js';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();

router.use(requireAuth);

router.post('/list', getWishlist);
router.post('/add', addToWishlist);
router.post('/remove', removeFromWishlist);

export default router;
