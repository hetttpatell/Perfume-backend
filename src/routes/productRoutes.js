import express from 'express';
import {
  getProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
  toggleProductStock
} from '../controllers/productController.js';
import { uploadHeroImage, uploadProductImage, uploadBatchProductImages } from '../controllers/adminController.js';
import { uploadSingleImage, uploadMultipleImages } from '../middleware/upload.js';

const router = express.Router();

// All routes enforce POST method - parameters passed in request body
router.post('/list', getProducts);
router.post('/detail', getProductById);

// Admin Product CRUD endpoints
router.post('/create', createProduct);
router.post('/update', updateProduct);
router.post('/delete', deleteProduct);
router.post('/toggle-stock', toggleProductStock);

// Failsafe Upload Endpoints
router.post('/upload-hero', uploadSingleImage, uploadHeroImage);
router.post('/upload', uploadSingleImage, uploadProductImage);
router.post('/upload-batch', uploadMultipleImages, uploadBatchProductImages);

export default router;
