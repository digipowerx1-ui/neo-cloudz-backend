'use strict';

const resendService = require('../../../services/resend');

/**
 * Early-access email service.
 */
async function sendAdminNotification(data) {
  const adminEmail = process.env.ADMIN_EMAIL || 'hello@neocloudz.com';
  const email = data.email || 'N/A';
  const userName = 'N/A'; // Name is not collected on the early access form
  const dateTime = data.createdAt ? new Date(data.createdAt).toLocaleString() : new Date().toLocaleString();

  // Use the exact template structure and replace variables at runtime
  let emailHtml = `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta name="x-apple-disable-message-reformatting">
  <meta name="format-detection" content="telephone=no,address=no,email=no,date=no,url=no">
  <title>New User Joined - NeoCloudz Token Factory Waitlist</title>

  <!--[if mso]>
  <noscript>
    <xml>
      <o:OfficeDocumentSettings>
        <o:AllowPNG/>
        <o:PixelsPerInch>96</o:PixelsPerInch>
      </o:OfficeDocumentSettings>
    </xml>
  </noscript>
  <![endif]-->

  <style>
    /* Reset */
    body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
    table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
    img { -ms-interpolation-mode: bicubic; border: 0; height: auto; line-height: 100%; outline: none; text-decoration: none; }
    body { height: 100% !important; margin: 0 !important; padding: 0 !important; width: 100% !important; background-color: #0a0a0a; }

    /* Google Fonts */
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');

    /* Responsive */
    @media only screen and (max-width: 620px) {
      .email-container {
        width: 100% !important;
        max-width: 100% !important;
      }
      .fluid {
        max-width: 100% !important;
        height: auto !important;
        margin-left: auto !important;
        margin-right: auto !important;
      }
      .body-content {
        padding: 28px 20px !important;
      }
      .footer-content {
        padding: 28px 20px !important;
      }
      .contact-row {
        display: block !important;
      }
      .contact-cell {
        display: block !important;
        width: 100% !important;
        padding: 8px 0 !important;
      }
      .social-icon {
        width: 36px !important;
        height: 36px !important;
      }
    }

    @media only screen and (max-width: 480px) {
      .body-content {
        padding: 24px 16px !important;
      }
      .footer-content {
        padding: 24px 16px !important;
      }
      h1 {
        font-size: 20px !important;
        line-height: 28px !important;
      }
    }
  </style>
</head>

<body style="margin: 0; padding: 0; background-color: #0a0a0a; font-family: 'Inter', Arial, Helvetica, sans-serif;">
  <!-- Hidden Preheader Text -->
  <div style="display: none; font-size: 1px; color: #0a0a0a; line-height: 1px; max-height: 0px; max-width: 0px; opacity: 0; overflow: hidden;">
    A new user has joined the NeoCloudz Token Factory waitlist.
  </div>

  <!-- Full Width Background Table -->
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #0a0a0a;">
    <tr>
      <td align="center" valign="top" style="padding: 0;">

        <!-- Email Container -->
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" class="email-container" style="margin: 0 auto; max-width: 600px;">

          <!-- ============================================ -->
          <!-- HERO IMAGE SECTION -->
          <!-- ============================================ -->
          <tr>
            <td style="background-color: #0a0a0a; text-align: center; padding: 0;">
              <img src="https://res.cloudinary.com/dntahkr0a/image/upload/v1783659656/Screenshot_2026-07-09_171043_aczzzv.png" 
                   alt="NeoCloudz - The Future of AI Compute" 
                   width="600" 
                   style="width: 100%; max-width: 600px; height: auto; display: block; border: 0; margin: 0; padding: 0;" 
                   class="fluid">
            </td>
          </tr>

          <!-- ============================================ -->
          <!-- BODY CONTENT SECTION (Dark Theme) -->
          <!-- ============================================ -->
          <tr>
            <td style="background-color: #141414;">
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                <tr>
                  <td class="body-content" style="padding: 36px 40px 32px 40px; font-family: 'Inter', Arial, Helvetica, sans-serif;">

                    <!-- Heading -->
                    <h1 style="margin: 0 0 24px 0; font-size: 22px; line-height: 30px; color: #ffffff; font-weight: 700; font-family: 'Inter', Arial, Helvetica, sans-serif;">
                      A new user has joined the <span style="color: #00d846;">NeoCloudz Token Factory</span> waitlist.
                    </h1>

                    <!-- User Details - Bullet List -->
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin: 0 0 24px 0;">
                      <!-- Email -->
                      <tr>
                        <td valign="top" style="padding: 0 10px 6px 8px; font-size: 15px; line-height: 24px; color: #cccccc; font-family: 'Inter', Arial, Helvetica, sans-serif;">
                          &bull;
                        </td>
                        <td valign="top" style="padding: 0 0 6px 0; font-size: 15px; line-height: 24px; color: #cccccc; font-family: 'Inter', Arial, Helvetica, sans-serif;">
                          <strong style="color: #e0e0e0;">Email:</strong> <span style="color: #cccccc;">{{USER_EMAIL}}</span>
                        </td>
                      </tr>
                      <!-- Name -->
                      <tr>
                        <td valign="top" style="padding: 0 10px 6px 8px; font-size: 15px; line-height: 24px; color: #cccccc; font-family: 'Inter', Arial, Helvetica, sans-serif;">
                          &bull;
                        </td>
                        <td valign="top" style="padding: 0 0 6px 0; font-size: 15px; line-height: 24px; color: #cccccc; font-family: 'Inter', Arial, Helvetica, sans-serif;">
                          <strong style="color: #e0e0e0;">Name:</strong> <span style="color: #cccccc;">{{USER_NAME}}</span>
                        </td>
                      </tr>
                      <!-- Date & Time -->
                      <tr>
                        <td valign="top" style="padding: 0 10px 6px 8px; font-size: 15px; line-height: 24px; color: #cccccc; font-family: 'Inter', Arial, Helvetica, sans-serif;">
                          &bull;
                        </td>
                        <td valign="top" style="padding: 0 0 6px 0; font-size: 15px; line-height: 24px; color: #cccccc; font-family: 'Inter', Arial, Helvetica, sans-serif;">
                          <strong style="color: #e0e0e0;">Date &amp; Time:</strong> <span style="color: #cccccc;">{{DATE_TIME}}</span>
                        </td>
                      </tr>
                    </table>

                    <!-- Confirmation Message -->
                    <p style="margin: 0 0 16px 0; font-size: 15px; line-height: 24px; color: #cccccc; font-family: 'Inter', Arial, Helvetica, sans-serif;">
                      This user has been successfully added to the waitlist and received a confirmation email.
                    </p>

                    <!-- Website Link -->
                    <p style="margin: 0 0 8px 0; font-size: 15px; line-height: 24px; color: #cccccc; font-family: 'Inter', Arial, Helvetica, sans-serif;">
                      NeoCloudz Website: <a href="https://www.neocloudz.com" target="_blank" style="color: #cccccc; text-decoration: underline;">https://www.neocloudz.com</a>
                    </p>

                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- ============================================ -->
          <!-- FOOTER SECTION -->
          <!-- ============================================ -->
          <tr>
            <td style="background-color: #111111; border-top: 1px solid #222222;">
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                <tr>
                  <td class="footer-content" style="padding: 32px 40px 12px 40px;">

                    <!-- Social Media Icons -->
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin: 0 0 28px 0;">
                      <tr>
                        <!-- Twitter/X -->
                        <td style="padding-right: 10px;">
                          <a href="https://twitter.com/neocloudz" target="_blank" style="text-decoration: none;">
                            <table role="presentation" cellspacing="0" cellpadding="0" border="0">
                              <tr>
                                <td class="social-icon" width="40" height="40" align="center" valign="middle" style="width: 40px; height: 40px; background-color: #1e1e1e; border-radius: 50%; border: 1px solid #333333; text-align: center; vertical-align: middle;">
                                  <span style="font-size: 16px; color: #888888; font-family: Arial, sans-serif; text-decoration: none;">&#120143;</span>
                                </td>
                              </tr>
                            </table>
                          </a>
                        </td>
                        <!-- LinkedIn -->
                        <td style="padding-right: 10px;">
                          <a href="https://linkedin.com/company/neocloudz" target="_blank" style="text-decoration: none;">
                            <table role="presentation" cellspacing="0" cellpadding="0" border="0">
                              <tr>
                                <td class="social-icon" width="40" height="40" align="center" valign="middle" style="width: 40px; height: 40px; background-color: #1e1e1e; border-radius: 50%; border: 1px solid #333333; text-align: center; vertical-align: middle;">
                                  <span style="font-size: 16px; color: #888888; font-family: Arial, sans-serif; font-weight: bold;">in</span>
                                </td>
                              </tr>
                            </table>
                          </a>
                        </td>
                        <!-- Instagram -->
                        <td style="padding-right: 10px;">
                          <a href="https://instagram.com/neocloudz" target="_blank" style="text-decoration: none;">
                            <table role="presentation" cellspacing="0" cellpadding="0" border="0">
                              <tr>
                                <td class="social-icon" width="40" height="40" align="center" valign="middle" style="width: 40px; height: 40px; background-color: #1e1e1e; border-radius: 50%; border: 1px solid #333333; text-align: center; vertical-align: middle;">
                                  <span style="font-size: 16px; color: #888888; font-family: Arial, sans-serif;">&#9675;</span>
                                </td>
                              </tr>
                            </table>
                          </a>
                        </td>
                        <!-- Facebook -->
                        <td>
                          <a href="https://facebook.com/neocloudz" target="_blank" style="text-decoration: none;">
                            <table role="presentation" cellspacing="0" cellpadding="0" border="0">
                              <tr>
                                <td class="social-icon" width="40" height="40" align="center" valign="middle" style="width: 40px; height: 40px; background-color: #1e1e1e; border-radius: 50%; border: 1px solid #333333; text-align: center; vertical-align: middle;">
                                  <span style="font-size: 16px; color: #888888; font-family: Arial, sans-serif; font-weight: bold;">f</span>
                                </td>
                              </tr>
                            </table>
                          </a>
                        </td>
                      </tr>
                    </table>

                    <!-- Contact Information Label -->
                    <p style="margin: 0 0 16px 0; font-size: 14px; font-weight: 700; color: #00d846; font-family: 'Inter', Arial, Helvetica, sans-serif; letter-spacing: 0.3px;">
                      Contact Information
                    </p>

                    <!-- Contact Details Row -->
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" class="contact-row">
                      <tr>
                        <!-- Direct Email -->
                        <td class="contact-cell" width="33%" valign="top" style="padding: 0 8px 20px 0;">
                          <table role="presentation" cellspacing="0" cellpadding="0" border="0">
                            <tr>
                              <td valign="top" style="padding-right: 8px;">
                                <span style="font-size: 14px; color: #888888;">&#9993;</span>
                              </td>
                              <td valign="top">
                                <p style="margin: 0; font-size: 13px; font-weight: 600; color: #e0e0e0; font-family: 'Inter', Arial, Helvetica, sans-serif; line-height: 18px;">
                                  Direct Email
                                </p>
                                <p style="margin: 2px 0 0 0; font-size: 11px; color: #888888; font-family: 'Inter', Arial, Helvetica, sans-serif; line-height: 16px;">
                                  <a href="mailto:hello@neocloudz.com" style="color: #888888; text-decoration: none;">hello@neocloudz.com</a>
                                </p>
                              </td>
                            </tr>
                          </table>
                        </td>

                        <!-- Enterprise Solutions -->
                        <td class="contact-cell" width="34%" valign="top" style="padding: 0 8px 20px 0;">
                          <table role="presentation" cellspacing="0" cellpadding="0" border="0">
                            <tr>
                              <td valign="top" style="padding-right: 8px;">
                                <span style="font-size: 14px; color: #888888;">&#128188;</span>
                              </td>
                              <td valign="top">
                                <p style="margin: 0; font-size: 13px; font-weight: 600; color: #e0e0e0; font-family: 'Inter', Arial, Helvetica, sans-serif; line-height: 18px;">
                                  Enterprise Solutions
                                </p>
                                <p style="margin: 2px 0 0 0; font-size: 11px; color: #888888; font-family: 'Inter', Arial, Helvetica, sans-serif; line-height: 16px;">
                                  <a href="mailto:sales@neocloudz.com" style="color: #888888; text-decoration: none;">sales@neocloudz.com</a>
                                </p>
                              </td>
                            </tr>
                          </table>
                        </td>

                        <!-- SLA Support -->
                        <td class="contact-cell" width="33%" valign="top" style="padding: 0 0 20px 0;">
                          <table role="presentation" cellspacing="0" cellpadding="0" border="0">
                            <tr>
                              <td valign="top" style="padding-right: 8px;">
                                <span style="font-size: 14px; color: #888888;">&#127911;</span>
                              </td>
                              <td valign="top">
                                <p style="margin: 0; font-size: 13px; font-weight: 600; color: #e0e0e0; font-family: 'Inter', Arial, Helvetica, sans-serif; line-height: 18px;">
                                  SLA Support
                                </p>
                                <p style="margin: 2px 0 0 0; font-size: 11px; color: #888888; font-family: 'Inter', Arial, Helvetica, sans-serif; line-height: 16px;">
                                  <a href="mailto:support@neocloudz.com" style="color: #888888; text-decoration: none;">support@neocloudz.com</a>
                                </p>
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                    </table>

                    <!-- Divider -->
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                      <tr>
                        <td style="padding: 8px 0 20px 0;">
                          <div style="border-top: 1px solid #2a2a2a; width: 100%; font-size: 1px; line-height: 1px;">&nbsp;</div>
                        </td>
                      </tr>
                    </table>

                    <!-- Copyright -->
                    <p style="margin: 0 0 6px 0; font-size: 12px; line-height: 18px; color: #666666; text-align: center; font-family: 'Inter', Arial, Helvetica, sans-serif;">
                      &copy; 2026 NeoCloudz Inc. All rights reserved.
                    </p>

                    <!-- Subtext -->
                    <p style="margin: 0 0 4px 0; font-size: 10px; line-height: 16px; color: #555555; text-align: center; font-family: 'Inter', Arial, Helvetica, sans-serif;">
                      The future of AI compute starts here. Powered by DigiPower &bull; U.S. Tier III Data Centers TIA-942
                    </p>
                    <p style="margin: 0 0 24px 0; font-size: 10px; line-height: 16px; color: #555555; text-align: center; font-family: 'Inter', Arial, Helvetica, sans-serif;">
                      Rated 3 &#9733; SOC 2 Type I Compliant
                    </p>

                  </td>
                </tr>
              </table>
            </td>
          </tr>

        </table>
        <!-- End Email Container -->

      </td>
    </tr>
  </table>
</body>
</html>`;

  // Replace the exact placeholders in the HTML
  emailHtml = emailHtml.replace(/{{USER_EMAIL}}/g, email)
    .replace(/{{USER_NAME}}/g, userName)
    .replace(/{{DATE_TIME}}/g, dateTime);

  const textBody = `
New Token Factory Waitlist Signup
==================================

Email:      ${email}
Name:       ${userName}
Date & Time: ${dateTime}
`.trim();

  strapi.log.info(`[EarlyAccess Email] Sending admin notification to ${adminEmail} for signup from ${email}...`);

  await resendService.send({
    to: adminEmail,
    subject: '🚀 New Token Factory Waitlist Signup',
    html: emailHtml,
    text: textBody,
  });

  strapi.log.info(`[EarlyAccess Email] Admin notification sent successfully to ${adminEmail}.`);
}

module.exports = { sendAdminNotification };
