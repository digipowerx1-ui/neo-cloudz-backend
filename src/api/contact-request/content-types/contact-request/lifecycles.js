'use strict';

const mailchimpService = require('../../services/mailchimp');
const emailService = require('../../services/email');

module.exports = {
  /**
   * Triggered after a contact request entry is successfully created
   */
  async afterCreate(event) {
    const { result } = event;

    // Run asynchronously to prevent blocking the HTTP response/client submission
    strapi.db.transaction(async () => {
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
    });
  },
};
