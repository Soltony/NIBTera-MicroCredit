
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { IsNotEmpty, IsNumber, Min } from 'class-validator';
import type { LoanProvider } from './LoanProvider';

@Entity({ name: 'loan_amount_tiers' })
@Index(['providerId', 'fromScore'], { unique: true })
export class LoanAmountTier {
  @PrimaryGeneratedColumn('increment', { name: 'id' })
  id!: number;

  @Column({ name: 'provider_id' })
  providerId!: number;

  @ManyToOne('LoanProvider', (provider: LoanProvider) => provider.loanAmountTiers)
  @JoinColumn({ name: 'provider_id' })
  provider!: LoanProvider;

  @Column({ type: 'number', name: 'from_score' })
  @IsNumber()
  fromScore!: number;

  @Column({ type: 'number', name: 'to_score' })
  @IsNumber()
  toScore!: number;

  @Column({ type: 'number', name: 'loan_amount', precision: 12, scale: 2 })
  @IsNumber()
  @Min(0)
  loanAmount!: number;

  @CreateDateColumn({ type: 'timestamp', name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamp', name: 'updated_at' })
  updatedAt!: Date;
}
