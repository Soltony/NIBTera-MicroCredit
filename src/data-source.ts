
import 'reflect-metadata';
import 'dotenv/config';
import { DataSource, type DataSourceOptions } from 'typeorm';
import { User, User as UserEntity } from '@/entities/User';
import { Role, Role as RoleEntity } from '@/entities/Role';
import { LoanProvider, LoanProvider as LoanProviderEntity } from '@/entities/LoanProvider';
import { LoanProduct, LoanProduct as LoanProductEntity } from '@/entities/LoanProduct';
import { LoanDetails, LoanDetails as LoanDetailsEntity } from '@/entities/LoanDetails';
import { Payment, Payment as PaymentEntity } from '@/entities/Payment';
import { ScoringParameter, ScoringParameter as ScoringParameterEntity } from '@/entities/ScoringParameter';
import { ScoringParameterRule, ScoringParameterRule as ScoringParameterRuleEntity } from '@/entities/ScoringParameterRule';
import { ScoringConfigurationHistory, ScoringConfigurationHistory as ScoringConfigurationHistoryEntity } from '@/entities/ScoringConfigurationHistory';
import { Customer, Customer as CustomerEntity } from '@/entities/Customer';
import { CustomParameter, CustomParameter as CustomParameterEntity } from '@/entities/CustomParameter';

const dataSourceOptions: DataSourceOptions = {
  type: 'oracle' as const,
  connectString: process.env.ORACLE_DB_CONNECT_STRING,
  username: process.env.ORACLE_DB_USER,
  password: process.env.ORACLE_DB_PASSWORD,
  synchronize: false, // This MUST be false for safety
  logging: process.env.NODE_ENV === 'development',
  entities: [
    UserEntity,
    RoleEntity,
    LoanProviderEntity,
    LoanProductEntity,
    LoanDetailsEntity,
    PaymentEntity,
    ScoringParameterEntity,
    ScoringParameterRuleEntity,
    ScoringConfigurationHistoryEntity,
    CustomerEntity,
    CustomParameterEntity,
  ],
  migrations: [],
  subscribers: [],
};

// This is the correct way to implement a singleton in a serverless environment.
// We cache the DataSource instance and the promise to initialize it.
// This prevents race conditions where multiple requests try to initialize at once.

let dataSource: DataSource | null = null;
let dataSourcePromise: Promise<DataSource> | null = null;

async function initializeDataSource(): Promise<DataSource> {
    const ds = new DataSource(dataSourceOptions);
    try {
        await ds.initialize();
        console.log('Database connection initialized successfully.');
        dataSource = ds;
        return ds;
    } catch (error) {
        console.error("FATAL: Error during Data Source initialization:", error);
        dataSourcePromise = null; // Reset promise on failure to allow retry
        throw error;
    }
}

export async function getConnectedDataSource(): Promise<DataSource> {
  if (dataSource) {
    // If the data source is already initialized and cached, return it
    return dataSource;
  }

  if (!dataSourcePromise) {
    // If there's no ongoing initialization, start one
    dataSourcePromise = initializeDataSource();
  }

  // Await the ongoing initialization promise
  // This handles concurrent requests safely
  return await dataSourcePromise;
}

// We no longer export the instance directly to enforce using the async getter
// export const AppDataSource = AppDataSourceInstance;
