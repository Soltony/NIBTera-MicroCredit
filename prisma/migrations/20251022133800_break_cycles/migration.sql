-- AlterTable
ALTER TABLE [dbo].[JournalEntry] DROP CONSTRAINT [JournalEntry_loanId_fkey];

-- AlterTable
ALTER TABLE [dbo].[JournalEntry] DROP CONSTRAINT [JournalEntry_providerId_fkey];

-- AlterTable
ALTER TABLE [dbo].[LedgerEntry] DROP CONSTRAINT [LedgerEntry_journalEntryId_fkey];

-- AlterTable
ALTER TABLE [dbo].[LedgerEntry] DROP CONSTRAINT [LedgerEntry_ledgerAccountId_fkey];

-- AlterTable
ALTER TABLE [dbo].[Loan] DROP CONSTRAINT [Loan_borrowerId_fkey];

-- AlterTable
ALTER TABLE [dbo].[Loan] DROP CONSTRAINT [Loan_loanApplicationId_fkey];

-- AlterTable
ALTER TABLE [dbo].[Loan] DROP CONSTRAINT [Loan_productId_fkey];

-- AlterTable
ALTER TABLE [dbo].[LoanApplication] DROP CONSTRAINT [LoanApplication_productId_fkey];

-- AlterTable
ALTER TABLE [dbo].[LoanProduct] DROP CONSTRAINT [FK__LoanProdu__dataP__4F12BBB9];

-- AlterTable
ALTER TABLE [dbo].[LoanProduct] DROP CONSTRAINT [LoanProduct_eligibilityUploadId_fkey];

-- AlterTable
ALTER TABLE [dbo].[Payment] DROP CONSTRAINT [Payment_journalEntryId_fkey];

-- AlterTable
ALTER TABLE [dbo].[Payment] DROP CONSTRAINT [Payment_loanId_fkey];

-- AlterTable
ALTER TABLE [dbo].[ProvisionedData] DROP CONSTRAINT [ProvisionedData_configId_fkey];

-- AlterTable
ALTER TABLE [dbo].[ProvisionedData] DROP CONSTRAINT [ProvisionedData_uploadId_fkey];

-- AlterTable
ALTER TABLE [dbo].[ScoringConfigurationProduct] DROP CONSTRAINT [ScoringConfigurationProduct_configId_fkey];

-- AlterTable
ALTER TABLE [dbo].[ScoringConfigurationProduct] DROP CONSTRAINT [ScoringConfigurationProduct_productId_fkey];

-- AlterTable
ALTER TABLE [dbo].[UploadedDocument] DROP CONSTRAINT [UploadedDocument_loanApplicationId_fkey];

-- AlterTable
ALTER TABLE [dbo].[UploadedDocument] DROP CONSTRAINT [UploadedDocument_requiredDocumentId_fkey];

-- AlterTable
ALTER TABLE [dbo].[User] DROP CONSTRAINT [User_loanProviderId_fkey];

-- AddForeignKey
ALTER TABLE [dbo].[User] ADD CONSTRAINT [User_loanProviderId_fkey] FOREIGN KEY ([loanProviderId]) REFERENCES [dbo].[LoanProvider]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[LoanProduct] ADD CONSTRAINT [LoanProduct_dataProvisioningConfigId_fkey] FOREIGN KEY ([dataProvisioningConfigId]) REFERENCES [dbo].[DataProvisioningConfig]([id]) ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[LoanProduct] ADD CONSTRAINT [LoanProduct_eligibilityUploadId_fkey] FOREIGN KEY ([eligibilityUploadId]) REFERENCES [dbo].[DataProvisioningUpload]([id]) ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[ProvisionedData] ADD CONSTRAINT [ProvisionedData_configId_fkey] FOREIGN KEY ([configId]) REFERENCES [dbo].[DataProvisioningConfig]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[ProvisionedData] ADD CONSTRAINT [ProvisionedData_uploadId_fkey] FOREIGN KEY ([uploadId]) REFERENCES [dbo].[DataProvisioningUpload]([id]) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[LoanApplication] ADD CONSTRAINT [LoanApplication_productId_fkey] FOREIGN KEY ([productId]) REFERENCES [dbo].[LoanProduct]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[UploadedDocument] ADD CONSTRAINT [UploadedDocument_loanApplicationId_fkey] FOREIGN KEY ([loanApplicationId]) REFERENCES [dbo].[LoanApplication]([id]) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[UploadedDocument] ADD CONSTRAINT [UploadedDocument_requiredDocumentId_fkey] FOREIGN KEY ([requiredDocumentId]) REFERENCES [dbo.[RequiredDocument]]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[Loan] ADD CONSTRAINT [Loan_borrowerId_fkey] FOREIGN KEY ([borrowerId]) REFERENCES [dbo].[Borrower]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[Loan] ADD CONSTRAINT [Loan_productId_fkey] FOREIGN KEY ([productId]) REFERENCES [dbo].[LoanProduct]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[Loan] ADD CONSTRAINT [Loan_loanApplicationId_fkey] FOREIGN KEY ([loanApplicationId]) REFERENCES [dbo].[LoanApplication]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[Payment] ADD CONSTRAINT [Payment_loanId_fkey] FOREIGN KEY ([loanId]) REFERENCES [dbo].[Loan]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[Payment] ADD CONSTRAINT [Payment_journalEntryId_fkey] FOREIGN KEY ([journalEntryId]) REFERENCES [dbo].[JournalEntry]([id]) ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[ScoringConfigurationProduct] ADD CONSTRAINT [ScoringConfigurationProduct_configId_fkey] FOREIGN KEY ([configId]) REFERENCES [dbo].[ScoringConfigurationHistory]([id]) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[ScoringConfigurationProduct] ADD CONSTRAINT [ScoringConfigurationProduct_productId_fkey] FOREIGN KEY ([productId]) REFERENCES [dbo].[LoanProduct]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[JournalEntry] ADD CONSTRAINT [JournalEntry_providerId_fkey] FOREIGN KEY ([providerId]) REFERENCES [dbo].[LoanProvider]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[JournalEntry] ADD CONSTRAINT [JournalEntry_loanId_fkey] FOREIGN KEY ([loanId]) REFERENCES [dbo].[Loan]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[LedgerEntry] ADD CONSTRAINT [LedgerEntry_journalEntryId_fkey] FOREIGN KEY ([journalEntryId]) REFERENCES [dbo].[JournalEntry]([id]) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[LedgerEntry] ADD CONSTRAINT [LedgerEntry_ledgerAccountId_fkey] FOREIGN KEY ([ledgerAccountId]) REFERENCES [dbo].[LedgerAccount]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
