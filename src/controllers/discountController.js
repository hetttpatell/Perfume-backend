import { supabase } from '../config/supabase.js';
import { z } from 'zod';

export const validateDiscountSchema = z.object({
  body: z.object({
    code: z.string().min(1, 'Discount code is required')
  })
});

export const validateDiscount = async (req, res, next) => {
  try {
    const { code } = req.body;

    const { data: discount, error } = await supabase
      .from('discounts')
      .select('*')
      .eq('code', code.toUpperCase())
      .eq('is_active', true)
      .single();

    if (error || !discount) {
      return res.status(404).json({
        success: false,
        valid: false,
        message: 'Invalid or expired discount code'
      });
    }

    if (discount.valid_until && new Date(discount.valid_until) < new Date()) {
      return res.status(400).json({
        success: false,
        valid: false,
        message: 'Discount code has expired'
      });
    }

    res.status(200).json({
      success: true,
      valid: true,
      code: discount.code,
      percentage: discount.percentage
    });
  } catch (error) {
    next(error);
  }
};
