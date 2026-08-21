'use strict';

const mailchimpService = require('../../services/mailchimp');
const emailService = require('../../services/email');
const { isFirstCreate } = require('../../../../utils/dedupe');

const UID = 'api::contact-request.contact-request';

module.exports = {
  /**
   * Triggered after a contact request entry is successfully created
   */
  async afterCreate(event) {
    const { result } = event;

    // Draft & publish stores the document as two rows, so this hook fires twice
    // per submission. Only act on the first one, otherwise every email is sent
    // (and every Mailchimp sync run) twice.
    if (!isFirstCreate(UID, result)) {
      strapi.log.debug(
        `[ContactRequest] Duplicate afterCreate for document ${result.documentId} ignored (draft/publish pair).`
      );
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
        strapi.log.error(`Unhandled exception in contact-request afterCreate lifecycle (Admin Email): ${err.message}`);
      }

      try {
        await emailService.sendUserConfirmation(result);
      } catch (err) {
        strapi.log.error(`Unhandled exception in contact-request afterCreate lifecycle (User Confirmation Email): ${err.message}`);
      }
    })();
  },
};
