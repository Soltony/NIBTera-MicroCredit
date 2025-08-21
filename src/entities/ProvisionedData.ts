
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import type { DataProvisioningUpload } from './DataProvisioningUpload';
import type { Customer } from './Customer';

@Entity({ name: 'provisioned_data' })
@Index(['customerId', 'uploadId'], { unique: true })
export class ProvisionedData {
  @PrimaryGeneratedColumn('increment', { name: 'id' })
  id!: number;

  @Column({ name: 'upload_id' })
  uploadId!: number;

  @ManyToOne('DataProvisioningUpload', (upload: DataProvisioningUpload) => upload.provisionedData, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'upload_id' })
  upload!: DataProvisioningUpload;

  @Column({ name: 'customer_id' })
  customerId!: number;

  @ManyToOne('Customer', (customer: Customer) => customer.provisionedDataEntries, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'customer_id' })
  customer!: Customer;

  @Column({ type: 'clob' })
  data!: string; // Stored as JSON string: { "Header 1": "value1", "Header 2": "value2", ... }

  @CreateDateColumn({ type: 'timestamp', name: 'created_at' })
  createdAt!: Date;
}
