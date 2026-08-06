import { supabaseAdmin as supabase, supabaseAdmin } from '../config/supabase.js';

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
      fullName: z.string().optional(),
      phone: z.string().optional(),
      street: z.string().min(1, 'Street address is required'),
      city: z.string().min(1, 'City is required'),
      state: z.string().optional(),
      postalCode: z.string().min(1, 'Postal code is required'),
      country: z.string().min(1, 'Country is required')
    }),
    discountCode: z.string().optional(),
    saveToProfile: z.boolean().optional()
  })
});

export const createOrder = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { items, shippingAddress, discountCode, saveToProfile = true } = req.body;

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
        status: 'ordered',
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

    // Save shipping address & phone details to User Profile in Database if requested / default
    if (saveToProfile) {
      try {
        const { fullName, phone, street, city, state, postalCode, country } = shippingAddress;

        // Update user_metadata in Supabase Auth
        await supabaseAdmin.auth.admin.updateUserById(userId, {
          user_metadata: {
            ...(fullName ? { full_name: fullName } : {}),
            ...(phone ? { phone } : {}),
            street_address: street,
            city,
            state: state || '',
            postal_code: postalCode,
            country
          }
        });

        // Update profiles table
        const profilePayload = {
          id: userId,
          email: req.user.email,
          ...(fullName ? { full_name: fullName } : {}),
          ...(phone ? { phone } : {}),
          updated_at: new Date().toISOString()
        };

        await supabaseAdmin.from('profiles').upsert(profilePayload, { onConflict: 'id' });
      } catch (profileErr) {
        console.error('Non-blocking error syncing shipping info to profile:', profileErr);
      }
    }

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
