'use strict';

/**
 * early-access service
 */

const { createCoreService } = require('@strapi/strapi').factories;

module.exports = createCoreService('api::early-access.early-access');
