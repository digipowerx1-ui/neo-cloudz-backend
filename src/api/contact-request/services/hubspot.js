'use strict';

/**
 * HubSpot CRM Integration Service
 *
 * Syncs contact-request submissions to the HubSpot CRM as Contacts.
 *
 * Mirrors the architectural contract of ./mailchimp.js:
 *  - Reads configuration from server-side environment variables only.
 *  - Returns early (without throwing) when configuration is absent.
 *  - Catches its own errors, logs them safely and never throws, so a CRM
 *    outage can never affect the Strapi submission or the Resend emails.
 *
 * Uses the official HubSpot CRM v3 REST API via native fetch (Node >= 20), so
 * no additional SDK dependency is required.
 *
 * Required HubSpot private-app scopes:
 *   crm.objects.contacts.read
 *   crm.objects.contacts.write
 */

const HUBSPOT_API_BASE = 'https://api.hubapi.com';
const CONTACTS_PATH = '/crm/v3/objects/contacts';

// Guards against a hung connection keeping the detached lifecycle task alive.
const REQUEST_TIMEOUT_MS = 10000;

/**
 * NeoCloudz-specific HubSpot contact properties.
 *
 * These are CUSTOM properties and must be created manually in the HubSpot
 * portal (Settings > Properties > Contact properties) before they will accept
 * values. This service never creates properties itself.
 *
 * If any are missing, HubSpot rejects the whole write with
 * PROPERTY_DOESNT_EXIST. The sync detects that and retries once using standard
 * properties only, so the lead is still captured.
 */
const CUSTOM_PROPERTY_NAMES = [
  'neocloudz_interest_type',
  'neocloudz_budget_range',
  'neocloudz_message',
  'neocloudz_lead_source',
];

/**
 * Strapi `budgetRange` enum value -> HubSpot `neocloudz_budget_range` option value.
 *
 * The two vocabularies differ, and HubSpot rejects the ENTIRE write when a
 * dropdown property receives an option it does not define, so the Strapi value
 * must be translated before it is sent.
 *
 * NOTE: Strapi also defines `under_5k`, which has no corresponding option in
 * HubSpot (the property allows only the four below). An unmapped value is
 * omitted rather than sent, so the contact still syncs with every other field
 * intact. To start syncing it, add the option in HubSpot and a line here.
 */
const BUDGET_RANGE_TO_HUBSPOT = {
  range_5k_20k: 'p_5k__20k',
  range_20k_100k: 'p_20k__100k',
  range_100k_500k: 'p_100k__500k',
  range_500k_plus: 'p_500k',
};

const MISSING_PROPERTY_HINT =
  '[HubSpot] A NeoCloudz custom property does not exist in the portal. ' +
  'Retrying with standard properties only. Expected properties: ' +
  CUSTOM_PROPERTY_NAMES.join(', ') +
  '. Create them under Settings > Properties > Contact properties.';

/**
 * Splits a free-text full name into HubSpot's firstname / lastname pair.
 * The first token is the first name, everything after it is the last name.
 *
 * "John Smith"      -> { firstName: 'John', lastName: 'Smith' }
 * "Ada B. Lovelace" -> { firstName: 'Ada',  lastName: 'B. Lovelace' }
 * "John"            -> { firstName: 'John', lastName: '' }
 *
 * @param {string} fullName
 * @returns {{ firstName: string, lastName: string }}
 */
function splitFullName(fullName) {
  const parts = String(fullName || '').trim().split(/\s+/).filter(Boolean);

  if (parts.length === 0) return { firstName: '', lastName: '' };
  if (parts.length === 1) return { firstName: parts[0], lastName: '' };

  return { firstName: parts[0], lastName: parts.slice(1).join(' ') };
}

/**
 * Builds the HubSpot properties payload from a contact-request entry.
 *
 * Only non-empty values are included. That single rule gives the behaviour
 * required on both paths: a create sends nothing useless, and an update can
 * never blank out richer data already held in HubSpot (an existing `company`
 * is preserved when this submission left the field empty).
 *
 * Deliberately NOT mapped:
 *  - `progress` - an internal pipeline field that is publicly writable on the
 *    Strapi API, so it must never drive a CRM lifecycle/status property.
 *
 * @param {Object} data - The contact request entry
 * @param {Object} [options]
 * @param {boolean} [options.standardOnly] - Omit the NeoCloudz custom properties
 * @returns {Object} HubSpot contact properties
 */
function buildProperties(data, { standardOnly = false } = {}) {
  const { firstName, lastName } = splitFullName(data.fullName);

  const properties = {
    // --- Standard HubSpot contact properties ---
    email: (data.workEmail || '').trim().toLowerCase(),
    firstname: firstName,
    lastname: lastName,
    phone: (data.phoneNumber || '').trim(),
    company: (data.company || '').trim(),
  };

  if (!standardOnly) {
    // --- NeoCloudz custom properties (must pre-exist in the portal) ---
    properties.neocloudz_interest_type = data.interestType || '';
    // Translated to HubSpot's own option values; an unmapped value is dropped
    // below rather than rejected by HubSpot along with the whole request.
    properties.neocloudz_budget_range = BUDGET_RANGE_TO_HUBSPOT[data.budgetRange] || '';

    if (data.budgetRange && !BUDGET_RANGE_TO_HUBSPOT[data.budgetRange]) {
      strapi.log.warn(
        `[HubSpot] budgetRange "${data.budgetRange}" has no HubSpot option in ` +
        'neocloudz_budget_range and was omitted from the sync. Add the option in ' +
        'HubSpot and map it in BUDGET_RANGE_TO_HUBSPOT to include it.'
      );
    }
    // Latest submission wins, matching the existing Mailchimp MESSAGE merge field.
    properties.neocloudz_message = (data.message || '').trim();
    // `source` arrives through the public API and is therefore untrusted. It is
    // stored as self-reported website input, never as internal attribution.
    properties.neocloudz_lead_source = (data.source || '').trim();
  }

  // Drop empty values so an update never overwrites existing HubSpot data.
  for (const [key, value] of Object.entries(properties)) {
    if (value === '' || value === null || value === undefined) {
      delete properties[key];
    }
  }

  return properties;
}

/**
 * Error carrying the details of a failed HubSpot request.
 *
 * Declaring `status` and `body` on a class keeps them part of the error's own
 * type, so they can be read back by the callers below without widening or
 * re-casting a plain Error.
 *
 * `status` is the HTTP status code, or 0 for a network/timeout failure.
 * `body` is the raw HubSpot response body, which never contains credentials
 * because the token travels only in the request headers.
 */
class HubSpotApiError extends Error {
  /**
   * @param {string} message
   * @param {{ status: number, body?: string }} details
   */
  constructor(message, { status, body }) {
    super(message);
    this.name = 'HubSpotApiError';
    this.status = status;
    this.body = body;
  }
}

/**
 * Performs an authenticated HubSpot API request.
 *
 * The access token is attached here and nowhere else; it is never returned,
 * logged, or included in a thrown error.
 *
 * @throws {HubSpotApiError} With `status` and `body` set for non-2xx responses.
 */
async function hubspotRequest(path, { method, token, body }) {
  let response;

  try {
    response = await fetch(`${HUBSPOT_API_BASE}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (err) {
    // Network failure, DNS error, or request timeout.
    const isTimeout = err.name === 'TimeoutError' || err.name === 'AbortError';
    throw new HubSpotApiError(
      isTimeout
        ? `Request timed out after ${REQUEST_TIMEOUT_MS}ms`
        : `Network error: ${err.message}`,
      { status: 0 }
    );
  }

  const rawBody = await response.text();

  if (!response.ok) {
    // HubSpot error bodies describe the problem and carry no credentials,
    // because the token only ever travels in the request headers.
    throw new HubSpotApiError(`HubSpot API responded ${response.status}`, {
      status: response.status,
      body: rawBody,
    });
  }

  return rawBody ? JSON.parse(rawBody) : {};
}

/**
 * Looks up a HubSpot contact by email address.
 *
 * Requests only the `email` property: the search response always carries the
 * record id, so no second full-contact fetch is needed.
 *
 * @returns {Promise<string|null>} The HubSpot contact id, or null if not found
 */
async function findContactIdByEmail(email, token) {
  const result = await hubspotRequest(`${CONTACTS_PATH}/search`, {
    method: 'POST',
    token,
    body: {
      filterGroups: [
        { filters: [{ propertyName: 'email', operator: 'EQ', value: email }] },
      ],
      properties: ['email'],
      limit: 1,
    },
  });

  const match = Array.isArray(result.results) ? result.results[0] : null;
  return match && match.id ? String(match.id) : null;
}

/** True when HubSpot rejected the write because a custom property is missing. */
function isMissingPropertyError(error) {
  return (
    error.status === 400 &&
    String(error.body || '').includes('PROPERTY_DOESNT_EXIST')
  );
}

/**
 * Extracts the existing contact id from a 409 Conflict response.
 *
 * HubSpot returns 409 "Contact already exists. Existing ID: 12345" when a
 * create races the search index, which lags writes by a short interval.
 *
 * @returns {string|null}
 */
function extractConflictContactId(error) {
  if (error.status !== 409) return null;
  const match = String(error.body || '').match(/Existing ID:\s*(\d+)/i);
  return match ? match[1] : null;
}

/**
 * PATCHes a contact, retrying once without the NeoCloudz custom properties if
 * the portal is missing them, so a misconfigured portal still records the lead.
 */
async function updateContact(contactId, data, token) {
  try {
    return await hubspotRequest(`${CONTACTS_PATH}/${contactId}`, {
      method: 'PATCH',
      token,
      body: { properties: buildProperties(data) },
    });
  } catch (err) {
    if (!isMissingPropertyError(err)) throw err;

    strapi.log.error(MISSING_PROPERTY_HINT);

    return await hubspotRequest(`${CONTACTS_PATH}/${contactId}`, {
      method: 'PATCH',
      token,
      body: { properties: buildProperties(data, { standardOnly: true }) },
    });
  }
}

/**
 * Builds a log-safe diagnostic context.
 *
 * The email is redacted and the submitted message is never included. The
 * Strapi documentId is logged instead, so an operator can still correlate a
 * failure with the stored record.
 */
function logContext(operation, data, error) {
  return JSON.stringify({
    operation,
    documentId: data.documentId || data.id || null,
    email: '[redacted]',
    status: error && error.status !== undefined ? error.status : null,
    error: error ? error.message : null,
  });
}

module.exports = {
  /**
   * Syncs a contact request submission to HubSpot as a Contact.
   *
   * Email is the identity key: an existing contact is updated, a new one is
   * created. A submitter who sends the form repeatedly ends up as exactly one
   * HubSpot contact with refreshed properties.
   *
   * Normal cost is two API calls (one search plus one write). Extra calls occur
   * only on the recoverable error paths documented inline.
   *
   * Never throws. Never logs the access token or the submitted message.
   *
   * @param {Object} data - The contact request entry data
   * @returns {Promise<{status: string, contactId?: string, reason?: string, error?: string}>}
   */
  async syncContactToHubSpot(data) {
    const token = process.env.HUBSPOT_ACCESS_TOKEN;

    if (!token) {
      strapi.log.warn(
        '[HubSpot] Sync skipped: Missing environment configuration (HUBSPOT_ACCESS_TOKEN).'
      );
      return { status: 'skipped', reason: 'missing_configuration' };
    }

    const email = (data.workEmail || '').trim().toLowerCase();

    // Email is the only duplicate key accepted. Without it the contact cannot
    // be identified, and matching on name or company would risk merging
    // unrelated people, so the sync is skipped entirely.
    if (!email) {
      strapi.log.warn(
        '[HubSpot] Sync skipped: No email address provided in the contact request.'
      );
      return { status: 'skipped', reason: 'missing_email' };
    }

    let operation = 'search';

    try {
      const existingContactId = await findContactIdByEmail(email, token);

      // --- Existing contact: update in place ---
      if (existingContactId) {
        operation = 'update';
        strapi.log.info(`[HubSpot] Updating existing contact ${existingContactId}...`);

        await updateContact(existingContactId, data, token);

        strapi.log.info(`[HubSpot] Contact ${existingContactId} updated successfully.`);
        return { status: 'updated', contactId: existingContactId };
      }

      // --- No contact found: create one ---
      operation = 'create';
      strapi.log.info('[HubSpot] Creating new contact...');

      let created;
      try {
        created = await hubspotRequest(CONTACTS_PATH, {
          method: 'POST',
          token,
          body: { properties: buildProperties(data) },
        });
      } catch (err) {
        // The search index lags behind writes, so a concurrent or very recent
        // submission can reach this point for a contact that already exists.
        // HubSpot reports which one, so update it instead of giving up.
        const conflictId = extractConflictContactId(err);
        if (conflictId) {
          operation = 'update';
          strapi.log.info(
            `[HubSpot] Contact already existed (search lag); updating ${conflictId} instead.`
          );

          await updateContact(conflictId, data, token);

          strapi.log.info(`[HubSpot] Contact ${conflictId} updated successfully.`);
          return { status: 'updated', contactId: conflictId };
        }

        if (isMissingPropertyError(err)) {
          strapi.log.error(MISSING_PROPERTY_HINT);

          created = await hubspotRequest(CONTACTS_PATH, {
            method: 'POST',
            token,
            body: { properties: buildProperties(data, { standardOnly: true }) },
          });
        } else {
          throw err;
        }
      }

      const contactId = created && created.id ? String(created.id) : undefined;
      strapi.log.info(
        `[HubSpot] Contact ${contactId || '(id unavailable)'} created successfully.`
      );
      return { status: 'created', contactId };
    } catch (error) {
      // Terminal failure. Logged for diagnosis and swallowed: the Strapi record
      // is already saved and Mailchimp/Resend must still run.
      strapi.log.error(`[HubSpot] Contact sync failed: ${logContext(operation, data, error)}`);

      if (error.body) {
        strapi.log.error(`[HubSpot] API error response: ${error.body}`);
      }

      return { status: 'failed', error: error.message };
    }
  },
};
