import { supabase } from '../config/supabase.js';
import { z } from 'zod';

export const cartItemSchema = z.object({
  body: z.object({
    productId: z.string().min(1, 'Product ID is required'),
    selectedSize: z.string().min(1, 'Selected size is required'),
    quantity: z.number().int().min(1).default(1),
    engravingText: z.string().optional()
  })
});

export const removeCartItemSchema = z.object({
  body: z.object({
    id: z.string().min(1, 'Cart item ID is required')
  })
});

export const getCart = async (req, res, next) => {
  try {
    const userId = req.user.id;

    const { data: cartItems, error } = await supabase
      .from('cart_items')
      .select(`
        *,
        product:products(*)
      `)
      .eq('user_id', userId);

    if (error) {
      return res.status(500).json({ success: false, error: error.message });
    }

    res.status(200).json({
      success: true,
      cart: cartItems
    });
  } catch (error) {
    next(error);
  }
};

export const addToCart = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { productId, selectedSize, quantity, engravingText } = req.body;

    const { data: item, error } = await supabase
      .from('cart_items')
      .insert({
        user_id: userId,
        product_id: productId,
        selected_size: selectedSize,
        quantity,
        engraving_text: engravingText
      })
      .select()
      .single();

    if (error) {
      return res.status(400).json({ success: false, error: error.message });
    }

    res.status(201).json({
      success: true,
      message: 'Item added to cart',
      item
    });
  } catch (error) {
    next(error);
  }
};

export const removeFromCart = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { id } = req.body || {};

    if (!id) {
      return res.status(400).json({ success: false, error: 'Cart item ID is required in request body' });
    }

    const { error } = await supabase
      .from('cart_items')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);

    if (error) {
      return res.status(400).json({ success: false, error: error.message });
    }

    res.status(200).json({
      success: true,
      message: 'Item removed from cart'
    });
  } catch (error) {
    next(error);
  }
};
