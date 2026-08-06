import sharp from 'sharp';
import { supabaseAdmin } from '../config/supabase.js';

/**
 * Process raw image buffer (PNG, JPG, JPEG, WEBP, etc.), convert to .webp automatically,
 * and save as base64 data URI in the database for faster loading and direct retrieval
 */
export const processAndStoreWebpImage = async ({
  fileBuffer,
  originalName,
  productId,
  isPrimary = false,
  altText = ''
}) => {
  if (!fileBuffer) {
    throw new Error('Image file buffer is required');
  }

  // 1. Convert any incoming raw image (PNG, JPG, WEBP) to WebP format using Sharp
  // Resizing to max 1000x1000 and quality 85 to optimize Base64 string payload size
  const webpBuffer = await sharp(fileBuffer)
    .resize({ width: 1000, height: 1000, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 85, effort: 4 })
    .toBuffer();

  const metadata = await sharp(webpBuffer).metadata();

  // 2. Generate base64 data URI in webp format directly
  const imageUrl = `data:image/webp;base64,${webpBuffer.toString('base64')}`;

  // Generate a clean dummy filepath for reference
  const sanitizeName = (originalName || 'image')
    .replace(/\.[^/.]+$/, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '-');
  
  const timestamp = Date.now();
  const safeProdId = (productId || 'general').replace(/[^a-z0-9]/g, '-');
  const filePath = `products/${safeProdId}/${sanitizeName}-${timestamp}.webp`;

  // 3. Safely insert into product_images table
  let record = null;
  if (productId && productId !== 'temp-product') {
    const { data: insertedRecord, error: dbError } = await supabaseAdmin
      .from('product_images')
      .insert({
        product_id: productId,
        image_url: imageUrl,
        file_path: filePath,
        is_primary: isPrimary,
        format: 'webp',
        alt_text: altText || `${productId} webp image`
      })
      .select()
      .maybeSingle();

    if (dbError) {
      console.warn(`Non-fatal product_images insert notice (${dbError.message}). Image URL still successfully returned.`);
    } else {
      record = insertedRecord;
    }
  }

  return {
    ...(record || {}),
    public_url: imageUrl,
    image_url: imageUrl,
    file_path: filePath,
    width: metadata.width,
    height: metadata.height,
    sizeBytes: webpBuffer.length
  };
};

/**
 * Process raw hero image buffer (PNG, JPG, JPEG, WEBP, etc.), convert to .webp automatically,
 * and save as base64 data URI in the database specifically for the Hero showcase section
 */
export const processAndStoreHeroWebpImage = async ({
  fileBuffer,
  originalName,
  productId,
  altText = 'hero_image'
}) => {
  if (!fileBuffer) {
    throw new Error('Hero image file buffer is required');
  }

  // 1. Convert any incoming raw hero image (PNG, JPG, WEBP, GIF) to WebP format using Sharp
  // Resizing to high resolution 1400x1400 for crisp hero banners while optimizing Base64 payload size
  const webpBuffer = await sharp(fileBuffer)
    .resize({ width: 1400, height: 1400, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 85, effort: 4 })
    .toBuffer();

  const metadata = await sharp(webpBuffer).metadata();

  // 2. Generate base64 data URI in .webp format directly
  const imageUrl = `data:image/webp;base64,${webpBuffer.toString('base64')}`;

  const sanitizeName = (originalName || 'hero-image')
    .replace(/\.[^/.]+$/, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '-');
  
  const timestamp = Date.now();
  const safeProdId = (productId || 'general').replace(/[^a-z0-9]/g, '-');
  const filePath = `products/${safeProdId}/hero-${sanitizeName}-${timestamp}.webp`;

  let record = null;
  if (productId && productId !== 'temp-product') {
    // Delete any existing hero image entries for this product in product_images
    await supabaseAdmin
      .from('product_images')
      .delete()
      .eq('product_id', productId)
      .eq('alt_text', 'hero_image');

    const { data: insertedRecord, error: dbError } = await supabaseAdmin
      .from('product_images')
      .insert({
        product_id: productId,
        image_url: imageUrl,
        file_path: filePath,
        is_primary: false,
        format: 'webp',
        alt_text: 'hero_image'
      })
      .select()
      .maybeSingle();

    if (dbError) {
      console.warn(`Non-fatal product_images insert notice for hero image (${dbError.message}).`);
    } else {
      record = insertedRecord;
    }
  }

  return {
    ...(record || {}),
    public_url: imageUrl,
    image_url: imageUrl,
    file_path: filePath,
    format: 'webp',
    width: metadata.width,
    height: metadata.height,
    sizeBytes: webpBuffer.length
  };
};

