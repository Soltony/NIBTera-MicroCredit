# LoanFlow - Micro-Credit Platform

This application is a multi-provider micro-credit platform built with Next.js, Prisma, and Tailwind CSS. It provides a comprehensive solution for managing the entire loan lifecycle, from provider configuration to borrower application and repayment.

## Key Features

*   **Admin & Borrower Interfaces**: The app has a secure admin dashboard for management and a separate, simplified flow for borrowers to apply for loans.

*   **Multi-Provider & Product Management**: Administrators can create and configure multiple loan providers (e.g., different banks) and define various loan products for each, such as personal loans with unique rules, fees, and interest rates.

*   **Dynamic Credit Scoring Engine**: Each provider can build their own credit scoring model using a powerful rules engine. This allows them to weigh different data points (like income or employment status from uploaded data) to automatically determine a borrower's eligibility and maximum loan amount.

*   **End-to-End Loan Lifecycle**: Borrowers can check their eligibility, apply for a loan, and receive funds. The system tracks the entire lifecycle, including disbursement, daily fee accrual, penalties, repayments, and overdue statuses.

*   **Automated Backend Processes**: The application includes backend services for processing automated loan repayments from borrower accounts and for identifying and flagging Non-Performing Loans (NPLs) based on configurable rules.

*   **Comprehensive Reporting & Auditing**: Admins have access to a detailed reporting suite to monitor key metrics like portfolio health, collections, income, and fund utilization. All critical actions are logged for compliance and security.

*   **Role-Based Access Control**: The platform features a robust access control system, allowing administrators to define granular roles and permissions for different user types.
