import { Resend } from 'resend';
import dotenv from 'dotenv';

dotenv.config();

// ─────────────────────────────────────────────────────────────────────────────
// Resend Client Initialization
// ─────────────────────────────────────────────────────────────────────────────
const resend = process.env.RESEND_API_KEY && process.env.RESEND_API_KEY !== 're_REPLACE_WITH_YOUR_API_KEY'
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

const SENDER_EMAIL = process.env.SENDER_EMAIL || 'onboarding@resend.dev';
const REPLY_TO_EMAIL = process.env.REPLY_TO_EMAIL || 'lunefragrance1@gmail.com';
const SENDER_NAME = 'Maison Lune';

// ─────────────────────────────────────────────────────────────────────────────
// Order Stage Definitions
// ─────────────────────────────────────────────────────────────────────────────
const ORDER_STAGES = [
  { key: 'ordered', number: '01', label: 'ORDERED' },
  { key: 'dispatched', number: '02', label: 'DISPATCHED' },
  { key: 'out_for_delivery', number: '03', label: 'OUT OF DELIVERY' },
  { key: 'delivered', number: '04', label: 'DELIVERED' },
];

const STATUS_MESSAGES = {
  ordered: {
    subject: 'Order Confirmed',
    heading: 'YOUR ORDER HAS BEEN CONFIRMED',
    message: 'Thank you for choosing Maison Lune. Your order has been received and is being prepared by our atelier team with meticulous care.',
  },
  dispatched: {
    subject: 'Order Dispatched',
    heading: 'YOUR ORDER HAS BEEN DISPATCHED',
    message: 'Your Maison Lune creation has been carefully packaged and dispatched from our atelier. It is now on its way to you.',
  },
  out_for_delivery: {
    subject: 'Out for Delivery',
    heading: 'YOUR ORDER IS OUT FOR DELIVERY',
    message: 'Your Maison Lune creation is out for delivery and will arrive today. Please ensure someone is available to receive your package.',
  },
  delivered: {
    subject: 'Order Delivered',
    heading: 'YOUR ORDER HAS BEEN DELIVERED',
    message: 'Your Maison Lune creation has been successfully delivered. We hope you enjoy your new fragrance. Thank you for your patronage.',
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// HTML Template Helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Generate the 4-stage order tracker HTML (matching the frontend UI)
 */
function buildStageTrackerHtml(currentStatus) {
  const currentIndex = ORDER_STAGES.findIndex(s => s.key === currentStatus);

  const stages = ORDER_STAGES.map((stage, idx) => {
    const isActive = idx <= currentIndex;
    const isCurrent = idx === currentIndex;

    const circleBg = isActive ? '#111111' : '#E5E5E5';
    const circleColor = isActive ? '#FFFFFF' : '#999999';
    const labelColor = isCurrent ? '#111111' : '#888888';
    const labelWeight = isCurrent ? 'bold' : 'normal';

    return `
      <td style="text-align:center;padding:0 8px;vertical-align:top;">
        <div style="width:40px;height:40px;border-radius:50%;background:${circleBg};color:${circleColor};font-size:13px;font-weight:bold;line-height:40px;text-align:center;margin:0 auto 6px auto;">
          ${stage.number}
        </div>
        <div style="font-size:9px;letter-spacing:1.5px;color:${labelColor};font-weight:${labelWeight};font-family:Helvetica,Arial,sans-serif;">
          ${stage.label}
        </div>
      </td>
    `;
  }).join('');

  // Connector line between circles
  return `
    <table cellpadding="0" cellspacing="0" border="0" style="margin:0 auto;">
      <tr>${stages}</tr>
    </table>
  `;
}

/**
 * Generate product items table rows
 */
function buildItemsHtml(items) {
  if (!items || items.length === 0) return '';

  return items.map(item => {
    const productName = item.product?.name || item.product_name || 'Maison Lune Creation';
    const frenchName = item.product?.french_name || '';
    const size = item.size || 'Full Size';
    const qty = item.quantity || 1;
    const unitPrice = Number(item.unit_price || 0);
    const lineTotal = (unitPrice * qty).toFixed(2);
    const imageUrl = item.product?.image_url || '';
    const engraving = item.engraving_text || item.engravingText || item.engraving;

    const imageHtml = imageUrl
      ? `<img src="${imageUrl}" alt="${productName}" width="60" height="60" style="border-radius:6px;object-fit:cover;border:1px solid #E5E5E5;" />`
      : `<div style="width:60px;height:60px;border-radius:6px;background:#F4F4F4;border:1px solid #E5E5E5;"></div>`;

    return `
      <tr>
        <td style="padding:12px 0;border-bottom:1px solid #F0F0F0;vertical-align:top;">
          <table cellpadding="0" cellspacing="0" border="0" width="100%">
            <tr>
              <td width="70" style="vertical-align:top;">
                ${imageHtml}
              </td>
              <td style="padding-left:12px;vertical-align:top;">
                <div style="font-family:Helvetica,Arial,sans-serif;font-size:13px;font-weight:bold;color:#111111;text-transform:uppercase;letter-spacing:0.5px;">
                  ${productName}
                </div>
                ${frenchName ? `<div style="font-family:Helvetica,Arial,sans-serif;font-size:11px;color:#888888;font-style:italic;margin-top:2px;">${frenchName}</div>` : ''}
                ${engraving ? `<div style="font-family:Helvetica,Arial,sans-serif;font-size:11px;color:#C08A3E;font-style:italic;margin-top:2px;">Engraving: "${engraving}"</div>` : ''}
                <div style="font-family:Helvetica,Arial,sans-serif;font-size:11px;color:#666666;margin-top:4px;">
                  SIZE: ${size} &nbsp;•&nbsp; QTY: ${qty}
                </div>
              </td>
              <td style="text-align:right;vertical-align:top;white-space:nowrap;">
                <div style="font-family:Helvetica,Arial,sans-serif;font-size:14px;font-weight:bold;color:#111111;">
                  $${lineTotal} USD
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
 * Build shipping address & customer contact block
 */
function buildShippingHtml(address, userEmail) {
  if (!address && !userEmail) return '';

  const parts = [
    address?.fullName || address?.full_name || address?.name,
    address?.street || address?.street_address,
    [address?.city, address?.state].filter(Boolean).join(', '),
    [address?.postalCode || address?.postal_code, address?.country].filter(Boolean).join(' — '),
    address?.phone ? `Tel: ${address.phone}` : null,
    (userEmail || address?.email) ? `Email: ${userEmail || address?.email}` : null,
  ].filter(Boolean);

  return parts
    .map(p => `<div style="font-family:Helvetica,Arial,sans-serif;font-size:12px;color:#444444;line-height:1.6;">${p}</div>`)
    .join('');
}

/**
 * Format order ID for display (first 8 chars uppercase)
 */
function formatOrderId(id) {
  if (!id) return 'N/A';
  return `#${String(id).substring(0, 8).toUpperCase()}`;
}

/**
 * Format date for display
 */
function formatDate(dateStr) {
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  } catch {
    return 'N/A';
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Master Email Template
// ─────────────────────────────────────────────────────────────────────────────
function buildEmailHtml({ order, items, status, statusInfo, userEmail }) {
  const orderId = formatOrderId(order.id);
  const orderDate = formatDate(order.created_at);
  const subtotal = Number(order.subtotal || 0).toFixed(2);
  const discount = Number(order.discount_amount || 0);
  const total = Number(order.total || 0).toFixed(2);
  const shippingAddress = order.shipping_address || {};

  const stageBadgeColor = status === 'delivered' ? '#059669' : '#111111';

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1.0" />
  <title>Maison Lune — ${statusInfo.subject}</title>
</head>
<body style="margin:0;padding:0;background:#F5F5F0;font-family:Helvetica,Arial,sans-serif;">
  <table cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#F5F5F0;padding:24px 0;">
    <tr>
      <td align="center">
        <table cellpadding="0" cellspacing="0" border="0" width="600" style="max-width:600px;width:100%;background:#FFFFFF;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">

          <!-- ═══ HEADER ═══ -->
          <tr>
            <td style="background:#111111;padding:24px 32px;text-align:center;">
              <div style="font-family:Helvetica,Arial,sans-serif;font-size:18px;font-weight:bold;letter-spacing:6px;color:#C08A3E;text-transform:uppercase;">
                MAISON LUNE
              </div>
              <div style="font-family:Helvetica,Arial,sans-serif;font-size:9px;letter-spacing:4px;color:#888888;margin-top:4px;text-transform:uppercase;">
                HAUTE PARFUMERIE · PARIS
              </div>
            </td>
          </tr>

          <!-- ═══ STATUS HEADING ═══ -->
          <tr>
            <td style="padding:32px 32px 8px 32px;text-align:center;">
              <div style="font-family:Helvetica,Arial,sans-serif;font-size:11px;letter-spacing:3px;color:#888888;text-transform:uppercase;margin-bottom:8px;">
                ORDER UPDATE
              </div>
              <div style="font-family:Helvetica,Arial,sans-serif;font-size:20px;font-weight:bold;color:#111111;letter-spacing:1px;">
                ${statusInfo.heading}
              </div>
              <div style="font-family:Helvetica,Arial,sans-serif;font-size:13px;color:#555555;line-height:1.6;margin-top:12px;max-width:440px;margin-left:auto;margin-right:auto;">
                ${statusInfo.message}
              </div>
            </td>
          </tr>

          <!-- ═══ ORDER INFO BAR ═══ -->
          <tr>
            <td style="padding:20px 32px;">
              <table cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#F9F9FB;border-radius:8px;padding:16px;">
                <tr>
                  <td style="padding:16px;">
                    <table cellpadding="0" cellspacing="0" border="0" width="100%">
                      <tr>
                        <td>
                          <div style="font-family:Helvetica,Arial,sans-serif;font-size:11px;letter-spacing:2px;color:#888888;text-transform:uppercase;">ORDER</div>
                          <div style="font-family:Helvetica,Arial,sans-serif;font-size:16px;font-weight:bold;color:#111111;margin-top:2px;">${orderId}</div>
                          <div style="font-family:Helvetica,Arial,sans-serif;font-size:11px;color:#888888;margin-top:2px;">${orderDate}</div>
                        </td>
                        <td style="text-align:right;vertical-align:top;">
                          <div style="display:inline-block;background:${stageBadgeColor};color:#FFFFFF;font-family:Helvetica,Arial,sans-serif;font-size:10px;font-weight:bold;letter-spacing:1.5px;padding:6px 14px;border-radius:20px;text-transform:uppercase;">
                            STAGE: ${statusInfo.subject.toUpperCase()}
                          </div>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- ═══ STAGE TRACKER ═══ -->
          <tr>
            <td style="padding:8px 32px 24px 32px;text-align:center;">
              <div style="font-family:Helvetica,Arial,sans-serif;font-size:10px;letter-spacing:2px;color:#888888;text-transform:uppercase;margin-bottom:16px;">
                LIVE ORDER STAGE
              </div>
              ${buildStageTrackerHtml(status)}
            </td>
          </tr>

          <!-- ═══ DIVIDER ═══ -->
          <tr>
            <td style="padding:0 32px;">
              <div style="border-top:1px solid #E8E8E8;"></div>
            </td>
          </tr>

          <!-- ═══ ITEMS LIST ═══ -->
          <tr>
            <td style="padding:24px 32px 8px 32px;">
              <div style="font-family:Helvetica,Arial,sans-serif;font-size:11px;letter-spacing:2px;color:#888888;text-transform:uppercase;margin-bottom:12px;">
                CREATIONS INCLUDED (${items.length})
              </div>
              <table cellpadding="0" cellspacing="0" border="0" width="100%">
                ${buildItemsHtml(items)}
              </table>
            </td>
          </tr>

          <!-- ═══ TOTALS ═══ -->
          <tr>
            <td style="padding:16px 32px;">
              <table cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#F9F9FB;border-radius:8px;">
                <tr>
                  <td style="padding:16px;">
                    <table cellpadding="0" cellspacing="0" border="0" width="100%">
                      <tr>
                        <td style="font-family:Helvetica,Arial,sans-serif;font-size:12px;color:#666666;padding:4px 0;">Subtotal</td>
                        <td style="font-family:Helvetica,Arial,sans-serif;font-size:12px;color:#111111;text-align:right;padding:4px 0;">$${subtotal} USD</td>
                      </tr>
                      ${discount > 0 ? `
                      <tr>
                        <td style="font-family:Helvetica,Arial,sans-serif;font-size:12px;color:#059669;padding:4px 0;">Discount</td>
                        <td style="font-family:Helvetica,Arial,sans-serif;font-size:12px;color:#059669;text-align:right;padding:4px 0;">-$${discount.toFixed(2)} USD</td>
                      </tr>
                      ` : ''}
                      <tr>
                        <td style="font-family:Helvetica,Arial,sans-serif;font-size:12px;color:#666666;padding:4px 0;">Shipping</td>
                        <td style="font-family:Helvetica,Arial,sans-serif;font-size:12px;color:#111111;text-align:right;padding:4px 0;">Complimentary</td>
                      </tr>
                      <tr>
                        <td colspan="2" style="padding:8px 0 0 0;border-top:1px solid #E0E0E0;"></td>
                      </tr>
                      <tr>
                        <td style="font-family:Helvetica,Arial,sans-serif;font-size:16px;font-weight:bold;color:#111111;padding:4px 0;">Total</td>
                        <td style="font-family:Helvetica,Arial,sans-serif;font-size:16px;font-weight:bold;color:#111111;text-align:right;padding:4px 0;">$${total} USD</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- ═══ SHIPPING & CONTACT ADDRESS ═══ -->
          <tr>
            <td style="padding:16px 32px 24px 32px;">
              <div style="font-family:Helvetica,Arial,sans-serif;font-size:11px;letter-spacing:2px;color:#888888;text-transform:uppercase;margin-bottom:10px;">
                DELIVERY & CONTACT DETAILS
              </div>
              <div style="background:#F9F9FB;border-radius:8px;padding:16px;">
                ${buildShippingHtml(shippingAddress, userEmail)}
              </div>
            </td>
          </tr>

          <!-- ═══ FOOTER ═══ -->
          <tr>
            <td style="background:#111111;padding:28px 32px;text-align:center;">
              <div style="font-family:Helvetica,Arial,sans-serif;font-size:12px;color:#AAAAAA;line-height:1.6;">
                Thank you for choosing Maison Lune.
              </div>
              <div style="font-family:Helvetica,Arial,sans-serif;font-size:11px;color:#666666;margin-top:8px;">
                Questions? Contact us at <a href="mailto:support@maisonlune.com" style="color:#C08A3E;text-decoration:none;">support@maisonlune.com</a>
              </div>
              <div style="font-family:Helvetica,Arial,sans-serif;font-size:9px;letter-spacing:3px;color:#555555;margin-top:16px;text-transform:uppercase;">
                MAISON LUNE · HAUTE PARFUMERIE
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
// Public API: Send Order Confirmation Email
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Send an order confirmation email with full invoice when an order is placed.
 * @param {Object} order - The order record from the database
 * @param {Array} items - Array of order items (with nested product info)
 * @param {string} userEmail - Customer's email address
 */
export const sendOrderConfirmationEmail = async (order, items, userEmail) => {
  if (!resend) {
    console.warn('📧 Email skipped: RESEND_API_KEY not configured. Set it in .env to enable order confirmation emails.');
    return;
  }

  if (!userEmail) {
    console.warn('📧 Email skipped: No customer email address available for order', order.id);
    return;
  }

  try {
    const status = 'ordered';
    const statusInfo = STATUS_MESSAGES[status];

    const html = buildEmailHtml({ order, items, status, statusInfo, userEmail });

    const { data, error } = await resend.emails.send({
      from: `${SENDER_NAME} <${SENDER_EMAIL}>`,
      reply_to: REPLY_TO_EMAIL,
      to: [userEmail],
      subject: `${statusInfo.subject} — Order ${formatOrderId(order.id)}`,
      html,
    });

    if (error) {
      console.error(`📧 Failed to send order confirmation email to ${userEmail}:`, error.message || error);
      if (error.statusCode === 403 || (error.message && error.message.includes('onboarding'))) {
        console.warn('💡 Tip: On Resend free test mode (onboarding@resend.dev), emails can only be sent to the Resend account owner email. Verify a custom domain in Resend to send to all customer emails.');
      }
    } else {
      console.log(`📧 Order confirmation email sent to ${userEmail} (Resend ID: ${data?.id})`);
    }
  } catch (err) {
    console.error('📧 Error sending order confirmation email:', err.message);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Public API: Send Order Status Update Email
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Send a status update email when an order stage changes.
 * @param {Object} order - The full order record
 * @param {Array} items - Array of order items (with nested product info)
 * @param {string} userEmail - Customer's email address
 * @param {string} newStatus - The new order status key (ordered, dispatched, out_for_delivery, delivered)
 */
export const sendOrderStatusUpdateEmail = async (order, items, userEmail, newStatus) => {
  if (!resend) {
    console.warn('📧 Email skipped: RESEND_API_KEY not configured. Set it in .env to enable status update emails.');
    return;
  }

  if (!userEmail) {
    console.warn('📧 Email skipped: No customer email address available for order', order.id);
    return;
  }

  const statusInfo = STATUS_MESSAGES[newStatus];
  if (!statusInfo) {
    console.warn(`📧 Email skipped: Unknown order status "${newStatus}"`);
    return;
  }

  try {
    const html = buildEmailHtml({ order, items, status: newStatus, statusInfo, userEmail });

    const { data, error } = await resend.emails.send({
      from: `${SENDER_NAME} <${SENDER_EMAIL}>`,
      reply_to: REPLY_TO_EMAIL,
      to: [userEmail],
      subject: `${statusInfo.subject} — Order ${formatOrderId(order.id)}`,
      html,
    });

    if (error) {
      console.error(`📧 Failed to send status update email (${newStatus}) to ${userEmail}:`, error.message || error);
      if (error.statusCode === 403 || (error.message && error.message.includes('onboarding'))) {
        console.warn('💡 Tip: On Resend free test mode (onboarding@resend.dev), emails can only be sent to the Resend account owner email. Verify a custom domain in Resend to send to all customer emails.');
      }
    } else {
      console.log(`📧 Status update email (${newStatus}) sent to ${userEmail} (Resend ID: ${data?.id})`);
    }
  } catch (err) {
    console.error(`📧 Error sending status update email (${newStatus}):`, err.message);
  }
};
