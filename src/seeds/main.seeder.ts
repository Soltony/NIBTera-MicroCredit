
import 'reflect-metadata';
import { getConnectedDataSource } from '@/data-source';
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
import { LoanAmountTier } from '@/entities/LoanAmountTier';
import bcrypt from 'bcryptjs';
import type { DeepPartial, EntityManager, DataSource } from 'typeorm';

class MainSeeder {
  private dataSource: DataSource | null = null;
  
  private async findOrCreateRole(manager: EntityManager, findCriteria: { name: string }, createData: DeepPartial<Role>): Promise<Role> {
    let instance = await manager.findOneBy(Role, findCriteria);
    if (!instance) {
      instance = manager.create(Role, createData);
      await manager.save(instance);
    }
    return instance;
  }

  private async findOrCreateProvider(manager: EntityManager, findCriteria: { name: string }, createData: DeepPartial<LoanProvider>): Promise<LoanProvider> {
    let instance = await manager.findOneBy(LoanProvider, findCriteria);
    if (!instance) {
      instance = manager.create(LoanProvider, createData);
      await manager.save(instance);
    }
    return instance;
  }
  
  private async findOrCreateUser(manager: EntityManager, findCriteria: { email: string }, createData: DeepPartial<User>): Promise<User> {
    let instance = await manager.findOneBy(User, findCriteria);
    if (!instance) {
      instance = manager.create(User, createData);
      await manager.save(instance);
    }
    return instance;
  }

  private async findOrCreateProduct(
    manager: EntityManager,
    findCriteria: { name: string; providerId: number },
    createData: DeepPartial<LoanProduct>
  ): Promise<LoanProduct> {
    let instance = await manager.findOne(LoanProduct, { where: findCriteria });
    if (!instance) {
      instance = manager.create(LoanProduct, createData);
      await manager.save(instance);
    }
    return instance;
  }

  private async findOrCreateCustomer(manager: EntityManager, findCriteria: { id: number }, createData: DeepPartial<Customer>): Promise<Customer> {
    let instance = await manager.findOneBy(Customer, findCriteria);
    if (!instance) {
        instance = manager.create(Customer, createData);
        await manager.save(instance);
    }
    return instance;
  }
  
  private async findOrCreateScoringParameter(manager: EntityManager, findCriteria: { name: string; providerId: number }, createData: DeepPartial<ScoringParameter>): Promise<ScoringParameter> {
    let instance = await manager.findOneBy(ScoringParameter, findCriteria);
    if (!instance) {
        instance = manager.create(ScoringParameter, createData);
        await manager.save(instance);
    }
    return instance;
  }
  
  private async createRulesForParameter(manager: EntityManager, parameter: ScoringParameter, rules: DeepPartial<ScoringParameterRule>[]) {
      for (const rule of rules) {
          const newRule = manager.create(ScoringParameterRule, {
              ...rule,
              parameterId: parameter.id
          });
          await manager.save(newRule);
      }
  }

  private async findOrCreateCustomParameter(manager: EntityManager, findCriteria: { name: string; providerId: number }, createData: DeepPartial<CustomParameter>): Promise<CustomParameter> {
    let instance = await manager.findOneBy(CustomParameter, findCriteria);
    if (!instance) {
        instance = manager.create(CustomParameter, createData);
        await manager.save(instance);
    }
    return instance;
  }

  private async createLoanTiers(manager: EntityManager, product: LoanProduct, tiers: DeepPartial<LoanAmountTier>[]) {
      for (const tier of tiers) {
          const existing = await manager.findOne(LoanAmountTier, { where: { productId: product.id, fromScore: tier.fromScore }});
          if (!existing) {
              await manager.save(LoanAmountTier, { ...tier, productId: product.id });
          }
      }
  }
    
    
  public async run(): Promise<void> {
    try {
        this.dataSource = await getConnectedDataSource();
        console.log('Database connection initialized for seeding.');
        
        await this.dataSource.transaction(async manager => {
            const salt = await bcrypt.genSalt(10);

            // 1. Seed Roles
            const superAdminRole = await this.findOrCreateRole(manager, { name: 'Super Admin' }, {
              name: 'Super Admin',
              permissions: JSON.stringify({
                users: { create: true, read: true, update: true, delete: true },
                roles: { create: true, read: true, update: true, delete: true },
                reports: { create: true, read: true, update: true, delete: true },
                settings: { create: true, read: true, update: true, delete: true },
                products: { create: true, read: true, update: true, delete: true },
              }),
            });

            const loanManagerRole = await this.findOrCreateRole(manager, { name: 'Loan Manager' }, {
              name: 'Loan Manager',
              permissions: JSON.stringify({
                users: { create: false, read: true, update: true, delete: false },
                roles: { create: false, read: false, update: false, delete: false },
                reports: { create: true, read: true, update: true, delete: true },
                settings: { create: true, read: true, update: true, delete: true },
                products: { create: true, read: true, update: true, delete: true },
              }),
            });

            const auditorRole = await this.findOrCreateRole(manager, { name: 'Auditor' }, {
              name: 'Auditor',
              permissions: JSON.stringify({
                users: { create: false, read: true, update: false, delete: false },
                roles: { create: false, read: true, update: false, delete: false },
                reports: { create: true, read: true, update: false, delete: false },
                settings: { create: false, read: true, update: false, delete: false },
                products: { create: false, read: true, update: false, delete: false },
              }),
            });
            
            const loanProviderRole = await this.findOrCreateRole(manager, { name: 'Loan Provider' }, {
              name: 'Loan Provider',
              permissions: JSON.stringify({
                  users: { create: false, read: false, update: false, delete: false },
                  roles: { create: false, read: false, update: false, delete: false },
                  reports: { create: true, read: true, update: false, delete: false },
                  settings: { create: false, read: true, update: true, delete: false },
                  products: { create: true, read: true, update: true, delete: true },
              }),
            });
            console.log('Seeded roles');

            // 2. Seed Loan Providers and Products
            const nibBank = await this.findOrCreateProvider(manager, { name: 'NIb Bank' }, {
              name: 'NIb Bank',
              icon: 'Building2',
              colorHex: '#fdb913',
              displayOrder: 1,
              accountNumber: '1000123456789',
              allowMultipleProviderLoans: false,
              allowCrossProviderLoans: false,
            });

            const quickCashLoan = await this.findOrCreateProduct(manager, { name: 'Quick Cash Loan', providerId: nibBank.id }, {
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

            const gadgetFinancing = await this.findOrCreateProduct(manager, { name: 'Gadget Financing', providerId: nibBank.id }, {
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

            const capitalBank = await this.findOrCreateProvider(manager, { name: 'Capital Bank' }, {
              name: 'Capital Bank',
              icon: 'Building2',
              colorHex: '#2563eb',
              displayOrder: 2,
              accountNumber: '2000987654321',
              allowMultipleProviderLoans: true,
              allowCrossProviderLoans: false,
            });
            const personalLoan = await this.findOrCreateProduct(manager, { name: 'Personal Loan', providerId: capitalBank.id }, {
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
              const homeImprovementLoan = await this.findOrCreateProduct(manager, { name: 'Home Improvement Loan', providerId: capitalBank.id }, {
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

            const providusFinancial = await this.findOrCreateProvider(manager, { name: 'Providus Financial' }, {
              name: 'Providus Financial',
              icon: 'Landmark',
              colorHex: '#16a34a',
              displayOrder: 3,
              accountNumber: '3000112233445',
              allowMultipleProviderLoans: true,
              allowCrossProviderLoans: true,
            });
              const startupLoan = await this.findOrCreateProduct(manager, { name: 'Startup Business Loan', providerId: providusFinancial.id }, {
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
            const autoLoan = await this.findOrCreateProduct(manager, { name: 'Personal Auto Loan', providerId: providusFinancial.id }, {
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
            await this.findOrCreateUser(manager, { email: 'superadmin@loanflow.com' }, {
              fullName: 'Super Admin',
              email: 'superadmin@loanflow.com',
              phoneNumber: '0912345678',
              password: await bcrypt.hash('Admin@123', salt),
              status: 'Active',
              role: superAdminRole,
            });
            await this.findOrCreateUser(manager, { email: 'john.p@capitalbank.com' }, {
              fullName: 'John Provider',
              email: 'john.p@capitalbank.com',
              phoneNumber: '0987654321',
              password: await bcrypt.hash('Password123', salt),
              status: 'Active',
              role: loanProviderRole,
              provider: capitalBank,
            });
              await this.findOrCreateUser(manager, { email: 'jane.o@providus.com' }, {
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
            const existingLoan = await manager.findOne(LoanDetails, { where: { loanAmount: 500, providerId: nibBank.id } });
            if (!existingLoan) {
              const loan = await manager.save(LoanDetails, {
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
              await manager.save(Payment, {
                loan: loan,
                amount: 545.96,
                date: new Date('2024-07-20'),
                outstandingBalanceBeforePayment: 545.96,
              });
              console.log('Seeded loan history');
            }

            // 5. Seed Scoring Parameters and Rules for all providers
            // NIb Bank
            const ageParamNib = await this.findOrCreateScoringParameter(manager, { name: 'age', providerId: nibBank.id }, { providerId: nibBank.id, name: 'age', weight: 20 });
            await this.createRulesForParameter(manager, ageParamNib, [
              { field: 'age', condition: '>=', value: '35', score: 20 },
              { field: 'age', condition: 'between', value: '25-34', score: 10 },
              { field: 'age', condition: '<', value: '25', score: 5 },
            ]);
            const onTimeRepaymentsParamNib = await this.findOrCreateScoringParameter(manager, { name: 'onTimeRepayments', providerId: nibBank.id }, { providerId: nibBank.id, name: 'onTimeRepayments', weight: 30 });
            await this.createRulesForParameter(manager, onTimeRepaymentsParamNib, [
              { field: 'onTimeRepayments', condition: '>', value: '5', score: 30 },
            ]);
            const totalLoansParamNib = await this.findOrCreateScoringParameter(manager, { name: 'totalLoans', providerId: nibBank.id }, { providerId: nibBank.id, name: 'totalLoans', weight: 10 });
            await this.createRulesForParameter(manager, totalLoansParamNib, [
              { field: 'totalLoans', condition: '<', value: '1', score: 10 },
            ]);
            const monthlyIncomeParamNib = await this.findOrCreateScoringParameter(manager, { name: 'monthlyIncome', providerId: nibBank.id }, { providerId: nibBank.id, name: 'monthlyIncome', weight: 40 });
            await this.createRulesForParameter(manager, monthlyIncomeParamNib, [
              { field: 'monthlyIncome', condition: '>', value: '5000', score: 40 },
              { field: 'monthlyIncome', condition: '<=', value: '2000', score: 15 },
            ]);

            // Capital Bank
            const monthlyIncomeParamCapital = await this.findOrCreateScoringParameter(manager, { name: 'monthlyIncome', providerId: capitalBank.id }, { providerId: capitalBank.id, name: 'monthlyIncome', weight: 50 });
            await this.createRulesForParameter(manager, monthlyIncomeParamCapital, [
                { field: 'monthlyIncome', condition: '>=', value: '10000', score: 50 },
                { field: 'monthlyIncome', condition: 'between', value: '4000-9999', score: 30 },
                { field: 'monthlyIncome', condition: '<', value: '4000', score: 10 },
            ]);
            const educationLevelParamCapital = await this.findOrCreateScoringParameter(manager, { name: 'educationLevel', providerId: capitalBank.id }, { providerId: capitalBank.id, name: 'educationLevel', weight: 50 });
            await this.createRulesForParameter(manager, educationLevelParamCapital, [
                { field: 'educationLevel', condition: '==', value: "Master's Degree", score: 40 },
                { field: 'educationLevel', condition: '==', value: "Bachelor's Degree", score: 25 },
            ]);
            
            // Providus Financial
            const genderParamProvidus = await this.findOrCreateScoringParameter(manager, { name: 'gender', providerId: providusFinancial.id }, { providerId: providusFinancial.id, name: 'gender', weight: 10 });
            await this.createRulesForParameter(manager, genderParamProvidus, [
                { field: 'gender', condition: '==', value: 'Female', score: 10 },
                { field: 'gender', condition: '==', value: 'Male', score: 5 },
            ]);
            const onTimeRepaymentsParamProvidus = await this.findOrCreateScoringParameter(manager, { name: 'onTimeRepayments', providerId: providusFinancial.id }, { providerId: providusFinancial.id, name: 'onTimeRepayments', weight: 50 });
            await this.createRulesForParameter(manager, onTimeRepaymentsParamProvidus, [
                { field: 'onTimeRepayments', condition: '>=', value: '10', score: 50 },
            ]);
            const totalLoansParamProvidus = await this.findOrCreateScoringParameter(manager, { name: 'totalLoans', providerId: providusFinancial.id }, { providerId: providusFinancial.id, name: 'totalLoans', weight: 40 });
            await this.createRulesForParameter(manager, totalLoansParamProvidus, [
                { field: 'totalLoans', condition: '>', value: '5', score: 40 },
            ]);

            console.log('Seeded scoring parameters for all providers.');

            // 6. Seed Loan Amount Tiers
            await this.createLoanTiers(manager, quickCashLoan, [
                { fromScore: 0, toScore: 20, loanAmount: 500 },
                { fromScore: 21, toScore: 40, loanAmount: 1000 },
                { fromScore: 41, toScore: 100, loanAmount: 2500 },
            ]);
            await this.createLoanTiers(manager, gadgetFinancing, [
                { fromScore: 0, toScore: 50, loanAmount: 300 },
                { fromScore: 51, toScore: 100, loanAmount: 1500 },
            ]);
            await this.createLoanTiers(manager, personalLoan, [
                { fromScore: 0, toScore: 25, loanAmount: 400 },
                { fromScore: 26, toScore: 50, loanAmount: 1000 },
                { fromScore: 51, toScore: 100, loanAmount: 2000 },
            ]);
            await this.createLoanTiers(manager, homeImprovementLoan, [
                { fromScore: 0, toScore: 60, loanAmount: 10000 },
                { fromScore: 61, toScore: 100, loanAmount: 50000 },
            ]);
            await this.createLoanTiers(manager, startupLoan, [
                { fromScore: 0, toScore: 70, loanAmount: 10000 },
                { fromScore: 71, toScore: 100, loanAmount: 100000 },
            ]);
            await this.createLoanTiers(manager, autoLoan, [
                { fromScore: 0, toScore: 30, loanAmount: 5000 },
                { fromScore: 31, toScore: 70, loanAmount: 15000 },
                { fromScore: 71, toScore: 100, loanAmount: 30000 },
            ]);
            console.log('Seeded loan amount tiers.');

            // 7. Seed Customers
            await this.findOrCreateCustomer(manager, { id: 8 }, {
                id: 8,
                age: 30,
                monthlyIncome: 5500,
                transactionHistory: JSON.stringify({ transactions: 150, averageBalance: 2000 }),
                gender: 'Male',
                loanHistory: JSON.stringify({ totalLoans: 5, onTimeRepayments: 5 }),
                educationLevel: "Bachelor's Degree",
            });
            await this.findOrCreateCustomer(manager, { id: 9 }, {
                id: 9,
                age: 22,
                monthlyIncome: 2500,
                transactionHistory: JSON.stringify({ transactions: 50, averageBalance: 500 }),
                gender: 'Female',
                loanHistory: JSON.stringify({ totalLoans: 1, onTimeRepayments: 0 }),
                educationLevel: 'High School',
            });
            await this.findOrCreateCustomer(manager, { id: 10 }, {
                id: 10,
                age: 45,
                monthlyIncome: 15000,
                transactionHistory: JSON.stringify({ transactions: 300, averageBalance: 10000 }),
                gender: 'Female',
                loanHistory: JSON.stringify({ totalLoans: 10, onTimeRepayments: 10 }),
                educationLevel: "Master's Degree",
            });
            await this.findOrCreateCustomer(manager, { id: 11 }, {
                id: 11,
                age: 19,
                monthlyIncome: 1000,
                transactionHistory: JSON.stringify({ transactions: 20, averageBalance: 300 }),
                gender: 'Male',
                loanHistory: JSON.stringify({ totalLoans: 0, onTimeRepayments: 0 }),
                educationLevel: "Student",
            });
            console.log('Seeded customers');

            // 8. Seed Custom Parameters
            await this.findOrCreateCustomParameter(manager, { name: 'Credit Utilization', providerId: nibBank.id }, {
                providerId: nibBank.id,
                name: 'Credit Utilization'
            });
            await this.findOrCreateCustomParameter(manager, { name: 'Years of Credit History', providerId: nibBank.id }, {
                providerId: nibBank.id,
                name: 'Years of Credit History'
            });
            await this.findOrCreateCustomParameter(manager, { name: 'Debt-to-Income Ratio', providerId: capitalBank.id }, {
                providerId: capitalBank.id,
                name: 'Debt-to-Income Ratio'
            });

            console.log('Seeded custom parameters.');
          });
        console.log('Seeding finished successfully.');
    } catch (err: any) {
      console.error('Error during seeding transaction, rolling back:', err);
    } finally {
      if (this.dataSource && this.dataSource.isInitialized) {
        await this.dataSource.destroy();
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
