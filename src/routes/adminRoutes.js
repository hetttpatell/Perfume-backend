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
  getAllOrdersAdmin,
  updateOrderStatusAdmin,
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
import { requireAdmin } from '../middleware/auth.js';

const router = express.Router();

// Publicly accessible category and discount lists for catalog display
router.post('/categories/list', getCategories);
router.post('/discounts/list', getDiscounts);
router.post('/images/list', getProductImages);

// Protect ALL administrative routes with strict requireAdmin middleware
router.use(requireAdmin);

// POST endpoint for single, batch, and hero section image uploads
router.post('/images/upload-hero', uploadSingleImage, uploadHeroImage);
router.post('/images/upload', uploadSingleImage, uploadProductImage);
router.post('/images/upload-batch', uploadMultipleImages, uploadBatchProductImages);
router.post('/images/delete', deleteProductImage);

// POST endpoints for Hero/Featured section and product stock toggling
router.post('/product/toggle-flags', toggleProductFlags);
router.post('/product/toggle-stock', toggleProductStock);

// POST endpoints for Dashboard Stats, User & Order Management
router.post('/stats', getDashboardStats);
router.post('/users/list', getUsersList);
router.post('/users/update-role', updateUserRole);
router.post('/orders/list', getAllOrdersAdmin);
router.post('/orders/update-status', updateOrderStatusAdmin);

// Category mutation endpoints
router.post('/categories/create', createCategory);
router.post('/categories/update', updateCategory);
router.post('/categories/delete', deleteCategory);

// Discount / Coupon mutation endpoints
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
