import { describe, it, expect, vi, beforeEach } from 'vitest';

// Adapter contract: legacy sendEmail(email, subject, html) delegates to the
// env-based mailer, never throws, and resolves null when unconfigured.

vi.mock('../config/mailer.js', () => ({ sendMail: vi.fn() }));

import { sendMail } from '../config/mailer.js';
import { sendEmail } from './emailService.js';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('sendEmail adapter', () => {
  it('forwards positional args to sendMail', async () => {
    sendMail.mockResolvedValue({ messageId: 'm1' });
    const info = await sendEmail('a@testmail.com', 'Hi', '<p>hi</p>');
    expect(sendMail).toHaveBeenCalledWith({ to: 'a@testmail.com', subject: 'Hi', html: '<p>hi</p>' });
    expect(info).toEqual({ messageId: 'm1' });
  });

  it('resolves null (never throws) when transport is missing', async () => {
    sendMail.mockResolvedValue(null);
    await expect(sendEmail('a@testmail.com', 'Hi', '<p>hi</p>')).resolves.toBeNull();
  });

  it('resolves null (never throws) when sending fails', async () => {
    sendMail.mockRejectedValue(new Error('boom'));
    await expect(sendEmail('a@testmail.com', 'Hi', '<p>hi</p>')).resolves.toBeNull();
  });
});
