'use strict';

const { Resend } = require('resend');

/**
 * Reusable Resend email utility.
 *
 * Usage:
 *   const resendService = require('../../services/resend');
 *   await resendService.send({ to, subject, html, text });
 *
 * All transactional emails (contact confirmations, OTP, password reset,
 * careers, newsletter notifications, etc.) should go through this service.
 */

let _client = null;

/**
 * Returns a lazily-initialised Resend client.
 * Throws clearly if RESEND_API_KEY is absent.
 */
function getClient() {
  if (_client) return _client;

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error(
      'RESEND_API_KEY environment variable is not set. ' +
      'Add it to your .env file before sending emails.'
    );
  }

  _client = new Resend(apiKey);
  return _client;
}

/**
 * Sends a transactional email via the Resend API.
 *
 * @param {object} options
 * @param {string|string[]} options.to       - Recipient address(es)
 * @param {string}          options.subject  - Email subject line
 * @param {string}          options.html     - HTML body
 * @param {string}          [options.text]   - Plain-text fallback (recommended)
 * @param {string}          [options.from]   - Override sender (defaults to EMAIL_FROM env var)
 * @returns {Promise<object>} Resend API response data
 * @throws  Will throw if the API call fails or RESEND_API_KEY is missing
 */
async function send({ to, subject, html, text, from }) {
  const sender = from || process.env.EMAIL_FROM || 'Neocloudz <hello@neocloudz.com>';

  const client = getClient();

  const { data, error } = await client.emails.send({
    from: sender,
    to: Array.isArray(to) ? to : [to],
    subject,
    html,
    ...(text ? { text } : {}),
  });

  if (error) {
    // Surface the Resend error without leaking API keys or recipient PII in logs
    throw new Error(`Resend API error [${error.name}]: ${error.message}`);
  }

  return data;
}

module.exports = { send };
