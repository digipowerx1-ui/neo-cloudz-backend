'use strict';

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

  const fullName     = escapeHtml(data.fullName     || 'N/A');
  const workEmail    = escapeHtml(data.workEmail    || 'N/A');
  const phoneNumber  = escapeHtml(data.phoneNumber  || 'N/A');
  const company      = escapeHtml(data.company      || 'N/A');
  const interestType = escapeHtml(data.interestType || 'N/A');
  const budgetRange  = escapeHtml(data.budgetRange  || 'N/A');
  const message      = escapeHtml(data.message      || 'No message provided.');
  const source       = escapeHtml(data.source       || 'N/A');

  const emailHtml = `<!DOCTYPE html>
<html lang="en">

<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>New Contact Request Received</title>
  <style>
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

  <table border="0" cellpadding="0" cellspacing="0" width="100%"
    style="background-color: #050505; table-layout: fixed;">
    <tr>
      <td align="center" style="padding: 20px 0;">

        <table border="0" cellpadding="0" cellspacing="0" width="600" class="email-container"
          style="background-color: #050505; max-width: 600px; width: 100%;">

          <!-- HEADER: Logo -->
          <tr>
            <td align="left" style="padding: 20px 20px 10px 20px;">
              <img src="https://www.neocloudz.com/images/neocloudz-logo.png" alt="NeoCloudz" height="45"
                style="display: block; height: 100px; width: auto;" />
            </td>
          </tr>

          <!-- HEADER: Title -->
          <tr>
            <td align="center" style="padding: 10px 20px 20px 20px;">
              <h1
                style="margin: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 28px; font-weight: 700; line-height: 1.3; color: #ffffff; text-align: center;">
                New Contact Request<br>
                <span style="color: #00ff66;">Received</span>
              </h1>
            </td>
          </tr>

          <!-- ALERT BADGE -->
          <tr>
            <td align="center" style="padding: 0 20px 20px 20px;">
              <table border="0" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center"
                    style="background-color: #00ff6622; border: 1px solid #00ff66; border-radius: 20px; padding: 8px 20px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 13px; font-weight: 600; color: #00ff66; letter-spacing: 1px; text-transform: uppercase;">
                    Action Required — Review Submission
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- FORM DETAILS SECTION -->
          <tr>
            <td align="center" style="padding: 10px 20px;">
              <table border="0" cellpadding="0" cellspacing="0" width="100%" class="details-table">

                <!-- Full Name -->
                <tr>
                  <td class="details-label" width="32%"
                    style="padding: 12px; background-color: #000000; border: 1px solid #00ff66; border-radius: 4px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 13px; font-weight: 600; color: #ffffff;">
                    Full Name
                  </td>
                  <td class="details-spacer" width="2%" style="font-size: 0; line-height: 0;">&nbsp;</td>
                  <td class="details-value" width="66%"
                    style="padding: 12px; background-color: #000000; border: 1px solid #00ff66; border-radius: 4px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 13px; color: #a3a3a3;">
                    ${fullName}
                  </td>
                </tr>
                <tr><td height="8" colspan="3" style="font-size: 0; line-height: 0;">&nbsp;</td></tr>

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
                <tr><td height="8" colspan="3" style="font-size: 0; line-height: 0;">&nbsp;</td></tr>

                <!-- Phone -->
                <tr>
                  <td class="details-label" width="32%"
                    style="padding: 12px; background-color: #000000; border: 1px solid #00ff66; border-radius: 4px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 13px; font-weight: 600; color: #ffffff;">
                    Phone
                  </td>
                  <td class="details-spacer" width="2%" style="font-size: 0; line-height: 0;">&nbsp;</td>
                  <td class="details-value" width="66%"
                    style="padding: 12px; background-color: #000000; border: 1px solid #00ff66; border-radius: 4px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 13px; color: #a3a3a3;">
                    ${phoneNumber}
                  </td>
                </tr>
                <tr><td height="8" colspan="3" style="font-size: 0; line-height: 0;">&nbsp;</td></tr>

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
                <tr><td height="8" colspan="3" style="font-size: 0; line-height: 0;">&nbsp;</td></tr>

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
                <tr><td height="8" colspan="3" style="font-size: 0; line-height: 0;">&nbsp;</td></tr>

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
                <tr><td height="8" colspan="3" style="font-size: 0; line-height: 0;">&nbsp;</td></tr>

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
                <tr><td height="8" colspan="3" style="font-size: 0; line-height: 0;">&nbsp;</td></tr>

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

          <!-- DIVIDER LINE -->
          <tr>
            <td align="center" style="padding: 30px 20px 10px 20px;">
              <hr style="border: 0; border-top: 1px solid #222222; margin: 0;">
            </td>
          </tr>

          <!-- COPYRIGHT -->
          <tr>
            <td align="center"
              style="padding: 10px 20px 20px 20px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 12px; line-height: 1.6; text-align: center;">
              <p style="margin: 0 0 5px 0;">
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
                  <!-- Facebook -->
                  <td style="padding: 0 10px;">
                    <a href="https://facebook.com/neocloudz" target="_blank" style="text-decoration: none;">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#00ff66" stroke-width="2"
                        stroke-linecap="round" stroke-linejoin="round" style="display: block;">
                        <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"></path>
                      </svg>
                    </a>
                  </td>
                  <!-- Instagram -->
                  <td style="padding: 0 10px;">
                    <a href="https://instagram.com/neocloudz" target="_blank" style="text-decoration: none;">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#00ff66" stroke-width="2"
                        stroke-linecap="round" stroke-linejoin="round" style="display: block;">
                        <rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect>
                        <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path>
                        <line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line>
                      </svg>
                    </a>
                  </td>
                  <!-- X (Twitter) -->
                  <td style="padding: 0 10px;">
                    <a href="https://x.com/neocloudz" target="_blank" style="text-decoration: none;">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#00ff66" stroke-width="2"
                        stroke-linecap="round" stroke-linejoin="round" style="display: block;">
                        <path d="M4 4l11.733 16h4.267l-11.733 -16z"></path>
                        <path d="M4 20l6.768 -6.768m2.46 -2.46l6.772 -6.772"></path>
                      </svg>
                    </a>
                  </td>
                  <!-- LinkedIn -->
                  <td style="padding: 0 10px;">
                    <a href="https://linkedin.com/company/neocloudz" target="_blank" style="text-decoration: none;">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#00ff66" stroke-width="2"
                        stroke-linecap="round" stroke-linejoin="round" style="display: block;">
                        <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"></path>
                        <rect x="2" y="9" width="4" height="12"></rect>
                        <circle cx="4" cy="4" r="2"></circle>
                      </svg>
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
  const originatingPage      = data.originatingPage || '';
  const originatingCta       = data.originatingCta || '';
  const utmSource            = data.utmSource || '';
  const utmMedium            = data.utmMedium || '';
  const utmCampaign          = data.utmCampaign || '';
  const utmTerm              = data.utmTerm || '';
  const utmContent           = data.utmContent || '';

  const emailHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Token Factory Early Access Request</title>
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
            <td align="center" style="padding: 0 20px 20px 20px;">
              <table border="0" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="background-color: #00ff6622; border: 1px solid #00ff66; border-radius: 20px; padding: 8px 20px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 13px; font-weight: 600; color: #00ff66; letter-spacing: 1px; text-transform: uppercase;">
                    Token Factory — Prospect Qualification
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding: 10px 20px;">
              <table border="0" cellpadding="0" cellspacing="0" width="100%" class="details-table">
                ${renderDetailRow('Product Interest', 'Token Factory')}
                ${renderDetailRow('Request Type', 'Early Access')}
                ${renderDetailRow('Full Name', fullName)}
                ${renderDetailRow('Work Email', workEmail)}
                ${renderDetailRow('Company', company)}
                ${renderDetailRow('Phone', phoneNumber)}
                ${renderDetailRow('Use Case / Workload', message)}
                ${renderDetailRow('Models of Interest', modelsOfInterest)}
                ${renderDetailRow('Endpoint Preference', endpointPreference)}
                ${renderDetailRow('Expected Usage', expectedUsage)}
                ${renderDetailRow('Target Start Date', targetStartDate)}
                ${renderDetailRow('Meet at GTC Berlin', interestedInGtcBerlin)}
                ${renderDetailRow('Marketing Consent', marketingOptIn)}
                ${renderDetailRow('Originating Page', originatingPage)}
                ${renderDetailRow('Originating CTA', originatingCta)}
                ${renderDetailRow('UTM Source', utmSource)}
                ${renderDetailRow('UTM Medium', utmMedium)}
                ${renderDetailRow('UTM Campaign', utmCampaign)}
                ${renderDetailRow('UTM Term', utmTerm)}
                ${renderDetailRow('UTM Content', utmContent)}
              </table>
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

Attribution:
  Originating Page: ${originatingPage || 'N/A'}
  Originating CTA:  ${originatingCta || 'N/A'}
  UTM Source:       ${utmSource || 'N/A'}
  UTM Medium:       ${utmMedium || 'N/A'}
  UTM Campaign:     ${utmCampaign || 'N/A'}
  UTM Term:         ${utmTerm || 'N/A'}
  UTM Content:      ${utmContent || 'N/A'}
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
