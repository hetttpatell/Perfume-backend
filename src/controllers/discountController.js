import { supabase } from '../config/supabase.js';
import { z } from 'zod';

export const validateDiscountSchema = z.object({
  body: z.object({
    code: z.string().min(1, 'Discount code is required')
  })
});

const STATIC_PROMO_CODES = {
  'TEST100': 100,
  'WELCOME15': 15,
  'HAUTE20': 20,
  'LUNE10': 10,
  'PARFUM20': 20,
  'PRIVILEGE25': 25,
};

export const validateDiscount = async (req, res, next) => {
  try {
    const { code } = req.body;
    const cleanCode = (code || '').trim().toUpperCase();

    // 1. Check database for active discount coupons
    const { data: discount } = await supabase
      .from('discounts')
      .select('*')
      .eq('code', cleanCode)
      .eq('is_active', true)
      .maybeSingle();

    if (discount) {
      if (discount.valid_until && new Date(discount.valid_until) < new Date()) {
        return res.status(400).json({
          success: false,
          valid: false,
          message: 'Discount code has expired'
        });
      }

      return res.status(200).json({
        success: true,
        valid: true,
        discount: {
          code: discount.code,
          percentage: Number(discount.percentage)
        },
        code: discount.code,
        percentage: Number(discount.percentage)
      });
    }

    // 2. Check privilege static codes
    if (STATIC_PROMO_CODES[cleanCode] !== undefined) {
      const percentage = STATIC_PROMO_CODES[cleanCode];
      return res.status(200).json({
        success: true,
        valid: true,
        discount: {
          code: cleanCode,
          percentage
        },
        code: cleanCode,
        percentage
      });
    }

    return res.status(404).json({
      success: false,
      valid: false,
      message: 'Invalid discount code'
    });
  } catch (error) {
    next(error);
  }
};
