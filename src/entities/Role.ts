
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  Index,
} from 'typeorm';
import { IsNotEmpty, Length } from 'class-validator';
import type { User } from './User';

@Entity({ name: 'roles' })
export class Role {
  @PrimaryGeneratedColumn('increment', { name: 'id' })
  id!: number;

  @Column({ type: 'varchar2', length: 255, unique: true })
  @IsNotEmpty()
  @Length(2, 255)
  name!: string;

  @Column({ type: 'clob' }) // Using CLOB for potentially large JSON objects
  permissions!: string; // Stored as a JSON string

  @OneToMany(() => User, (user) => user.role)
  users!: User[];

  @CreateDateColumn({ type: 'timestamp', name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamp', name: 'updated_at' })
  updatedAt!: Date;
}
