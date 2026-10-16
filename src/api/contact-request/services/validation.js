'use strict';

const { errors } = require('@strapi/utils');
const { ValidationError } = errors;

// RFC 5322 compliant email pattern for server-side verification
const EMAIL_REGEX = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;

// ISO 8601 date string check (YYYY-MM-DD)
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

const ALLOWED_REQUEST_TYPES = ['early_access', 'general_contact'];
const ALLOWED_PRODUCT_INTERESTS = ['token_factory'];
const ALLOWED_ENDPOINT_PREFERENCES = ['api_inference', 'dedicated_endpoint', 'undecided'];
const ALLOWED_INTEREST_TYPES = [
  'on_demand_gpus',
  'enterprise_bare_metal',
  'weka_storage',
  'technical_support',
  'partnership',
  'other',
];
const ALLOWED_BUDGET_RANGES = [
  'under_5k',
  'range_5k_20k',
  'range_20k_100k',
  'range_100k_500k',
  'range_500k_plus',
];

const MAX_LENGTHS = {
  fullName: 200,
  workEmail: 254,
  company: 200,
  phoneNumber: 50,
  message: 5000,
  modelsOfInterest: 2000,
  expectedUsage: 5000,
  source: 200,
};

/**
 * Checks whether a submission is an Early Access request
 * @param {Object} data
 * @returns {boolean}
 */
function isEarlyAccessRequest(data) {
  if (!data) return false;
  return data.requestType === 'early_access' || data.productInterest === 'token_factory';
}

/**
 * Validates and sanitizes a contact request payload.
 * Throws a Strapi ValidationError if any validation rules are violated.
 *
 * @param {Object} data - Input data object (ctx.request.body.data)
 * @throws {ValidationError}
 */
function validateContactRequest(data) {
  if (!data || typeof data !== 'object') {
    throw new ValidationError('Invalid request payload: expected a data object');
  }

  const validationErrors = [];
  const isEarlyAccess = isEarlyAccessRequest(data);

  // 1. Required fields for Early Access
  if (isEarlyAccess) {
    if (data.fullName === undefined || data.fullName === null || String(data.fullName).trim() === '') {
      validationErrors.push({ path: ['fullName'], message: 'Full name is required for early access requests.' });
    }
    if (data.workEmail === undefined || data.workEmail === null || String(data.workEmail).trim() === '') {
      validationErrors.push({ path: ['workEmail'], message: 'Valid work email is required for early access requests.' });
    }
    if (data.company === undefined || data.company === null || String(data.company).trim() === '') {
      validationErrors.push({ path: ['company'], message: 'Company is required for early access requests.' });
    }
    if (data.message === undefined || data.message === null || String(data.message).trim() === '') {
      validationErrors.push({ path: ['message'], message: 'Use-case or workload description is required for early access requests.' });
    }
  }

  // 2. Email format validation (server-side)
  if (data.workEmail !== undefined && data.workEmail !== null && String(data.workEmail).trim() !== '') {
    const email = String(data.workEmail).trim();
    if (typeof data.workEmail !== 'string' || !EMAIL_REGEX.test(email) || email.length > MAX_LENGTHS.workEmail) {
      validationErrors.push({ path: ['workEmail'], message: 'Invalid email address format.' });
    }
  }

  // 3. Enumeration validations
  if (data.requestType !== undefined && data.requestType !== null && data.requestType !== '') {
    if (!ALLOWED_REQUEST_TYPES.includes(data.requestType)) {
      validationErrors.push({
        path: ['requestType'],
        message: `Invalid requestType "${data.requestType}". Allowed values: ${ALLOWED_REQUEST_TYPES.join(', ')}.`,
      });
    }
  }

  if (data.productInterest !== undefined && data.productInterest !== null && data.productInterest !== '') {
    if (!ALLOWED_PRODUCT_INTERESTS.includes(data.productInterest)) {
      validationErrors.push({
        path: ['productInterest'],
        message: `Invalid productInterest "${data.productInterest}". Allowed values: ${ALLOWED_PRODUCT_INTERESTS.join(', ')}.`,
      });
    }
  }

  if (data.endpointPreference !== undefined && data.endpointPreference !== null && data.endpointPreference !== '') {
    if (!ALLOWED_ENDPOINT_PREFERENCES.includes(data.endpointPreference)) {
      validationErrors.push({
        path: ['endpointPreference'],
        message: `Invalid endpointPreference "${data.endpointPreference}". Allowed values: ${ALLOWED_ENDPOINT_PREFERENCES.join(', ')}.`,
      });
    }
  }

  if (data.interestType !== undefined && data.interestType !== null && data.interestType !== '') {
    if (!ALLOWED_INTEREST_TYPES.includes(data.interestType)) {
      validationErrors.push({
        path: ['interestType'],
        message: `Invalid interestType "${data.interestType}". Allowed values: ${ALLOWED_INTEREST_TYPES.join(', ')}.`,
      });
    }
  }

  if (data.budgetRange !== undefined && data.budgetRange !== null && data.budgetRange !== '') {
    if (!ALLOWED_BUDGET_RANGES.includes(data.budgetRange)) {
      validationErrors.push({
        path: ['budgetRange'],
        message: `Invalid budgetRange "${data.budgetRange}". Allowed values: ${ALLOWED_BUDGET_RANGES.join(', ')}.`,
      });
    }
  }

  // 4. Boolean validations (Strict: do not silently cast invalid non-boolean strings/numbers)
  if (data.interestedInGtcBerlin !== undefined && data.interestedInGtcBerlin !== null) {
    if (typeof data.interestedInGtcBerlin !== 'boolean') {
      validationErrors.push({
        path: ['interestedInGtcBerlin'],
        message: 'interestedInGtcBerlin must be a boolean (true or false).',
      });
    }
  }

  if (data.marketingOptIn !== undefined && data.marketingOptIn !== null) {
    if (typeof data.marketingOptIn !== 'boolean') {
      validationErrors.push({
        path: ['marketingOptIn'],
        message: 'marketingOptIn must be a boolean (true or false).',
      });
    }
  }

  // 5. Date validation
  if (data.targetStartDate !== undefined && data.targetStartDate !== null && data.targetStartDate !== '') {
    if (
      typeof data.targetStartDate !== 'string' ||
      !DATE_REGEX.test(data.targetStartDate) ||
      isNaN(Date.parse(data.targetStartDate))
    ) {
      validationErrors.push({
        path: ['targetStartDate'],
        message: 'targetStartDate must be a valid date in YYYY-MM-DD format.',
      });
    }
  }

  // 6. String length limits & type checks
  for (const [field, maxLen] of Object.entries(MAX_LENGTHS)) {
    if (data[field] !== undefined && data[field] !== null && data[field] !== '') {
      if (typeof data[field] !== 'string') {
        validationErrors.push({
          path: [field],
          message: `${field} must be a string.`,
        });
      } else if (data[field].length > maxLen) {
        validationErrors.push({
          path: [field],
          message: `${field} exceeds maximum length of ${maxLen} characters.`,
        });
      }
    }
  }

  if (validationErrors.length > 0) {
    throw new ValidationError(
      validationErrors.map((e) => e.message).join('; '),
      { details: { errors: validationErrors } }
    );
  }
}

module.exports = {
  validateContactRequest,
  isEarlyAccessRequest,
};
