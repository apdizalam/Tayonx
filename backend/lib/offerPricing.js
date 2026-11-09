// Offer pricing, always calculated on the server:
//   Product subtotal  = quantity × price per item
//   Total offer price = product subtotal + delivery fee
// Keep parseQuantity / calculateOfferPrice in sync with frontend/src/lib/offerPricing.js.

const MAX_PRICE = 1000000000;

/**
 * Reads the item count from a free-text quantity such as "50 laptops",
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

function hasAtMostTwoDecimals(value) {
  return roundMoney(value) === value;
}

/** { subtotal, total } for a quantity, unit price and delivery fee (all already validated). */
function calculateOfferPrice(quantityCount, unitPrice, deliveryFee = 0) {
  const subtotal = roundMoney(quantityCount * unitPrice);
  return { subtotal, total: roundMoney(subtotal + deliveryFee) };
}

/**
 * Validates an offer body against the request's quantity.
 * Returns { fields } ready to store on the offer, or { error, field }.
 * The client never sends totals: subtotal and total are calculated here.
 */
function readOfferBody(body, requestQuantity) {
  const quantityCount = parseQuantity(requestQuantity);
  if (!quantityCount) {
    return { error: 'This request has no numeric quantity. Ask the customer to update the quantity (e.g. "50 laptops") before quoting.', field: 'quantity' };
  }

  const unitPrice = Number(body.unitPrice);
  if (body.unitPrice === undefined || body.unitPrice === null || body.unitPrice === ''
    || !Number.isFinite(unitPrice) || unitPrice <= 0 || !hasAtMostTwoDecimals(unitPrice)) {
    return { error: 'Enter a price per item greater than zero (up to 2 decimals).', field: 'unitPrice' };
  }

  const deliveryFee = Number(body.deliveryFee);
  if (body.deliveryFee === undefined || body.deliveryFee === null || body.deliveryFee === ''
    || !Number.isFinite(deliveryFee) || deliveryFee < 0 || !hasAtMostTwoDecimals(deliveryFee)) {
    return { error: 'Enter a delivery fee of 0 or more (up to 2 decimals). Use 0 for free delivery.', field: 'deliveryFee' };
  }

  const deliveryDays = Number(body.deliveryDays);
  if (!Number.isInteger(deliveryDays) || deliveryDays < 1 || deliveryDays > 365) {
    return { error: 'Estimated delivery time must be a whole number of days from 1 to 365.', field: 'deliveryDays' };
  }

  const includes = typeof body.includes === 'string' ? body.includes.trim() : '';
  if (includes.length > 500) return { error: 'Included services must be 500 characters or fewer.', field: 'includes' };

  const { subtotal, total } = calculateOfferPrice(quantityCount, unitPrice, deliveryFee);
  if (total > MAX_PRICE) return { error: 'The total offer price is too large.', field: 'unitPrice' };

  return {
    fields: {
      unitPrice,
      quantityCount,
      subtotal,
      deliveryFee,
      price: total, // `price` stays the total offer price, as used everywhere else.
      deliveryDays,
      includes,
    },
  };
}

/** Recalculates a stored offer after the request's quantity changed. */
function repriceOffer(offer, quantityCount) {
  if (!offer.unitPrice || !quantityCount) return;
  const { subtotal, total } = calculateOfferPrice(quantityCount, offer.unitPrice, offer.deliveryFee || 0);
  offer.quantityCount = quantityCount;
  offer.subtotal = subtotal;
  offer.price = total;
}

module.exports = { calculateOfferPrice, parseQuantity, readOfferBody, repriceOffer, roundMoney };
