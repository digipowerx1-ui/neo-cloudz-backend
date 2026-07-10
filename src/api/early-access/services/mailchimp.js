'use strict';

const mailchimp = require('@mailchimp/mailchimp_marketing');
const crypto = require('crypto');

/**
 * Mailchimp Integration Service — Early Access / Token Factory
 *
 * Subscribes a new early-access email to the configured Mailchimp audience
 * and applies the "Token Factory Early Access" tag so Mailchimp Customer
 * Journey automations can trigger automatically.
 *
 * Design principles (mirrors contact-request/services/mailchimp.js):
 *  - Never throws: all errors are caught and logged; the caller is never
 *    disrupted regardless of Mailchimp availability.
 *  - Duplicate-safe: uses setListMember (PUT upsert) which returns 200 for
 *    existing members instead of 400, so re-submissions are handled gracefully.
 *  - Env-guarded: silently skips if any required env var is absent.
 *  - Tag-driven: applies "Token Factory Early Access" tag for Journey trigger.
 */
module.exports = {
  /**
   * Subscribes an early-access email to the Mailchimp audience.
   *
   * @param {Object} data              - The early-access entry data from Strapi
   * @param {string} [data.email]      - The subscriber's email address
   */
  async subscribeEarlyAccess(data) {
    const apiKey       = process.env.MAILCHIMP_API_KEY;
    const serverPrefix = process.env.MAILCHIMP_SERVER_PREFIX;
    const audienceId   = process.env.MAILCHIMP_AUDIENCE_ID;

    // Guard: skip silently if any required config is missing
    if (!apiKey || !serverPrefix || !audienceId) {
      strapi.log.warn(
        '[EarlyAccess] Mailchimp subscription skipped: Missing environment configuration ' +
        '(MAILCHIMP_API_KEY, MAILCHIMP_SERVER_PREFIX, or MAILCHIMP_AUDIENCE_ID).'
      );
      return;
    }

    try {
      // Configure the Mailchimp client (idempotent — safe to call each time)
      mailchimp.setConfig({
        apiKey: apiKey,
        server: serverPrefix,
      });

      // Normalise the email address
      const email = (data.email || '').trim().toLowerCase();

      if (!email) {
        strapi.log.warn(
          '[EarlyAccess] Mailchimp subscription skipped: No email address found in the early-access entry.'
        );
        return;
      }

      // MD5 hash of the lowercase email is the Mailchimp subscriber identifier
      const subscriberHash = crypto.createHash('md5').update(email).digest('hex');

      strapi.log.info(
        `[EarlyAccess] Subscribing ${email} to Mailchimp audience ${audienceId}...`
      );

      // PUT upsert — adds new member or updates existing without throwing on duplicate
      await mailchimp.lists.setListMember(audienceId, subscriberHash, {
        email_address: email,
        status_if_new: 'subscribed',   // only sets status when first added
      });

      // Apply tag to trigger Mailchimp Customer Journey / Automation
      await mailchimp.lists.updateListMemberTags(audienceId, subscriberHash, {
        tags: [
          {
            name: 'Token Factory Early Access',
            status: 'active',
          },
        ],
      });

      strapi.log.info(
        `[EarlyAccess] Successfully subscribed ${email} to Mailchimp and tagged as "Token Factory Early Access".`
      );
    } catch (error) {
      // Log full details but never re-throw — Mailchimp failure must not
      // affect the early-access entry already saved in Strapi.
      strapi.log.error(
        `[EarlyAccess] Mailchimp subscription failed: ${error.message}`
      );
      if (error.response && error.response.text) {
        strapi.log.error(
          `[EarlyAccess] Mailchimp API error response: ${error.response.text}`
        );
      }
    }
  },
};


