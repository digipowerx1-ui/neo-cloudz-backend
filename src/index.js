'use strict';

const _ = require('lodash');

module.exports = {
  /**
   * An asynchronous register function that runs before
   * your application is initialized.
   */
  register(/*{ strapi }*/) {},

  /**
   * An asynchronous bootstrap function that runs before
   * your application gets started.
   */
  async bootstrap({ strapi }) {
    // Ensure public role has permission to create contact requests
    try {
      const roleService = strapi.plugin('users-permissions').service('role');
      const publicRole = await strapi.db.query('plugin::users-permissions.role').findOne({
        where: { type: 'public' },
      });

      if (publicRole) {
        const fullRole = await roleService.findOne(publicRole.id);
        const hasCreate = _.get(
          fullRole,
          'permissions.api::contact-request.controllers.contact-request.create.enabled'
        );

        if (!hasCreate) {
          _.set(
            fullRole,
            'permissions.api::contact-request.controllers.contact-request.create.enabled',
            true
          );
          await roleService.updateRole(publicRole.id, fullRole);
          strapi.log.info('[Bootstrap] Granted api::contact-request.contact-request.create permission to Public role');
        }
      }
    } catch (err) {
      strapi.log.warn(`[Bootstrap] Note on public permissions: ${err.message}`);
    }
  },
};
