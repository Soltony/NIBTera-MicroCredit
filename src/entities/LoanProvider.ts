
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { IsNotEmpty, Length } from 'class-validator';
import { User } from './User';
import { LoanProduct } from './LoanProduct';
import { LoanDetails } from './LoanDetails';
import { ScoringParameter } from './ScoringParameter';
import { ScoringConfigurationHistory } from './ScoringConfigurationHistory';
import { CustomParameter } from './CustomParameter';

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

  @OneToMany(() => User, (user: User) => user.provider)
  users!: User[];

  @OneToMany(() => LoanProduct, (product: LoanProduct) => product.provider)
  products!: LoanProduct[];

  @OneToMany(() => LoanDetails, (loan: LoanDetails) => loan.provider)
  loans!: LoanDetails[];

  @OneToMany(() => ScoringParameter, (parameter: ScoringParameter) => parameter.provider)
  scoringParameters!: ScoringParameter[];

  @OneToMany(
    () => ScoringConfigurationHistory,
    (history: ScoringConfigurationHistory) => history.provider
  )
  scoringConfigurationHistory!: ScoringConfigurationHistory[];
  
  @OneToMany(() => CustomParameter, (parameter: CustomParameter) => parameter.provider)
  customParameters!: CustomParameter[];

  @CreateDateColumn({ type: 'timestamp', name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamp', name: 'updated_at' })
  updatedAt!: Date;
}
