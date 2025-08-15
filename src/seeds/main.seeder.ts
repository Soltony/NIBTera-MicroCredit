
import 'reflect-metadata';
import { AppDataSource } from '@/data-source';
import { Role } from '@/entities/Role';
import { User } from '@/entities/User';
import { LoanProvider } from '@/entities/LoanProvider';
import { LoanProduct } from '@/entities/LoanProduct';
import { LoanDetails } from '@/entities/LoanDetails';
import { Payment } from '@/entities/Payment';
import { ScoringParameter } from '@/entities/ScoringParameter';
import { ScoringParameterRule } from '@/entities/ScoringParameterRule';
import { ScoringConfigurationHistory } from '@/entities/ScoringConfigurationHistory';
import { Customer } from '@/entities/Customer';
import { CustomParameter } from '@/entities/CustomParameter';
import bcrypt from 'bcryptjs';

class MainSeeder {
  public async run(): Promise<void> {
    try {
      await AppDataSource.initialize();
      console.log('Database connection initialized.');
      
      const queryRunner = AppDataSource.createQueryRunner();

      try {
        console.log('Synchronizing database schema...');
        
        await AppDataSource.synchronize(false);
        console.log('Schema synchronized.');

        await queryRunner.startTransaction();
        
        console.log('Starting seeding...');
        
        const salt = await bcrypt.genSalt(10);

        // 1. Seed Roles
        const superAdminRole = queryRunner.manager.create(Role, {
          name: 'Super Admin',
          permissions: JSON.stringify({
            users: { create: true, read: true, update: true, delete: true },
            roles: { create: true, read: true, update: true, delete: true },
            reports: { create: true, read: true, update: true, delete: true },
            settings: { create: true, read: true, update: true, delete: true },
            products: { create: true, read: true, update: true, delete: true },
          }),
        });

        const loanManagerRole = queryRunner.manager.create(Role, {
          name: 'Loan Manager',
          permissions: JSON.stringify({
            users: { create: false, read: true, update: true, delete: false },
            roles: { create: false, read: false, update: false, delete: false },
            reports: { create: true, read: true, update: true, delete: true },
            settings: { create: true, read: true, update: true, delete: true },
            products: { create: true, read: true, update: true, delete: true },
          }),
        });

        const auditorRole = queryRunner.manager.create(Role, {
          name: 'Auditor',
          permissions: JSON.stringify({
            users: { create: false, read: true, update: false, delete: false },
            roles: { create: false, read: true, update: false, delete: false },
            reports: { create: true, read: true, update: false, delete: false },
            settings: { create: false, read: true, update: false, delete: false },
            products: { create: false, read: true, update: false, delete: false },
          }),
        });
        
        const loanProviderRole = queryRunner.manager.create(Role, {
          name: 'Loan Provider',
          permissions: JSON.stringify({
             users: { create: false, read: false, update: false, delete: false },
             roles: { create: false, read: false, update: false, delete: false },
             reports: { create: true, read: true, update: false, delete: false },
             settings: { create: false, read: true, update: true, delete: false },
             products: { create: true, read: true, update: true, delete: true },
          }),
        });
        
        await queryRunner.manager.save([superAdminRole, loanManagerRole, auditorRole, loanProviderRole]);
        console.log('Seeded roles');

        // 2. Seed Loan Providers and Products
        const nibBank = await queryRunner.manager.save(LoanProvider, {
          name: 'NIb Bank',
          icon: 'Building2',
          colorHex: '#fdb913',
          displayOrder: 1,
        });

        const quickCashLoan = await queryRunner.manager.save(LoanProduct, {
          provider: nibBank,
          name: 'Quick Cash Loan',
          description: 'Instant cash for emergencies.',
          icon: 'PersonStanding',
          minLoan: 500,
          maxLoan: 2500,
          serviceFee: JSON.stringify({ type: 'percentage', value: 3 }),
          dailyFee: JSON.stringify({ type: 'percentage', value: 0.2 }),
          penaltyRules: JSON.stringify([
              { id: 'p1', fromDay: 1, toDay: Infinity, type: 'percentageOfPrincipal', value: 0.11 }
          ]),
          status: 'Active',
          serviceFeeEnabled: true,
          dailyFeeEnabled: true,
          penaltyRulesEnabled: true,
        });
        await queryRunner.manager.save(LoanProduct, {
          provider: nibBank,
          name: 'Gadget Financing',
          description: 'Upgrade your devices with easy financing.',
          icon: 'Home',
          minLoan: 300,
          maxLoan: 1500,
          serviceFee: JSON.stringify({ type: 'percentage', value: 3 }),
          dailyFee: JSON.stringify({ type: 'percentage', value: 0.2 }),
          penaltyRules: '[]',
          status: 'Active',
          serviceFeeEnabled: true,
          dailyFeeEnabled: true,
          penaltyRulesEnabled: false,
        });

        const capitalBank = await queryRunner.manager.save(LoanProvider, {
          name: 'Capital Bank',
          icon: 'Building2',
          colorHex: '#2563eb',
          displayOrder: 2,
        });
        await queryRunner.manager.save(LoanProduct, {
          provider: capitalBank,
          name: 'Personal Loan',
          description: 'Flexible personal loans for your needs.',
          icon: 'PersonStanding',
          minLoan: 400,
          maxLoan: 2000,
          serviceFee: JSON.stringify({ type: 'fixed', value: 50 }),
          dailyFee: JSON.stringify({ type: 'percentage', value: 0.25 }),
          penaltyRules: JSON.stringify([
               { id: 'p2', fromDay: 1, toDay: 5, type: 'fixed', value: 100 },
               { id: 'p3', fromDay: 6, toDay: 10, type: 'fixed', value: 200 }
          ]),
          status: 'Active',
          serviceFeeEnabled: true,
          dailyFeeEnabled: true,
          penaltyRulesEnabled: true,
        });
         await queryRunner.manager.save(LoanProduct, {
          provider: capitalBank,
          name: 'Home Improvement Loan',
          description: 'Finance your home renovation projects.',
          icon: 'Home',
          minLoan: 10000,
          maxLoan: 50000,
          serviceFee: JSON.stringify({ type: 'percentage', value: 2.5 }),
          dailyFee: JSON.stringify({ type: 'percentage', value: 0.05 }),
          penaltyRules: '[]',
          status: 'Disabled',
          serviceFeeEnabled: true,
          dailyFeeEnabled: true,
          penaltyRulesEnabled: false,
        });

        const providusFinancial = await queryRunner.manager.save(LoanProvider, {
          name: 'Providus Financial',
          icon: 'Landmark',
          colorHex: '#16a34a',
          displayOrder: 3,
        });
         await queryRunner.manager.save(LoanProduct, {
          provider: providusFinancial,
          name: 'Startup Business Loan',
          description: 'Kickstart your new business venture.',
          icon: 'Briefcase',
          minLoan: 5000,
          maxLoan: 100000,
          serviceFee: JSON.stringify({ type: 'fixed', value: 1000 }),
          dailyFee: JSON.stringify({ type: 'percentage', value: 0 }),
          penaltyRules: '[]',
          status: 'Active',
          serviceFeeEnabled: true,
          dailyFeeEnabled: false,
          penaltyRulesEnabled: false,
        });
        await queryRunner.manager.save(LoanProduct, {
          provider: providusFinancial,
          name: 'Personal Auto Loan',
          description: 'Get behind the wheel of your new car.',
          icon: 'PersonStanding',
          minLoan: 2000,
          maxLoan: 30000,
          serviceFee: JSON.stringify({ type: 'percentage', value: 4 }),
          dailyFee: JSON.stringify({ type: 'percentage', value: 0.1 }),
          penaltyRules: '[]',
          status: 'Active',
          serviceFeeEnabled: true,
          dailyFeeEnabled: true,
          penaltyRulesEnabled: false,
        });
        console.log('Seeded loan providers and products');

        // 3. Seed Users
        await queryRunner.manager.save(User, {
          fullName: 'Super Admin',
          email: 'superadmin@loanflow.com',
          phoneNumber: '0912345678',
          password: await bcrypt.hash('Admin@123', salt),
          status: 'Active',
          role: superAdminRole,
        });
        await queryRunner.manager.save(User, {
          fullName: 'John Provider',
          email: 'john.p@capitalbank.com',
          phoneNumber: '0987654321',
          password: await bcrypt.hash('Password123', salt),
          status: 'Active',
          role: loanProviderRole,
          provider: capitalBank,
        });
         await queryRunner.manager.save(User, {
          fullName: 'Jane Officer',
          email: 'jane.o@providus.com',
          phoneNumber: '5555555555',
          password: await bcrypt.hash('Password123', salt),
          status: 'Inactive',
          role: loanProviderRole,
          provider: providusFinancial,
        });
        console.log('Seeded users');

        // 4. Seed Loan History
        const loan = await queryRunner.manager.save(LoanDetails, {
          provider: nibBank,
          product: quickCashLoan,
          loanAmount: 500,
          serviceFee: 15,
          disbursedDate: new Date('2024-06-25'),
          dueDate: new Date('2024-07-25'),
          repaymentStatus: 'Paid',
          repaidAmount: 545.96,
          penaltyAmount: 0,
        });
        await queryRunner.manager.save(Payment, {
          loan: loan,
          amount: 545.96,
          date: new Date('2024-07-20'),
          outstandingBalanceBeforePayment: 545.96,
        });
        console.log('Seeded loan history');

        // 5. Seed Scoring Parameters for all providers
        
        // NIb Bank
        const nibAgeParam = await queryRunner.manager.save(ScoringParameter, { provider: nibBank, name: 'Age', weight: 20 });
        await queryRunner.manager.save(ScoringParameterRule, [
          { parameter: nibAgeParam, field: 'age', condition: '>=', value: '35', score: 20 },
          { parameter: nibAgeParam, field: 'age', condition: '<', value: '25', score: 5 },
        ]);
        const nibHistoryParam = await queryRunner.manager.save(ScoringParameter, { provider: nibBank, name: 'Loan History', weight: 30 });
        await queryRunner.manager.save(ScoringParameterRule, [
          { parameter: nibHistoryParam, field: 'onTimeRepayments', condition: '>', value: '5', score: 30 },
          { parameter: nibHistoryParam, field: 'loanHistoryCount', condition: '<', value: '1', score: 10 },
        ]);
        const nibIncomeParam = await queryRunner.manager.save(ScoringParameter, { provider: nibBank, name: 'Income Level', weight: 50 });
         await queryRunner.manager.save(ScoringParameterRule, [
          { parameter: nibIncomeParam, field: 'monthlyIncome', condition: '>', value: '5000', score: 40 },
          { parameter: nibIncomeParam, field: 'monthlyIncome', condition: '<=', value: '2000', score: 15 },
        ]);

        // Capital Bank
        const capIncomeParam = await queryRunner.manager.save(ScoringParameter, { provider: capitalBank, name: 'Income Level', weight: 70 });
        await queryRunner.manager.save(ScoringParameterRule, [
            { parameter: capIncomeParam, field: 'monthlyIncome', condition: '>=', value: '10000', score: 50 },
            { parameter: capIncomeParam, field: 'monthlyIncome', condition: 'between', value: '4000-9999', score: 30 },
            { parameter: capIncomeParam, field: 'monthlyIncome', condition: '<', value: '4000', score: 10 },
        ]);
        const capEduParam = await queryRunner.manager.save(ScoringParameter, { provider: capitalBank, name: 'Education Level', weight: 30 });
        await queryRunner.manager.save(ScoringParameterRule, [
            { parameter: capEduParam, field: 'educationLevel', condition: '==', value: 'Master\'s Degree', score: 40 },
            { parameter: capEduParam, field: 'educationLevel', condition: '==', value: 'Bachelor\'s Degree', score: 25 },
        ]);
        
        // Providus Financial
        const provGenderParam = await queryRunner.manager.save(ScoringParameter, { provider: providusFinancial, name: 'Gender', weight: 10 });
        await queryRunner.manager.save(ScoringParameterRule, [
            { parameter: provGenderParam, field: 'gender', condition: '==', value: 'Female', score: 10 },
        ]);
        const provLoanHistoryParam = await queryRunner.manager.save(ScoringParameter, { provider: providusFinancial, name: 'Loan History', weight: 90 });
         await queryRunner.manager.save(ScoringParameterRule, [
            { parameter: provLoanHistoryParam, field: 'onTimeRepayments', condition: '>=', value: '10', score: 100 },
            { parameter: provLoanHistoryParam, field: 'totalLoans', condition: '>', value: '5', score: 60 },
        ]);

        console.log('Seeded scoring parameters for all providers.');

        // 6. Seed Customers
        await queryRunner.manager.save(Customer, [
          {
            id: 8,
            age: 30,
            monthlyIncome: 5500,
            transactionHistory: JSON.stringify({ transactions: 150, averageBalance: 2000 }),
            gender: 'Male',
            loanHistory: JSON.stringify({ totalLoans: 5, onTimeRepayments: 5 }),
            educationLevel: "Bachelor's Degree",
          },
          {
            id: 9,
            age: 22,
            monthlyIncome: 2500,
            transactionHistory: JSON.stringify({ transactions: 50, averageBalance: 500 }),
            gender: 'Female',
            loanHistory: JSON.stringify({ totalLoans: 1, onTimeRepayments: 0 }),
            educationLevel: 'High School',
          },
          {
            id: 10,
            age: 45,
            monthlyIncome: 15000,
            transactionHistory: JSON.stringify({ transactions: 300, averageBalance: 10000 }),
            gender: 'Female',
            loanHistory: JSON.stringify({ totalLoans: 10, onTimeRepayments: 10 }),
            educationLevel: "Master's Degree",
          },
          {
            id: 11,
            age: 19,
            monthlyIncome: 1000,
            transactionHistory: JSON.stringify({ transactions: 20, averageBalance: 300 }),
            gender: 'Male',
            loanHistory: JSON.stringify({ totalLoans: 0, onTimeRepayments: 0 }),
            educationLevel: "Student",
          },
        ]);
        console.log('Seeded customers');

        // 7. Seed Custom Parameters
        await queryRunner.manager.save(CustomParameter, {
            provider: nibBank,
            name: 'Credit Utilization'
        });
        await queryRunner.manager.save(CustomParameter, {
            provider: nibBank,
            name: 'Years of Credit History'
        });
        await queryRunner.manager.save(CustomParameter, {
            provider: capitalBank,
            name: 'Debt-to-Income Ratio'
        });

        console.log('Seeded custom parameters.');
        
        await queryRunner.commitTransaction();
        console.log('Seeding finished successfully.');

      } catch (err) {
        console.error('Error during seeding transaction, rolling back:', err);
        await queryRunner.rollbackTransaction();
      } finally {
        await queryRunner.release();
      }

    } catch (err) {
      console.error('Error establishing database connection for seeding:', err);
    } finally {
      if (AppDataSource.isInitialized) {
        await AppDataSource.destroy();
        console.log('Database connection closed.');
      }
    }
  }
}

const seeder = new MainSeeder();
seeder.run().catch((err) => {
  console.error('Failed to run seeder', err);
  process.exit(1);
});
