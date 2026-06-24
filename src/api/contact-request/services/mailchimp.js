'use strict';

const mailchimp = require('@mailchimp/mailchimp_marketing');
const crypto = require('crypto');

/**
 * Mailchimp Integration Service
 */
module.exports = {
  /**
   * Syncs a contact request submission to Mailchimp
   * @param {Object} data - The contact request entry data
   */
  async syncContactToMailchimp(data) {
    const apiKey = process.env.MAILCHIMP_API_KEY;
    const serverPrefix = process.env.MAILCHIMP_SERVER_PREFIX;
    const audienceId = process.env.MAILCHIMP_AUDIENCE_ID;

    if (!apiKey || !serverPrefix || !audienceId) {
      strapi.log.warn('Mailchimp integration is skipped: Missing environment configuration (MAILCHIMP_API_KEY, MAILCHIMP_SERVER_PREFIX, or MAILCHIMP_AUDIENCE_ID).');
      return;
    }

    try {
      mailchimp.setConfig({
        apiKey: apiKey,
        server: serverPrefix,
      });

      const email = (data.workEmail || '').trim().toLowerCase();
      if (!email) {
        strapi.log.warn('Mailchimp sync skipped: No email address provided in the contact request.');
        return;
      }

      const subscriberHash = crypto.createHash('md5').update(email).digest('hex');

      // Map fields according to specifications
      const mergeFields = {
        FNAME: data.fullName || '',
        PHONE: data.phoneNumber || '',
        COMPANY: data.company || '',
        MESSAGE: data.message || '',
      };

      strapi.log.info(`Syncing contact ${email} to Mailchimp audience ${audienceId}...`);

      // Add or update the member in the list
      await mailchimp.lists.setListMember(audienceId, subscriberHash, {
        email_address: email,
        status_if_new: 'subscribed',
        merge_fields: mergeFields,
      });

      // Add the tag to trigger the Mailchimp Customer Journey
      await mailchimp.lists.updateListMemberTags(audienceId, subscriberHash, {
        tags: [
          {
            name: 'contact-form-lead',
            status: 'active',
          },
        ],
      });

      strapi.log.info(`Successfully synced contact ${email} to Mailchimp and tagged as "contact-form-lead".`);
    } catch (error) {
      strapi.log.error(`Mailchimp synchronization failed: ${error.message}`);
      if (error.response && error.response.text) {
        strapi.log.error(`Mailchimp API Error response: ${error.response.text}`);
      }
    }
  }
};
