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
