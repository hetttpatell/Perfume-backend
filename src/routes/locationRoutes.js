import express from 'express';
import { getLocations } from '../controllers/locationController.js';

const router = express.Router();

// Enforce POST method to prevent exposing query params in URL
router.post('/list', getLocations);

export default router;
