
'use server';
/**
 * @fileOverview Standalone worker process for running background tasks.
 * This script is intended to be executed by a scheduler (e.g., cron) or run as a long-running service.
 *
 * Usage:
 * To run a one-off task (like NPL check):
 * npm run run:worker -- npl
 *
 * To start the continuous repayment service:
 * npm run run:worker -- repayment-service
 */

import { logger } from './lib/logger';

const REPAYMENT_INTERVAL_MS = 60 * 60 * 1000; // 1 hour
const PROVIDER_DISTRIBUTION_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours
const INTEREST_ACCRUAL_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours

async function runRepaymentServiceLoop() {
    // startup log removed to reduce console noise
    while (true) {
        try {
          // Send due-date reminders for loans due today
            try {
              const { sendDueDateReminders } = await import('./actions/repayment');
              await sendDueDateReminders();
              logger.info('Due date reminders completed');
            } catch (e) {
              console.error(`[${new Date().toISOString()}] Error sending due-date reminders:`, e);
              logger.error(`Error sending due-date reminders: ${String(e)}`);
            }
            // cycle start log removed to reduce console noise
            const { processAutomatedRepayments } = await import('./app/api/repayment');
            await processAutomatedRepayments();
            logger.info('Automated repayments cycle completed');
            // cycle finished log removed to reduce console noise
        } catch (error) {
            console.error(`[${new Date().toISOString()}] An error occurred during the repayment cycle:`, error);
          logger.error(`Error during repayment cycle: ${String(error)}`);
        }
        // waiting log removed to reduce console noise
        await new Promise(resolve => setTimeout(resolve, REPAYMENT_INTERVAL_MS));
    }
}

async function runProviderDistributionServiceLoop() {
  while (true) {
    try {
      logger.info('Starting provider distribution scheduled run');
      const { runProviderDistributionOnce } = await import('./actions/provider-distribution');
      await runProviderDistributionOnce();
      logger.info('Provider distribution scheduled run finished');
    } catch (error) {
      console.error(`[${new Date().toISOString()}] Error during provider distribution cycle:`, error);
      logger.error(`Error during provider distribution cycle: ${String(error)}`);
    }
    logger.info(`Provider distribution service sleeping for ${Math.round(PROVIDER_DISTRIBUTION_INTERVAL_MS / (60 * 60 * 1000))}h`);
    await new Promise(resolve => setTimeout(resolve, PROVIDER_DISTRIBUTION_INTERVAL_MS));
  }
}

async function runInterestAccrualServiceLoop() {
  logger.info('Interest accrual service started');
  while (true) {
    try {
      logger.info(`Interest accrual tick at ${new Date().toISOString()}`);
      logger.info('Starting daily interest accrual scheduled run');
      const { runDailyInterestAccrualOnce } = await import('./actions/interest-accrual');
      const result = await runDailyInterestAccrualOnce(new Date());
      logger.info(`Daily interest accrual finished processedLoans=${result.processedLoans} totalAccrued=${result.totalAccrued}`);
    } catch (error) {
      console.error(`[${new Date().toISOString()}] Error during interest accrual cycle:`, error);
      logger.error(`Error during interest accrual cycle: ${String(error)}`);
    }
    logger.info(`Interest accrual service sleeping for ${Math.round(INTEREST_ACCRUAL_INTERVAL_MS / (60 * 60 * 1000))}h`);
    await new Promise(resolve => setTimeout(resolve, INTEREST_ACCRUAL_INTERVAL_MS));
  }
}


async function main() {
  const task = process.argv[2];

  if (!task) {
    console.error('Error: No task specified.');
    process.exit(1);
  }

  // start task log removed to reduce console noise
  logger.info(`Worker started task=${task}`);

  try {
    switch (task) {
      case 'repayment-service':
        // This is a long-running service, it will not exit on its own.
        await runRepaymentServiceLoop();
        break;
      case 'provider-distribution-service':
        logger.info('Starting provider-distribution-service long-running loop');
        await runProviderDistributionServiceLoop();
        break;
      case 'provider-distribution':
        logger.info('Running one-off provider-distribution');
        {
          const { runProviderDistributionOnce } = await import('./actions/provider-distribution');
          await runProviderDistributionOnce();
        }
        logger.info('One-off provider-distribution finished');
        process.exit(0);
        break;
      case 'interest-accrual-service':
        logger.info('Starting interest-accrual-service long-running loop');
        await runInterestAccrualServiceLoop();
        break;
      case 'interest-accrual':
        logger.info('Running one-off interest-accrual');
        {
          const { runDailyInterestAccrualOnce } = await import('./actions/interest-accrual');
          await runDailyInterestAccrualOnce(new Date());
        }
        logger.info('One-off interest-accrual finished');
        process.exit(0);
        break;
      case 'npl':
        // This is a one-off task.
        {
          const { updateNplStatusJob } = await import('./actions/npl');
          await updateNplStatusJob();
        }
        process.exit(0);
        break;
      default:
        console.error(`Error: Unknown task "${task}".`);
        process.exit(1);
    }
  } catch (error) {
    console.error(`[${new Date().toISOString()}] Error executing task "${task}":`, error);
    process.exit(1);
  }
}

main();
