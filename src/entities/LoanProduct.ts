
'use server';
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  OneToMany,
} from 'typeorm';
import { IsNotEmpty, Length, IsNumber } from 'class-validator';
import { LoanProvider } from './LoanProvider';
import type { LoanDetails } from './LoanDetails';

@Entity({ name: 'loan_products' })
export class LoanProduct {
  @PrimaryGeneratedColumn('increment', { name: 'id' })
  id!: number;

  @Column({ type: 'varchar2', length: 255 })
  @IsNotEmpty()
  @Length(2, 255)
  name!: string;

  @Column({ type: 'varchar2', length: 1000 })
  description!: string;

  @Column({ type: 'clob', nullable: true })
  icon!: string;

  @Column({ type: 'number', name: 'min_loan', precision: 10, scale: 2 })
  @IsNumber()
  minLoan!: number;

  @Column({ type: 'number', name: 'max_loan', precision: 10, scale: 2 })
  @IsNumber()
  maxLoan!: number;

  @Column({ type: 'varchar2', length: 50, name: 'service_fee' })
  serviceFee!: string;

  @Column({ type: 'varchar2', length: 50, name: 'daily_fee' })
  dailyFee!: string;

  @Column({ type: 'varchar2', length: 50, name: 'penalty_fee' })
  penaltyFee!: string;

  @Column({ type: 'varchar2', length: 50 })
  status!: string;

  @Column({ name: 'provider_id' })
  providerId!: number;

  @ManyToOne(() => LoanProvider, (provider) => provider.products)
  @JoinColumn({ name: 'provider_id' })
  provider!: LoanProvider;

  @OneToMany('LoanDetails', (loan) => loan.product)
  loans!: LoanDetails[];

  @CreateDateColumn({ type: 'timestamp', name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamp', name: 'updated_at' })
  updatedAt!: Date;
}
