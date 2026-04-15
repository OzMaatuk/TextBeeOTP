import { z } from 'zod';

export const sendSchema = z
  .object({
    recipient: z.string().trim().min(5).max(320),
    channel: z.enum(['sms', 'email']),
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
