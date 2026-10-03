import { sendMail } from '../config/mailer.js';
import logger from '../config/logger.js';

/**
 * Legacy adapter (cleanup slice): the historic `sendEmail(email, subject, html)`
 * contract is preserved for its 4 live callers (auth, contact, transaction,
 * email-subscription), but transport now goes through the env-based
 * `config/mailer.js` singleton. This removes the hardcoded
 * `alex.i@davidotv.com` mailbox + `EMAILPASS` credential from the codebase and
 * the dead diamondproject block.
 *
 * Behavior notes:
 * - Never throws (legacy contract): failures log + resolve null, matching the
 *   old try/catch-console.error behavior, now via Winston.
 * - From header becomes `SMTP_FROM || no-reply@davidotv.com` (was
 *   `noreply@davidotv.com`). Cosmetic; documented.
 * - New code MUST import `sendMail` from `config/mailer.js` directly.
 */
export const sendEmail = async (email, subject, htmlContent) => {
  try {
    const info = await sendMail({ to: email, subject, html: htmlContent });
    if (info) logger.info(`Email sent to ${email}`);
    return info;
  } catch (error) {
    logger.error(`Error sending email to ${email}`, { error: error.message });
    return null;
  }
};

export default { sendEmail };
