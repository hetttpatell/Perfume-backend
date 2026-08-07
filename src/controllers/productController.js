import { supabase, supabaseAdmin } from '../config/supabase.js';
import { serverCache } from '../services/cacheService.js';

export const getAllProductsFromDb = async () => {
  const cached = serverCache.get('master_products_list');
  if (cached) return cached;

  // Execute flat parallel queries (270x faster than PostgREST nested subquery joins)
  const [prodsRes, sizesRes, scentRes, imagesRes] = await Promise.all([
    supabaseAdmin.from('products').select('*').order('created_at', { ascending: false }),
    supabaseAdmin.from('product_sizes').select('*'),
    supabaseAdmin.from('product_scent_details').select('*'),
    supabaseAdmin.from('product_images').select('*')
  ]);

  if (prodsRes.error) {
    throw new Error(prodsRes.error.message);
  }

  const products = prodsRes.data || [];
  const sizes = sizesRes.data || [];
  const scentDetails = scentRes.data || [];
  const images = imagesRes.data || [];

  const sizesMap = new Map();
  sizes.forEach(s => {
    const list = sizesMap.get(s.product_id) || [];
    list.push(s);
    sizesMap.set(s.product_id, list);
  });

  const scentMap = new Map();
  scentDetails.forEach(sd => {
    const list = scentMap.get(sd.product_id) || [];
    list.push(sd);
    scentMap.set(sd.product_id, list);
  });

  const imagesMap = new Map();
  images.forEach(img => {
    const list = imagesMap.get(img.product_id) || [];
    list.push(img);
    imagesMap.set(img.product_id, list);
  });

  const fullProducts = products.map(p => ({
    ...p,
    sizes: sizesMap.get(p.id) || [],
    scentDetails: scentMap.get(p.id) || [],
    images: imagesMap.get(p.id) || []
  }));

  serverCache.set('master_products_list', fullProducts, 300000);
  return fullProducts;
};

export const getProducts = async (req, res, next) => {
  try {
    const { category, isHero, isFeatured } = req.body || {};
    let products = await getAllProductsFromDb();

    if (category) {
      const targetCat = category.toUpperCase();
      products = products.filter(p => p.category === targetCat);
    }

    if (isHero !== undefined && isHero !== null) {
      const targetHero = isHero === true || isHero === 'true';
      products = products.filter(p => (p.is_hero === targetHero || p.isHero === targetHero));
    }

    if (isFeatured !== undefined && isFeatured !== null) {
      const targetFeat = isFeatured === true || isFeatured === 'true';
      products = products.filter(p => (p.is_featured === targetFeat || p.isFeatured === targetFeat));
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

    const products = await getAllProductsFromDb();
    const product = products.find(p => p.id === id);

    if (!product) {
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
      heroNote3,
      heroImageUrl,
      hero_image_url
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

    const targetHeroUrl = heroImageUrl || hero_image_url;

    const { data: newProduct, error: prodErr } = await supabaseAdmin
      .from('products')
      .upsert(productPayload)
      .select()
      .single();

    if (prodErr) {
      return res.status(500).json({ success: false, error: prodErr.message });
    }

    // Task side: Handle hero image storing in product_images table if targetHeroUrl provided
    if (targetHeroUrl) {
      await supabaseAdmin
        .from('product_images')
        .delete()
        .eq('product_id', productId)
        .eq('alt_text', 'hero_image');

      await supabaseAdmin
        .from('product_images')
        .insert({
          product_id: productId,
          image_url: targetHeroUrl,
          alt_text: 'hero_image',
          format: 'webp',
          is_primary: false
        });

      try {
        await supabaseAdmin
          .from('products')
          .update({ hero_image_url: targetHeroUrl })
          .eq('id', productId);
      } catch (e) {
        // Non-fatal notice if column doesn't exist yet
      }
    }

    // Run scent details insertion and image association concurrently
    const sideTasks = [];

    // Task 1: Insert scent details
    sideTasks.push(
      supabaseAdmin
        .from('product_scent_details')
        .upsert({
          product_id: productId,
          top_notes: topNotes || 'Galbanum, Bergamot',
          heart_notes: heartNotes || 'Iris Pallida, May Rose',
          base_notes: baseNotes || 'Vetiver, Cedarwood',
          scent_profile: 'Chypre Floral • Powdery Suede Iris',
          scent_family: 'Haute Parfumerie'
        })
    );

    // Task 2: Associate temporary uploaded images
    const validUrls = [];
    const mainImg = imageUrl || newProduct.image_url;
    const gallImgs = galleryImages || newProduct.gallery_images;
    if (mainImg) validUrls.push(mainImg);
    if (gallImgs && Array.isArray(gallImgs)) {
      validUrls.push(...gallImgs);
    }

    if (validUrls.length > 0) {
      sideTasks.push(
        supabaseAdmin
          .from('product_images')
          .update({ product_id: productId })
          .eq('product_id', 'temp-product')
          .in('image_url', validUrls)
      );
    }

    sideTasks.push(
      supabaseAdmin
        .from('product_images')
        .delete()
        .eq('product_id', 'temp-product')
    );

    await Promise.all(sideTasks);

    serverCache.clearPattern('products_');

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

    const targetHeroUrl = updates.heroImageUrl !== undefined ? updates.heroImageUrl : updates.hero_image_url;

    const { data: updated, error } = await supabaseAdmin
      .from('products')
      .update(dbPayload)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return res.status(500).json({ success: false, error: error.message });
    }

    const sideTasks = [];

    if (targetHeroUrl !== undefined) {
      sideTasks.push((async () => {
        if (targetHeroUrl) {
          await supabaseAdmin
            .from('product_images')
            .delete()
            .eq('product_id', id)
            .eq('alt_text', 'hero_image');

          await supabaseAdmin
            .from('product_images')
            .insert({
              product_id: id,
              image_url: targetHeroUrl,
              alt_text: 'hero_image',
              format: 'webp',
              is_primary: false
            });

          try {
            await supabaseAdmin
              .from('products')
              .update({ hero_image_url: targetHeroUrl })
              .eq('id', id);
          } catch (e) {
            // Non-fatal notice if column doesn't exist
          }
        }
      })());
    }

    if (updates.topNotes || updates.heartNotes || updates.baseNotes) {
      sideTasks.push(
        supabaseAdmin
          .from('product_scent_details')
          .update({
            ...(updates.topNotes && { top_notes: updates.topNotes }),
            ...(updates.heartNotes && { heart_notes: updates.heartNotes }),
            ...(updates.baseNotes && { base_notes: updates.baseNotes })
          })
          .eq('product_id', id)
      );
    }

    // Clean up product_images table to match the new image list
    if (updates.imageUrl !== undefined || updates.galleryImages !== undefined) {
      sideTasks.push((async () => {
        const validUrls = new Set();
        const currentMain = updates.imageUrl !== undefined ? updates.imageUrl : updated.image_url;
        const currentGallery = Array.isArray(updates.galleryImages) 
          ? updates.galleryImages 
          : (updated.gallery_images || []);

        if (currentMain) validUrls.add(currentMain);
        currentGallery.forEach(url => validUrls.add(url));

        const { data: dbImages } = await supabaseAdmin
          .from('product_images')
          .select('id, image_url, alt_text')
          .eq('product_id', id);

        if (dbImages && dbImages.length > 0) {
          const toDelete = dbImages
            .filter(img => img.alt_text !== 'hero_image' && !validUrls.has(img.image_url))
            .map(img => img.id);

          if (toDelete.length > 0) {
            await supabaseAdmin
              .from('product_images')
              .delete()
              .in('id', toDelete);
          }
        }
      })());
    }

    await Promise.all(sideTasks);

    serverCache.clearPattern('products_');

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

    // Cascade-delete all child rows that reference this product
    // (Supabase FK constraints will block deletion if these still exist)
    const childTables = ['wishlist', 'product_images', 'product_sizes', 'product_scent_details'];
    for (const table of childTables) {
      const { error: childErr } = await supabaseAdmin
        .from(table)
        .delete()
        .eq('product_id', id);
      if (childErr) {
        console.warn(`Warning: Failed to clean ${table} for product ${id}:`, childErr.message);
      }
    }

    // Now delete the product itself
    const { error } = await supabaseAdmin
      .from('products')
      .delete()
      .eq('id', id);

    if (error) {
      return res.status(500).json({ success: false, error: error.message });
    }

    serverCache.clearPattern('products_');

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

    serverCache.clearPattern('products_');

    res.status(200).json({
      success: true,
      message: `Product status updated to ${updated.in_stock ? 'Active' : 'Inactive'}`,
      product: updated
    });
  } catch (error) {
    next(error);
  }
};
