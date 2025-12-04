import { NextRequest, NextResponse } from 'next/server';
import { z, ZodError, ZodSchema } from 'zod';

// Minimal list of common/compromised passwords to block locally.
// In production consider using a maintained list or external service.
const COMMON_PASSWORDS = new Set([
  '123456','123456789','qwerty','password','1234567','12345678','12345','111111','123123','password1','1234567890','1234','welcome','letmein','admin','iloveyou'
]);

export function isCommonPassword(pw: string) {
  return COMMON_PASSWORDS.has(pw.toLowerCase());
}

export async function validateBody<T>(req: NextRequest, schema: ZodSchema<T>) {
  try {
    const body = await req.json();
    const parsed = schema.parse(body);
    return { ok: true as const, data: parsed };
  } catch (err) {
    if (err instanceof ZodError) {
      return {
        ok: false as const,
        errorResponse: NextResponse.json({ error: 'Invalid request', issues: err.errors }, { status: 400 }),
      };
    }
    console.error('Unexpected validation error', err);
    return {
      ok: false as const,
      errorResponse: NextResponse.json({ error: 'Invalid request body' }, { status: 400 }),
    };
  }
}

// Common schemas
// Password policy:
// - Minimum length: 8
// - Must contain uppercase, lowercase, digit and symbol
// - Must not be a common password
export const loginSchema = z.object({
  phoneNumber: z.string().min(3),
  password: z.string().min(8)
    .regex(/(?=.*[a-z])/, 'must contain a lowercase letter')
    .regex(/(?=.*[A-Z])/, 'must contain an uppercase letter')
    .regex(/(?=.*\d)/, 'must contain a number')
    .regex(/(?=.*[^A-Za-z0-9])/, 'must contain a symbol')
    .refine((pw) => !isCommonPassword(pw), { message: 'password is too common or compromised' }),
});

export const scoringRulesSchema = z.object({
  providerId: z.string().min(1),
  parameters: z.array(z.object({
    name: z.string().min(1),
    weight: z.number(),
    rules: z.array(z.object({
      field: z.string().min(1),
      condition: z.string().min(1),
      value: z.any(),
      score: z.number(),
    }))
  }))
});

export default {
  validateBody,
  loginSchema,
  scoringRulesSchema,
};
