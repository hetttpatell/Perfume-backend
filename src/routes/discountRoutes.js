import express from 'express';
import { validateDiscount, validateDiscountSchema } from '../controllers/discountController.js';
import { validate } from '../middleware/validator.js';

const router = express.Router();

router.post('/validate', validate(validateDiscountSchema), validateDiscount);

export default router;
