
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Unique,
  OneToMany,
} from 'typeorm';
import { IsNotEmpty, Length } from 'class-validator';
import type { LoanProvider } from './LoanProvider';
import type { LoanProduct } from './LoanProduct';


@Entity({ name: 'data_provisioning_configs' })
@Unique(['providerId', 'name'])
export class DataProvisioningConfig {
  @PrimaryGeneratedColumn('increment', { name: 'id' })
  id!: number;

  @Column({ name: 'provider_id' })
  providerId!: number;

  @ManyToOne('LoanProvider', (provider: LoanProvider) => provider.dataProvisioningConfigs)
  @JoinColumn({ name: 'provider_id' })
  provider!: LoanProvider;

  @Column({ type: 'varchar2', length: 255 })
  @IsNotEmpty()
  @Length(2, 255)
  name!: string;
  
  @Column({ type: 'clob' })
  columns!: string; // Stored as JSON string: [{ id: string, name: string, type: 'string'|'number'|'date' }]

  @OneToMany('LoanProduct', (product: LoanProduct) => product.dataProvisioningConfig)
  loanProducts!: LoanProduct[];

  @CreateDateColumn({ type: 'timestamp', name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamp', name: 'updated_at' })
  updatedAt!: Date;
}
