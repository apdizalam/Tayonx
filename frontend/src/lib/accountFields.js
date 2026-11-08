// Role-based account form rules shared by the public sign-up page and the admin
// "Create user" modal. Keep COUNTRIES in sync with backend/constants/accounts.js.

export const COUNTRIES = [
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

export const ACCOUNT_TYPES = {
  customer: {
    label: 'Customer',
    description: 'I want to buy products from abroad.',
    nameLabel: 'Full name (three names)',
    nameHint: 'Magaca oo saddex ah: first, father’s and grandfather’s name.',
    namePlaceholder: 'Abdi Hassan Ali',
    nameKind: 'full',
    profilePhoto: true,
  },
  cargo_provider: {
    label: 'Cargo company',
    description: 'A registered company that sources and ships for customers.',
    nameLabel: 'Company name',
    nameHint: 'The registered name of your business.',
    namePlaceholder: 'Global Cargo Ltd',
    nameKind: 'company',
    profilePhoto: false,
  },
  individual_cargo: {
    label: 'Individual cargo',
    description: 'I ship for customers on my own, without a company.',
    nameLabel: 'Full name (three names)',
    nameHint: 'Magaca oo saddex ah: first, father’s and grandfather’s name.',
    namePlaceholder: 'Hodan Ahmed Warsame',
    nameKind: 'full',
    profilePhoto: false,
  },
};

export const ROLE_LABELS = {
  customer: 'Customer',
  cargo_provider: 'Cargo company',
  individual_cargo: 'Individual cargo',
  admin: 'Administrator',
};

export const VERIFICATION_LABELS = {
  unverified: 'Not verified',
  pending: 'Under review',
  approved: 'Verified',
  rejected: 'Needs changes',
};

export const MAX_FILE_BYTES = 5 * 1024 * 1024;
export const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
export const DOCUMENT_TYPES = [...IMAGE_TYPES, 'application/pdf'];

const namePartPattern = /^[\p{L}][\p{L}'’-]+$/u;

export function cleanText(value) {
  return String(value ?? '').trim().replace(/\s+/g, ' ');
}

export function normalizePhone(value) {
  return cleanText(value).replace(/[\s().-]/g, '');
}

export function validateFile(file, allowedTypes = IMAGE_TYPES) {
  if (!file) return '';
  if (!allowedTypes.includes(file.type)) {
    return allowedTypes.includes('application/pdf') ? 'Use a JPG, PNG, WebP image or a PDF.' : 'Use a JPG, PNG or WebP image.';
  }
  if (file.size > MAX_FILE_BYTES) return 'The file must be 5 MB or smaller.';
  return '';
}

/** Returns { fieldName: message } for every invalid field (empty object when valid). */
export function validateAccount(values, role, { requirePassword = true, only } = {}) {
  const errors = {};
  const type = ACCOUNT_TYPES[role] || ACCOUNT_TYPES.customer;
  const shouldCheck = (field) => !only || only.includes(field);

  if (shouldCheck('name')) {
    const name = cleanText(values.name);
    if (type.nameKind === 'company') {
      if (name.length < 2) errors.name = 'Enter the company name.';
    } else {
      const parts = name.split(' ').filter(Boolean);
      if (parts.length < 3) errors.name = 'Enter all three names (first, father’s and grandfather’s).';
      else if (parts.some((part) => !namePartPattern.test(part))) errors.name = 'Each name must use letters only, at least 2 characters.';
    }
    if (name.length > 100) errors.name = 'Must be 100 characters or fewer.';
  }
  if (shouldCheck('phone') && !/^\+?[0-9]{7,15}$/.test(normalizePhone(values.phone))) {
    errors.phone = 'Enter a valid phone number, e.g. +252 63 412 3456.';
  }
  if (shouldCheck('email')) {
    const email = cleanText(values.email);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) errors.email = 'Enter a valid email address.';
  }
  if (shouldCheck('country') && !COUNTRIES.includes(values.country)) errors.country = 'Choose a country.';
  if (shouldCheck('password') && (requirePassword || values.password)) {
    const password = values.password || '';
    if (password.length < 8) errors.password = 'Use at least 8 characters.';
    else if (new TextEncoder().encode(password).length > 72) errors.password = 'Password is too long.';
  }
  if (shouldCheck('profilePhoto') && type.profilePhoto && values.profilePhoto) {
    const fileError = validateFile(values.profilePhoto, IMAGE_TYPES);
    if (fileError) errors.profilePhoto = fileError;
  }
  return errors;
}
