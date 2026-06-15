/*
  Tax transfer simulation — SQL Server DDL

  Adds only [dbo].[TaxTransferSimulation]. Journal entries use existing
  [dbo].[JournalEntry] and [dbo].[LedgerEntry] tables.

  Prerequisites: [LoanProvider], [User], [JournalEntry] must exist.
*/

SET NOCOUNT ON;

IF OBJECT_ID(N'[dbo].[TaxTransferSimulation]', N'U') IS NOT NULL
BEGIN
  PRINT 'Table [dbo].[TaxTransferSimulation] already exists — skipping.';
  RETURN;
END;

BEGIN TRY
  BEGIN TRAN;

  CREATE TABLE [dbo].[TaxTransferSimulation] (
    [id] NVARCHAR(1000) NOT NULL,
    [providerId] NVARCHAR(1000) NOT NULL,
    [transferAmount] FLOAT(53) NOT NULL,
    [destinationAccountName] NVARCHAR(1000) NOT NULL,
    [transferReference] NVARCHAR(1000) NOT NULL,
    [transferDate] DATETIME2 NOT NULL,
    [journalEntryId] NVARCHAR(1000) NULL,
    [recordedByUserId] NVARCHAR(1000) NOT NULL,
    [status] NVARCHAR(1000) NOT NULL CONSTRAINT [TaxTransferSimulation_status_df] DEFAULT N'SIMULATED',
    [reversedByUserId] NVARCHAR(1000) NULL,
    [reversalReason] TEXT NULL,
    [reversedAt] DATETIME2 NULL,
    [notes] TEXT NULL,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [TaxTransferSimulation_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [TaxTransferSimulation_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [TaxTransferSimulation_transferReference_key] UNIQUE NONCLUSTERED ([transferReference]),
    CONSTRAINT [TaxTransferSimulation_journalEntryId_key] UNIQUE NONCLUSTERED ([journalEntryId])
  );

  CREATE NONCLUSTERED INDEX [TaxTransferSimulation_providerId_idx]
    ON [dbo].[TaxTransferSimulation]([providerId]);

  CREATE NONCLUSTERED INDEX [TaxTransferSimulation_transferDate_idx]
    ON [dbo].[TaxTransferSimulation]([transferDate]);

  CREATE NONCLUSTERED INDEX [TaxTransferSimulation_status_idx]
    ON [dbo].[TaxTransferSimulation]([status]);

  ALTER TABLE [dbo].[TaxTransferSimulation]
    ADD CONSTRAINT [TaxTransferSimulation_providerId_fkey]
    FOREIGN KEY ([providerId]) REFERENCES [dbo].[LoanProvider]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

  ALTER TABLE [dbo].[TaxTransferSimulation]
    ADD CONSTRAINT [TaxTransferSimulation_journalEntryId_fkey]
    FOREIGN KEY ([journalEntryId]) REFERENCES [dbo].[JournalEntry]([id]) ON DELETE SET NULL ON UPDATE NO ACTION;

  ALTER TABLE [dbo].[TaxTransferSimulation]
    ADD CONSTRAINT [TaxTransferSimulation_recordedByUserId_fkey]
    FOREIGN KEY ([recordedByUserId]) REFERENCES [dbo].[User]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

  ALTER TABLE [dbo].[TaxTransferSimulation]
    ADD CONSTRAINT [TaxTransferSimulation_reversedByUserId_fkey]
    FOREIGN KEY ([reversedByUserId]) REFERENCES [dbo].[User]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

  COMMIT TRAN;
  PRINT 'Created [dbo].[TaxTransferSimulation] and indexes.';
END TRY
BEGIN CATCH
  IF @@TRANCOUNT > 0 ROLLBACK TRAN;
  THROW;
END CATCH;
