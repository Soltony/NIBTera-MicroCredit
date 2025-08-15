
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
import { IsNumber, IsDate, IsNotEmpty } from 'class-validator';
import { LoanProvider } from './LoanProvider';
import { LoanProduct } from './LoanProduct';
import type { Payment } from './Payment';

@Entity({ name: 'loan_details' })
export class LoanDetails {
  @PrimaryGeneratedColumn('increment', { name: 'id' })
  id!: number;

  @Column({ name: 'provider_id' })
  providerId!: number;

  @ManyToOne(() => LoanProvider, (provider) => provider.loans)
  @JoinColumn({ name: 'provider_id' })
  provider!: LoanProvider;

  @Column({ name: 'product_id' })
  productId!: number;

  @ManyToOne(() => LoanProduct, (product) => product.loans)
  @JoinColumn({ name: 'product_id' })
  product!: LoanProduct;

  @Column({ type: 'number', name: 'loan_amount', precision: 10, scale: 2 })
  @IsNumber()
  loanAmount!: number;

  @Column({ type: 'number', name: 'service_fee', precision: 10, scale: 2 })
  @IsNumber()
  serviceFee!: number;

  @Column({ type: 'date', name: 'disbursed_date' })
  @IsDate()
  disbursedDate!: Date;

  @Column({ type: 'date', name: 'due_date' })
  @IsDate()
  dueDate!: Date;

  @Column({ type: 'varchar2', length: 50, name: 'repayment_status' })
  @IsNotEmpty()
  repaymentStatus!: string;

  @Column({ type: 'number', name: 'repaid_amount', precision: 10, scale: 2, nullable: true })
  repaidAmount!: number | null;

  @OneToMany('Payment', (payment: Payment) => payment.loan)
  payments!: Payment[];

  @CreateDateColumn({ type: 'timestamp', name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamp', name: 'updated_at' })
  updatedAt!: Date;
}
