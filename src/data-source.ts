
import 'reflect-metadata';
import 'dotenv/config';
import { DataSource, type DataSourceOptions } from 'typeorm';
import { User } from '@/entities/User';
import { Role } from '@/entities/Role';
import { LoanProvider } from '@/entities/LoanProvider';
import { LoanProduct } from '@/entities/LoanProduct';
import { LoanDetails } from '@/entities/LoanDetails';
import { Payment } from '@/entities/Payment';
import { ScoringParameter } from '@/entities/ScoringParameter';
import { ScoringParameterRule } from '@/entities/ScoringParameterRule';
import { ScoringConfigurationHistory } from '@/entities/ScoringConfigurationHistory';
import { Customer } from '@/entities/Customer';
import { CustomParameter } from '@/entities/CustomParameter';
import { DataProvisioningConfig } from '@/entities/DataProvisioningConfig';
import { LoanAmountTier } from '@/entities/LoanAmountTier';
import { DataProvisioningUpload } from '@/entities/DataProvisioningUpload';
import { ProvisionedData } from '@/entities/ProvisionedData';

const isDevelopment = process.env.NODE_ENV === 'development';

const dataSourceOptions: DataSourceOptions = {
  type: 'oracle' as const,
  connectString: process.env.ORACLE_DB_CONNECT_STRING,
  username: process.env.ORACLE_DB_USER,
  password: process.env.ORACLE_DB_PASSWORD,
  schema: process.env.ORACLE_DB_USER, // Explicitly set the schema to the username
  synchronize: true, // This will create the database schema on every application launch.
  dropSchema: true, // Add this line. This will drop the schema each time the app starts. USE WITH CAUTION.
  logging: isDevelopment,
  // Explicitly list all entities to ensure they are always found.
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
    CustomParameter,
    DataProvisioningConfig,
    LoanAmountTier,
    DataProvisioningUpload,
    ProvisionedData,
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
  if (dataSource && dataSource.isInitialized) {
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
