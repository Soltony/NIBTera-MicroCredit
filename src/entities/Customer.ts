
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { IsNumber, IsNotEmpty, IsEnum, IsOptional, IsString } from 'class-validator';
import type { ProvisionedData } from './ProvisionedData';

@Entity({ name: 'customers' })
export class Customer {
  @PrimaryGeneratedColumn('increment', { name: 'id' })
  ID!: number;

  @Column({ type: 'varchar2', length: 255, unique: true })
  @IsNotEmpty()
  PHONE_NUMBER!: string;
  
  @Column({ type: 'varchar2', length: 255, unique: true, nullable: true })
  @IsOptional()
  @IsString()
  NATIONAL_ID?: string;

  @Column({ type: 'number' })
  @IsNumber()
  AGE!: number;

  @Column({ type: 'number', name: 'monthly_income', precision: 10, scale: 2 })
  @IsNumber()
  MONTHLY_INCOME!: number;

  @Column({ type: 'clob', name: 'transaction_history' })
  @IsNotEmpty()
  TRANSACTION_HISTORY!: string; // Stored as JSON string

  @Column({ type: 'varchar2', length: 50 })
  @IsEnum(['Male', 'Female', 'Other'])
  GENDER!: string;

  @Column({ type: 'clob', name: 'loan_history' })
  @IsNotEmpty()
  LOAN_HISTORY!: string; // Stored as JSON string

  @Column({ type: 'varchar2', length: 255, name: 'education_level' })
  @IsNotEmpty()
  EDUCATION_LEVEL!: string;

  @OneToMany('ProvisionedData', (data: ProvisionedData) => data.customer)
  provisionedDataEntries!: ProvisionedData[];

  @CreateDateColumn({ type: 'timestamp', name: 'created_at' })
  CREATED_AT!: Date;

  @UpdateDateColumn({ type: 'timestamp', name: 'updated_at' })
  UPDATED_AT!: Date;
}
