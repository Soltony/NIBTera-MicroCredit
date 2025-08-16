
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
import { IsNumber, IsNotEmpty } from 'class-validator';
import { LoanProvider } from './LoanProvider';
import { ScoringParameterRule } from './ScoringParameterRule';

@Entity({ name: 'scoring_parameters' })
export class ScoringParameter {
  @PrimaryGeneratedColumn('increment', { name: 'id' })
  id!: number;

  @Column({ name: 'provider_id' })
  providerId!: number;

  @ManyToOne('LoanProvider', (provider: LoanProvider) => provider.scoringParameters)
  @JoinColumn({ name: 'provider_id' })
  provider!: LoanProvider;

  @Column({ type: 'varchar2', length: 255 })
  @IsNotEmpty()
  name!: string;

  @Column({ type: 'number' })
  @IsNumber()
  weight!: number;

  @OneToMany('ScoringParameterRule', (rule: ScoringParameterRule) => rule.parameter, {
    cascade: true,
  })
  rules!: ScoringParameterRule[];

  @CreateDateColumn({ type: 'timestamp', name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamp', name: 'updated_at' })
  updatedAt!: Date;
}
