'use strict';

/**
 * early-access controller
 */

const { createCoreController } = require('@strapi/strapi').factories;

module.exports = createCoreController('api::early-access.early-access');
