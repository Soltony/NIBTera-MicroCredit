-- AlterTable: Add isInclusive column to Tax table
ALTER TABLE [dbo].[Tax] ADD [isInclusive] BIT NOT NULL CONSTRAINT [Tax_isInclusive_df] DEFAULT 0;

-- AlterTable: Add taxDeducted and netDisbursedAmount columns to Loan table
ALTER TABLE [dbo].[Loan] ADD [taxDeducted] FLOAT(53) NOT NULL CONSTRAINT [Loan_taxDeducted_df] DEFAULT 0;
ALTER TABLE [dbo].[Loan] ADD [netDisbursedAmount] FLOAT(53);
