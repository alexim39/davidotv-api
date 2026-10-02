import axios from 'axios';
import logger from '../config/logger.js';

/**
 * Shared Paystack client (test mode until explicit live cutover).
 * Uses PAYSTACK_SECRET, legacy PAYSTACKTOKEN fallback. All amounts in kobo.
 */
export const paystackSecret = () => process.env.PAYSTACK_SECRET || process.env.PAYSTACKTOKEN;

/** Verify a charge by reference. Throws {statusCode:502} on provider failure. */
export const verifyTransaction = async (reference) => {
  const secret = paystackSecret();
  if (!secret) throw Object.assign(new Error('Billing not configured'), { statusCode: 503 });
  try {
    const { data } = await axios.get(`https://api.paystack.co/transaction/verify/${reference}`, {
      headers: { Authorization: `Bearer ${secret}` },
      timeout: 15000,
    });
    return data?.data; // {status, amount(kobo), reference, ...}
  } catch (e) {
    logger.error('Paystack verify failed', { error: e.message, reference });
    throw Object.assign(new Error('Payment verification failed'), { statusCode: 502 });
  }
};

export default { paystackSecret, verifyTransaction };
