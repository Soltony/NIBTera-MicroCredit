
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { IsNotEmpty, Length } from 'class-validator';
import { User as UserEntity } from './User';
import type { User } from './User';
import { LoanProduct as LoanProductEntity } from './LoanProduct';
import type { LoanProduct } from './LoanProduct';
import { LoanDetails as LoanDetailsEntity } from './LoanDetails';
import type { LoanDetails } from './LoanDetails';
import { ScoringParameter as ScoringParameterEntity } from './ScoringParameter';
import type { ScoringParameter } from './ScoringParameter';
import { ScoringConfigurationHistory as ScoringConfigurationHistoryEntity } from './ScoringConfigurationHistory';
import type { ScoringConfigurationHistory } from './ScoringConfigurationHistory';
import { CustomParameter as CustomParameterEntity } from './CustomParameter';
import type { CustomParameter } from './CustomParameter';


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

  @OneToMany(() => UserEntity, (user: User) => user.provider)
  users!: User[];

  @OneToMany(() => LoanProductEntity, (product: LoanProduct) => product.provider)
  products!: LoanProduct[];

  @OneToMany(() => LoanDetailsEntity, (loan: LoanDetails) => loan.provider)
  loans!: LoanDetails[];

  @OneToMany(() => ScoringParameterEntity, (parameter: ScoringParameter) => parameter.provider)
  scoringParameters!: ScoringParameter[];

  @OneToMany(
    () => ScoringConfigurationHistoryEntity,
    (history: ScoringConfigurationHistory) => history.provider
  )
  scoringConfigurationHistory!: ScoringConfigurationHistory[];
  
  @OneToMany(() => CustomParameterEntity, (parameter: CustomParameter) => parameter.provider)
  customParameters!: CustomParameter[];

  @CreateDateColumn({ type: 'timestamp', name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamp', name: 'updated_at' })
  updatedAt!: Date;
}
