
import 'reflect-metadata';
import 'dotenv/config';
import { DataSource, type DataSourceOptions } from 'typeorm';

const dataSourceOptions: DataSourceOptions = {
  type: 'oracle' as const,
  connectString: process.env.ORACLE_DB_CONNECT_STRING,
  username: process.env.ORACLE_DB_USER,
  password: process.env.ORACLE_DB_PASSWORD,
  synchronize: false, // This MUST be false for safety
  logging: process.env.NODE_ENV === 'development',
  // Use glob pattern to discover entities. This is the most robust method for Next.js production builds.
  entities: [__dirname + '/entities/**/*.js', __dirname + '/entities/**/*.ts'],
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
