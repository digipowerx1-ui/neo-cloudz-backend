'use strict';

const mailchimpService = require('../../services/mailchimp');
const emailService = require('../../services/email');

module.exports = {
  /**
   * Triggered after a contact request entry is successfully created
   */
  async afterCreate(event) {
    const { result } = event;

    // Prevent duplicate triggers in Draft & Publish setup (only execute for draft/initial creation)
    if (result.publishedAt) {
      return;
    }

    // Run asynchronously to prevent blocking the HTTP response/client submission
    (async () => {
      try {
        await mailchimpService.syncContactToMailchimp(result);
      } catch (err) {
        strapi.log.error(`Unhandled exception in contact-request afterCreate lifecycle (Mailchimp): ${err.message}`);
      }

      try {
        await emailService.sendAdminNotification(result);
      } catch (err) {
        strapi.log.error(`Unhandled exception in contact-request afterCreate lifecycle (Email): ${err.message}`);
      }
    })();
  },
};
