
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Unique,
} from 'typeorm';
import { IsNotEmpty, Length } from 'class-validator';
import { LoanProvider as LoanProviderEntity } from './LoanProvider';
import type { LoanProvider } from './LoanProvider';


@Entity({ name: 'custom_parameters' })
@Unique(['providerId', 'name'])
export class CustomParameter {
  @PrimaryGeneratedColumn('increment', { name: 'id' })
  id!: number;

  @Column({ type: 'varchar2', length: 255 })
  @IsNotEmpty()
  @Length(2, 255)
  name!: string;
  
  @Column({ name: 'provider_id' })
  providerId!: number;

  @ManyToOne(() => LoanProviderEntity, (provider: LoanProvider) => provider.customParameters)
  @JoinColumn({ name: 'provider_id' })
  provider!: LoanProvider;

  @CreateDateColumn({ type: 'timestamp', name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamp', name: 'updated_at' })
  updatedAt!: Date;
}
