import { startOfDay } from 'date-fns';

/**
 * Gets the "as of" date for all loan calculations from the environment variable ASOF_DATE.
 * This is used for testing repayment calculations by simulating different dates.
 * 
 * @throws Error if ASOF_DATE is not set in the environment
 * @returns Date object representing the start of the configured day
 * 
 * Usage:
 * - Set ASOF_DATE in your .env file in format YYYY-MM-DD (e.g., ASOF_DATE=2026-01-10)
 * - All loan calculations (interest, penalty, installments) will use this date
 * - For production, set ASOF_DATE to today's date or use a scheduled job to update it
 */
export function getAsOfDate(): Date {
  const asOfDateStr = process.env.ASOF_DATE;
  
  if (!asOfDateStr) {
    throw new Error(
      'ASOF_DATE environment variable is not set. ' +
      'Please set ASOF_DATE in your .env file (format: YYYY-MM-DD, e.g., ASOF_DATE=2026-01-04)'
    );
  }

  const parsed = new Date(asOfDateStr);
  
  if (isNaN(parsed.getTime())) {
    throw new Error(
      `Invalid ASOF_DATE format: "${asOfDateStr}". ` +
      'Please use format YYYY-MM-DD (e.g., ASOF_DATE=2026-01-04)'
    );
  }

  return startOfDay(parsed);
}

/**
 * Gets the "as of" date for server-side calculations.
 * This version is explicitly for server actions and API routes.
 */
export function getServerAsOfDate(): Date {
  return getAsOfDate();
}
