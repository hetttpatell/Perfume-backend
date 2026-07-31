import { processAndStoreWebpImage } from '../services/imageService.js';
import { supabaseAdmin, supabase } from '../config/supabase.js';

export const uploadProductImage = async (req, res, next) => {
  try {
    const { productId, isPrimary, altText } = req.body;

    if (!req.file && !req.body.imageBase64) {
      return res.status(400).json({ success: false, error: 'Image file upload or base64 buffer is required' });
    }

    let fileBuffer;
    let originalName = 'uploaded-image';

    if (req.file) {
      fileBuffer = req.file.buffer;
      originalName = req.file.originalname;
    } else if (req.body.imageBase64) {
      const base64Data = req.body.imageBase64.replace(/^data:image\/\w+;base64,/, '');
      fileBuffer = Buffer.from(base64Data, 'base64');
    }

    const processedImage = await processAndStoreWebpImage({
      fileBuffer,
      originalName,
      productId: productId || 'temp-product',
      isPrimary: isPrimary === 'true' || isPrimary === true,
      altText
    });

    if (productId && productId !== 'temp-product') {
      if (isPrimary === 'true' || isPrimary === true) {
        await supabaseAdmin
          .from('products')
          .update({ image_url: processedImage.public_url })
          .eq('id', productId);
      } else {
        const { data: prod } = await supabase
          .from('products')
          .select('gallery_images')
          .eq('id', productId)
          .single();

        const currentGallery = prod?.gallery_images || [];
        const updatedGallery = Array.from(new Set([...currentGallery, processedImage.public_url]));

        await supabaseAdmin
          .from('products')
          .update({ gallery_images: updatedGallery })
          .eq('id', productId);
      }
    }

    res.status(201).json({
      success: true,
      message: 'Product image automatically converted to .webp and stored in database successfully',
      image: processedImage
    });
  } catch (error) {
    console.error('Error in uploadProductImage:', error);
    res.status(500).json({ success: false, error: error.message || 'Image upload and conversion failed' });
  }
};

export const uploadBatchProductImages = async (req, res, next) => {
  try {
    const { productId } = req.body;
    const files = req.files || [];

    if (!files || files.length === 0) {
      return res.status(400).json({ success: false, error: 'At least one image file is required' });
    }

    const processedImages = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const processed = await processAndStoreWebpImage({
        fileBuffer: file.buffer,
        originalName: file.originalname,
        productId: productId || 'temp-product',
        isPrimary: false,
        altText: `Product image ${i + 1}`
      });
      if (processed && processed.public_url) {
        processedImages.push(processed.public_url);
      }
    }

    res.status(201).json({
      success: true,
      message: `${processedImages.length} images converted to .webp and processed successfully`,
      images: processedImages
    });
  } catch (error) {
    console.error('Error in uploadBatchProductImages:', error);
    res.status(500).json({ success: false, error: error.message || 'Batch image upload failed' });
  }
};

export const getProductImages = async (req, res, next) => {
  try {
    const { productId } = req.body;

    if (!productId) {
      return res.status(400).json({ success: false, error: 'Product ID is required in request body' });
    }

    const { data: images, error } = await supabase
      .from('product_images')
      .select('*')
      .eq('product_id', productId)
      .order('is_primary', { ascending: false });

    if (error) {
      return res.status(500).json({ success: false, error: error.message });
    }

    res.status(200).json({
      success: true,
      count: images.length,
      images
    });
  } catch (error) {
    next(error);
  }
};

export const deleteProductImage = async (req, res, next) => {
  try {
    const { imageId } = req.body;

    if (!imageId) {
      return res.status(400).json({ success: false, error: 'Image ID is required in request body' });
    }

    const { data: imageRecord } = await supabaseAdmin
      .from('product_images')
      .select('*')
      .eq('id', imageId)
      .single();

    if (!imageRecord) {
      return res.status(404).json({ success: false, error: 'Image record not found' });
    }

    if (imageRecord.file_path) {
      await supabaseAdmin.storage.from('product-images').remove([imageRecord.file_path]);
    }

    const { error: deleteErr } = await supabaseAdmin
      .from('product_images')
      .delete()
      .eq('id', imageId);

    if (deleteErr) {
      return res.status(500).json({ success: false, error: deleteErr.message });
    }

    res.status(200).json({
      success: true,
      message: 'Product image deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};

export const toggleProductFlags = async (req, res, next) => {
  try {
    const { productId, isHero, isFeatured } = req.body;

    if (!productId) {
      return res.status(400).json({ success: false, error: 'Product ID is required in request payload' });
    }

    const updatePayload = {};
    if (isHero !== undefined) {
      updatePayload.is_hero = isHero === true || isHero === 'true';
    }
    if (isFeatured !== undefined) {
      updatePayload.is_featured = isFeatured === true || isFeatured === 'true';
    }

    if (Object.keys(updatePayload).length === 0) {
      return res.status(400).json({ success: false, error: 'Provide at least isHero or isFeatured boolean to update' });
    }

    const { data: updatedProduct, error } = await supabaseAdmin
      .from('products')
      .update(updatePayload)
      .eq('id', productId)
      .select()
      .single();

    if (error) {
      return res.status(500).json({ success: false, error: error.message });
    }

    res.status(200).json({
      success: true,
      message: `Updated product flags for ${productId}`,
      product: updatedProduct
    });
  } catch (error) {
    next(error);
  }
};

export const getDashboardStats = async (req, res, next) => {
  try {
    const { count: totalProducts } = await supabase.from('products').select('*', { count: 'exact', head: true });
    const { count: activeProducts } = await supabase.from('products').select('*', { count: 'exact', head: true }).eq('in_stock', true);
    const { count: heroProducts } = await supabase.from('products').select('*', { count: 'exact', head: true }).eq('is_hero', true);
    const { count: featuredProducts } = await supabase.from('products').select('*', { count: 'exact', head: true }).eq('is_featured', true);
    const { count: totalOrders } = await supabase.from('orders').select('*', { count: 'exact', head: true });
    const { count: totalUsers } = await supabase.from('profiles').select('*', { count: 'exact', head: true });
    const { count: totalDiscounts } = await supabase.from('discounts').select('*', { count: 'exact', head: true });
    const { count: totalCategories } = await supabase.from('categories').select('*', { count: 'exact', head: true });

    // Calculate total revenue from live orders
    const { data: orderData } = await supabase.from('orders').select('total_amount');
    const totalRevenue = (orderData || []).reduce((sum, o) => sum + (Number(o.total_amount) || 0), 0);

    // Fetch latest 5 orders for real live activity
    const { data: recentOrders } = await supabase
      .from('orders')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(5);

    // Fetch latest 5 products for live catalog activity
    const { data: recentProducts } = await supabase
      .from('products')
      .select('id, name, french_name, category, price, image_url, created_at')
      .order('created_at', { ascending: false })
      .limit(5);

    res.status(200).json({
      success: true,
      stats: {
        totalProducts: totalProducts || 0,
        activeProducts: activeProducts || 0,
        heroProducts: heroProducts || 0,
        featuredProducts: featuredProducts || 0,
        totalOrders: totalOrders || 0,
        totalUsers: totalUsers || 0,
        totalDiscounts: totalDiscounts || 0,
        totalCategories: totalCategories || 0,
        totalRevenue: totalRevenue || 0
      },
      recentOrders: recentOrders || [],
      recentProducts: recentProducts || []
    });
  } catch (error) {
    next(error);
  }
};

export const getUsersList = async (req, res, next) => {
  try {
    const { data: users, error } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      return res.status(500).json({ success: false, error: error.message });
    }

    res.status(200).json({
      success: true,
      count: users.length,
      users
    });
  } catch (error) {
    next(error);
  }
};

export const updateUserRole = async (req, res, next) => {
  try {
    const { userId, role } = req.body;
    if (!userId || !role) {
      return res.status(400).json({ success: false, error: 'User ID and Role are required' });
    }

    const { data: updated, error } = await supabaseAdmin
      .from('profiles')
      .update({ role })
      .eq('id', userId)
      .select()
      .single();

    if (error) {
      return res.status(500).json({ success: false, error: error.message });
    }

    res.status(200).json({
      success: true,
      message: `Updated user role to ${role}`,
      user: updated
    });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// CATEGORY CRUD CONTROLLERS
// ─────────────────────────────────────────────────────────────────────────────
export const getCategories = async (req, res, next) => {
  try {
    const { data: categories, error } = await supabase
      .from('categories')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) return res.status(500).json({ success: false, error: error.message });

    res.status(200).json({ success: true, categories: categories || [] });
  } catch (error) {
    next(error);
  }
};

export const createCategory = async (req, res, next) => {
  try {
    const { name, frenchName, description, isActive } = req.body;
    if (!name) return res.status(400).json({ success: false, error: 'Category name is required' });

    const id = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');

    const { data: newCat, error } = await supabaseAdmin
      .from('categories')
      .upsert({
        id,
        name: name.toUpperCase(),
        french_name: frenchName || name,
        description: description || '',
        is_active: isActive !== false
      })
      .select()
      .single();

    if (error) return res.status(500).json({ success: false, error: error.message });

    res.status(201).json({ success: true, message: 'Category created successfully', category: newCat });
  } catch (error) {
    next(error);
  }
};

export const updateCategory = async (req, res, next) => {
  try {
    const { id, name, frenchName, description, isActive } = req.body;
    if (!id) return res.status(400).json({ success: false, error: 'Category ID is required' });

    const updates = {};
    if (name !== undefined) updates.name = name.toUpperCase();
    if (frenchName !== undefined) updates.french_name = frenchName;
    if (description !== undefined) updates.description = description;
    if (isActive !== undefined) updates.is_active = isActive === true;

    const { data: updated, error } = await supabaseAdmin
      .from('categories')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) return res.status(500).json({ success: false, error: error.message });

    res.status(200).json({ success: true, message: 'Category updated successfully', category: updated });
  } catch (error) {
    next(error);
  }
};

export const deleteCategory = async (req, res, next) => {
  try {
    const { id } = req.body;
    if (!id) return res.status(400).json({ success: false, error: 'Category ID is required' });

    const { error } = await supabaseAdmin.from('categories').delete().eq('id', id);
    if (error) return res.status(500).json({ success: false, error: error.message });

    res.status(200).json({ success: true, message: 'Category deleted successfully' });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// DISCOUNT / COUPON CRUD CONTROLLERS
// ─────────────────────────────────────────────────────────────────────────────
export const getDiscounts = async (req, res, next) => {
  try {
    const { data: discounts, error } = await supabase
      .from('discounts')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) return res.status(500).json({ success: false, error: error.message });

    res.status(200).json({ success: true, discounts: discounts || [] });
  } catch (error) {
    next(error);
  }
};

export const createDiscount = async (req, res, next) => {
  try {
    const { code, percentage, maxUses, isActive, validUntil } = req.body;
    if (!code || percentage === undefined) {
      return res.status(400).json({ success: false, error: 'Coupon Code and Percentage are required' });
    }

    const { data: newCoupon, error } = await supabaseAdmin
      .from('discounts')
      .insert({
        code: code.toUpperCase(),
        percentage: Number(percentage),
        max_uses: Number(maxUses || 100),
        used_count: 0,
        is_active: isActive !== false,
        valid_until: validUntil || null
      })
      .select()
      .single();

    if (error) return res.status(500).json({ success: false, error: error.message });

    res.status(201).json({ success: true, message: 'Coupon created successfully', discount: newCoupon });
  } catch (error) {
    next(error);
  }
};

export const updateDiscount = async (req, res, next) => {
  try {
    const { id, code, percentage, maxUses, isActive, validUntil } = req.body;
    if (!id) return res.status(400).json({ success: false, error: 'Coupon ID is required' });

    const updates = {};
    if (code !== undefined) updates.code = code.toUpperCase();
    if (percentage !== undefined) updates.percentage = Number(percentage);
    if (maxUses !== undefined) updates.max_uses = Number(maxUses);
    if (isActive !== undefined) updates.is_active = isActive === true;
    if (validUntil !== undefined) updates.valid_until = validUntil || null;

    const { data: updated, error } = await supabaseAdmin
      .from('discounts')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) return res.status(500).json({ success: false, error: error.message });

    res.status(200).json({ success: true, message: 'Coupon updated successfully', discount: updated });
  } catch (error) {
    next(error);
  }
};

export const deleteDiscount = async (req, res, next) => {
  try {
    const { id } = req.body;
    if (!id) return res.status(400).json({ success: false, error: 'Coupon ID is required' });

    const { error } = await supabaseAdmin.from('discounts').delete().eq('id', id);
    if (error) return res.status(500).json({ success: false, error: error.message });

    res.status(200).json({ success: true, message: 'Coupon deleted successfully' });
  } catch (error) {
    next(error);
  }
};

export const toggleProductStock = async (req, res, next) => {
  try {
    const { id, inStock } = req.body;
    if (!id) {
      return res.status(400).json({ success: false, error: 'Product ID is required' });
    }

    const { data: updated, error } = await supabaseAdmin
      .from('products')
      .update({ in_stock: inStock === true || inStock === 'true' })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return res.status(500).json({ success: false, error: error.message });
    }

    res.status(200).json({
      success: true,
      message: `Product status updated to ${updated.in_stock ? 'Active' : 'Inactive'}`,
      product: updated
    });
  } catch (error) {
    next(error);
  }
};
