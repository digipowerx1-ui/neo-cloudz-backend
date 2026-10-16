'use strict';

const fs = require('fs');
const path = require('path');

const resendService = require('../../../services/resend');

/**
 * Contact-request email service.
 *
 * Provides two transactional emails triggered on contact form submission:
 *  1. sendAdminNotification – alerts the admin team with all form details.
 *  2. sendUserConfirmation  – sends the thank-you email to the submitter.
 *
 * Both are sent via the shared Resend utility (src/services/resend.js).
 */

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Escapes characters that are sensitive in HTML context to prevent XSS in email clients.
 * @param {string|null|undefined} str
 * @returns {string}
 */
function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Renders a two-column detail row for NeoCloudz emails.
 */
function renderDetailRow(label, rawValue) {
  if (rawValue === undefined || rawValue === null || String(rawValue).trim() === '') {
    return '';
  }
  return `
    <tr>
      <td class="details-label" width="32%"
        style="padding: 12px; background-color: #000000; border: 1px solid #00ff66; border-radius: 4px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 13px; font-weight: 600; color: #ffffff;">
        ${escapeHtml(label)}
      </td>
      <td class="details-spacer" width="2%" style="font-size: 0; line-height: 0;">&nbsp;</td>
      <td class="details-value" width="66%"
        style="padding: 12px; background-color: #000000; border: 1px solid #00ff66; border-radius: 4px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 13px; color: #a3a3a3;">
        ${escapeHtml(String(rawValue))}
      </td>
    </tr>
    <tr><td height="8" colspan="3" style="font-size: 0; line-height: 0;">&nbsp;</td></tr>
  `;
}

/**
 * Prepares a single-line user-supplied value for safe inclusion in an HTML email.
 *
 * @param {*} value           - Raw value from the contact request
 * @param {string} [fallback] - Text shown when the value is absent
 * @returns {string} HTML-escaped, email-safe value
 */
function escapeForEmail(value, fallback = 'Not provided') {
  if (value === null || value === undefined || String(value).trim() === '') {
    return escapeHtml(fallback);
  }
  return escapeHtml(String(value).trim());
}

/**
 * Same as escapeForEmail, but preserves the line breaks of multi-line text
 * fields (message, models of interest, expected usage) as <br>.
 * Escaping runs first, so those <br> tags are the only markup that can appear.
 *
 * @param {*} value           - Raw value from the contact request
 * @param {string} [fallback] - Text shown when the value is absent
 * @returns {string} HTML-escaped, email-safe value with <br> line breaks
 */
function escapeMultilineForEmail(value, fallback = 'Not provided') {
  return escapeForEmail(value, fallback).replace(/\r\n|\r|\n/g, '<br>');
}

// ---------------------------------------------------------------------------
// HTML template loading
// ---------------------------------------------------------------------------

/**
 * Directory holding the standalone HTML email templates.
 *
 * Resolved from this module's own location (__dirname) rather than the process
 * working directory, so it behaves identically however Strapi is started.
 * src/api/contact-request/services -> src/neocloudz-templates
 */
const TEMPLATE_DIR = path.join(__dirname, '..', '..', '..', 'neocloudz-templates');

const EARLY_ACCESS_ADMIN_TEMPLATE = 'early-access-admin-notification.html';
const GENERAL_CONTACT_ADMIN_TEMPLATE = 'general-contact-admin-notification.html';

/** In-memory template cache, keyed by file name. */
const templateCache = new Map();

/**
 * Reads an HTML email template from disk as UTF-8 and caches it.
 *
 * Throws rather than returning an empty or partial document, so a missing or
 * unreadable template is logged by the lifecycle hook instead of resulting in
 * a broken email being delivered.
 *
 * @param {string} fileName - Template file name inside TEMPLATE_DIR
 * @returns {string} Raw template HTML
 */
function loadTemplate(fileName) {
  const cached = templateCache.get(fileName);
  if (cached) return cached;

  const templatePath = path.join(TEMPLATE_DIR, fileName);

  let raw;
  try {
    raw = fs.readFileSync(templatePath, 'utf8');
  } catch (err) {
    throw new Error(
      `Unable to read email template "${fileName}" from ${templatePath} (${err.code || 'read error'})`
    );
  }

  if (raw.trim() === '') {
    throw new Error(`Email template "${fileName}" at ${templatePath} is empty.`);
  }

  templateCache.set(fileName, raw);
  return raw;
}

/**
 * Substitutes {{TOKEN}} placeholders in a template with pre-escaped values.
 *
 * Substitution is a single pass over the template, so a submitted value that
 * itself contains placeholder-like text (for example a message containing the
 * literal "{{WORK_EMAIL}}") is never re-scanned and replaced.
 *
 * @param {string} template     - Template HTML containing {{TOKEN}} markers
 * @param {Object} replacements - Map of TOKEN -> already HTML-escaped value
 * @returns {string} Rendered HTML
 */
function renderTemplate(template, replacements) {
  const unresolved = new Set();

  const html = template.replace(/\{\{([A-Z0-9_]+)\}\}/g, (match, token) => {
    if (Object.prototype.hasOwnProperty.call(replacements, token)) {
      return replacements[token];
    }
    unresolved.add(token);
    return match;
  });

  if (unresolved.size > 0) {
    // Field names only - never the submitted values.
    strapi.log.warn(
      `[Email] Template placeholders had no mapped value: ${[...unresolved].join(', ')}`
    );
  }

  return html;
}

/** Human-readable labels for the enumeration values stored by Strapi. */
const REQUEST_TYPE_LABELS = {
  early_access: 'Early Access',
  general_contact: 'General Contact',
};

const PRODUCT_INTEREST_LABELS = {
  token_factory: 'Token Factory',
};

// ---------------------------------------------------------------------------
// 1. ADMIN NOTIFICATION
// ---------------------------------------------------------------------------

/**
 * Sends an admin email notification when a new contact request is created.
 * @param {Object} data - The contact request entry data
 */
async function sendAdminNotification(data) {
  const isEarlyAccess = data.requestType === 'early_access' || data.productInterest === 'token_factory';
  if (isEarlyAccess) {
    return sendEarlyAccessAdminNotification(data);
  }

  const adminEmail = process.env.ADMIN_EMAIL || 'hello@neocloudz.com';

  // Raw values: used for the subject, the log line and the plain-text body.
  // HTML escaping is applied per placeholder when the template is rendered.
  const fullName     = data.fullName     || 'N/A';
  const workEmail    = data.workEmail    || 'N/A';
  const phoneNumber  = data.phoneNumber  || 'N/A';
  const company      = data.company      || 'N/A';
  const interestType = data.interestType || 'N/A';
  const budgetRange  = data.budgetRange  || 'N/A';
  const message      = data.message      || 'No message provided.';
  const source       = data.source       || 'N/A';

  const emailHtml = renderTemplate(loadTemplate(GENERAL_CONTACT_ADMIN_TEMPLATE), {
    FULL_NAME:     escapeForEmail(data.fullName),
    WORK_EMAIL:    escapeForEmail(data.workEmail),
    COMPANY:       escapeForEmail(data.company),
    PHONE_NUMBER:  escapeForEmail(data.phoneNumber),
    INTEREST_TYPE: escapeForEmail(data.interestType),
    BUDGET_RANGE:  escapeForEmail(data.budgetRange),
    SOURCE:        escapeForEmail(data.source),
    MESSAGE:       escapeMultilineForEmail(data.message, 'No message provided.'),
  });

  const textBody = `
New Contact Request Received
=============================

Full Name:    ${fullName}
Work Email:   ${workEmail}
Phone:        ${phoneNumber}
Company:      ${company}
Interest:     ${interestType}
Budget Range: ${budgetRange}
Source:       ${source}

Message:
${message}
  `.trim();

  strapi.log.info(`[Email] Sending admin notification to ${adminEmail} for contact from ${workEmail}...`);

  await resendService.send({
    to: adminEmail,
    subject: `New Contact Request - Neo Cloudz (${fullName})`,
    html: emailHtml,
    text: textBody,
  });

  strapi.log.info(`[Email] Admin notification sent successfully to ${adminEmail}.`);
}

// ---------------------------------------------------------------------------
// 2. USER CONFIRMATION
// ---------------------------------------------------------------------------

/**
 * Sends a thank-you confirmation email to the contact form submitter.
 * @param {Object} data - The contact request entry data
 */
async function sendUserConfirmation(data) {
  const isEarlyAccess = data.requestType === 'early_access' || data.productInterest === 'token_factory';
  if (isEarlyAccess) {
    return sendEarlyAccessUserConfirmation(data);
  }

  const fullName     = escapeHtml(data.fullName     || 'there');
  const workEmail    = (data.workEmail || '').trim();
  const interestType = escapeHtml(data.interestType || 'N/A');
  const budgetRange  = escapeHtml(data.budgetRange  || 'N/A');
  const company      = escapeHtml(data.company      || 'N/A');
  const message      = escapeHtml(data.message      || 'No message provided.');
  const source       = escapeHtml(data.source       || 'N/A');

  if (!workEmail) {
    strapi.log.warn('[Email] User confirmation skipped: no workEmail provided in contact request.');
    return;
  }

  const emailHtml = `<!DOCTYPE html>
<html lang="en">

<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Thanks for contacting NeoCloudz</title>
  <style>
    /* Reset styles to avoid client-specific overrides */
    body,
    table,
    td,
    a {
      -webkit-text-size-adjust: 100%;
      -ms-text-size-adjust: 100%;
    }

    table,
    td {
      mso-table-lspace: 0pt;
      mso-table-rspace: 0pt;
    }

    img {
      -ms-interpolation-mode: bicubic;
      border: 0;
      height: auto;
      line-height: 100%;
      outline: none;
      text-decoration: none;
    }

    table {
      border-collapse: collapse !important;
    }

    body {
      height: 100% !important;
      margin: 0 !important;
      padding: 0 !important;
      width: 100% !important;
      background-color: #050505;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      color: #ffffff;
    }

    /* Responsive Styles */
    @media screen and (max-width: 600px) {
      .email-container {
        width: 100% !important;
        padding-left: 10px !important;
        padding-right: 10px !important;
      }

      .details-table td {
        display: block !important;
        width: 100% !important;
        box-sizing: border-box !important;
      }

      .details-table tr {
        margin-bottom: 10px !important;
        display: block !important;
      }

      .details-spacer {
        display: none !important;
      }

      .details-label {
        margin-bottom: 6px !important;
      }
    }
  </style>
</head>

<body style="margin: 0; padding: 0; background-color: #050505; color: #ffffff;">

  <!-- Outer background container -->
  <table border="0" cellpadding="0" cellspacing="0" width="100%"
    style="background-color: #050505; table-layout: fixed;">
    <tr>
      <td align="center" style="padding: 20px 0;">

        <!-- Main Email Wrapper (Max 600px width) -->
        <table border="0" cellpadding="0" cellspacing="0" width="600" class="email-container"
          style="background-color: #050505; max-width: 600px; width: 100%;">

          <!-- HEADER: Logo -->
          <tr>
            <td align="left" style="padding: 20px 20px 10px 20px;">
              <img src="https://www.neocloudz.com/images/neocloudz-logo.png" alt="NeoCloudz" height="45"
                style="display: block; height: 100px; width: auto;" />
            </td>
          </tr>

          <!-- HEADER: Greeting / Thank you -->
          <tr>
            <td align="center" style="padding: 10px 20px 20px 20px;">
              <h1
                style="margin: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 28px; font-weight: 700; line-height: 1.3; color: #ffffff; text-align: center;">
                Thanks for contacting<br>
                <span style="color: #00ff66;">NeoCloudz</span>
              </h1>
            </td>
          </tr>

          <!-- GPU CLUSTER CARD -->
          <tr>
            <td align="center" style="padding: 10px 20px;">
              <table border="0" cellpadding="0" cellspacing="0" width="100%"
                style="border: 1px solid #00ff66; border-radius: 8px; background-color: #0a0a0a; overflow: hidden;">
                <!-- Card Header (GPU Clusters text + icon) -->
                <tr>
                  <td align="center" style="padding: 25px 20px 15px 20px;">
                    <!-- 3D Cube Icon SVG -->
                    <table border="0" cellpadding="0" cellspacing="0">
                      <tr>
                        <td align="center" style="padding-bottom: 8px;">
                          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"
                            style="display: block;">
                            <path d="M12 2L2 7L12 12L22 7L12 2Z" stroke="#00ff66" stroke-width="2"
                              stroke-linejoin="round" />
                            <path d="M2 17L12 22L22 17" stroke="#00ff66" stroke-width="2" stroke-linejoin="round" />
                            <path d="M2 12L12 17L22 12" stroke="#00ff66" stroke-width="2" stroke-linejoin="round" />
                          </svg>
                        </td>
                      </tr>
                      <tr>
                        <td align="center"
                          style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 14px; font-weight: 700; letter-spacing: 3px; color: #ffffff; text-transform: uppercase;">
                          GPU <span style="color: #00ff66;">CLUSTERS</span>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <!-- Card Image -->
                <tr>
                  <td align="center" style="padding: 0 15px 20px 15px;">
                    <img src="https://res.cloudinary.com/dntahkr0a/image/upload/v1782278462/gpu-clusters_srxl1s.jpg" alt="GPU Clusters" width="530"
                      style="display: block; width: 100%; max-width: 530px; height: auto; border-radius: 6px;" />
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- PERSONALIZED GREETING & INTRO -->
          <tr>
            <td align="left"
              style="padding: 25px 20px 15px 20px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 15px; line-height: 1.6; color: #e0e0e0;">
              <p style="margin: 0 0 12px 0;">Hi <span style="font-weight: 600; color: #ffffff;">${fullName}</span>,</p>
              <p style="margin: 0;">Thanks for contacting <strong style="color: #ffffff;">NeoCloudz</strong>. We've
                received your request and our team is reviewing it.</p>
            </td>
          </tr>

          <!-- FORM DETAILS SECTION -->
          <tr>
            <td align="center" style="padding: 10px 20px;">
              <table border="0" cellpadding="0" cellspacing="0" width="100%" class="details-table">
                <!-- Interest Type -->
                <tr>
                  <td class="details-label" width="32%"
                    style="padding: 12px; background-color: #000000; border: 1px solid #00ff66; border-radius: 4px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 13px; font-weight: 600; color: #ffffff;">
                    Interest Type
                  </td>
                  <td class="details-spacer" width="2%" style="font-size: 0; line-height: 0;">&nbsp;</td>
                  <td class="details-value" width="66%"
                    style="padding: 12px; background-color: #000000; border: 1px solid #00ff66; border-radius: 4px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 13px; color: #a3a3a3;">
                    ${interestType}
                  </td>
                </tr>
                <tr>
                  <td height="8" colspan="3" style="font-size: 0; line-height: 0;">&nbsp;</td>
                </tr>
                <!-- Fullname -->
                <tr>
                  <td class="details-label" width="32%"
                    style="padding: 12px; background-color: #000000; border: 1px solid #00ff66; border-radius: 4px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 13px; font-weight: 600; color: #ffffff;">
                    Fullname
                  </td>
                  <td class="details-spacer" width="2%" style="font-size: 0; line-height: 0;">&nbsp;</td>
                  <td class="details-value" width="66%"
                    style="padding: 12px; background-color: #000000; border: 1px solid #00ff66; border-radius: 4px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 13px; color: #a3a3a3;">
                    ${fullName}
                  </td>
                </tr>
                <tr>
                  <td height="8" colspan="3" style="font-size: 0; line-height: 0;">&nbsp;</td>
                </tr>
                <!-- Work Email -->
                <tr>
                  <td class="details-label" width="32%"
                    style="padding: 12px; background-color: #000000; border: 1px solid #00ff66; border-radius: 4px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 13px; font-weight: 600; color: #ffffff;">
                    Work Email
                  </td>
                  <td class="details-spacer" width="2%" style="font-size: 0; line-height: 0;">&nbsp;</td>
                  <td class="details-value" width="66%"
                    style="padding: 12px; background-color: #000000; border: 1px solid #00ff66; border-radius: 4px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 13px; color: #a3a3a3;">
                    ${workEmail}
                  </td>
                </tr>
                <tr>
                  <td height="8" colspan="3" style="font-size: 0; line-height: 0;">&nbsp;</td>
                </tr>
                <!-- Company -->
                <tr>
                  <td class="details-label" width="32%"
                    style="padding: 12px; background-color: #000000; border: 1px solid #00ff66; border-radius: 4px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 13px; font-weight: 600; color: #ffffff;">
                    Company
                  </td>
                  <td class="details-spacer" width="2%" style="font-size: 0; line-height: 0;">&nbsp;</td>
                  <td class="details-value" width="66%"
                    style="padding: 12px; background-color: #000000; border: 1px solid #00ff66; border-radius: 4px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 13px; color: #a3a3a3;">
                    ${company}
                  </td>
                </tr>
                <tr>
                  <td height="8" colspan="3" style="font-size: 0; line-height: 0;">&nbsp;</td>
                </tr>
                <!-- Budget Range -->
                <tr>
                  <td class="details-label" width="32%"
                    style="padding: 12px; background-color: #000000; border: 1px solid #00ff66; border-radius: 4px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 13px; font-weight: 600; color: #ffffff;">
                    Budget Range
                  </td>
                  <td class="details-spacer" width="2%" style="font-size: 0; line-height: 0;">&nbsp;</td>
                  <td class="details-value" width="66%"
                    style="padding: 12px; background-color: #000000; border: 1px solid #00ff66; border-radius: 4px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 13px; color: #a3a3a3;">
                    ${budgetRange}
                  </td>
                </tr>
                <tr>
                  <td height="8" colspan="3" style="font-size: 0; line-height: 0;">&nbsp;</td>
                </tr>
                <!-- Message -->
                <tr>
                  <td class="details-label" width="32%"
                    style="padding: 12px; background-color: #000000; border: 1px solid #00ff66; border-radius: 4px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 13px; font-weight: 600; color: #ffffff;">
                    Message
                  </td>
                  <td class="details-spacer" width="2%" style="font-size: 0; line-height: 0;">&nbsp;</td>
                  <td class="details-value" width="66%"
                    style="padding: 12px; background-color: #000000; border: 1px solid #00ff66; border-radius: 4px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 13px; color: #a3a3a3;">
                    ${message}
                  </td>
                </tr>
                <tr>
                  <td height="8" colspan="3" style="font-size: 0; line-height: 0;">&nbsp;</td>
                </tr>
                <!-- Source -->
                <tr>
                  <td class="details-label" width="32%"
                    style="padding: 12px; background-color: #000000; border: 1px solid #00ff66; border-radius: 4px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 13px; font-weight: 600; color: #ffffff;">
                    Source
                  </td>
                  <td class="details-spacer" width="2%" style="font-size: 0; line-height: 0;">&nbsp;</td>
                  <td class="details-value" width="66%"
                    style="padding: 12px; background-color: #000000; border: 1px solid #00ff66; border-radius: 4px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 13px; color: #a3a3a3;">
                    ${source}
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- EXPLORE BUTTON -->
          <tr>
            <td align="center" style="padding: 30px 20px 20px 20px;">
              <table border="0" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="background-color: #00ff66; border-radius: 25px;">
                    <a href="https://neocloudz.com" target="_blank"
                      style="display: inline-block; padding: 12px 36px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 15px; font-weight: 700; color: #000000; text-decoration: none; border-radius: 25px;">
                      Explore Our Solution
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- INFOTEXT: Respond Time -->
          <tr>
            <td align="center"
              style="padding: 10px 20px 20px 20px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 14px; line-height: 1.5; color: #a3a3a3; text-align: center;">
              Our team will get back to you within <strong style="color: #ffffff;">24 hours</strong>. If your request is
              urgent, simply reply to this email.
            </td>
          </tr>

          <!-- DIVIDER LINE -->
          <tr>
            <td align="center" style="padding: 10px 20px;">
              <hr style="border: 0; border-top: 1px solid #222222; margin: 0;">
            </td>
          </tr>

          <!-- SOCIAL MEDIA ICONS -->
          <tr>
            <td align="center" style="padding: 20px 20px 10px 20px;">
              <table border="0" cellpadding="0" cellspacing="0">
                <tr>
                  <!-- Instagram -->
                  <td style="padding: 0 10px;">
                    <a href="https://instagram.com/neocloudz" target="_blank" style="text-decoration: none; display: block;">
                      <img src="https://cdn.jsdelivr.net/gh/SwayamGandhi01/neocloudz-templates@main/email-icons/social-instagram.png"
                        width="44" height="44" alt="Instagram"
                        style="display: block; width: 44px; height: 44px; border: 0; outline: none; color: #98a59b; font-family: Arial, sans-serif; font-size: 11px;">
                    </a>
                  </td>
                  <!-- X (Twitter) -->
                  <td style="padding: 0 10px;">
                    <a href="https://x.com/neocloudz" target="_blank" style="text-decoration: none; display: block;">
                      <img src="https://cdn.jsdelivr.net/gh/SwayamGandhi01/neocloudz-templates@main/email-icons/social-x.png"
                        width="44" height="44" alt="X"
                        style="display: block; width: 44px; height: 44px; border: 0; outline: none; color: #98a59b; font-family: Arial, sans-serif; font-size: 11px;">
                    </a>
                  </td>
                  <!-- LinkedIn -->
                  <td style="padding: 0 10px;">
                    <a href="https://linkedin.com/company/neocloudz" target="_blank" style="text-decoration: none; display: block;">
                      <img src="https://cdn.jsdelivr.net/gh/SwayamGandhi01/neocloudz-templates@main/email-icons/social-linkedin.png"
                        width="44" height="44" alt="LinkedIn"
                        style="display: block; width: 44px; height: 44px; border: 0; outline: none; color: #98a59b; font-family: Arial, sans-serif; font-size: 11px;">
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- SUPPORT EMAILS & COPYRIGHT -->
          <tr>
            <td align="center"
              style="padding: 10px 20px 20px 20px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 12px; line-height: 1.6; text-align: center;">
              <p style="margin: 0 0 5px 0;">
                <a href="mailto:support@neocloudz.com"
                  style="color: #00ff66; text-decoration: underline;">support@neocloudz.com</a>
              </p>
              <p style="margin: 0 0 15px 0;">
                <a href="mailto:hello@neocloudz.com"
                  style="color: #00ff66; text-decoration: underline;">hello@neocloudz.com</a>
              </p>
              <p style="margin: 0; color: #666666;">
                &copy; 2026 NeoCloudz Inc. All rights reserved.
              </p>
            </td>
          </tr>

        </table>

      </td>
    </tr>
  </table>

</body>

</html>`;

  const textBody = `
Hi ${fullName},

Thanks for contacting NeoCloudz! We've received your request and our team is reviewing it.

Your submission details:
  Interest Type: ${interestType}
  Full Name:     ${fullName}
  Work Email:    ${workEmail}
  Company:       ${company}
  Budget Range:  ${budgetRange}
  Source:        ${source}

Message:
${message}

Our team will get back to you within 24 hours.
If your request is urgent, simply reply to this email.

— The NeoCloudz Team
https://neocloudz.com
  `.trim();

  strapi.log.info(`[Email] Sending user confirmation to ${workEmail}...`);

  await resendService.send({
    to: workEmail,
    subject: `Thanks for contacting NeoCloudz, ${fullName}!`,
    html: emailHtml,
    text: textBody,
  });

  strapi.log.info(`[Email] User confirmation sent successfully to ${workEmail}.`);
}

// ---------------------------------------------------------------------------
// 3. TOKEN FACTORY EARLY ACCESS NOTIFICATIONS
// ---------------------------------------------------------------------------

/**
 * Sends a dedicated Token Factory Early Access admin qualification notification.
 * @param {Object} data - The contact request entry data
 */
async function sendEarlyAccessAdminNotification(data) {
  const adminEmail = process.env.ADMIN_EMAIL || 'hello@neocloudz.com';

  const fullName             = data.fullName || 'N/A';
  const workEmail            = data.workEmail || 'N/A';
  const company              = data.company || 'N/A';
  const phoneNumber          = data.phoneNumber || '';
  const message              = data.message || 'No workload description provided.';
  const modelsOfInterest     = data.modelsOfInterest || '';
  const endpointPreference   = data.endpointPreference || 'undecided';
  const expectedUsage        = data.expectedUsage || '';
  const targetStartDate      = data.targetStartDate || '';
  const interestedInGtcBerlin = data.interestedInGtcBerlin ? 'Yes' : 'No';
  const marketingOptIn       = data.marketingOptIn ? 'Yes (Opted In)' : 'No';

  const emailHtml = renderTemplate(loadTemplate(EARLY_ACCESS_ADMIN_TEMPLATE), {
    PRODUCT_INTEREST:    escapeForEmail(PRODUCT_INTEREST_LABELS[data.productInterest] || data.productInterest, 'Token Factory'),
    REQUEST_TYPE:        escapeForEmail(REQUEST_TYPE_LABELS[data.requestType] || data.requestType, 'Early Access'),
    FULL_NAME:           escapeForEmail(data.fullName),
    WORK_EMAIL:          escapeForEmail(data.workEmail),
    COMPANY:             escapeForEmail(data.company),
    PHONE_NUMBER:        escapeForEmail(phoneNumber),
    MESSAGE:             escapeMultilineForEmail(data.message),
    MODELS_OF_INTEREST:  escapeMultilineForEmail(modelsOfInterest),
    ENDPOINT_PREFERENCE: escapeForEmail(endpointPreference),
    EXPECTED_USAGE:      escapeMultilineForEmail(expectedUsage),
    TARGET_START_DATE:   escapeForEmail(targetStartDate),
    GTC_BERLIN:          escapeForEmail(interestedInGtcBerlin),
    MARKETING_OPT_IN:    escapeForEmail(marketingOptIn),
  });

  const textBody = `
Token Factory Early Access Request
===================================
Product:             Token Factory
Request Type:        Early Access
Full Name:           ${fullName}
Work Email:          ${workEmail}
Company:             ${company}
Phone:               ${phoneNumber || 'N/A'}
Endpoint Preference: ${endpointPreference}
Target Start Date:   ${targetStartDate || 'N/A'}
GTC Berlin Meeting:  ${interestedInGtcBerlin}
Marketing Opt-In:    ${marketingOptIn}

Models of Interest:
${modelsOfInterest || 'N/A'}

Expected Usage:
${expectedUsage || 'N/A'}

Use Case / Workload:
${message}
  `.trim();

  strapi.log.info(`[Email] Sending Token Factory early access admin notification to ${adminEmail} for ${workEmail}...`);

  await resendService.send({
    to: adminEmail,
    subject: `Token Factory Early Access Request - ${fullName} (${company})`,
    html: emailHtml,
    text: textBody,
  });

  strapi.log.info(`[Email] Token Factory early access admin notification sent to ${adminEmail}.`);
}

/**
 * Sends a dedicated Token Factory Early Access acknowledgement to the submitter.
 * @param {Object} data - The contact request entry data
 */
async function sendEarlyAccessUserConfirmation(data) {
  const fullName           = data.fullName || 'there';
  const workEmail          = (data.workEmail || '').trim();
  const company            = data.company || '';
  const message            = data.message || '';
  const endpointPreference = data.endpointPreference || 'undecided';
  const modelsOfInterest   = data.modelsOfInterest || '';

  if (!workEmail) {
    strapi.log.warn('[Email] Early access user confirmation skipped: no workEmail provided.');
    return;
  }

  const emailHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Thanks for requesting Token Factory Early Access</title>
  <style>
    body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
    table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
    table { border-collapse: collapse !important; }
    body { height: 100% !important; margin: 0 !important; padding: 0 !important; width: 100% !important; background-color: #050505; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #ffffff; }
    @media screen and (max-width: 600px) {
      .email-container { width: 100% !important; padding-left: 10px !important; padding-right: 10px !important; }
      .details-table td { display: block !important; width: 100% !important; box-sizing: border-box !important; }
      .details-table tr { margin-bottom: 10px !important; display: block !important; }
      .details-spacer { display: none !important; }
    }
  </style>
</head>
<body style="margin: 0; padding: 0; background-color: #050505; color: #ffffff;">
  <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #050505; table-layout: fixed;">
    <tr>
      <td align="center" style="padding: 20px 0;">
        <table border="0" cellpadding="0" cellspacing="0" width="600" class="email-container" style="background-color: #050505; max-width: 600px; width: 100%;">
          <tr>
            <td align="left" style="padding: 20px 20px 10px 20px;">
              <img src="https://www.neocloudz.com/images/neocloudz-logo.png" alt="NeoCloudz" height="45" style="display: block; height: 100px; width: auto;" />
            </td>
          </tr>
          <tr>
            <td align="center" style="padding: 10px 20px 20px 20px;">
              <h1 style="margin: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 26px; font-weight: 700; line-height: 1.3; color: #ffffff; text-align: center;">
                Token Factory Early Access<br>
                <span style="color: #00ff66;">Request Received</span>
              </h1>
            </td>
          </tr>
          <tr>
            <td align="left" style="padding: 10px 20px; font-size: 15px; line-height: 1.6; color: #e5e5e5;">
              <p>Hi ${escapeHtml(fullName)},</p>
              <p>Thank you for your interest in NeoCloudz Token Factory. We’ve received your early-access request, and our team will contact you about next steps.</p>
              <p>Below is a summary of the details you submitted:</p>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding: 10px 20px;">
              <table border="0" cellpadding="0" cellspacing="0" width="100%" class="details-table">
                ${renderDetailRow('Product', 'Token Factory')}
                ${renderDetailRow('Company', company)}
                ${renderDetailRow('Endpoint Preference', endpointPreference)}
                ${renderDetailRow('Models of Interest', modelsOfInterest)}
                ${renderDetailRow('Use Case / Workload', message)}
              </table>
            </td>
          </tr>
          <tr>
            <td align="left" style="padding: 15px 20px; font-size: 13px; line-height: 1.5; color: #888888;">
              <p style="margin: 0;">Please note: This email confirms receipt of your early-access application. Early access is subject to onboarding review and availability.</p>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding: 30px 20px 10px 20px;">
              <hr style="border: 0; border-top: 1px solid #222222; margin: 0;">
            </td>
          </tr>
          <tr>
            <td align="center" style="padding: 10px 20px 20px 20px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 12px; line-height: 1.6; text-align: center;">
              <p style="margin: 0 0 5px 0;"><a href="mailto:hello@neocloudz.com" style="color: #00ff66; text-decoration: underline;">hello@neocloudz.com</a></p>
              <p style="margin: 0; color: #666666;">&copy; 2026 NeoCloudz Inc. All rights reserved.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const textBody = `
Hi ${fullName},

Thank you for your interest in NeoCloudz Token Factory. We’ve received your early-access request, and our team will contact you about next steps.

Your submission details:
  Product:             Token Factory
  Company:             ${company}
  Endpoint Preference: ${endpointPreference}
  Models of Interest:  ${modelsOfInterest || 'N/A'}
  Use Case / Workload: ${message}

Please note: This email confirms receipt of your early-access application. Early access is subject to onboarding review and availability.

— The NeoCloudz Team
https://neocloudz.com
  `.trim();

  strapi.log.info(`[Email] Sending early access user confirmation to ${workEmail}...`);

  await resendService.send({
    to: workEmail,
    subject: `Thanks for your interest in NeoCloudz Token Factory, ${fullName}!`,
    html: emailHtml,
    text: textBody,
  });

  strapi.log.info(`[Email] Early access user confirmation sent to ${workEmail}.`);
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

module.exports = {
  sendAdminNotification,
  sendUserConfirmation,
  sendEarlyAccessAdminNotification,
  sendEarlyAccessUserConfirmation,
};
