// Offer pricing: a provider can quote a unit price that is multiplied by the
// request's quantity, or (for quantities that are not a number) a total price.
// Keep parseQuantity in sync with frontend/src/lib/offerPricing.js.

const MAX_PRICE = 1000000000;

/**
 * Reads the item count from a free-text quantity such as "50 units",
 * "1,200 pcs" or "50". Returns null when no positive whole number is found.
 */
function parseQuantity(quantity) {
  const match = String(quantity ?? '').replace(/(\d),(?=\d{3}\b)/g, '$1').match(/\d+(?:\.\d+)?/);
  if (!match) return null;
  const count = Number(match[0]);
  return Number.isInteger(count) && count > 0 && count <= 10000000 ? count : null;
}

function roundMoney(value) {
  return Math.round(value * 100) / 100;
}

/**
 * Validates an offer body against the request's quantity.
 * Returns { fields: { price, unitPrice, quantityCount, deliveryDays, includes } } or { error, field }.
 * When a unit price is given, the total is always calculated here (the client's total is ignored).
 */
function readOfferBody(body, requestQuantity) {
  const deliveryDays = Number(body.deliveryDays);
  const includes = typeof body.includes === 'string' ? body.includes.trim() : '';
  if (!Number.isInteger(deliveryDays) || deliveryDays < 1 || deliveryDays > 365) {
    return { error: 'Delivery time must be between 1 and 365 days.', field: 'deliveryDays' };
  }
  if (includes.length > 500) return { error: 'Offer details must be 500 characters or fewer.', field: 'includes' };

  const hasUnitPrice = body.unitPrice !== undefined && body.unitPrice !== null && body.unitPrice !== '';
  if (hasUnitPrice) {
    const unitPrice = Number(body.unitPrice);
    if (!Number.isFinite(unitPrice) || unitPrice <= 0 || roundMoney(unitPrice) !== unitPrice) {
      return { error: 'Enter a valid unit price greater than zero (up to 2 decimals).', field: 'unitPrice' };
    }
    const quantityCount = parseQuantity(requestQuantity);
    if (!quantityCount) {
      return { error: 'This request has no numeric quantity, so enter a total quote instead of a unit price.', field: 'unitPrice' };
    }
    const price = roundMoney(unitPrice * quantityCount);
    if (price > MAX_PRICE) return { error: 'The total quote is too large.', field: 'unitPrice' };
    return { fields: { price, unitPrice, quantityCount, deliveryDays, includes } };
  }

  const price = Number(body.price);
  if (!Number.isFinite(price) || price <= 0 || price > MAX_PRICE) {
    return { error: 'Enter a valid offer price greater than zero.', field: 'price' };
  }
  return { fields: { price: roundMoney(price), unitPrice: null, quantityCount: null, deliveryDays, includes } };
}

module.exports = { parseQuantity, readOfferBody, roundMoney };
