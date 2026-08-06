import { supabaseAdmin as supabase } from '../config/supabase.js';
import { z } from 'zod';

export const cartItemSchema = z.object({
  body: z.object({
    productId: z.string().min(1, 'Product ID is required'),
    selectedSize: z.string().min(1, 'Selected size is required'),
    quantity: z.number().int().min(1).default(1),
    engravingText: z.string().optional()
  })
});

export const updateCartItemSchema = z.object({
  body: z.object({
    id: z.string().min(1, 'Cart item ID is required'),
    quantity: z.number().int()
  })
});

export const removeCartItemSchema = z.object({
  body: z.object({
    id: z.string().min(1, 'Cart item ID is required')
  })
});

export const getCart = async (req, res, next) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(200).json({ success: true, cart: [] });
    }

    const { data: cartItems, error } = await supabase
      .from('cart_items')
      .select(`
        *,
        product:products(*)
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('getCart DB error:', error);
      return res.status(500).json({ success: false, error: error.message });
    }

    res.status(200).json({
      success: true,
      cart: cartItems || []
    });
  } catch (error) {
    next(error);
  }
};

export const addToCart = async (req, res, next) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Authentication required to add to cart' });
    }

    const { productId, selectedSize, quantity = 1, engravingText = null } = req.body;

    // Check if matching cart item already exists in database
    let query = supabase
      .from('cart_items')
      .select('*')
      .eq('user_id', userId)
      .eq('product_id', productId)
      .eq('selected_size', selectedSize);

    if (engravingText) {
      query = query.eq('engraving_text', engravingText);
    } else {
      query = query.is('engraving_text', null);
    }

    const { data: existingItems } = await query;
    const existing = existingItems && existingItems.length > 0 ? existingItems[0] : null;

    if (existing) {
      // Increment existing quantity in DB
      const updatedQty = existing.quantity + quantity;
      const { data: updatedItem, error: updateErr } = await supabase
        .from('cart_items')
        .update({ quantity: updatedQty })
        .eq('id', existing.id)
        .select(`
          *,
          product:products(*)
        `)
        .single();

      if (updateErr) {
        return res.status(400).json({ success: false, error: updateErr.message });
      }

      return res.status(200).json({
        success: true,
        message: 'Cart item quantity updated',
        item: updatedItem
      });
    }

    // Insert new record in DB
    const { data: item, error } = await supabase
      .from('cart_items')
      .insert({
        user_id: userId,
        product_id: productId,
        selected_size: selectedSize,
        quantity,
        engraving_text: engravingText || null
      })
      .select(`
        *,
        product:products(*)
      `)
      .single();

    if (error) {
      console.error('addToCart DB error:', error);
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

export const updateCartQuantity = async (req, res, next) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ success: false, error: 'Auth required' });

    const { id, quantity } = req.body;

    if (quantity <= 0) {
      await supabase.from('cart_items').delete().eq('id', id).eq('user_id', userId);
      return res.status(200).json({ success: true, message: 'Item removed from cart' });
    }

    const { data: updatedItem, error } = await supabase
      .from('cart_items')
      .update({ quantity })
      .eq('id', id)
      .eq('user_id', userId)
      .select(`
        *,
        product:products(*)
      `)
      .single();

    if (error) {
      return res.status(400).json({ success: false, error: error.message });
    }

    res.status(200).json({
      success: true,
      message: 'Cart item quantity updated',
      item: updatedItem
    });
  } catch (error) {
    next(error);
  }
};

export const removeFromCart = async (req, res, next) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ success: false, error: 'Auth required' });

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

export const clearCart = async (req, res, next) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ success: false, error: 'Auth required' });

    await supabase.from('cart_items').delete().eq('user_id', userId);
    res.status(200).json({ success: true, message: 'Cart cleared successfully' });
  } catch (error) {
    next(error);
  }
};
