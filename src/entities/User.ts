
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { IsEmail, IsNotEmpty, Length } from 'class-validator';
import type { Role } from './Role';
import type { LoanProvider } from './LoanProvider';

@Entity({ name: 'users' })
export class User {
  @PrimaryGeneratedColumn('increment', { name: 'id' })
  id!: number;

  @Column({ type: 'varchar2', length: 255, name: 'full_name' })
  @IsNotEmpty()
  @Length(2, 255)
  fullName!: string;

  @Column({ type: 'varchar2', length: 255, unique: true })
  @IsEmail()
  email!: string;

  @Column({ type: 'varchar2', length: 255, unique: true, name: 'phone_number' })
  @Length(10, 20)
  phoneNumber!: string;

  @Column({ type: 'varchar2', length: 255, nullable: true })
  password?: string;

  @Column({ type: 'varchar2', length: 50 })
  status!: string;

  @Column({ name: 'role_name' })
  roleName!: string;

  @ManyToOne(() => 'Role', (role: Role) => role.users, { eager: true })
  @JoinColumn({ name: 'role_name', referencedColumnName: 'name' })
  role!: Role;

  @Column({ type: 'number', nullable: true, name: 'provider_id' })
  providerId!: number | null;

  @ManyToOne(() => 'LoanProvider', (provider: LoanProvider) => provider.users, { nullable: true })
  @JoinColumn({ name: 'provider_id' })
  provider!: LoanProvider;

  @CreateDateColumn({ type: 'timestamp', name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamp', name: 'updated_at' })
  updatedAt!: Date;
}
