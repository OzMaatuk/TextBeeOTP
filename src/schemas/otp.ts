import { z } from 'zod';
import { config } from '../utils/config.js';

// Allowed channels depend on runtime config
const allowedChannels = () =>
  config.enableSmsOtp ? (['email', 'sms'] as const) : (['email'] as const);

export const sendSchema = z
  .object({
    recipient: z.string().trim().min(5).max(320),
    // SMS OTP is temporarily disabled
    // channel: z.enum(['sms', 'email']),
    channel: z.string().refine((v) => (allowedChannels() as readonly string[]).includes(v), {
      message: 'Invalid channel. Allowed values: ' + allowedChannels().join(', '),
    }),
  })
  .strict();

export const verifySchema = z
  .object({
    recipient: z.string().trim().min(5).max(320),
    code: z
      .string()
      .trim()
      .regex(/^\d{4,10}$/),
  })
  .strict();
