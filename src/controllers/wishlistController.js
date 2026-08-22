import { supabaseAdmin as supabase } from '../config/supabase.js';
import { serverCache } from '../services/cacheService.js';
import { getAllProductsFromDb } from './productController.js';

export const getWishlist = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const cacheKey = `user_wishlist_${userId}`;
    const cached = serverCache.get(cacheKey);

    if (cached) {
      return res.status(200).json({
        success: true,
        count: cached.length,
        wishlist: cached
      });
    }

    const { data: wishlist, error } = await supabase
      .from('wishlist')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      return res.status(500).json({ success: false, error: error.message });
    }

    if (!wishlist || wishlist.length === 0) {
      serverCache.set(cacheKey, [], 30000);
      return res.status(200).json({
        success: true,
        count: 0,
        wishlist: []
      });
    }

    const products = await getAllProductsFromDb().catch(() => []);
    const prodMap = new Map((products || []).map(p => [p.id, p]));

    const fullWishlist = wishlist.map(w => ({
      ...w,
      product: prodMap.get(w.product_id) || null
    })).filter(w => w.product);

    serverCache.set(cacheKey, fullWishlist, 30000);

    res.status(200).json({
      success: true,
      count: fullWishlist.length,
      wishlist: fullWishlist
    });
  } catch (error) {
    next(error);
  }
};

export const addToWishlist = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { productId } = req.body;

    if (!productId) {
      return res.status(400).json({ success: false, error: 'Product ID is required' });
    }

    const { data: item, error } = await supabase
      .from('wishlist')
      .upsert({
        user_id: userId,
        product_id: productId
      })
      .select()
      .single();

    if (error) {
      return res.status(400).json({ success: false, error: error.message });
    }

    serverCache.clearPattern(`user_wishlist_${userId}`);

    res.status(201).json({
      success: true,
      message: 'Product added to wishlist',
      item
    });
  } catch (error) {
    next(error);
  }
};

export const removeFromWishlist = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { productId } = req.body;

    if (!productId) {
      return res.status(400).json({ success: false, error: 'Product ID is required' });
    }

    const { error } = await supabase
      .from('wishlist')
      .delete()
      .eq('user_id', userId)
      .eq('product_id', productId);

    if (error) {
      return res.status(400).json({ success: false, error: error.message });
    }

    serverCache.clearPattern(`user_wishlist_${userId}`);

    res.status(200).json({
      success: true,
      message: 'Product removed from wishlist'
    });
  } catch (error) {
    next(error);
  }
};

