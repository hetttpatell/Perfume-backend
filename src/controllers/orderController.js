import { supabaseAdmin as supabase, supabaseAdmin } from '../config/supabase.js';
import { sendOrderConfirmationEmail } from '../services/emailService.js';
import { serverCache } from '../services/cacheService.js';
import { getAllProductsFromDb } from './productController.js';
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
      fullName: z.string().min(2, 'Full name must be at least 2 characters'),
      phone: z.string().min(10, 'Phone number must be at least 10 digits'),
      street: z.string().min(3, 'Street address is required'),
      city: z.string().min(2, 'City is required'),
      state: z.string().optional(),
      postalCode: z.string().regex(/^\d{6}$/, 'Postal PIN code must be a valid 6-digit Indian PIN code'),
      country: z.string().default('India')
    }),
    // Guest checkout fields (used when user is not authenticated)
    guestEmail: z.string().email('Valid email is required for guest checkout').optional(),
    guestName: z.string().optional(),
    guestPhone: z.string().optional(),
    orderNotes: z.string().optional(),
    discountCode: z.string().optional(),
    saveToProfile: z.boolean().optional()
  })
});

export const createOrder = async (req, res, next) => {
  try {
    const userId = req.user?.id || null;
    const isGuest = !userId;
    const { items, shippingAddress, discountCode, saveToProfile = true, guestEmail, guestName, guestPhone, orderNotes } = req.body;

    // For guest checkout, email is mandatory
    if (isGuest && !guestEmail) {
      return res.status(400).json({ success: false, error: 'Email address is required for guest checkout' });
    }

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

    // Build order record — user_id is null for guest orders
    const orderInsert = {
      user_id: userId,
      status: 'ordered',
      subtotal,
      discount_amount: discountAmount,
      total,
      shipping_address: shippingAddress,
      ...(isGuest ? {
        guest_email: guestEmail,
        guest_name: guestName || shippingAddress.fullName,
        guest_phone: guestPhone || shippingAddress.phone
      } : {}),
      ...(orderNotes ? { order_notes: orderNotes } : {})
    };

    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert(orderInsert)
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

    // Invalidate user orders cache
    serverCache.clearPattern('user_orders_');

    // Save shipping address & phone details to User Profile in Database if requested (authenticated users only)
    if (!isGuest && saveToProfile) {
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
        serverCache.clearPattern(`user_profile_${userId}`);
      } catch (profileErr) {
        console.error('Non-blocking error syncing shipping info to profile:', profileErr);
      }
    }

    // Clear user cart (authenticated users only — guests use local cart)
    if (!isGuest) {
      await supabase.from('cart_items').delete().eq('user_id', userId);
    }

    // Fire-and-forget: Send order confirmation email with luxury invoice & 4-stage tracking
    (async () => {
      try {
        let customerEmail = null;
        if (!isGuest) {
          customerEmail = req.user?.email || req.user?.user_metadata?.email || shippingAddress?.email;
          if (!customerEmail && userId) {
            const { data: profile } = await supabaseAdmin.from('profiles').select('email').eq('id', userId).single();
            customerEmail = profile?.email;
          }
          if (!customerEmail && userId) {
            const { data: { user: authUser } } = await supabaseAdmin.auth.admin.getUserById(userId);
            customerEmail = authUser?.email;
          }
        } else {
          customerEmail = guestEmail || shippingAddress?.email;
        }

        await sendOrderConfirmationEmail(order, null, customerEmail);
      } catch (emailErr) {
        console.error('Non-blocking error sending order confirmation email:', emailErr.message);
      }
    })();

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
    const cacheKey = `user_orders_${userId}`;
    const cached = serverCache.get(cacheKey);

    if (cached) {
      return res.status(200).json({
        success: true,
        orders: cached
      });
    }

    // Flat fast indexed query on orders table
    const { data: orders, error } = await supabaseAdmin
      .from('orders')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      return res.status(500).json({ success: false, error: error.message });
    }

    if (!orders || orders.length === 0) {
      serverCache.set(cacheKey, [], 30000);
      return res.status(200).json({
        success: true,
        orders: []
      });
    }

    const orderIds = orders.map(o => o.id);

    // Parallel flat fetch of order_items and products
    const [itemsRes, products] = await Promise.all([
      supabaseAdmin.from('order_items').select('*').in('order_id', orderIds),
      getAllProductsFromDb().catch(() => [])
    ]);

    const orderItems = itemsRes.data || [];
    const prodMap = new Map();
    (products || []).forEach(p => {
      prodMap.set(p.id, {
        name: p.name,
        french_name: p.french_name || p.frenchName || p.name,
        image_url: p.image_url || p.imageUrl || p.image || ''
      });
    });

    const itemsByOrder = new Map();
    orderItems.forEach(item => {
      const prod = prodMap.get(item.product_id) || {
        name: 'Creation',
        french_name: '',
        image_url: ''
      };
      const list = itemsByOrder.get(item.order_id) || [];
      list.push({
        ...item,
        product: prod
      });
      itemsByOrder.set(item.order_id, list);
    });

    const fullOrders = orders.map(o => ({
      ...o,
      items: itemsByOrder.get(o.id) || []
    }));

    // Cache user orders for 45 seconds for sub-millisecond response on subsequent tab switches
    serverCache.set(cacheKey, fullOrders, 45000);

    res.status(200).json({
      success: true,
      orders: fullOrders
    });
  } catch (error) {
    next(error);
  }
};

