import { S3Client } from '@aws-sdk/client-s3';
import { ConfigService } from '@nestjs/config';
import { FILE_LINK_TTL_SECONDS } from '@mdarj/shared';

/** No credentials in source or implicit AWS profile lookup. Provision the bucket separately. */
export function storageConfig(config: ConfigService) {
  const required = (name: string) => {
    const value = config.get<string>(name);
    if (!value) throw new Error(`Missing storage setting: ${name}`);
    return value;
  };
  const endpoint = new URL(required('S3_ENDPOINT'));
  if (
    !['http:', 'https:'].includes(endpoint.protocol) ||
    endpoint.username ||
    endpoint.password ||
    endpoint.search ||
    endpoint.hash
  )
    throw new Error('Invalid S3_ENDPOINT');
  if (config.get('NODE_ENV') === 'production' && endpoint.protocol !== 'https:')
    throw new Error('Production S3_ENDPOINT must use HTTPS');
  const ttl = Number(config.get('S3_LINK_TTL_SECONDS', FILE_LINK_TTL_SECONDS));
  if (!Number.isInteger(ttl) || ttl < 1 || ttl > FILE_LINK_TTL_SECONDS)
    throw new Error('S3_LINK_TTL_SECONDS must be between 1 and 300');
  const pathStyle = config.get<string>('S3_FORCE_PATH_STYLE', 'false');
  if (!['true', 'false'].includes(pathStyle))
    throw new Error('Invalid S3_FORCE_PATH_STYLE');
  const bucket = required('S3_BUCKET');
  const client = new S3Client({
    endpoint: endpoint.href,
    region: required('S3_REGION'),
    credentials: {
      accessKeyId: required('S3_ACCESS_KEY_ID'),
      secretAccessKey: required('S3_SECRET_ACCESS_KEY'),
    },
    forcePathStyle: pathStyle === 'true',
    maxAttempts: 2,
    requestHandler: { connectionTimeout: 5000, requestTimeout: 15000 },
  });
  return { client, bucket, ttl };
}
