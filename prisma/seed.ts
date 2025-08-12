
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log(`Start seeding ...`);

  // Clean up existing data to ensure idempotency
  await prisma.payment.deleteMany({});
  await prisma.loanDetails.deleteMany({});
  await prisma.scoringParameterRule.deleteMany({});
  await prisma.scoringParameter.deleteMany({});
  await prisma.user.deleteMany({});
  await prisma.loanProduct.deleteMany({});
  await prisma.loanProvider.deleteMany({});
  await prisma.role.deleteMany({});
  console.log('Deleted existing data.');


  const salt = await bcrypt.genSalt(10);

  // Seed Roles
  const superAdminRole = await prisma.role.create({
    data: {
      name: 'Super Admin',
      permissions: {
        users: { create: true, read: true, update: true, delete: true },
        roles: { create: true, read: true, update: true, delete: true },
        reports: { create: true, read: true, update: true, delete: true },
        settings: { create: true, read: true, update: true, delete: true },
        products: { create: true, read: true, update: true, delete: true },
      },
    },
  });

  const loanManagerRole = await prisma.role.create({
    data: {
      name: 'Loan Manager',
      permissions: {
        users: { create: false, read: true, update: true, delete: false },
        roles: { create: false, read: false, update: false, delete: false },
        reports: { create: true, read: true, update: true, delete: true },
        settings: { create: true, read: true, update: true, delete: true },
        products: { create: true, read: true, update: true, delete: true },
      },
    },
  });

  const auditorRole = await prisma.role.create({
    data: {
      name: 'Auditor',
      permissions: {
        users: { create: false, read: true, update: false, delete: false },
        roles: { create: false, read: true, update: false, delete: false },
        reports: { create: true, read: true, update: false, delete: false },
        settings: { create: false, read: true, update: false, delete: false },
        products: { create: false, read: true, update: false, delete: false },
      },
    },
  });
  
  const loanProviderRole = await prisma.role.create({
    data: {
      name: 'Loan Provider',
      permissions: {
         users: { create: false, read: false, update: false, delete: false },
         roles: { create: false, read: false, update: false, delete: false },
         reports: { create: true, read: true, update: false, delete: false },
         settings: { create: false, read: true, update: true, delete: false },
         products: { create: true, read: true, update: true, delete: true },
      },
    },
  });


  console.log('Seeded roles');

  // Seed Loan Providers and Products
  const nibBank = await prisma.loanProvider.create({
    data: {
      name: 'NIb Bank',
      icon: 'Building2',
      colorHex: '#fdb913',
      displayOrder: 1,
      products: {
        create: [
          {
            name: 'Quick Cash Loan',
            description: 'Instant cash for emergencies.',
            icon: 'PersonStanding',
            minLoan: 500,
            maxLoan: 2500,
            serviceFee: '3%',
            dailyFee: '0.2%',
            penaltyFee: '0.11% daily',
            status: 'Active',
          },
          {
            name: 'Gadget Financing',
            description: 'Upgrade your devices with easy financing.',
            icon: 'Home',
            minLoan: 300,
            maxLoan: 1500,
            serviceFee: '3%',
            dailyFee: '0.2%',
            penaltyFee: '0.11% daily',
            status: 'Active',
          },
        ],
      },
    },
    include: {
      products: true,
    },
  });

  const capitalBank = await prisma.loanProvider.create({
    data: {
      name: 'Capital Bank',
      icon: 'Building2',
      colorHex: '#2563eb',
      displayOrder: 2,
      products: {
        create: [
          {
            name: 'Personal Loan',
            description: 'Flexible personal loans for your needs.',
            icon: 'PersonStanding',
            minLoan: 400,
            maxLoan: 2000,
            serviceFee: '3%',
            dailyFee: '0.2%',
            penaltyFee: '0.11% daily',
            status: 'Active',
          },
          {
            name: 'Home Improvement Loan',
            description: 'Finance your home renovation projects.',
            icon: 'Home',
            minLoan: 10000,
            maxLoan: 50000,
            serviceFee: '3%',
            dailyFee: '0.2%',
            penaltyFee: '0.11% daily',
            status: 'Disabled',
          },
        ],
      },
    },
  });

  const providusFinancial = await prisma.loanProvider.create({
    data: {
      name: 'Providus Financial',
      icon: 'Landmark',
      colorHex: '#16a34a',
      displayOrder: 3,
      products: {
        create: [
          {
            name: 'Startup Business Loan',
            description: 'Kickstart your new business venture.',
            icon: 'Briefcase',
            minLoan: 5000,
            maxLoan: 100000,
            serviceFee: '3%',
            dailyFee: '0.2%',
            penaltyFee: '0.11% daily',
            status: 'Active',
          },
          {
            name: 'Personal Auto Loan',
            description: 'Get behind the wheel of your new car.',
            icon: 'PersonStanding',
            minLoan: 2000,
            maxLoan: 30000,
            serviceFee: '3%',
            dailyFee: '0.2%',
            penaltyFee: '0.11% daily',
            status: 'Active',
          },
        ],
      },
    },
  });

  console.log('Seeded loan providers and products');
  
  // Seed Users
  await prisma.user.create({
    data: {
      fullName: 'Super Admin',
      email: 'superadmin@loanflow.com',
      phoneNumber: '0912345678',
      password: await bcrypt.hash('Admin@123', salt),
      status: 'Active',
      roleName: superAdminRole.name,
    },
  });

  await prisma.user.create({
    data: {
      fullName: 'John Provider',
      email: 'john.p@capitalbank.com',
      phoneNumber: '0987654321',
      password: await bcrypt.hash('Password123', salt),
      status: 'Active',
      roleName: loanProviderRole.name,
      providerId: capitalBank.id,
    },
  });
  
  await prisma.user.create({
    data: {
      fullName: 'Jane Officer',
      email: 'jane.o@providus.com',
      phoneNumber: '5555555555',
      password: await bcrypt.hash('Password123', salt),
      status: 'Inactive',
      roleName: loanProviderRole.name,
      providerId: providusFinancial.id,
    },
  });
  
  console.log('Seeded users');

  // Seed Loan History
  const quickCashLoanProduct = nibBank.products.find(p => p.name === 'Quick Cash Loan');
  if (quickCashLoanProduct) {
    const loan = await prisma.loanDetails.create({
      data: {
        providerId: nibBank.id,
        productId: quickCashLoanProduct.id,
        loanAmount: 500,
        serviceFee: 15,
        interestRate: 0.2,
        disbursedDate: new Date('2024-06-25'),
        dueDate: new Date('2024-07-25'),
        penaltyAmount: 0.11,
        repaymentStatus: 'Paid',
        repaidAmount: 545.96,
      },
    });

    await prisma.payment.create({
      data: {
        loanId: loan.id,
        amount: 545.96,
        date: new Date('2024-07-20'),
        outstandingBalanceBeforePayment: 545.96,
      },
    });
  }

  console.log('Seeded loan history');
  
  // Seed Scoring Parameters
  await prisma.scoringParameter.create({
    data: {
      providerId: nibBank.id,
      name: 'Age',
      weight: 20,
      rules: {
        create: [
          { field: 'age', condition: '>=', value: '35', score: 20 },
          { field: 'age', condition: '<', value: '25', score: 5 },
        ],
      },
    },
  });
  await prisma.scoringParameter.create({
    data: {
      providerId: nibBank.id,
      name: 'Loan History',
      weight: 30,
      rules: {
        create: [
          { field: 'onTimeRepayments', condition: '>', value: '5', score: 30 },
          { field: 'loanHistoryCount', condition: '<', value: '1', score: 10 },
        ],
      },
    },
  });
  await prisma.scoringParameter.create({
    data: {
      providerId: nibBank.id,
      name: 'Income Level',
      weight: 50,
      rules: {
        create: [
          { field: 'monthlyIncome', condition: '>', value: '5000', score: 40 },
          { field: 'monthlyIncome', condition: '<=', value: '2000', score: 15 },
        ],
      },
    },
  });

  console.log('Seeded scoring parameters');

  console.log(`Seeding finished.`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
