import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import compression from 'compression';

import { globalLimiter } from './middleware/rateLimiter.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';

import authRoutes from './routes/authRoutes.js';
import productRoutes from './routes/productRoutes.js';
import reviewRoutes from './routes/reviewRoutes.js';
import cartRoutes from './routes/cartRoutes.js';
import orderRoutes from './routes/orderRoutes.js';
import locationRoutes from './routes/locationRoutes.js';
import discountRoutes from './routes/discountRoutes.js';
import adminRoutes from './routes/adminRoutes.js';
import wishlistRoutes from './routes/wishlistRoutes.js';
import contactRoutes from './routes/contactRoutes.js';

import { getAllProductsFromDb } from './controllers/productController.js';
import { serverCache } from './services/cacheService.js';
import { supabaseAdmin } from './config/supabase.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// GZIP Compression Middleware
app.use(compression());

// Security Headers via Helmet
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));

// Parse configured CLIENT_ORIGIN (supports comma-separated list)
const configuredOrigins = (process.env.CLIENT_ORIGIN || '')
  .split(',')
  .map(o => o.trim().replace(/\/$/, ''))
  .filter(Boolean);

const allowedOrigins = new Set([
  'https://www.lunefragrance.com',
  'https://lunefragrance.com',
  'http://localhost:5173',
  'http://localhost:3000',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:3000',
  ...configuredOrigins
]);

// CORS configuration supporting credentials, preflight OPTIONS, and custom domains
const corsOptions = {
  origin: (origin, callback) => {
    // Allow non-browser requests (curl, server-to-server, health checkers)
    if (!origin) return callback(null, true);

    if (allowedOrigins.has(origin)) {
      return callback(null, true);
    }

    try {
      const parsed = new URL(origin);
      // Allow root and any subdomain of lunefragrance.com
      if (parsed.hostname === 'lunefragrance.com' || parsed.hostname.endsWith('.lunefragrance.com')) {
        return callback(null, true);
      }
      // Allow Vercel or Render preview domains
      if (parsed.hostname.endsWith('.vercel.app') || parsed.hostname.endsWith('.onrender.com')) {
        return callback(null, true);
      }
    } catch {
      // Invalid URL format
    }

    // In non-production environments, allow access
    if (process.env.NODE_ENV !== 'production') {
      return callback(null, true);
    }

    return callback(null, false);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-Lune-Signature'],
  optionsSuccessStatus: 200
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

// Request Body Parsers (Only JSON and Multipart payloads allowed)
app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ extended: true, limit: '15mb' }));
app.use(cookieParser());

// Logging
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('dev'));
}

// Global Rate Limiter
app.use(globalLimiter);

// Health Check Endpoint (Both POST and GET supported)
const healthHandler = (req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
};
app.post('/health', healthHandler);
app.get('/health', healthHandler);

// Secured API V1 Routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/products', productRoutes);
app.use('/api/v1/reviews', reviewRoutes);
app.use('/api/v1/cart', cartRoutes);
app.use('/api/v1/orders', orderRoutes);
app.use('/api/v1/locations', locationRoutes);
app.use('/api/v1/discounts', discountRoutes);
app.use('/api/v1/admin', adminRoutes);
app.use('/api/v1/wishlist', wishlistRoutes);
app.use('/api/v1/contact', contactRoutes);

// Fallback Route Aliases (Handles clients sending requests without /api/v1 prefix)
app.use('/auth', authRoutes);
app.use('/products', productRoutes);
app.use('/reviews', reviewRoutes);
app.use('/cart', cartRoutes);
app.use('/orders', orderRoutes);
app.use('/locations', locationRoutes);
app.use('/discounts', discountRoutes);
app.use('/admin', adminRoutes);
app.use('/wishlist', wishlistRoutes);
app.use('/contact', contactRoutes);

// Error Handling Middlewares
app.use(notFoundHandler);
app.use(errorHandler);

if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, async () => {
    console.log(`🔒 Lune Secured Backend Server v1.1 running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);

    // Non-blocking background pre-warm
    try {
      console.log('⚡ Pre-warming database caches...');
      const [products, { data: categories }] = await Promise.all([
        getAllProductsFromDb(),
        supabaseAdmin.from('categories').select('*').order('created_at', { ascending: false })
      ]);
      if (categories) {
        serverCache.set('categories_list', { success: true, categories }, 300000);
      }
      console.log(`🚀 Database cache warm! Loaded ${products.length} products & ${categories?.length || 0} categories into ultra-fast memory cache.`);
    } catch (err) {
      console.warn('Cache pre-warm notice:', err.message);
    }
  });
}

export default app;
