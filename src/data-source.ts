
import 'reflect-metadata';
import 'dotenv/config';
import { DataSource } from 'typeorm';
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

const dataSourceOptions = {
  type: 'oracle' as const,
  connectString: process.env.ORACLE_DB_CONNECT_STRING,
  username: process.env.ORACLE_DB_USER,
  password: process.env.ORACLE_DB_PASSWORD,
  synchronize: false, // This MUST be false for safety
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
    CustomParameter,
  ],
  migrations: [],
  subscribers: [],
};

// Singleton pattern to manage the DataSource instance
class DataSourceManager {
  private static instance: DataSource;

  private constructor() {}

  public static getInstance(): DataSource {
    if (!DataSourceManager.instance) {
      DataSourceManager.instance = new DataSource(dataSourceOptions);
    }
    return DataSourceManager.instance;
  }
}

export const AppDataSource = DataSourceManager.getInstance();

export async function getConnectedDataSource(): Promise<DataSource> {
  if (AppDataSource.isInitialized) {
    return AppDataSource;
  }
  try {
    return await AppDataSource.initialize();
  } catch (error) {
    console.error("Error during Data Source initialization:", error)
    throw error;
  }
}
