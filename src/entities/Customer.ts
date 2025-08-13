
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { IsNumber, IsNotEmpty, IsEnum } from 'class-validator';

@Entity({ name: 'customers' })
export class Customer {
  @PrimaryGeneratedColumn('increment', { name: 'id' })
  id!: number;

  @Column({ type: 'number' })
  @IsNumber()
  age!: number;

  @Column({ type: 'number', name: 'monthly_salary', precision: 10, scale: 2 })
  @IsNumber()
  monthlySalary!: number;

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

  @CreateDateColumn({ type: 'timestamp', name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamp', name: 'updated_at' })
  updatedAt!: Date;
}
