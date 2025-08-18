
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  ManyToMany,
  JoinTable,
} from 'typeorm';
import { LoanProvider } from './LoanProvider';
import { LoanProduct } from './LoanProduct';

@Entity({ name: 'scoring_configuration_history' })
export class ScoringConfigurationHistory {
  @PrimaryGeneratedColumn('increment', { name: 'id' })
  id!: number;

  @Column({ name: 'provider_id' })
  providerId!: number;

  @ManyToOne(() => LoanProvider, (provider: LoanProvider) => provider.scoringConfigurationHistory)
  @JoinColumn({ name: 'provider_id' })
  provider!: LoanProvider;

  @Column({ type: 'clob' })
  parameters!: string; // Stored as a JSON string

  @ManyToMany(() => LoanProduct)
  @JoinTable({
    name: '_scoring_config_history_to_products',
    joinColumn: {
      name: 'scoring_config_history_id',
      referencedColumnName: 'id',
    },
    inverseJoinColumn: {
      name: 'loan_product_id',
      referencedColumnName: 'id',
    },
  })
  appliedProducts!: LoanProduct[];

  @CreateDateColumn({ type: 'timestamp', name: 'saved_at' })
  savedAt!: Date;
}
