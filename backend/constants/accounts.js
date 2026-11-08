// Shared account rules for registration, admin user management and verification.
// Keep COUNTRIES in sync with frontend/src/lib/accountFields.js.

const COUNTRIES = [
  'Somaliland',
  'Somalia',
  'Djibouti',
  'Ethiopia',
  'Kenya',
  'Uganda',
  'Tanzania',
  'Sudan',
  'Egypt',
  'South Africa',
  'Nigeria',
  'China',
  'Turkey',
  'United Arab Emirates',
  'Saudi Arabia',
  'Qatar',
  'Oman',
  'Yemen',
  'India',
  'Pakistan',
  'Malaysia',
  'Indonesia',
  'Japan',
  'South Korea',
  'United Kingdom',
  'Germany',
  'France',
  'Italy',
  'Netherlands',
  'Sweden',
  'Norway',
  'Finland',
  'Denmark',
  'United States',
  'Canada',
  'Australia',
  'Other',
];

const ACCOUNT_ROLES = ['customer', 'cargo_provider', 'individual_cargo'];
const CARGO_ROLES = ['cargo_provider', 'individual_cargo'];
const VERIFICATION_STATUSES = ['unverified', 'pending', 'approved', 'rejected'];

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// Letters (any language), apostrophes and hyphens; at least 2 characters per name part.
const namePartPattern = /^[\p{L}][\p{L}'’-]+$/u;

function cleanString(value) {
  return typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : '';
}

function validateFullName(name) {
  const parts = name.split(' ').filter(Boolean);
  if (parts.length < 3) return 'Enter the full three-part name (first, father’s and grandfather’s name).';
  if (parts.some((part) => !namePartPattern.test(part))) return 'Each part of the name must contain letters only, at least 2 characters.';
  if (name.length > 100) return 'Name must be 100 characters or fewer.';
  return '';
}

function validateCompanyName(name) {
  if (name.length < 2) return 'Enter the company name.';
  if (name.length > 100) return 'Company name must be 100 characters or fewer.';
  return '';
}

function normalizePhone(value) {
  return cleanString(value).replace(/[\s().-]/g, '');
}

function validatePhone(phone) {
  if (!/^\+?[0-9]{7,15}$/.test(phone)) return 'Enter a valid phone number (7–15 digits, optionally starting with +).';
  return '';
}

function validateEmail(email) {
  if (!emailPattern.test(email) || email.length > 254) return 'Enter a valid email address.';
  return '';
}

function validatePassword(password) {
  if (typeof password !== 'string' || password.length < 8 || Buffer.byteLength(password, 'utf8') > 72) {
    return 'Password must be at least 8 characters and no more than 72 UTF-8 bytes.';
  }
  return '';
}

function normalizeRole(value) {
  const role = cleanString(value).toLowerCase().replace(/[\s-]+/g, '_');
  if (role === 'cargo_company' || role === 'provider') return 'cargo_provider';
  return role;
}

/**
 * Validates the role-dependent account fields.
 * Returns { fields } or { error, field }.
 * When `partial` is true only the keys present in `body` are checked (used for edits).
 */
function validateAccountFields(body, { role, partial = false } = {}) {
  const fields = {};
  const has = (key) => Object.hasOwn(body, key);

  if (!partial || has('name')) {
    const name = cleanString(body.name);
    const nameError = role === 'cargo_provider' ? validateCompanyName(name) : validateFullName(name);
    if (nameError) return { error: nameError, field: 'name' };
    fields.name = name;
  }
  if (!partial || has('phone')) {
    const phone = normalizePhone(body.phone);
    const phoneError = validatePhone(phone);
    if (phoneError) return { error: phoneError, field: 'phone' };
    fields.phone = phone;
  }
  if (!partial || has('email')) {
    const email = cleanString(body.email).toLowerCase();
    const emailError = validateEmail(email);
    if (emailError) return { error: emailError, field: 'email' };
    fields.email = email;
  }
  if (!partial || has('country')) {
    const country = cleanString(body.country);
    if (!COUNTRIES.includes(country)) return { error: 'Choose a country from the list.', field: 'country' };
    fields.country = country;
  }
  return { fields };
}

module.exports = {
  ACCOUNT_ROLES,
  CARGO_ROLES,
  COUNTRIES,
  VERIFICATION_STATUSES,
  cleanString,
  normalizeRole,
  validateAccountFields,
  validatePassword,
};
