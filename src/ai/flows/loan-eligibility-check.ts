'use server';
/**
 * @fileOverview Implements the loan eligibility check flow.
 *
 * - checkLoanEligibility - Checks user's loan eligibility and suggests a loan amount range.
 * - CheckLoanEligibilityInput - The input type for the checkLoanEligibility function.
 * - CheckLoanEligibilityOutput - The return type for the checkLoanEligibility function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const CheckLoanEligibilityInputSchema = z.object({
  creditScore: z.number().describe('The user\'s credit score.'),
  annualIncome: z.number().describe('The user\'s annual income.'),
});
export type CheckLoanEligibilityInput = z.infer<typeof CheckLoanEligibilityInputSchema>;

const CheckLoanEligibilityOutputSchema = z.object({
  isEligible: z.boolean().describe('Whether the user is eligible for a loan.'),
  suggestedLoanAmountMin: z.number().optional().describe('The minimum suggested loan amount if eligible.'),
  suggestedLoanAmountMax: z.number().optional().describe('The maximum suggested loan amount if eligible.'),
  reason: z.string().describe('The reason for eligibility or ineligibility.'),
});
export type CheckLoanEligibilityOutput = z.infer<typeof CheckLoanEligibilityOutputSchema>;

export async function checkLoanEligibility(input: CheckLoanEligibilityInput): Promise<CheckLoanEligibilityOutput> {
  return checkLoanEligibilityFlow(input);
}

const determineEligibility = ai.defineTool({
  name: 'determineEligibility',
  description: 'Determines if a user is eligible for a loan based on their credit score and annual income.',
  inputSchema: CheckLoanEligibilityInputSchema,
  outputSchema: z.object({
    isEligible: z.boolean().describe('Whether the user is eligible for a loan.'),
    suggestedLoanAmountMin: z.number().optional().describe('The minimum suggested loan amount if eligible.'),
    suggestedLoanAmountMax: z.number().optional().describe('The maximum suggested loan amount if eligible.'),
    reason: z.string().describe('The reason for eligibility or ineligibility.'),
  }),
}, async (input) => {
  // Basic eligibility check logic based on credit score and income.
  if (input.creditScore < 600) {
    return {
      isEligible: false,
      reason: 'Your credit score is below the minimum requirement.',
    };
  }
  if (input.annualIncome < 30000) {
    return {
      isEligible: false,
      reason: 'Your annual income is below the minimum requirement.',
    };
  }

  // Suggest a loan amount range based on income.
  const suggestedLoanAmountMin = input.annualIncome * 0.1;
  const suggestedLoanAmountMax = input.annualIncome * 0.5;

  return {
    isEligible: true,
    suggestedLoanAmountMin,
    suggestedLoanAmountMax,
    reason: 'You are eligible for a loan.',
  };
});

const checkLoanEligibilityPrompt = ai.definePrompt({
  name: 'checkLoanEligibilityPrompt',
  tools: [determineEligibility],
  input: {schema: CheckLoanEligibilityInputSchema},
  output: {schema: CheckLoanEligibilityOutputSchema},
  prompt: `Determine the loan eligibility for a user based on their credit score and annual income.

  Use the determineEligibility tool to check the eligibility and get a suggested loan amount range if eligible.

  Credit Score: {{{creditScore}}}
  Annual Income: {{{annualIncome}}}`,
});

const checkLoanEligibilityFlow = ai.defineFlow(
  {
    name: 'checkLoanEligibilityFlow',
    inputSchema: CheckLoanEligibilityInputSchema,
    outputSchema: CheckLoanEligibilityOutputSchema,
  },
  async input => {
    const {output} = await checkLoanEligibilityPrompt(input);
    return output!;
  }
);
