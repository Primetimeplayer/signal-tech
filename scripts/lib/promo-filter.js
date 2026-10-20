// Titles that are a sale, coupon, or price pitch rather than a story.

const PROMO_TITLE = /\b(deal|deals|coupon|promo code|discount|% off|for only|save \$|price drop|lowest price|on sale|black friday|cyber monday|prime day)\b|\$\d+(\.\d+)?\s*(off)?\b.*\b(deal|only|sale)\b/i;

export function isPromo(title) {
  return PROMO_TITLE.test(title || '');
}
