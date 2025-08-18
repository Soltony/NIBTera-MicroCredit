
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { IsNumber, IsDate } from 'class-validator';
import type { LoanDetails } from './LoanDetails';

@Entity({ name: 'payments' })
export class Payment {
  @PrimaryGeneratedColumn('increment', { name: 'id' })
  id!: number;

  @Column({ name: 'loan_id' })
  loanId!: number;

  @ManyToOne(() => LoanDetails, (loan) => loan.payments)
  @JoinColumn({ name: 'loan_id' })
  loan!: LoanDetails;

  @Column({ type: 'number', precision: 10, scale: 2 })
  @IsNumber()
  amount!: number;

  @Column({ type: 'date' })
  @IsDate()
  date!: Date;

  @Column({ type: 'number', name: 'outstanding_balance_before_payment', precision: 10, scale: 2 })
  @IsNumber()
  outstandingBalanceBeforePayment!: number;

  @CreateDateColumn({ type: 'timestamp', name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamp', name: 'updated_at' })
  updatedAt!: Date;
}
