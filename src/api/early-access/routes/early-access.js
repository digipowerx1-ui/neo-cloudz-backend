'use strict';

/**
 * early-access router
 */

const { createCoreRouter } = require('@strapi/strapi').factories;

module.exports = createCoreRouter('api::early-access.early-access');
