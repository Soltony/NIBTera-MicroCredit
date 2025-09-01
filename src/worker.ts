'use server';
/**
 * @fileOverview Standalone worker process for running background tasks.
 * This script is intended to be executed by a scheduler (e.g., cron).
 *
 * Usage:
 * npm run run:worker -- <task-name>
 *
 * Available tasks:
 * - repayment: Processes automated loan repayments for overdue loans.
 * - npl: Updates the status of borrowers with non-performing loans.
 */

import { processAutomatedRepayments } from './actions/repayment';
import { updateNplStatus } from './actions/npl';

async function main() {
  const task = process.argv[2];

  if (!task) {
    console.error('Error: No task specified.');
    console.log('Usage: npm run run:worker -- <task-name>');
    console.log('Available tasks: repayment, npl');
    process.exit(1);
  }

  console.log(`[${new Date().toISOString()}] Starting worker for task: ${task}`);

  try {
    switch (task) {
      case 'repayment':
        await processAutomatedRepayments();
        break;
      case 'npl':
        await updateNplStatus();
        break;
      default:
        console.error(`Error: Unknown task "${task}".`);
        process.exit(1);
    }
    console.log(`[${new Date().toISOString()}] Finished task: ${task} successfully.`);
    process.exit(0);
  } catch (error) {
    console.error(`[${new Date().toISOString()}] Error executing task "${task}":`, error);
    process.exit(1);
  }
}

main();
