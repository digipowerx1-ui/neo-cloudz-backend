'use strict';

const fs = require('fs');
const path = require('path');

const resendService = require('../../../services/resend');

/**
 * Early-access (Token Factory waitlist) email service.
 *
 * The admin notification markup lives in an external template file rather than
 * inline in this module:
 *   src/neocloudz-templates/waitlist-admin-notification.html
 *
 * That file is the single source of truth for the email's design; there is no
 * inline fallback. Loading, rendering and escaping follow the same conventions
 * as src/api/contact-request/services/email.js.
 */

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Escapes characters that are sensitive in HTML context, so that a submitted
 * value cannot inject markup into the admin's mailbox.
 *
 * @param {string|null|undefined} str
 * @returns {string}
 */
function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Prepares a value for safe inclusion in the HTML email.
 *
 * Quotes are escaped as well as angle brackets, so the result is also safe
 * inside an HTML attribute such as the recipient's `mailto:` href.
 *
 * @param {*} value           - Raw value
 * @param {string} [fallback] - Text shown when the value is absent
 * @returns {string} HTML-escaped, email-safe value
 */
function escapeForEmail(value, fallback = 'N/A') {
  if (value === null || value === undefined || String(value).trim() === '') {
    return escapeHtml(fallback);
  }
  return escapeHtml(String(value).trim());
}

// ---------------------------------------------------------------------------
// HTML template loading
// ---------------------------------------------------------------------------

/**
 * Directory holding the standalone HTML email templates.
 *
 * Resolved from this module's own location (__dirname) rather than the process
 * working directory, so it behaves identically however Strapi is started.
 * src/api/early-access/services -> src/neocloudz-templates
 */
const TEMPLATE_DIR = path.join(__dirname, '..', '..', '..', 'neocloudz-templates');

const WAITLIST_ADMIN_TEMPLATE = 'waitlist-admin-notification.html';

/** In-memory template cache, keyed by file name. */
const templateCache = new Map();

/**
 * Reads an HTML email template from disk as UTF-8 and caches it.
 *
 * Throws rather than returning an empty or partial document, and never falls
 * back to inline HTML: a missing or unreadable template is logged by the
 * lifecycle hook instead of resulting in a broken email being delivered.
 *
 * @param {string} fileName - Template file name inside TEMPLATE_DIR
 * @returns {string} Raw template HTML
 */
function loadTemplate(fileName) {
  const cached = templateCache.get(fileName);
  if (cached) return cached;

  const templatePath = path.join(TEMPLATE_DIR, fileName);

  let raw;
  try {
    raw = fs.readFileSync(templatePath, 'utf8');
  } catch (err) {
    throw new Error(
      `Unable to read email template "${fileName}" from ${templatePath} (${err.code || 'read error'})`
    );
  }

  if (raw.trim() === '') {
    throw new Error(`Email template "${fileName}" at ${templatePath} is empty.`);
  }

  templateCache.set(fileName, raw);
  return raw;
}

/**
 * Substitutes {{TOKEN}} placeholders in a template with pre-escaped values.
 *
 * Substitution is a single pass over the template, so a submitted value that
 * itself contains placeholder-like text (for example an address containing the
 * literal "{{DATE_TIME}}") is never re-scanned and replaced.
 *
 * @param {string} template     - Template HTML containing {{TOKEN}} markers
 * @param {Object} replacements - Map of TOKEN -> already HTML-escaped value
 * @returns {string} Rendered HTML
 */
function renderTemplate(template, replacements) {
  const unresolved = new Set();

  const html = template.replace(/\{\{([A-Z0-9_]+)\}\}/g, (match, token) => {
    if (Object.prototype.hasOwnProperty.call(replacements, token)) {
      return replacements[token];
    }
    unresolved.add(token);
    return match;
  });

  if (unresolved.size > 0) {
    // Field names only - never the submitted values.
    strapi.log.warn(
      `[EarlyAccess Email] Template placeholders had no mapped value: ${[...unresolved].join(', ')}`
    );
  }

  return html;
}

// ---------------------------------------------------------------------------
// ADMIN NOTIFICATION
// ---------------------------------------------------------------------------

/**
 * Sends the admin notification for a new Token Factory waitlist signup.
 *
 * @param {Object} data - The newly created early-access entry
 */
async function sendAdminNotification(data) {
  const adminEmail = process.env.ADMIN_EMAIL || 'hello@neocloudz.com';

  // Raw values: used for the log line and the plain-text alternative.
  // HTML escaping is applied per placeholder when the template is rendered.
  const email = data.email || 'N/A';
  const userName = 'N/A'; // Name is not collected on the early access form
  const dateTime = data.createdAt ? new Date(data.createdAt).toLocaleString() : new Date().toLocaleString();

  const emailHtml = renderTemplate(loadTemplate(WAITLIST_ADMIN_TEMPLATE), {
    USER_EMAIL: escapeForEmail(data.email),
    USER_NAME: escapeForEmail(userName),
    DATE_TIME: escapeForEmail(dateTime),
  });

  const textBody = `
New Token Factory Waitlist Signup
==================================

Email:      ${email}
Name:       ${userName}
Date & Time: ${dateTime}
`.trim();

  strapi.log.info(`[EarlyAccess Email] Sending admin notification to ${adminEmail} for signup from ${email}...`);

  await resendService.send({
    to: adminEmail,
    subject: '🚀 New Token Factory Waitlist Signup',
    html: emailHtml,
    text: textBody,
  });

  strapi.log.info(`[EarlyAccess Email] Admin notification sent successfully to ${adminEmail}.`);
}

module.exports = { sendAdminNotification };
