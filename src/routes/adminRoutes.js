import express from 'express';
import { 
  uploadHeroImage,
  uploadProductImage, 
  uploadBatchProductImages,
  getProductImages, 
  deleteProductImage, 
  toggleProductFlags,
  getDashboardStats,
  getUsersList,
  updateUserRole,
  toggleProductStock,
  getCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  getDiscounts,
  createDiscount,
  updateDiscount,
  deleteDiscount
} from '../controllers/adminController.js';
import { getAllReviews, deleteReview } from '../controllers/reviewController.js';
import { getAllContactMessages, updateContactMessageStatus, deleteContactMessage } from '../controllers/contactController.js';
import { uploadSingleImage, uploadMultipleImages } from '../middleware/upload.js';

const router = express.Router();

// POST endpoint for single, batch, and hero section image uploads with automatic .webp conversion
router.post('/images/upload-hero', uploadSingleImage, uploadHeroImage);
router.post('/images/upload', uploadSingleImage, uploadProductImage);
router.post('/images/upload-batch', uploadMultipleImages, uploadBatchProductImages);

// POST endpoint to retrieve images for a product
router.post('/images/list', getProductImages);

// POST endpoint to delete an image
router.post('/images/delete', deleteProductImage);

// POST endpoint to toggle Hero Section and Featured Section visibility
router.post('/product/toggle-flags', toggleProductFlags);
router.post('/product/toggle-stock', toggleProductStock);

// POST endpoints for Dashboard Stats and User Management
router.post('/stats', getDashboardStats);
router.post('/users/list', getUsersList);
router.post('/users/update-role', updateUserRole);

// Category CRUD endpoints
router.post('/categories/list', getCategories);
router.post('/categories/create', createCategory);
router.post('/categories/update', updateCategory);
router.post('/categories/delete', deleteCategory);

// Discount / Coupon CRUD endpoints
router.post('/discounts/list', getDiscounts);
router.post('/discounts/create', createDiscount);
router.post('/discounts/update', updateDiscount);
router.post('/discounts/delete', deleteDiscount);

// Review moderation endpoints
router.post('/reviews/list', getAllReviews);
router.post('/reviews/delete', deleteReview);

// Contact / Support message endpoints
router.post('/contacts/list', getAllContactMessages);
router.post('/contacts/update-status', updateContactMessageStatus);
router.post('/contacts/delete', deleteContactMessage);

export default router;
