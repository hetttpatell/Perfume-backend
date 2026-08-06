import express from 'express';
import { submitContactMessage } from '../controllers/contactController.js';

const router = express.Router();

// Public: Submit a contact/support message
router.post('/submit', submitContactMessage);

export default router;
