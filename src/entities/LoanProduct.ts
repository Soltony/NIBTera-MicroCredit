
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
import { IsNotEmpty, Length, IsNumber, IsBoolean, IsOptional, IsString } from 'class-validator';
import type { LoanProvider } from './LoanProvider';
import type { LoanDetails } from './LoanDetails';
import type { DataProvisioningConfig } from './DataProvisioningConfig';
import type { LoanAmountTier } from './LoanAmountTier';


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

  @Column({ type: 'number', name: 'min_loan', precision: 10, scale: 2, default: 0 })
  @IsNumber()
  minLoan!: number;

  @Column({ type: 'number', name: 'max_loan', precision: 10, scale: 2, default: 0 })
  @IsNumber()
  maxLoan!: number;

  // Store complex rules as JSON strings in CLOB
  @Column({ type: 'clob', name: 'service_fee', default: '{}' })
  serviceFee!: string;

  @Column({ type: 'clob', name: 'daily_fee', default: '{}' })
  dailyFee!: string;

  @Column({ type: 'clob', name: 'penalty_rules', default: '[]' })
  penaltyRules!: string;

  @Column({ type: 'varchar2', length: 50 })
  status!: string;
  
  @Column({ type: 'number', precision: 1, scale: 0, default: 0, name: 'service_fee_enabled' })
  @IsBoolean()
  serviceFeeEnabled!: boolean;

  @Column({ type: 'number', precision: 1, scale: 0, default: 0, name: 'daily_fee_enabled' })
  @IsBoolean()
  dailyFeeEnabled!: boolean;

  @Column({ type: 'number', precision: 1, scale: 0, default: 0, name: 'penalty_rules_enabled' })
  @IsBoolean()
  penaltyRulesEnabled!: boolean;

  @Column({ type: 'number', precision: 1, scale: 0, name: 'data_provisioning_enabled', nullable: true, default: 0 })
  dataProvisioningEnabled?: boolean;

  @Column({ type: 'number', name: 'data_provisioning_config_id', nullable: true })
  dataProvisioningConfigId?: number | null;

  @ManyToOne('DataProvisioningConfig', { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'data_provisioning_config_id' })
  dataProvisioningConfig?: DataProvisioningConfig;

  @Column({ name: 'provider_id' })
  providerId!: number;

  @ManyToOne('LoanProvider', (provider: LoanProvider) => provider.products)
  @JoinColumn({ name: 'provider_id' })
  provider!: LoanProvider;

  @OneToMany('LoanDetails', (loan: LoanDetails) => loan.product)
  loans!: LoanDetails[];
  
  @OneToMany('LoanAmountTier', (tier: LoanAmountTier) => tier.product)
  loanAmountTiers!: LoanAmountTier[];

  @CreateDateColumn({ type: 'timestamp', name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamp', name: 'updated_at' })
  updatedAt!: Date;
}
