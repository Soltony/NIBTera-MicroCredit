
# LoanFlow - Micro-Credit Platform

LoanFlow is a comprehensive, multi-provider micro-credit platform designed to manage the entire loan lifecycle, from provider configuration and borrower application to automated repayment and auditing. It features a robust maker-checker approval workflow for all critical configuration changes.

## Key Features

*   **Multi-Provider Architecture**: Onboard and manage multiple loan providers, each with their own branding, products, and rule sets.
*   **Dynamic Product Management**: Admins can create diverse loan products (e.g., Personal, SME) with unique interest rates, fees, and tenors.
*   **Advanced Credit Scoring Engine**: Providers can build custom-weighted credit scoring models using a powerful rules engine, leveraging both provisioned data and borrower repayment history.
*   **Maker-Checker Approval Workflow**: All critical configuration changes (e.g., updating products, scoring rules, provider settings) require approval from a designated user, ensuring operational integrity.
*   **End-to-End Loan Lifecycle**: A streamlined process for borrowers to check eligibility, apply for loans, upload documents, and manage repayments. The system handles automated disbursements, daily fee accruals, penalties, and payment prioritization.
*   **Automated Backend Services**: Includes scheduled workers for:
    *   **Automated Repayments**: Attempts to deduct payments for overdue loans from borrower accounts.
    *   **NPL Flagging**: Identifies and flags Non-Performing Loans based on configurable overdue thresholds.
*   **Double-Entry Accounting**: A full ledger system tracks all financial transactions, ensuring every disbursement, repayment, and fee accrual is accounted for.
*   **Comprehensive Reporting**: An admin dashboard provides real-time KPIs and a suite of exportable reports (Loans, Collections, Income, etc.).
*   **Granular Access Control (RBAC)**: A powerful role-based access control system allows for precise definition of user permissions for every module.
*   **Full Audit Trail**: Logs all critical user and system actions for compliance, security, and traceability.

---

## Technology Stack

*   **Framework**: [Next.js](https://nextjs.org/) (App Router)
*   **Language**: [TypeScript](https://www.typescriptlang.org/)
*   **Styling**: [Tailwind CSS](https://tailwindcss.com/) with [ShadCN UI](https://ui.shadcn.com/) components
*   **Database ORM**: [Prisma](https://www.prisma.io/)
*   **Database**: SQL Server (but can be swapped via Prisma provider)
*   **Authentication**: JWT-based sessions

---

## Getting Started

Follow these instructions to get the project running on your local machine for development and testing.

### Prerequisites

*   Node.js (v18 or newer recommended)
*   npm or yarn
*   A running SQL Server instance

### 1. Installation

Clone the repository and install the dependencies:

```bash
git clone <repository-url>
cd LoanFlow
npm install
```

### 2. Environment Setup

Create a `.env` file in the root of the project and add the necessary environment variables.

```env
# The connection string for your SQL Server database.
# Example: "sqlserver://your_server_name.database.windows.net:1433;database=your_db;user=your_user;password=your_password;encrypt=true;"
DATABASE_URL="your-database-connection-string"

# A long, random string used for signing session JWTs.
SESSION_SECRET="your-super-secret-key-for-jwt-signing"

# Payment Gateway Configuration (for SuperApp integration)
ACCOUNT_NO="your_payment_gateway_account_number"
CALLBACK_URL="https://your-app-domain.com/api/payment-callback"
COMPANY_NAME="Your Company Name"
NIB_PAYMENT_KEY="your_payment_gateway_api_key"
NIB_PAYMENT_URL="https://your_payment_gateway_endpoint_url.com/api/pay"
TOKEN_VALIDATION_API_URL="https://your_superapp_token_validation_url.com/api/validate"
```

### 3. Database Migration & Seeding

Run the Prisma commands to set up your database schema and populate it with initial data (roles, users, providers, etc.).

```bash
# Apply database migrations
npx prisma migrate dev

# Seed the database with default data
npx prisma db seed
```

The seed script will create a default Super Admin user with the following credentials:
*   **Phone Number**: `0900000000`
*   **Password**: `password123`

### 4. Running the Development Server

Start the Next.js development server:

```bash
npm run dev
```

The application will be available at `http://localhost:9002`.

---

## Core Workflows

### The Loan Lifecycle

The loan process is fully managed by the system, from the initial check to the final repayment.

1.  **Eligibility Check**: A borrower's journey begins by selecting their profile. The system automatically runs an eligibility check for each available loan provider, calculating the borrower's credit score and maximum loan limit.
2.  **Product Selection**: The borrower is presented with available loan products, showing their specific credit limit for each.
3.  **Application & Calculation**:
    *   **Personal Loans**: The borrower uses a calculator to see the total repayable amount. Upon acceptance, the loan is disbursed immediately.
    *   **SME Loans**: The borrower is directed to a portal to upload all required documents.
4.  **Approval Workflow (SME Loans)**: Once all documents are submitted, the application enters a "Pending Approval" state for an admin to review.
5.  **Disbursement**: After approval (or immediately for personal loans), the backend records the transaction, creates ledger entries, and decrements the provider's available capital.
6.  **Monitoring & Repayment**: The system tracks the loan's status, accrues daily fees, and applies penalties if overdue. Borrowers can make repayments at any time.

### Maker-Checker (Approval) Workflow

To maintain data integrity and operational control, all significant configuration changes must be approved by a user with `Approver` privileges.

*   **Initiation (Maker)**: A user makes a change (e.g., edits a loan product's interest rate). Instead of applying directly, the system creates a `PendingChange` record.
*   **Review (Checker)**: The change appears in the **Approvals** page. An approver can view a clear, human-readable summary of the "before" and "after" states.
*   **Decision**: The approver can **Approve** the change, which applies it to the database, or **Reject** it with a reason. This ensures a second pair of eyes reviews all critical modifications.

---

## Background Services

The application includes background services defined in `src/worker.ts`. These are designed to be run by a scheduler (e.g., a cron job).

*   `npm run run:worker -- npl`: A one-off task that scans for overdue loans and flags the associated borrowers as "NPL" (Non-Performing Loan).
*   `npm run run:worker -- repayment-service`: A long-running service that periodically attempts to process automated repayments for overdue loans.
