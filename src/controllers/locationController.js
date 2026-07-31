import { supabase } from '../config/supabase.js';

export const getLocations = async (req, res, next) => {
  try {
    const { data: locations, error } = await supabase
      .from('brand_locations')
      .select('*');

    if (error) {
      return res.status(500).json({ success: false, error: error.message });
    }

    res.status(200).json({
      success: true,
      count: locations.length,
      locations
    });
  } catch (error) {
    next(error);
  }
};
