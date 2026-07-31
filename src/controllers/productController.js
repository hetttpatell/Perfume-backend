import { supabase, supabaseAdmin } from '../config/supabase.js';

export const getProducts = async (req, res, next) => {
  try {
    const { category, isHero, isFeatured } = req.body || {};
    let query = supabase
      .from('products')
      .select(`
        *,
        sizes:product_sizes(*),
        scentDetails:product_scent_details(*),
        images:product_images(*)
      `)
      .order('created_at', { ascending: false });

    if (category) {
      query = query.eq('category', category.toUpperCase());
    }

    if (isHero !== undefined && isHero !== null) {
      query = query.eq('is_hero', isHero === true || isHero === 'true');
    }

    if (isFeatured !== undefined && isFeatured !== null) {
      query = query.eq('is_featured', isFeatured === true || isFeatured === 'true');
    }

    const { data: products, error } = await query;

    if (error) {
      return res.status(500).json({ success: false, error: error.message });
    }

    res.status(200).json({
      success: true,
      count: products.length,
      products
    });
  } catch (error) {
    next(error);
  }
};

export const getProductById = async (req, res, next) => {
  try {
    const { id } = req.body || {};

    if (!id) {
      return res.status(400).json({ success: false, error: 'Product ID is required in request body' });
    }

    const { data: product, error } = await supabase
      .from('products')
      .select(`
        *,
        sizes:product_sizes(*),
        scentDetails:product_scent_details(*),
        images:product_images(*),
        reviews:reviews(*)
      `)
      .eq('id', id)
      .single();

    if (error || !product) {
      return res.status(404).json({ success: false, error: 'Product not found' });
    }

    res.status(200).json({
      success: true,
      product
    });
  } catch (error) {
    next(error);
  }
};

export const createProduct = async (req, res, next) => {
  try {
    const {
      id,
      name,
      frenchName,
      category,
      subtitle,
      price,
      inStock,
      badge,
      description,
      imageUrl,
      galleryImages,
      topNotes,
      heartNotes,
      baseNotes,
      heroTitle,
      heroSubtitle,
      heroQuote,
      heroNote1,
      heroNote2,
      heroNote3
    } = req.body;

    if (!name || !price) {
      return res.status(400).json({ success: false, error: 'Product name and price are required' });
    }

    const productId = id || name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');

    const productPayload = {
      id: productId,
      name,
      french_name: frenchName || name,
      category: (category || 'EXTRAIT DE PARFUM').toUpperCase(),
      subtitle: subtitle || '',
      price: Number(price),
      in_stock: inStock !== false,
      badge: badge || 'HAUTE COUTURE',
      description: description || '',
      image_url: imageUrl || 'https://images.unsplash.com/photo-1594035910387-fea47794261f?auto=format&fit=crop&w=600&q=80',
      gallery_images: Array.isArray(galleryImages) ? galleryImages : [],
      hero_title: heroTitle || name,
      hero_subtitle: heroSubtitle || frenchName || subtitle,
      hero_quote: heroQuote || description,
      hero_note_1: heroNote1 || 'Galbanum',
      hero_note_2: heroNote2 || 'Iris Pallida',
      hero_note_3: heroNote3 || 'Vetiver',
      is_hero: false,
      is_featured: false
    };

    const { data: newProduct, error: prodErr } = await supabaseAdmin
      .from('products')
      .upsert(productPayload)
      .select()
      .single();

    if (prodErr) {
      return res.status(500).json({ success: false, error: prodErr.message });
    }

    // Insert scent details
    await supabaseAdmin
      .from('product_scent_details')
      .upsert({
        product_id: productId,
        top_notes: topNotes || 'Galbanum, Bergamot',
        heart_notes: heartNotes || 'Iris Pallida, May Rose',
        base_notes: baseNotes || 'Vetiver, Cedarwood',
        scent_profile: 'Chypre Floral • Powdery Suede Iris',
        scent_family: 'Haute Parfumerie'
      });

    res.status(201).json({
      success: true,
      message: 'Product created successfully',
      product: newProduct
    });
  } catch (error) {
    next(error);
  }
};

export const updateProduct = async (req, res, next) => {
  try {
    const { id, ...updates } = req.body;
    if (!id) {
      return res.status(400).json({ success: false, error: 'Product ID is required' });
    }

    const dbPayload = {};
    if (updates.name !== undefined) dbPayload.name = updates.name;
    if (updates.frenchName !== undefined) dbPayload.french_name = updates.frenchName;
    if (updates.category !== undefined) dbPayload.category = updates.category.toUpperCase();
    if (updates.subtitle !== undefined) dbPayload.subtitle = updates.subtitle;
    if (updates.price !== undefined) dbPayload.price = Number(updates.price);
    if (updates.inStock !== undefined) dbPayload.in_stock = updates.inStock === true || updates.inStock === 'true';
    if (updates.badge !== undefined) dbPayload.badge = updates.badge;
    if (updates.description !== undefined) dbPayload.description = updates.description;
    if (updates.imageUrl !== undefined) dbPayload.image_url = updates.imageUrl;
    if (updates.galleryImages !== undefined) dbPayload.gallery_images = updates.galleryImages;
    if (updates.heroTitle !== undefined) dbPayload.hero_title = updates.heroTitle;
    if (updates.heroSubtitle !== undefined) dbPayload.hero_subtitle = updates.heroSubtitle;
    if (updates.heroQuote !== undefined) dbPayload.hero_quote = updates.heroQuote;
    if (updates.heroNote1 !== undefined) dbPayload.hero_note_1 = updates.heroNote1;
    if (updates.heroNote2 !== undefined) dbPayload.hero_note_2 = updates.heroNote2;
    if (updates.heroNote3 !== undefined) dbPayload.hero_note_3 = updates.heroNote3;

    const { data: updated, error } = await supabaseAdmin
      .from('products')
      .update(dbPayload)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return res.status(500).json({ success: false, error: error.message });
    }

    if (updates.topNotes || updates.heartNotes || updates.baseNotes) {
      await supabaseAdmin
        .from('product_scent_details')
        .update({
          ...(updates.topNotes && { top_notes: updates.topNotes }),
          ...(updates.heartNotes && { heart_notes: updates.heartNotes }),
          ...(updates.baseNotes && { base_notes: updates.baseNotes })
        })
        .eq('product_id', id);
    }

    res.status(200).json({
      success: true,
      message: 'Product updated successfully',
      product: updated
    });
  } catch (error) {
    next(error);
  }
};

export const deleteProduct = async (req, res, next) => {
  try {
    const { id } = req.body;
    if (!id) {
      return res.status(400).json({ success: false, error: 'Product ID is required' });
    }

    const { error } = await supabaseAdmin
      .from('products')
      .delete()
      .eq('id', id);

    if (error) {
      return res.status(500).json({ success: false, error: error.message });
    }

    res.status(200).json({
      success: true,
      message: `Product ${id} deleted successfully`
    });
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
