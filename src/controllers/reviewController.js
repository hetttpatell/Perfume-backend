import { supabase } from '../config/supabase.js';
import { z } from 'zod';

export const getReviewsSchema = z.object({
  body: z.object({
    productId: z.string().min(1, 'Product ID is required')
  })
});

export const createReviewSchema = z.object({
  body: z.object({
    productId: z.string().min(1, 'Product ID is required'),
    author: z.string().min(1, 'Author name is required'),
    rating: z.number().int().min(1).max(5),
    title: z.string().optional(),
    comment: z.string().min(3, 'Comment must be at least 3 characters')
  })
});

export const getReviewsByProduct = async (req, res, next) => {
  try {
    const { productId } = req.body || {};
    if (!productId) {
      return res.status(400).json({ success: false, error: 'Product ID is required in request body' });
    }

    const { data: reviews, error } = await supabase
      .from('reviews')
      .select('*')
      .eq('product_id', productId)
      .order('created_at', { ascending: false });

    if (error) {
      return res.status(500).json({ success: false, error: error.message });
    }

    res.status(200).json({
      success: true,
      count: reviews.length,
      reviews
    });
  } catch (error) {
    next(error);
  }
};

export const addReview = async (req, res, next) => {
  try {
    const { productId, author, rating, title, comment } = req.body;
    const userId = req.user?.id || null;

    const { data: newReview, error } = await supabase
      .from('reviews')
      .insert({
        product_id: productId,
        user_id: userId,
        author,
        rating,
        title,
        comment,
        verified: !!userId
      })
      .select()
      .single();

    if (error) {
      return res.status(400).json({ success: false, error: error.message });
    }

    res.status(201).json({
      success: true,
      message: 'Review submitted successfully',
      review: newReview
    });
  } catch (error) {
    next(error);
  }
};
