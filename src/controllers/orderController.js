import { supabase } from '../config/supabase.js';
import { z } from 'zod';

export const createOrderSchema = z.object({
  body: z.object({
    items: z.array(z.object({
      productId: z.string(),
      size: z.string(),
      quantity: z.number().int().min(1),
      unitPrice: z.number().positive(),
      engravingText: z.string().optional()
    })).min(1, 'Order must contain at least one item'),
    shippingAddress: z.object({
      street: z.string().min(1),
      city: z.string().min(1),
      postalCode: z.string().min(1),
      country: z.string().min(1)
    }),
    discountCode: z.string().optional()
  })
});

export const createOrder = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { items, shippingAddress, discountCode } = req.body;

    let subtotal = items.reduce((acc, item) => acc + (item.unitPrice * item.quantity), 0);
    let discountAmount = 0;

    if (discountCode) {
      const { data: discount } = await supabase
        .from('discounts')
        .select('*')
        .eq('code', discountCode)
        .eq('is_active', true)
        .single();

      if (discount) {
        discountAmount = (subtotal * discount.percentage) / 100;
      }
    }

    const total = Math.max(0, subtotal - discountAmount);

    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert({
        user_id: userId,
        status: 'pending',
        subtotal,
        discount_amount: discountAmount,
        total,
        shipping_address: shippingAddress
      })
      .select()
      .single();

    if (orderError) {
      return res.status(400).json({ success: false, error: orderError.message });
    }

    const orderItemsPayload = items.map(item => ({
      order_id: order.id,
      product_id: item.productId,
      size: item.size,
      quantity: item.quantity,
      unit_price: item.unitPrice,
      engraving_text: item.engravingText || null
    }));

    await supabase.from('order_items').insert(orderItemsPayload);

    // Clear user cart
    await supabase.from('cart_items').delete().eq('user_id', userId);

    res.status(201).json({
      success: true,
      message: 'Order created successfully',
      order
    });
  } catch (error) {
    next(error);
  }
};

export const getUserOrders = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { data: orders, error } = await supabase
      .from('orders')
      .select(`
        *,
        items:order_items(
          *,
          product:products(name, french_name, image_url)
        )
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      return res.status(500).json({ success: false, error: error.message });
    }

    res.status(200).json({
      success: true,
      orders
    });
  } catch (error) {
    next(error);
  }
};
