
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const permissions = {
  superAdmin: {
    users: { create: true, read: true, update: true, delete: true },
    roles: { create: true, read: true, update: true, delete: true },
    reports: { create: true, read: true, update: true, delete: true },
    settings: { create: true, read: true, update: true, delete: true },
    products: { create: true, read: true, update: true, delete: true },
  },
  loanProvider: {
    users: { create: false, read: true, update: false, delete: false },
    roles: { create: false, read: false, update: false, delete: false },
    reports: { create: true, read: true, update: false, delete: false },
    settings: { create: false, read: true, update: true, delete: false },
    products: { create: true, read: true, update: true, delete: true },
  },
};

async function main() {
  console.log('Start seeding...');

  // Seed Roles
  const superAdminRole = await prisma.role.upsert({
    where: { name: 'Super Admin' },
    update: {},
    create: {
      name: 'Super Admin',
      permissions: JSON.stringify(permissions.superAdmin),
    },
  });

  await prisma.role.upsert({
    where: { name: 'Loan Provider' },
    update: {},
    create: {
      name: 'Loan Provider',
      permissions: JSON.stringify(permissions.loanProvider),
    },
  });

  console.log('Roles seeded.');

  // Seed User
  const hashedPassword = await bcrypt.hash('password123', 10);
  await prisma.user.upsert({
    where: { email: 'admin@example.com' },
    update: {},
    create: {
      fullName: 'Super Admin',
      email: 'admin@example.com',
      phoneNumber: '0900000000',
      password: hashedPassword,
      status: 'Active',
      role: {
        connect: {
          name: 'Super Admin',
        }
      }
    },
  });
  console.log('Admin user seeded.');

  // Seed Loan Provider and Products
  const nibBank = await prisma.loanProvider.upsert({
    where: { name: 'NIb Bank' },
    update: {},
    create: {
      name: 'NIb Bank',
      icon: 'Landmark',
      colorHex: '#fdb913',
      displayOrder: 1,
      accountNumber: '1000123456789',
      allowCrossProviderLoans: true,
      allowMultipleProviderLoans: false,
    },
  });

  const personalLoan = await prisma.loanProduct.upsert({
    where: { name_providerId: { name: 'Personal Loan', providerId: nibBank.id } },
    update: {},
    create: {
      providerId: nibBank.id,
      name: 'Personal Loan',
      description: 'A personal loan for your everyday needs.',
      icon: 'PersonStanding',
      minLoan: 500,
      maxLoan: 50000,
      status: 'Active',
      serviceFeeEnabled: true,
      serviceFee: JSON.stringify({ type: 'percentage', value: 2 }),
      dailyFeeEnabled: true,
      dailyFee: JSON.stringify({ type: 'percentage', value: 0.1, calculationBase: 'principal' }),
      penaltyRulesEnabled: true,
      penaltyRules: JSON.stringify([
        { id: 'p1', fromDay: 1, toDay: 15, type: 'fixed', value: 50 },
        { id: 'p2', fromDay: 16, toDay: null, type: 'percentageOfPrincipal', value: 0.5 },
      ]),
    },
  });
  
  await prisma.loanAmountTier.createMany({
      data: [
          { productId: personalLoan.id, fromScore: 0, toScore: 300, loanAmount: 1000 },
          { productId: personalLoan.id, fromScore: 301, toScore: 500, loanAmount: 5000 },
          { productId: personalLoan.id, fromScore: 501, toScore: 700, loanAmount: 25000 },
          { productId: personalLoan.id, fromScore: 701, toScore: 1000, loanAmount: 50000 },
      ]
  });


  console.log('Loan Providers and Products seeded.');
  
  // Seed Customers
    await prisma.customer.upsert({
        where: { id: '1' },
        update: {},
        create: {
            id: '1',
            age: 35,
            gender: 'Male',
            monthlyIncome: 5000,
            educationLevel: 'Graduate',
            loanHistory: JSON.stringify({ totalLoans: 5, onTimeRepayments: 5 }),
        },
    });

    await prisma.customer.upsert({
        where: { id: '2' },
        update: {},
        create: {
            id: '2',
            age: 28,
            gender: 'Female',
            monthlyIncome: 3000,
            educationLevel: 'High School',
            loanHistory: JSON.stringify({ totalLoans: 2, onTimeRepayments: 1 }),
        },
    });
    console.log('Customers seeded.');


  console.log('Seeding finished.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
