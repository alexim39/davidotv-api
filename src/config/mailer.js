import nodemailer from 'nodemailer';
import logger from './logger.js';

/**
 * Nodemailer transporter singleton for Call-Up emails.
 */
let transporter = null;

export const getTransporter = () => {
  if (transporter) return transporter;
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM } = process.env;
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
    logger.warn('SMTP not configured - emails disabled');
    return null;
  }
  transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT) || 587,
    secure: Number(SMTP_PORT) === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });
  // verify async
  transporter.verify().then(()=> logger.info('✅ SMTP ready')).catch(e=> logger.error('SMTP verify failed', { error: e.message }));
  return transporter;
};

export const sendMail = async ({ to, subject, html, text }) => {
  const t = getTransporter();
  if (!t) { logger.warn('sendMail skipped - no transporter', { to, subject }); return null; }
  const from = process.env.SMTP_FROM || 'no-reply@davidotv.com';
  const info = await t.sendMail({ from, to, subject, html, text });
  logger.info('Email sent', { to, subject, messageId: info.messageId });
  return info;
};

export default { getTransporter, sendMail };
