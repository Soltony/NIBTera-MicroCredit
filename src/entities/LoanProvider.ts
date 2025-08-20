
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { IsNotEmpty, Length, IsBoolean } from 'class-validator';
import type { User } from './User';
import type { LoanProduct } from './LoanProduct';
import type { LoanDetails } from './LoanDetails';
import type { ScoringParameter } from './ScoringParameter';
import type { ScoringConfigurationHistory } from './ScoringConfigurationHistory';
import type { CustomParameter } from './CustomParameter';
import type { DataProvisioningConfig } from './DataProvisioningConfig';

@Entity({ name: 'loan_providers' })
export class LoanProvider {
  @PrimaryGeneratedColumn('increment', { name: 'id' })
  id!: number;

  @Column({ type: 'varchar2', length: 255 })
  @IsNotEmpty()
  @Length(2, 255)
  name!: string;

  @Column({ type: 'clob', nullable: true })
  icon!: string;

  @Column({ type: 'varchar2', length: 50, name: 'color_hex' })
  colorHex!: string;

  @Column({ type: 'number', name: 'display_order', default: 0 })
  displayOrder!: number;

  @Column({ type: 'number', precision: 1, scale: 0, name: 'allow_multiple_active_loans', default: 1 })
  allowMultipleActiveLoans!: number;

  @OneToMany('User', (user: User) => user.provider)
  users!: User[];

  @OneToMany('LoanProduct', (product: LoanProduct) => product.provider)
  products!: LoanProduct[];

  @OneToMany('LoanDetails', (loan: LoanDetails) => loan.provider)
  loans!: LoanDetails[];

  @OneToMany('ScoringParameter', (parameter: ScoringParameter) => parameter.provider)
  scoringParameters!: ScoringParameter[];

  @OneToMany(
    'ScoringConfigurationHistory',
    (history: ScoringConfigurationHistory) => history.provider
  )
  scoringConfigurationHistory!: ScoringConfigurationHistory[];
  
  @OneToMany('CustomParameter', (parameter: CustomParameter) => parameter.provider)
  customParameters!: CustomParameter[];

  @OneToMany('DataProvisioningConfig', (config: DataProvisioningConfig) => config.provider)
  dataProvisioningConfigs!: DataProvisioningConfig[];

  @CreateDateColumn({ type: 'timestamp', name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamp', name: 'updated_at' })
  updatedAt!: Date;
}
