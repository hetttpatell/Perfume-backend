import { Resend } from 'resend';
import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
import { supabaseAdmin } from '../config/supabase.js';
import { getAllProductsFromDb } from '../controllers/productController.js';

dotenv.config();

// ─────────────────────────────────────────────────────────────────────────────
// Email Clients Initialization (Dual Engine: Resend + Gmail SMTP)
// ─────────────────────────────────────────────────────────────────────────────
const resend = process.env.RESEND_API_KEY && process.env.RESEND_API_KEY !== 're_REPLACE_WITH_YOUR_API_KEY'
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

const SENDER_EMAIL = process.env.SENDER_EMAIL || 'onboarding@resend.dev';
const REPLY_TO_EMAIL = process.env.REPLY_TO_EMAIL || 'lunefragrance1@gmail.com';
const SENDER_NAME = 'Maison Lune Haute Parfumerie';

// Gmail / Custom SMTP configuration (Allows sending to ANY customer without domain verification)
const smtpUser = process.env.SMTP_USER || process.env.GMAIL_USER || 'lunefragrance1@gmail.com';
const smtpPass = process.env.SMTP_PASS || process.env.GMAIL_APP_PASSWORD || null;

const smtpTransporter = smtpPass
  ? nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: smtpUser,
        pass: smtpPass.replace(/\s+/g, ''), // clean spaces from Google App Password
      },
    })
  : null;

// ─────────────────────────────────────────────────────────────────────────────
// Order 4-Stage Definitions & Visual Styling
// ─────────────────────────────────────────────────────────────────────────────
export const ORDER_STAGES = [
  {
    key: 'ordered',
    number: '01',
    label: 'ORDERED',
    color: '#D97706', // Amber / Gold
    bgLight: '#FEF3C7',
    badgeText: 'STAGE 1/4 · ORDER CONFIRMED',
    subject: 'Order Confirmed & Atelier Preparation Underway',
    headline: 'YOUR ORDER HAS BEEN RECEIVED',
    subheadline: 'Our master perfumers in the Paris atelier are preparing your bespoke creations with meticulous care.',
    estimatedDeliveryNote: 'Estimated Dispatch: Within 24-48 business hours via Express Courier.',
  },
  {
    key: 'dispatched',
    number: '02',
    label: 'DISPATCHED',
    color: '#2563EB', // Sapphire Blue
    bgLight: '#DBEAFE',
    badgeText: 'STAGE 2/4 · ORDER DISPATCHED',
    subject: 'Order Dispatched & In Transit',
    headline: 'YOUR CREATION IS ON ITS WAY',
    subheadline: 'Your order has been sealed in our signature presentation box and handed over to our luxury courier.',
    estimatedDeliveryNote: 'Estimated Arrival: 2 to 4 business days to your designated address.',
  },
  {
    key: 'out_for_delivery',
    number: '03',
    label: 'OUT FOR DELIVERY',
    color: '#7C3AED', // Royal Violet
    bgLight: '#EDE9FE',
    badgeText: 'STAGE 3/4 · OUT FOR DELIVERY',
    subject: 'Out for Delivery Today',
    headline: 'YOUR PACKAGE IS ARRIVING TODAY',
    subheadline: 'Your courier has loaded your parcel and is en route. Please ensure someone is available to receive the package.',
    estimatedDeliveryNote: 'Delivery Scheduled: Today during standard courier delivery hours.',
  },
  {
    key: 'delivered',
    number: '04',
    label: 'DELIVERED',
    color: '#059669', // Emerald Green
    bgLight: '#D1FAE5',
    badgeText: 'STAGE 4/4 · DELIVERED',
    subject: 'Delivered — Enjoy Your Maison Lune Fragrance',
    headline: 'YOUR CREATION HAS BEEN DELIVERED',
    subheadline: 'Your package has been successfully delivered. We invite you to discover the olfactory symphony inside.',
    estimatedDeliveryNote: 'Delivered: Handed over / placed securely at destination address.',
  },
];

// Normalize status key to one of the 4 valid stages
export function normalizeStageKey(status) {
  const s = String(status || '').toLowerCase().trim();
  if (s === 'ordered' || s === 'pending' || s === 'processing' || s === 'confirmed') return 'ordered';
  if (s === 'dispatched' || s === 'dispatch' || s === 'shipped' || s === 'in_transit') return 'dispatched';
  if (s === 'out_for_delivery' || s === 'out-for-delivery' || s === 'out for delivery' || s === 'out_of_delivery') return 'out_for_delivery';
  if (s === 'delivered' || s === 'received' || s === 'completed') return 'delivered';
  return 'ordered';
}

// ─────────────────────────────────────────────────────────────────────────────
// HTML Builders for Luxury Email
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Visual 4-Stage Stepper Bar
 */
function buildStageTrackerHtml(currentKey) {
  const activeKey = normalizeStageKey(currentKey);
  const currentIndex = ORDER_STAGES.findIndex(s => s.key === activeKey);

  const stageCells = ORDER_STAGES.map((stg, idx) => {
    const isCompleted = idx < currentIndex;
    const isCurrent = idx === currentIndex;
    const isPending = idx > currentIndex;

    let circleBg = '#E5E7EB';
    let circleText = '#9CA3AF';
    let labelColor = '#9CA3AF';
    let labelWeight = '500';
    let borderStyle = 'none';

    if (isCompleted) {
      circleBg = '#111111';
      circleText = '#C08A3E';
      labelColor = '#111111';
      labelWeight = '700';
    } else if (isCurrent) {
      circleBg = stg.color;
      circleText = '#FFFFFF';
      labelColor = '#111111';
      labelWeight = '800';
      borderStyle = `2px solid ${stg.color}`;
    }

    const stepContent = isCompleted
      ? `<span style="font-size:14px;color:#C08A3E;">✓</span>`
      : stg.number;

    return `
      <td style="text-align:center;padding:0 4px;vertical-align:top;width:25%;">
        <div style="width:36px;height:36px;border-radius:50%;background:${circleBg};color:${circleText};font-size:12px;font-weight:bold;line-height:36px;text-align:center;margin:0 auto 6px auto;font-family:system-ui,-apple-system,sans-serif;${borderStyle !== 'none' ? `box-shadow:0 0 0 3px ${stg.bgLight};` : ''}">
          ${stepContent}
        </div>
        <div style="font-size:9px;letter-spacing:1px;color:${labelColor};font-weight:${labelWeight};font-family:system-ui,-apple-system,sans-serif;text-transform:uppercase;line-height:1.2;">
          ${stg.label}
        </div>
      </td>
    `;
  }).join('');

  return `
    <table cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:12px 0 0 0;">
      <tr>${stageCells}</tr>
    </table>
  `;
}

/**
 * Build Itemized Products List
 */
function buildItemsHtml(items) {
  if (!items || items.length === 0) {
    return `
      <tr>
        <td style="padding:16px;text-align:center;color:#888888;font-size:12px;font-style:italic;">
          Standard Maison Lune Atelier Order Selection
        </td>
      </tr>
    `;
  }

  return items.map((item, idx) => {
    const productName = item.product?.name || item.product_name || item.name || 'Maison Lune Fragrance';
    const frenchName = item.product?.french_name || item.french_name || item.product?.frenchName || '';
    const size = item.size || '50 ml';
    const qty = Number(item.quantity || item.qty || 1);
    const unitPrice = Number(item.unit_price || item.price || 0);
    const lineTotal = (unitPrice * qty).toFixed(2);
    const imageUrl = item.product?.image_url || item.image_url || item.image || '';
    const engraving = item.engraving_text || item.engravingText || item.engraving || null;

    const isLast = idx === items.length - 1;
    const borderBottom = isLast ? 'none' : '1px solid #F0F0F0';

    const imageHtml = imageUrl
      ? `<img src="${imageUrl}" alt="${productName}" width="64" height="64" style="border-radius:10px;object-fit:contain;background:#FFFFFF;border:1px solid #EAEAEA;display:block;" />`
      : `<div style="width:64px;height:64px;border-radius:10px;background:#F8F8F8;border:1px solid #EAEAEA;text-align:center;line-height:64px;font-size:20px;">🧴</div>`;

    return `
      <tr>
        <td style="padding:16px 0;border-bottom:${borderBottom};vertical-align:top;">
          <table cellpadding="0" cellspacing="0" border="0" width="100%">
            <tr>
              <td width="72" style="vertical-align:top;">
                ${imageHtml}
              </td>
              <td style="padding-left:14px;vertical-align:top;">
                <div style="font-family:system-ui,-apple-system,sans-serif;font-size:13px;font-weight:700;color:#111111;text-transform:uppercase;letter-spacing:0.5px;">
                  ${productName}
                </div>
                ${frenchName ? `<div style="font-family:Georgia,serif;font-size:11px;color:#777777;font-style:italic;margin-top:2px;">${frenchName}</div>` : ''}
                
                <div style="font-family:system-ui,-apple-system,sans-serif;font-size:11px;color:#555555;margin-top:6px;">
                  <span style="font-weight:600;color:#111111;">SIZE:</span> ${size} &nbsp;•&nbsp; 
                  <span style="font-weight:600;color:#111111;">QTY:</span> ${qty} &nbsp;•&nbsp; 
                  <span style="color:#666666;">$${unitPrice.toFixed(2)} USD each</span>
                </div>

                ${engraving ? `
                  <div style="margin-top:6px;display:inline-block;padding:3px 8px;background:#FEF3C7;border:1px solid #FDE68A;border-radius:6px;font-size:10px;color:#92400E;font-family:system-ui,-apple-system,sans-serif;font-weight:600;">
                    ✨ BOTTLE ENGRAVING: "${engraving}"
                  </div>
                ` : ''}
              </td>
              <td style="text-align:right;vertical-align:top;white-space:nowrap;padding-left:10px;">
                <div style="font-family:system-ui,-apple-system,sans-serif;font-size:14px;font-weight:800;color:#111111;">
                  $${lineTotal} <span style="font-size:10px;font-weight:500;color:#666666;">USD</span>
                </div>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    `;
  }).join('');
}

/**
 * Build Formatted Delivery & Recipient Card
 */
function buildShippingCardHtml(address, customerEmail, guestName, guestPhone) {
  const addr = address || {};
  const recipientName = addr.fullName || addr.full_name || addr.name || guestName || 'Valued Patron';
  const phone = addr.phone || guestPhone || 'Not specified';
  const email = customerEmail || addr.email || 'Not specified';

  const addressLine1 = addr.street || addr.street_address || addr.address || '';
  const cityStateZip = [
    addr.city,
    addr.state,
    addr.postalCode || addr.postal_code || addr.zip
  ].filter(Boolean).join(', ');
  const country = addr.country || 'International';

  const formattedAddress = [addressLine1, cityStateZip, country].filter(Boolean).join(' — ') || 'Atelier Vault Delivery';

  return `
    <table cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#F9F9FB;border:1px solid #EBEBF0;border-radius:12px;padding:16px;">
      <tr>
        <td style="padding:16px;">
          <table cellpadding="0" cellspacing="0" border="0" width="100%">
            <tr>
              <td width="50%" style="vertical-align:top;padding-right:12px;border-right:1px solid #EAEAEA;">
                <div style="font-family:system-ui,-apple-system,sans-serif;font-size:10px;font-weight:700;letter-spacing:1.5px;color:#C08A3E;text-transform:uppercase;">
                  RECIPIENT & CONTACT
                </div>
                <div style="font-family:system-ui,-apple-system,sans-serif;font-size:13px;font-weight:700;color:#111111;margin-top:6px;">
                  ${recipientName}
                </div>
                <div style="font-family:system-ui,-apple-system,sans-serif;font-size:11px;color:#555555;margin-top:3px;">
                  📞 ${phone}
                </div>
                <div style="font-family:system-ui,-apple-system,sans-serif;font-size:11px;color:#2563EB;margin-top:2px;">
                  ✉️ ${email}
                </div>
              </td>
              <td width="50%" style="vertical-align:top;padding-left:16px;">
                <div style="font-family:system-ui,-apple-system,sans-serif;font-size:10px;font-weight:700;letter-spacing:1.5px;color:#C08A3E;text-transform:uppercase;">
                  DELIVERY DESTINATION
                </div>
                <div style="font-family:system-ui,-apple-system,sans-serif;font-size:12px;color:#222222;margin-top:6px;line-height:1.5;">
                  ${formattedAddress}
                </div>
                <div style="font-family:system-ui,-apple-system,sans-serif;font-size:10px;color:#059669;font-weight:600;margin-top:4px;">
                  ✓ Signature Required Delivery
                </div>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  `;
}

/**
 * Format Order Reference #
 */
function formatOrderId(id) {
  if (!id) return 'ML-00000';
  const clean = String(id).replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
  return `#${clean.substring(0, 8)}`;
}

/**
 * Format Date String
 */
function formatDate(dateStr) {
  try {
    const d = dateStr ? new Date(dateStr) : new Date();
    return d.toLocaleDateString('en-US', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch {
    return 'Confirmed';
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Master Haute Parfumerie Email Generator
// ─────────────────────────────────────────────────────────────────────────────
function buildLuxuryEmailHtml({ order, items, stageKey, customerEmail }) {
  const activeKey = normalizeStageKey(stageKey || order.status);
  const stageInfo = ORDER_STAGES.find(s => s.key === activeKey) || ORDER_STAGES[0];

  const orderId = formatOrderId(order.id);
  const orderDate = formatDate(order.created_at);
  const shippingAddress = order.shipping_address || {};

  // Financial calculations
  let subtotal = Number(order.subtotal || 0);
  if (subtotal === 0 && Array.isArray(items) && items.length > 0) {
    subtotal = items.reduce((sum, it) => sum + (Number(it.unit_price || it.price || 0) * Number(it.quantity || 1)), 0);
  }
  const discount = Number(order.discount_amount || order.discount || 0);
  let total = Number(order.total || order.total_amount || (subtotal - discount));
  if (total < 0) total = 0;

  const discountPercent = subtotal > 0 && discount > 0 ? Math.round((discount / subtotal) * 100) : 0;

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1.0" />
  <title>Maison Lune — ${stageInfo.subject} (${orderId})</title>
</head>
<body style="margin:0;padding:0;background-color:#F4F4F0;font-family:system-ui,-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased;">
  <table cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:#F4F4F0;padding:24px 0 40px 0;">
    <tr>
      <td align="center">
        <!-- Main Email Container -->
        <table cellpadding="0" cellspacing="0" border="0" width="620" style="max-width:620px;width:100%;background-color:#FFFFFF;border-radius:16px;overflow:hidden;box-shadow:0 8px 30px rgba(0,0,0,0.06);border:1px solid #E8E8E2;">

          <!-- ══════════════════ 1. BRAND HEADER ══════════════════ -->
          <tr>
            <td style="background-color:#111111;padding:28px 32px;text-align:center;">
              <table cellpadding="0" cellspacing="0" border="0" width="100%">
                <tr>
                  <td align="center">
                    <div style="font-family:Georgia,serif;font-size:22px;font-weight:700;letter-spacing:7px;color:#C08A3E;text-transform:uppercase;">
                      MAISON LUNE
                    </div>
                    <div style="font-family:system-ui,-apple-system,sans-serif;font-size:9px;letter-spacing:4px;color:#A0A0A0;margin-top:6px;text-transform:uppercase;">
                      HAUTE PARFUMERIE · PARIS
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- ══════════════════ 2. STAGE STATUS HERO BANNER ══════════════════ -->
          <tr>
            <td style="padding:28px 32px 16px 32px;text-align:center;background-color:#FAFAFA;border-bottom:1px solid #EEEEEE;">
              <!-- Stage Pill Badge -->
              <div style="display:inline-block;background-color:${stageInfo.bgLight};color:${stageInfo.color};font-family:system-ui,-apple-system,sans-serif;font-size:10px;font-weight:800;letter-spacing:2px;padding:6px 16px;border-radius:24px;text-transform:uppercase;border:1px solid ${stageInfo.color}30;margin-bottom:12px;">
                ● ${stageInfo.badgeText}
              </div>

              <!-- Main Stage Headline -->
              <div style="font-family:Georgia,serif;font-size:22px;font-weight:700;color:#111111;letter-spacing:0.5px;text-transform:uppercase;line-height:1.3;">
                ${stageInfo.headline}
              </div>

              <!-- Stage Narrative Subtitle -->
              <div style="font-family:system-ui,-apple-system,sans-serif;font-size:13px;color:#555555;line-height:1.6;margin-top:10px;max-width:480px;margin-left:auto;margin-right:auto;">
                ${stageInfo.subheadline}
              </div>
            </td>
          </tr>

          <!-- ══════════════════ 3. 4-STAGE LIVE PROGRESS STEPPER ══════════════════ -->
          <tr>
            <td style="padding:24px 32px;background-color:#FFFFFF;border-bottom:1px solid #F0F0F0;">
              <div style="font-family:system-ui,-apple-system,sans-serif;font-size:10px;font-weight:800;letter-spacing:2px;color:#888888;text-transform:uppercase;text-align:center;margin-bottom:12px;">
                FULFILLMENT TIMELINE (STAGE ${stageInfo.number} OF 04)
              </div>
              
              ${buildStageTrackerHtml(activeKey)}

              <div style="margin-top:16px;background-color:${stageInfo.bgLight};border-radius:8px;padding:10px 14px;text-align:center;font-size:11px;color:${stageInfo.color};font-family:system-ui,-apple-system,sans-serif;font-weight:600;">
                ℹ️ ${stageInfo.estimatedDeliveryNote}
              </div>
            </td>
          </tr>

          <!-- ══════════════════ 4. ORDER REFERENCE BAR ══════════════════ -->
          <tr>
            <td style="padding:18px 32px;background-color:#F9F9FB;border-bottom:1px solid #EEEEEE;">
              <table cellpadding="0" cellspacing="0" border="0" width="100%">
                <tr>
                  <td>
                    <div style="font-family:system-ui,-apple-system,sans-serif;font-size:10px;font-weight:700;letter-spacing:1.5px;color:#888888;text-transform:uppercase;">
                      ORDER REFERENCE
                    </div>
                    <div style="font-family:Georgia,serif;font-size:18px;font-weight:700;color:#111111;margin-top:2px;">
                      ${orderId}
                    </div>
                    <div style="font-family:system-ui,-apple-system,sans-serif;font-size:11px;color:#666666;margin-top:2px;">
                      Placed on ${orderDate}
                    </div>
                  </td>
                  <td style="text-align:right;vertical-align:middle;">
                    <div style="display:inline-block;padding:6px 12px;background-color:#EBFBF3;border:1px solid #10B98130;border-radius:8px;font-size:11px;font-weight:700;color:#065F46;font-family:system-ui,-apple-system,sans-serif;">
                      ✓ PAYMENT CONFIRMED
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- ══════════════════ 5. ITEMIZED CREATIONS ══════════════════ -->
          <tr>
            <td style="padding:24px 32px 8px 32px;">
              <div style="font-family:system-ui,-apple-system,sans-serif;font-size:11px;font-weight:800;letter-spacing:2px;color:#C08A3E;text-transform:uppercase;margin-bottom:8px;">
                CREATIONS IN THIS ORDER (${items.length})
              </div>
              <table cellpadding="0" cellspacing="0" border="0" width="100%">
                ${buildItemsHtml(items)}
              </table>
            </td>
          </tr>

          <!-- ══════════════════ 6. FINANCIAL BREAKDOWN ══════════════════ -->
          <tr>
            <td style="padding:16px 32px;">
              <table cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:#F9F9FB;border:1px solid #EBEBF0;border-radius:12px;">
                <tr>
                  <td style="padding:18px;">
                    <table cellpadding="0" cellspacing="0" border="0" width="100%">
                      <!-- Actual Amount (Subtotal) -->
                      <tr>
                        <td style="font-family:system-ui,-apple-system,sans-serif;font-size:12px;font-weight:600;color:#555555;padding:4px 0;">
                          1. Actual Amount (Subtotal)
                        </td>
                        <td style="font-family:system-ui,-apple-system,sans-serif;font-size:12px;font-weight:700;color:#111111;text-align:right;padding:4px 0;">
                          $${subtotal.toFixed(2)} USD
                        </td>
                      </tr>

                      <!-- Coupon Discount -->
                      ${discount > 0 ? `
                      <tr>
                        <td style="font-family:system-ui,-apple-system,sans-serif;font-size:12px;font-weight:600;color:#C08A3E;padding:4px 0;">
                          2. Coupon Discount ${discountPercent > 0 ? `(-${discountPercent}%)` : ''}
                        </td>
                        <td style="font-family:system-ui,-apple-system,sans-serif;font-size:12px;font-weight:700;color:#C08A3E;text-align:right;padding:4px 0;">
                          -$${discount.toFixed(2)} USD
                        </td>
                      </tr>
                      ` : `
                      <tr>
                        <td style="font-family:system-ui,-apple-system,sans-serif;font-size:12px;font-weight:600;color:#888888;padding:4px 0;">
                          2. Coupon Discount
                        </td>
                        <td style="font-family:system-ui,-apple-system,sans-serif;font-size:12px;font-weight:600;color:#888888;text-align:right;padding:4px 0;">
                          $0.00 USD
                        </td>
                      </tr>
                      `}

                      <!-- Luxury Delivery -->
                      <tr>
                        <td style="font-family:system-ui,-apple-system,sans-serif;font-size:12px;font-weight:600;color:#555555;padding:4px 0;">
                          Complimentary Atelier Express Delivery
                        </td>
                        <td style="font-family:system-ui,-apple-system,sans-serif;font-size:12px;font-weight:700;color:#059669;text-align:right;padding:4px 0;">
                          FREE (Included)
                        </td>
                      </tr>

                      <tr>
                        <td colspan="2" style="padding:10px 0 0 0;border-top:1px solid #E2E2EA;"></td>
                      </tr>

                      <!-- Final Amount Paid -->
                      <tr>
                        <td style="font-family:system-ui,-apple-system,sans-serif;font-size:14px;font-weight:800;color:#111111;text-transform:uppercase;padding:4px 0;">
                          3. Final Amount Paid
                        </td>
                        <td style="font-family:Georgia,serif;font-size:20px;font-weight:700;color:#111111;text-align:right;padding:4px 0;">
                          $${total.toFixed(2)} <span style="font-size:11px;font-family:system-ui,sans-serif;font-weight:600;color:#666666;">USD</span>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- ══════════════════ 7. DELIVERY & RECIPIENT CARD ══════════════════ -->
          <tr>
            <td style="padding:12px 32px 24px 32px;">
              <div style="font-family:system-ui,-apple-system,sans-serif;font-size:11px;font-weight:800;letter-spacing:2px;color:#C08A3E;text-transform:uppercase;margin-bottom:8px;">
                DELIVERY DETAILS
              </div>
              ${buildShippingCardHtml(shippingAddress, customerEmail, order.guest_name, order.guest_phone)}
            </td>
          </tr>

          <!-- ══════════════════ 8. CONCIERGE & SUPPORT CTA ══════════════════ -->
          <tr>
            <td style="padding:20px 32px;background-color:#FAFAFA;border-top:1px solid #EEEEEE;text-align:center;">
              <div style="font-family:Georgia,serif;font-size:14px;font-weight:700;color:#111111;">
                NEED ASSISTANCE WITH YOUR ORDER?
              </div>
              <div style="font-family:system-ui,-apple-system,sans-serif;font-size:12px;color:#666666;margin-top:4px;">
                Our Haute Parfumerie Concierge is available 7 days a week for olfactory guidance.
              </div>
              <div style="margin-top:12px;">
                <a href="mailto:${REPLY_TO_EMAIL}?subject=Inquiry%20regarding%20Order%20${orderId}" style="display:inline-block;padding:10px 22px;background-color:#111111;color:#C08A3E;text-decoration:none;font-family:system-ui,-apple-system,sans-serif;font-size:11px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;border-radius:30px;border:1px solid #C08A3E;">
                  CONTACT CONCIERGE ATELIER
                </a>
              </div>
            </td>
          </tr>

          <!-- ══════════════════ 9. LUXURY FOOTER ══════════════════ -->
          <tr>
            <td style="background-color:#111111;padding:32px;text-align:center;">
              <div style="font-family:Georgia,serif;font-size:14px;color:#C08A3E;letter-spacing:4px;text-transform:uppercase;">
                MAISON LUNE
              </div>
              <div style="font-family:system-ui,-apple-system,sans-serif;font-size:11px;color:#888888;margin-top:8px;line-height:1.6;">
                Exceptional French Haute Parfumerie · Hand-Crafted In Small Batches
              </div>
              <div style="font-family:system-ui,-apple-system,sans-serif;font-size:10px;color:#555555;margin-top:16px;">
                © ${new Date().getFullYear()} Maison Lune Parfums Paris. All rights reserved.<br />
                This is an automated transactional update regarding order ${orderId}.
              </div>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

// ─────────────────────────────────────────────────────────────────────────────
// Database Helper: Full Order & Items Resolution
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Fully resolves an order object with its order_items and product details
 * regardless of PostgREST schema variations.
 */
export async function fetchFullOrderForEmail(orderIdOrObject) {
  let order = orderIdOrObject;

  // If passed an ID string, fetch the order from DB
  if (typeof orderIdOrObject === 'string' || typeof orderIdOrObject === 'number') {
    const { data, error } = await supabaseAdmin
      .from('orders')
      .select('*')
      .eq('id', orderIdOrObject)
      .single();

    if (error || !data) {
      throw new Error(`Order ${orderIdOrObject} not found: ${error?.message}`);
    }
    order = data;
  }

  // Parse shipping_address if it is a JSON string
  if (order.shipping_address && typeof order.shipping_address === 'string') {
    try {
      order.shipping_address = JSON.parse(order.shipping_address);
    } catch {
      // keep as is
    }
  }

  // Fetch order items for this order
  const { data: orderItems, error: itemsErr } = await supabaseAdmin
    .from('order_items')
    .select('*')
    .eq('order_id', order.id);

  if (itemsErr) {
    console.error('📧 Error fetching order_items for email:', itemsErr.message);
  }

  const rawItems = orderItems || [];

  // Fetch products catalog to resolve complete metadata (images, french_name, etc.)
  const products = await getAllProductsFromDb().catch(() => []);
  const prodMap = new Map();
  products.forEach(p => {
    prodMap.set(p.id, {
      name: p.name,
      french_name: p.french_name || p.frenchName || p.name,
      image_url: p.image_url || p.imageUrl || p.image || (p.images?.[0]?.url) || ''
    });
  });

  const enrichedItems = rawItems.map(item => {
    const prod = prodMap.get(item.product_id) || {
      name: item.product_name || 'Maison Lune Creation',
      french_name: '',
      image_url: ''
    };
    return {
      ...item,
      product: prod
    };
  });

  // Resolve customer email address
  let customerEmail = order.guest_email || order.shipping_address?.email || order.shipping_address?.userEmail || null;

  if (!customerEmail && order.user_id) {
    // Check profiles table
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('email')
      .eq('id', order.user_id)
      .single();
    if (profile?.email) customerEmail = profile.email;
  }

  if (!customerEmail && order.user_id) {
    // Check Supabase Auth Users
    const { data: authData } = await supabaseAdmin.auth.admin.getUserById(order.user_id).catch(() => ({ data: {} }));
    if (authData?.user?.email) customerEmail = authData.user.email;
  }

  return {
    order,
    items: enrichedItems,
    customerEmail
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Public API: Send Order Confirmation Email (Initial Placement)
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Send an ultra-professional order confirmation email when an order is placed.
 * @param {Object|string} orderOrId - Database order object or order ID string
 * @param {Array} [providedItems] - Optional pre-loaded items array
 * @param {string} [providedEmail] - Optional pre-resolved customer email
 */
// ─────────────────────────────────────────────────────────────────────────────
// Universal Email Delivery Engine (SMTP / Gmail + Resend)
// ─────────────────────────────────────────────────────────────────────────────
async function dispatchEmail({ recipient, subject, html }) {
  if (!recipient) {
    console.warn('📧 Email skipped: No recipient email address provided.');
    return { success: false, reason: 'Recipient email missing' };
  }

  // 1. Direct Gmail / SMTP Delivery (Works immediately for ANY customer email without domain verification)
  if (smtpTransporter) {
    try {
      console.log(`📧 Dispatching email via Gmail SMTP to customer: ${recipient} | Subject: "${subject}"...`);
      const info = await smtpTransporter.sendMail({
        from: `"${SENDER_NAME}" <${smtpUser}>`,
        replyTo: REPLY_TO_EMAIL,
        to: recipient,
        subject,
        html,
      });

      console.log(`✅ Email delivered to customer via Gmail SMTP: ${recipient} (Message ID: ${info.messageId})`);
      return { success: true, id: info.messageId, provider: 'smtp', recipient };
    } catch (smtpErr) {
      console.error(`❌ SMTP Error for ${recipient}:`, smtpErr.message);
    }
  }

  // 2. Resend API Delivery
  if (resend) {
    try {
      console.log(`📧 Dispatching email via Resend to customer: ${recipient} | Subject: "${subject}"...`);
      const { data, error } = await resend.emails.send({
        from: `${SENDER_NAME} <${SENDER_EMAIL}>`,
        reply_to: REPLY_TO_EMAIL,
        to: [recipient],
        subject,
        html,
      });

      if (!error) {
        console.log(`✅ Email delivered to customer via Resend: ${recipient} (Resend ID: ${data?.id})`);
        return { success: true, id: data?.id, provider: 'resend', recipient };
      }

      console.error(`❌ Resend API Error for customer (${recipient}):`, error.message || error);
      return { success: false, error };
    } catch (err) {
      console.error(`❌ Resend Exception for ${recipient}:`, err.message);
      return { success: false, error: err.message };
    }
  }

  console.warn('📧 Email skipped: Neither SMTP (SMTP_PASS) nor Resend (RESEND_API_KEY) configured.');
  return { success: false, reason: 'No email service configured' };
}

// ─────────────────────────────────────────────────────────────────────────────
// Public API: Send Order Confirmation Email (Initial Placement)
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Send an ultra-professional order confirmation email when an order is placed.
 * @param {Object|string} orderOrId - Database order object or order ID string
 * @param {Array} [providedItems] - Optional pre-loaded items array
 * @param {string} [providedEmail] - Optional pre-resolved customer email
 */
export const sendOrderConfirmationEmail = async (orderOrId, providedItems = null, providedEmail = null) => {
  try {
    const { order, items, customerEmail } = await fetchFullOrderForEmail(orderOrId);
    const recipient = providedEmail || customerEmail;
    const finalItems = (providedItems && providedItems.length > 0) ? providedItems : items;

    if (!recipient) {
      console.warn('📧 Email skipped: No customer recipient email found for order', order.id);
      return { success: false, reason: 'Recipient email missing' };
    }

    const stageKey = 'ordered';
    const stageInfo = ORDER_STAGES[0];
    const orderIdFormatted = formatOrderId(order.id);

    const html = buildLuxuryEmailHtml({
      order,
      items: finalItems,
      stageKey,
      customerEmail: recipient
    });

    console.log(`📧 Dispatching Order Confirmation email to customer ${recipient} (Order ${orderIdFormatted})...`);

    return await dispatchEmail({
      recipient,
      subject: `Order Confirmed ${orderIdFormatted} — Maison Lune Haute Parfumerie`,
      html,
    });
  } catch (err) {
    console.error('📧 Unexpected error in sendOrderConfirmationEmail:', err.message);
    return { success: false, error: err.message };
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Public API: Send Live Order Stage Update Email (Admin Triggered)
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Send an updated status email when an admin modifies the order stage.
 * @param {Object|string} orderOrId - Database order object or order ID string
 * @param {Array} [providedItems] - Optional pre-loaded items array
 * @param {string} [providedEmail] - Optional pre-resolved customer email
 * @param {string} newStatus - The new stage key (ordered, dispatched, out_for_delivery, delivered)
 */
export const sendOrderStatusUpdateEmail = async (orderOrId, providedItems = null, providedEmail = null, newStatus = 'ordered') => {
  try {
    const { order, items, customerEmail } = await fetchFullOrderForEmail(orderOrId);
    const recipient = providedEmail || customerEmail;
    const finalItems = (providedItems && providedItems.length > 0) ? providedItems : items;
    const activeKey = normalizeStageKey(newStatus);
    const stageInfo = ORDER_STAGES.find(s => s.key === activeKey) || ORDER_STAGES[0];
    const orderIdFormatted = formatOrderId(order.id);

    if (!recipient) {
      console.warn('📧 Status email skipped: No recipient email address found for order', order.id);
      return { success: false, reason: 'Recipient email missing' };
    }

    const html = buildLuxuryEmailHtml({
      order: { ...order, status: activeKey },
      items: finalItems,
      stageKey: activeKey,
      customerEmail: recipient
    });

    console.log(`📧 Dispatching Stage Update [${stageInfo.label}] email to customer ${recipient} (Order ${orderIdFormatted})...`);

    return await dispatchEmail({
      recipient,
      subject: `${stageInfo.subject} — Order ${orderIdFormatted}`,
      html,
    });
  } catch (err) {
    console.error(`📧 Unexpected error in sendOrderStatusUpdateEmail (${newStatus}):`, err.message);
    return { success: false, error: err.message };
  }
};
