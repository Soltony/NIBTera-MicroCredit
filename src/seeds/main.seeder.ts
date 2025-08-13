
import 'reflect-metadata';
import { AppDataSource } from '../data-source';
import { Role } from '../entities/Role';
import { User } from '../entities/User';
import { LoanProvider } from '../entities/LoanProvider';
import { LoanProduct } from '../entities/LoanProduct';
import { LoanDetails } from '../entities/LoanDetails';
import { Payment } from '../entities/Payment';
import { ScoringParameter } from '../entities/ScoringParameter';
import { ScoringParameterRule } from '../entities/ScoringParameterRule';
import bcrypt from 'bcryptjs';

class MainSeeder {
  public async run(): Promise<void> {
    await AppDataSource.initialize();
    console.log('Database connection initialized.');

    // Use a query runner for transaction
    const queryRunner = AppDataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      console.log('Starting seeding...');

      // Clean up existing data to ensure idempotency
      // Note: Order is important due to foreign key constraints
      await queryRunner.manager.query('DELETE FROM payments');
      await queryRunner.manager.query('DELETE FROM loan_details');
      await queryRunner.manager.query('DELETE FROM scoring_parameter_rules');
      await queryRunner.manager.query('DELETE FROM scoring_parameters');
      await queryRunner.manager.query('DELETE FROM users');
      await queryRunner.manager.query('DELETE FROM loan_products');
      await queryRunner.manager.query('DELETE FROM loan_providers');
      await queryRunner.manager.query('DELETE FROM roles');
      console.log('Deleted existing data.');

      const salt = await bcrypt.genSalt(10);

      // Repositories
      const roleRepository = queryRunner.manager.getRepository(Role);
      const userRepository = queryRunner.manager.getRepository(User);
      const providerRepository = queryRunner.manager.getRepository(LoanProvider);
      const productRepository = queryRunner.manager.getRepository(LoanProduct);
      const loanDetailsRepository = queryRunner.manager.getRepository(LoanDetails);
      const paymentRepository = queryRunner.manager.getRepository(Payment);
      const scoringParamRepository = queryRunner.manager.getRepository(ScoringParameter);
      const scoringRuleRepository = queryRunner.manager.getRepository(ScoringParameterRule);

      // 1. Seed Roles
      const superAdminRole = roleRepository.create({
        name: 'Super Admin',
        permissions: JSON.stringify({
          users: { create: true, read: true, update: true, delete: true },
          roles: { create: true, read: true, update: true, delete: true },
          reports: { create: true, read: true, update: true, delete: true },
          settings: { create: true, read: true, update: true, delete: true },
          products: { create: true, read: true, update: true, delete: true },
        }),
      });

      const loanManagerRole = roleRepository.create({
        name: 'Loan Manager',
        permissions: JSON.stringify({
          users: { create: false, read: true, update: true, delete: false },
          roles: { create: false, read: false, update: false, delete: false },
          reports: { create: true, read: true, update: true, delete: true },
          settings: { create: true, read: true, update: true, delete: true },
          products: { create: true, read: true, update: true, delete: true },
        }),
      });

      const auditorRole = roleRepository.create({
        name: 'Auditor',
        permissions: JSON.stringify({
          users: { create: false, read: true, update: false, delete: false },
          roles: { create: false, read: true, update: false, delete: false },
          reports: { create: true, read: true, update: false, delete: false },
          settings: { create: false, read: true, update: false, delete: false },
          products: { create: false, read: true, update: false, delete: false },
        }),
      });
      
      const loanProviderRole = roleRepository.create({
        name: 'Loan Provider',
        permissions: JSON.stringify({
           users: { create: false, read: false, update: false, delete: false },
           roles: { create: false, read: false, update: false, delete: false },
           reports: { create: true, read: true, update: false, delete: false },
           settings: { create: false, read: true, update: true, delete: false },
           products: { create: true, read: true, update: true, delete: true },
        }),
      });
      
      await roleRepository.save([superAdminRole, loanManagerRole, auditorRole, loanProviderRole]);
      console.log('Seeded roles');

      // 2. Seed Loan Providers and Products
      const nibBank = await providerRepository.save({
        name: 'NIb Bank',
        icon: 'Building2',
        colorHex: '#fdb913',
        displayOrder: 1,
      });

      const quickCashLoan = await productRepository.save({
        provider: nibBank,
        name: 'Quick Cash Loan',
        description: 'Instant cash for emergencies.',
        icon: 'PersonStanding',
        minLoan: 500,
        maxLoan: 2500,
        serviceFee: '3%',
        dailyFee: '0.2%',
        penaltyFee: '0.11% daily',
        status: 'Active',
      });
      await productRepository.save({
        provider: nibBank,
        name: 'Gadget Financing',
        description: 'Upgrade your devices with easy financing.',
        icon: 'Home',
        minLoan: 300,
        maxLoan: 1500,
        serviceFee: '3%',
        dailyFee: '0.2%',
        penaltyFee: '0.11% daily',
        status: 'Active',
      });

      const capitalBank = await providerRepository.save({
        name: 'Capital Bank',
        icon: 'Building2',
        colorHex: '#2563eb',
        displayOrder: 2,
      });
      await productRepository.save({
        provider: capitalBank,
        name: 'Personal Loan',
        description: 'Flexible personal loans for your needs.',
        icon: 'PersonStanding',
        minLoan: 400,
        maxLoan: 2000,
        serviceFee: '3%',
        dailyFee: '0.2%',
        penaltyFee: '0.11% daily',
        status: 'Active',
      });
       await productRepository.save({
        provider: capitalBank,
        name: 'Home Improvement Loan',
        description: 'Finance your home renovation projects.',
        icon: 'Home',
        minLoan: 10000,
        maxLoan: 50000,
        serviceFee: '3%',
        dailyFee: '0.2%',
        penaltyFee: '0.11% daily',
        status: 'Disabled',
      });

      const providusFinancial = await providerRepository.save({
        name: 'Providus Financial',
        icon: 'Landmark',
        colorHex: '#16a34a',
        displayOrder: 3,
      });
       await productRepository.save({
        provider: providusFinancial,
        name: 'Startup Business Loan',
        description: 'Kickstart your new business venture.',
        icon: 'Briefcase',
        minLoan: 5000,
        maxLoan: 100000,
        serviceFee: '3%',
        dailyFee: '0.2%',
        penaltyFee: '0.11% daily',
        status: 'Active',
      });
      await productRepository.save({
        provider: providusFinancial,
        name: 'Personal Auto Loan',
        description: 'Get behind the wheel of your new car.',
        icon: 'PersonStanding',
        minLoan: 2000,
        maxLoan: 30000,
        serviceFee: '3%',
        dailyFee: '0.2%',
        penaltyFee: '0.11% daily',
        status: 'Active',
      });
      console.log('Seeded loan providers and products');

      // 3. Seed Users
      await userRepository.save({
        fullName: 'Super Admin',
        email: 'superadmin@loanflow.com',
        phoneNumber: '0912345678',
        password: await bcrypt.hash('Admin@123', salt),
        status: 'Active',
        role: superAdminRole,
      });
      await userRepository.save({
        fullName: 'John Provider',
        email: 'john.p@capitalbank.com',
        phoneNumber: '0987654321',
        password: await bcrypt.hash('Password123', salt),
        status: 'Active',
        role: loanProviderRole,
        provider: capitalBank,
      });
       await userRepository.save({
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
      const loan = await loanDetailsRepository.save({
        provider: nibBank,
        product: quickCashLoan,
        loanAmount: 500,
        serviceFee: 15,
        interestRate: 0.2,
        disbursedDate: new Date('2024-06-25'),
        dueDate: new Date('2024-07-25'),
        penaltyAmount: 0.11,
        repaymentStatus: 'Paid',
        repaidAmount: 545.96,
      });
      await paymentRepository.save({
        loan: loan,
        amount: 545.96,
        date: new Date('2024-07-20'),
        outstandingBalanceBeforePayment: 545.96,
      });
      console.log('Seeded loan history');

      // 5. Seed Scoring Parameters
      const ageParam = await scoringParamRepository.save({
        provider: nibBank, name: 'Age', weight: 20,
      });
      await scoringRuleRepository.save([
        { parameter: ageParam, field: 'age', condition: '>=', value: '35', score: 20 },
        { parameter: ageParam, field: 'age', condition: '<', value: '25', score: 5 },
      ]);
      const historyParam = await scoringParamRepository.save({
        provider: nibBank, name: 'Loan History', weight: 30,
      });
      await scoringRuleRepository.save([
        { parameter: historyParam, field: 'onTimeRepayments', condition: '>', value: '5', score: 30 },
        { parameter: historyParam, field: 'loanHistoryCount', condition: '<', value: '1', score: 10 },
      ]);
      const incomeParam = await scoringParamRepository.save({
        provider: nibBank, name: 'Income Level', weight: 50,
      });
       await scoringRuleRepository.save([
        { parameter: incomeParam, field: 'monthlyIncome', condition: '>', value: '5000', score: 40 },
        { parameter: incomeParam, field: 'monthlyIncome', condition: '<=', value: '2000', score: 15 },
      ]);
      console.log('Seeded scoring parameters');

      await queryRunner.commitTransaction();
      console.log('Seeding finished successfully.');
    } catch (err) {
      console.error('Error during seeding:', err);
      await queryRunner.rollbackTransaction();
    } finally {
      await queryRunner.release();
      await AppDataSource.destroy();
      console.log('Database connection closed.');
    }
  }
}

const seeder = new MainSeeder();
seeder.run().catch((err) => {
  console.error('Failed to run seeder', err);
});
