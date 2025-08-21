
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
  id!: number;

  @Column({ type: 'varchar2', length: 255, name: 'phone_number', unique: true })
  @IsNotEmpty()
  phoneNumber!: string;
  
  @Column({ type: 'varchar2', length: 255, name: 'national_id', unique: true, nullable: true })
  @IsOptional()
  @IsString()
  nationalId?: string;

  @Column({ type: 'number' })
  @IsNumber()
  age!: number;

  @Column({ type: 'number', name: 'monthly_income', precision: 10, scale: 2 })
  @IsNumber()
  monthlyIncome!: number;

  @Column({ type: 'clob', name: 'transaction_history' })
  @IsNotEmpty()
  transactionHistory!: string; // Stored as JSON string

  @Column({ type: 'varchar2', length: 50 })
  @IsEnum(['Male', 'Female', 'Other'])
  gender!: string;

  @Column({ type: 'clob', name: 'loan_history' })
  @IsNotEmpty()
  loanHistory!: string; // Stored as JSON string

  @Column({ type: 'varchar2', length: 255, name: 'education_level' })
  @IsNotEmpty()
  educationLevel!: string;

  @OneToMany('ProvisionedData', (data: ProvisionedData) => data.customer)
  provisionedDataEntries!: ProvisionedData[];

  @CreateDateColumn({ type: 'timestamp', name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamp', name: 'updated_at' })
  updatedAt!: Date;
}
