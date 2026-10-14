'use strict';

/**
 * contact-request controller
 */

const { createCoreController } = require('@strapi/strapi').factories;
const { errors } = require('@strapi/utils');
const { validateContactRequest } = require('../services/validation');

module.exports = createCoreController('api::contact-request.contact-request', ({ strapi }) => ({
  async create(ctx) {
    const { body = {} } = ctx.request;

    if (!body || typeof body.data !== 'object' || body.data === null) {
      throw new errors.ValidationError('Missing "data" payload in the request body');
    }

    // Server-side validation
    validateContactRequest(body.data);

    // Sanitize empty optional date strings so Strapi's date validator accepts them
    if (body.data.targetStartDate === '') {
      body.data.targetStartDate = null;
    }

    // Delegate to core create controller implementation
    const response = await super.create(ctx);
    return response;
  },
}));
