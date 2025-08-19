
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { IsNotEmpty, IsNumber } from 'class-validator';
import type { DataProvisioningConfig } from './DataProvisioningConfig';
import type { User } from './User';

@Entity({ name: 'data_provisioning_uploads' })
export class DataProvisioningUpload {
  @PrimaryGeneratedColumn('increment', { name: 'id' })
  id!: number;

  @Column({ name: 'config_id' })
  configId!: number;

  @ManyToOne('DataProvisioningConfig', (config: DataProvisioningConfig) => config.uploads)
  @JoinColumn({ name: 'config_id' })
  config!: DataProvisioningConfig;

  @Column({ name: 'file_name', type: 'varchar2', length: 255 })
  @IsNotEmpty()
  fileName!: string;

  @Column({ name: 'row_count', type: 'number' })
  @IsNumber()
  rowCount!: number;

  @Column({ name: 'uploaded_by_user_id' })
  uploadedByUserId!: number;

  @ManyToOne('User', (user: User) => user.dataProvisioningUploads)
  @JoinColumn({ name: 'uploaded_by_user_id' })
  uploadedByUser!: User;

  @CreateDateColumn({ type: 'timestamp', name: 'uploaded_at' })
  uploadedAt!: Date;
}
