
import { z } from 'zod';

export const productSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional(),
  icon: z.string().min(1, 'Icon is required'),
  minLoan: z.number().positive(),
  maxLoan: z.number().positive(),
});

export const createProductSchema = productSchema.extend({
  providerId: z.string(),
});

const feeRuleSchema = z.object({
    type: z.enum(['fixed', 'percentage']),
    value: z.number().or(z.string().regex(/^\d*\.?\d*$/).transform(v => v === '' ? '' : Number(v))),
});

const penaltyRuleSchema = z.object({
    id: z.string(),
    fromDay: z.number().or(z.string().regex(/^\d*$/).transform(v => v === '' ? '' : Number(v))),
    toDay: z.number().or(z.string().regex(/^\d*$/).transform(v => v === '' ? Infinity : Number(v))),
    type: z.enum(['fixed', 'percentageOfPrincipal']),
    value: z.number().or(z.string().regex(/^\d*\.?\d*$/).transform(v => v === '' ? '' : Number(v))),
});


export const updateProductSchema = productSchema.partial().extend({
  id: z.string(),
  status: z.enum(['Active', 'Disabled']).optional(),
  serviceFee: feeRuleSchema.optional(),
  dailyFee: feeRuleSchema.optional(),
  penaltyRules: z.array(penaltyRuleSchema).optional(),
  serviceFeeEnabled: z.boolean().optional(),
  dailyFeeEnabled: z.boolean().optional(),
  penaltyRulesEnabled: z.boolean().optional(),
});

export const loanSchema = z.object({
    providerId: z.string(),
    productId: z.string(),
    loanAmount: z.number(),
    serviceFee: z.number(),
    penaltyAmount: z.number(),
    disbursedDate: z.string().datetime(),
    dueDate: z.string().datetime(),
    repaymentStatus: z.enum(['Paid', 'Unpaid']),
});
