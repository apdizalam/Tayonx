// Mirrors backend/lib/offerPricing.js so the Send offer form shows the same total the server stores.

/** Reads the item count from a quantity like "50 units" or "1,200 pcs"; null if there is none. */
export function parseQuantity(quantity) {
  const match = String(quantity ?? '').replace(/(\d),(?=\d{3}\b)/g, '$1').match(/\d+(?:\.\d+)?/);
  if (!match) return null;
  const count = Number(match[0]);
  return Number.isInteger(count) && count > 0 && count <= 10000000 ? count : null;
}

export function roundMoney(value) {
  return Math.round(value * 100) / 100;
}

const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

/** "$1,250.50", or "$10" for whole dollars. */
export function formatUsd(value) {
  const number = Number(value) || 0;
  return Number.isInteger(number) ? usd.format(number).replace(/\.00$/, '') : usd.format(number);
}
