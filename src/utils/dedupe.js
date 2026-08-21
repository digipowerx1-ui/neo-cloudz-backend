'use strict';

/**
 * Lifecycle de-duplication helper.
 *
 * Content types with `draftAndPublish: true` store a document as two rows
 * (draft + published). Strapi fires the database-layer `afterCreate` hook once
 * per row, so a single form submission triggers the hook twice — which in turn
 * sent the admin/user emails twice.
 *
 * `isFirstCreate` returns true only for the first hook of a given document, so
 * side effects (emails, Mailchimp sync, webhooks) run exactly once per entry.
 * Both rows are written inside the same request by the same process, so an
 * in-memory guard is sufficient.
 */

// How long a key is remembered. Comfortably longer than the gap between the
// draft and published `afterCreate` hooks, short enough that the map stays tiny.
const TTL_MS = 5 * 60 * 1000;

/** @type {Map<string, number>} key -> expiry timestamp (ms) */
const seen = new Map();

/**
 * Marks a document as processed and reports whether this is the first time.
 *
 * @param {string} uid        - Content-type uid, e.g. 'api::contact-request.contact-request'
 * @param {Object} result     - The lifecycle event result (needs documentId or id)
 * @returns {boolean} true if this is the first create hook for the document
 */
function isFirstCreate(uid, result) {
  const identifier = result && (result.documentId || result.id);

  // Without an identifier we cannot de-duplicate; never suppress the side effect.
  if (!identifier) return true;

  const key = `${uid}:${identifier}`;
  const now = Date.now();

  // Drop expired keys so the map cannot grow unbounded.
  for (const [k, expiresAt] of seen) {
    if (expiresAt <= now) seen.delete(k);
  }

  if (seen.has(key)) return false;

  seen.set(key, now + TTL_MS);
  return true;
}

module.exports = { isFirstCreate };
