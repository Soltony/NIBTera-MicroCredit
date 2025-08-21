
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
  OneToMany,
} from 'typeorm';
import { IsNumber, IsNotEmpty, Min, IsString } from 'class-validator';
import type { LoanProvider } from './LoanProvider';
import type { ScoringParameterRule } from './ScoringParameterRule';

@Entity({ name: 'scoring_parameters' })
@Index(['providerId', 'name'], { unique: true })
export class ScoringParameter {
  @PrimaryGeneratedColumn('increment', { name: 'id' })
  id!: number;

  @Column({ name: 'provider_id' })
  providerId!: number;

  @ManyToOne('LoanProvider', (provider: LoanProvider) => provider.scoringParameters, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'provider_id' })
  provider!: LoanProvider;

  @Column({ type: 'varchar2', length: 255 })
  @IsNotEmpty()
  @IsString()
  name!: string;
  
  @Column({ type: 'number', default: 0 })
  @IsNumber()
  @Min(0)
  weight!: number;

  @OneToMany('ScoringParameterRule', (rule: ScoringParameterRule) => rule.parameter, { cascade: true, eager: true })
  rules!: ScoringParameterRule[];

  @CreateDateColumn({ type: 'timestamp', name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamp', name: 'updated_at' })
  updatedAt!: Date;
}
