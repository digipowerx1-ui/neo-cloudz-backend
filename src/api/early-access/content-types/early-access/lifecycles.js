'use strict';

const mailchimpService = require('../../services/mailchimp');

/**
 * Lifecycle hooks for the early-access content type.
 *
 * afterCreate — fires after a new early-access entry is successfully written
 *               to the Strapi database.  It asynchronously subscribes the
 *               email to the configured Mailchimp audience so that existing
 *               Customer Journey automations ("Thank You for Subscribing")
 *               can trigger automatically.
 *
 * Guarantees:
 *  - The HTTP response is never delayed: Mailchimp work runs in a detached
 *    async IIFE, identical to the contact-request lifecycle pattern.
 *  - Mailchimp errors are caught and logged; they never cause the API to
 *    return an error to the frontend.
 *  - The early-access entry remains saved regardless of Mailchimp outcome.
 *  - Duplicate subscriptions are handled gracefully by the service layer.
 */
module.exports = {
  /**
   * Triggered after a new early-access entry is successfully created.
   *
   * @param {Object} event        - Strapi lifecycle event
   * @param {Object} event.result - The newly created entry (includes .email)
   */
  async afterCreate(event) {
    const { result } = event;

    // Guard: In Draft & Publish setups the hook fires for both the initial
    // draft save and the publish action.  We only want to subscribe once —
    // on the first (draft) save, before publishedAt is set.
    if (result.publishedAt) {
      return;
    }

    // Detach Mailchimp work from the HTTP request/response cycle.
    // This matches the contact-request lifecycle pattern exactly.
    (async () => {
      try {
        await mailchimpService.subscribeEarlyAccess(result);
      } catch (err) {
        strapi.log.error(
          `[EarlyAccess] Unhandled exception in afterCreate lifecycle (Mailchimp): ${err.message}`
        );
      }
    })();
  },
};
