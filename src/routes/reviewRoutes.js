import express from 'express';
import { getReviewsByProduct, addReview, getReviewsSchema, createReviewSchema } from '../controllers/reviewController.js';
import { validate } from '../middleware/validator.js';
import { optionalAuth } from '../middleware/auth.js';

const router = express.Router();

router.post('/list', validate(getReviewsSchema), getReviewsByProduct);
router.post('/add', optionalAuth, validate(createReviewSchema), addReview);

export default router;
