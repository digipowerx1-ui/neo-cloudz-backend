'use strict';

const mailchimpService = require('../../services/mailchimp');
const emailService = require('../../services/email');
const { isFirstCreate } = require('../../../../utils/dedupe');

const UID = 'api::early-access.early-access';

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

    // Draft & publish stores the document as two rows, so this hook fires twice
    // per signup. Only act on the first one, otherwise the admin notification
    // (and the Mailchimp sync) runs twice.
    if (!isFirstCreate(UID, result)) {
      strapi.log.debug(
        `[EarlyAccess] Duplicate afterCreate for document ${result.documentId} ignored (draft/publish pair).`
      );
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

      try {
        await emailService.sendAdminNotification(result);
      } catch (err) {
        strapi.log.error(
          `[EarlyAccess] Unhandled exception in afterCreate lifecycle (Admin Email): ${err.message}`
        );
      }
    })();
  },
};
