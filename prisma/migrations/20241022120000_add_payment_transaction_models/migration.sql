-- CreateTable
CREATE TABLE [dbo].[PendingPayment] (
    [id] NVARCHAR(1000) NOT NULL,
    [transactionId] NVARCHAR(1000) NOT NULL,
    [loanId] NVARCHAR(1000) NOT NULL,
    [borrowerId] NVARCHAR(1000) NOT NULL,
    [amount] FLOAT(53) NOT NULL,
    [status] NVARCHAR(1000) NOT NULL,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [PendingPayment_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [PendingPayment_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [PendingPayment_transactionId_key] UNIQUE NONCLUSTERED ([transactionId])
);

-- CreateTable
CREATE TABLE [dbo].[PaymentTransaction] (
    [id] NVARCHAR(1000) NOT NULL,
    [transactionId] NVARCHAR(1000) NOT NULL,
    [status] NVARCHAR(1000) NOT NULL,
    [payload] NTEXT NOT NULL,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [PaymentTransaction_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [PaymentTransaction_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [PaymentTransaction_transactionId_key] UNIQUE NONCLUSTERED ([transactionId])
);

-- AddForeignKey
ALTER TABLE [dbo].[PendingPayment] ADD CONSTRAINT [PendingPayment_borrowerId_fkey] FOREIGN KEY ([borrowerId]) REFERENCES [dbo].[Borrower]([id]) ON DELETE NO ACTION ON UPDATE CASCADE;
