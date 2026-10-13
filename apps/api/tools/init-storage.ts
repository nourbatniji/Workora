// Local/CI provisioning only. Never called by an upload request.
import 'dotenv/config';
import {
  CreateBucketCommand,
  DeleteBucketPolicyCommand,
  HeadBucketCommand,
} from '@aws-sdk/client-s3';
import { ConfigService } from '@nestjs/config';
import { storageConfig } from '../src/common/files/storage-config.js';

if (process.env.NODE_ENV === 'production')
  throw new Error(
    'Provision production storage outside this development script',
  );

const endpoint = new URL(process.env.S3_ENDPOINT ?? '');
if (!['localhost', '127.0.0.1', '[::1]'].includes(endpoint.hostname))
  throw new Error('storage:init only provisions local/CI storage');

const { client, bucket } = storageConfig(new ConfigService());
try {
  try {
    await client.send(new HeadBucketCommand({ Bucket: bucket }));
  } catch (error) {
    if (
      !(error instanceof Error) ||
      !['NotFound', 'NoSuchBucket'].includes(error.name)
    )
      throw error;
    await client.send(new CreateBucketCommand({ Bucket: bucket }));
  }
  // S3 buckets start private. Also remove any anonymous policy from this dedicated local bucket.
  await client.send(new DeleteBucketPolicyCommand({ Bucket: bucket }));
  console.log('Private file bucket is ready.');
} finally {
  client.destroy();
}
