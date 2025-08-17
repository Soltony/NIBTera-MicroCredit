
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { IsNumber, IsNotEmpty } from 'class-validator';
import { ScoringParameter as ScoringParameterEntity } from './ScoringParameter';
import type { ScoringParameter } from './ScoringParameter';


@Entity({ name: 'scoring_parameter_rules' })
export class ScoringParameterRule {
  @PrimaryGeneratedColumn('increment', { name: 'id' })
  id!: number;

  @Column({ name: 'parameter_id' })
  parameterId!: number;

  @ManyToOne(() => ScoringParameterEntity, (parameter) => parameter.rules, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'parameter_id' })
  parameter!: ScoringParameter;

  @Column({ type: 'varchar2', length: 255 })
  @IsNotEmpty()
  field!: string;

  @Column({ type: 'varchar2', length: 50 })
  @IsNotEmpty()
  condition!: string;

  @Column({ type: 'varchar2', length: 255 })
  @IsNotEmpty()
  value!: string;

  @Column({ type: 'number' })
  @IsNumber()
  score!: number;

  @CreateDateColumn({ type: 'timestamp', name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamp', name: 'updated_at' })
  updatedAt!: Date;
}
