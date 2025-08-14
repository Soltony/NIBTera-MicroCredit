
'use server';

import { z } from 'zod';

export const productSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional(),
  icon: z.string().min(1, 'Icon is required'),
  minLoan: z.number().positive(),
  maxLoan: z.number().positive(),
  serviceFee: z.string(),
  dailyFee: z.string(),
  penaltyFee: z.string(),
});

export const createProductSchema = productSchema.extend({
  providerId: z.string(),
});

export const updateProductSchema = productSchema.extend({
  id: z.string(),
  status: z.enum(['Active', 'Disabled']),
});

export const loanSchema = z.object({
    providerId: z.string(),
    productId: z.string(),
    loanAmount: z.number(),
    serviceFee: z.number(),
    interestRate: z.number(),
    disbursedDate: z.string().datetime(),
    dueDate: z.string().datetime(),
    penaltyAmount: z.number(),
    repaymentStatus: z.enum(['Paid', 'Unpaid']),
});
