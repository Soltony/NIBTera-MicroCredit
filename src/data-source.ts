
import 'reflect-metadata';
import 'dotenv/config';
import { DataSource } from 'typeorm';
import { User } from './entities/User';
import { Role } from './entities/Role';
import { LoanProvider } from './entities/LoanProvider';
import { LoanProduct } from './entities/LoanProduct';
import { LoanDetails } from './entities/LoanDetails';
import { Payment } from './entities/Payment';
import { ScoringParameter } from './entities/ScoringParameter';
import { ScoringParameterRule } from './entities/ScoringParameterRule';
import { ScoringConfigurationHistory } from './entities/ScoringConfigurationHistory';
import { Customer } from './entities/Customer';

export const AppDataSource = new DataSource({
  type: 'oracle',
  connectString: process.env.ORACLE_DB_CONNECT_STRING,
  username: process.env.ORACLE_DB_USER,
  password: process.env.ORACLE_DB_PASSWORD,
  synchronize: false, // Set to false for production and manual seeding
  logging: process.env.NODE_ENV === 'development',
  entities: [
    User,
    Role,
    LoanProvider,
    LoanProduct,
    LoanDetails,
    Payment,
    ScoringParameter,
    ScoringParameterRule,
    ScoringConfigurationHistory,
    Customer,
  ],
  migrations: [],
  subscribers: [],
});
