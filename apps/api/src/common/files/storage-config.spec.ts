import { ConfigService } from '@nestjs/config';
import { storageConfig } from './storage-config.js';

const settings = {
  S3_ENDPOINT: 'http://localhost:9000',
  S3_REGION: 'us-east-1',
  S3_BUCKET: 'unit-tests',
  S3_ACCESS_KEY_ID: 'test',
  S3_SECRET_ACCESS_KEY: 'test-secret',
  S3_FORCE_PATH_STYLE: 'true',
};

describe('Private storage configuration', () => {
  it('defaults to five-minute links and explicit credentials', () => {
    const config = storageConfig(new ConfigService(settings));
    expect(config.ttl).toBe(300);
    expect(config.bucket).toBe('unit-tests');
    config.client.destroy();
  });
  it.each(['0', '301', 'NaN', '1.5'])(
    'refuses invalid link lifetimes (%s)',
    (ttl) => {
      expect(() =>
        storageConfig(
          new ConfigService({ ...settings, S3_LINK_TTL_SECONDS: ttl }),
        ),
      ).toThrow();
    },
  );
  it('requires HTTPS in production and refuses credentials embedded in URLs', () => {
    expect(() =>
      storageConfig(new ConfigService({ ...settings, NODE_ENV: 'production' })),
    ).toThrow();
    expect(() =>
      storageConfig(
        new ConfigService({
          ...settings,
          S3_ENDPOINT: 'http://user:secret@localhost:9000',
        }),
      ),
    ).toThrow();
  });
  it('does not silently fall back to another AWS profile when unconfigured', () => {
    expect(() =>
      storageConfig(
        new ConfigService({ S3_ENDPOINT: '', S3_ACCESS_KEY_ID: '' }),
      ),
    ).toThrow();
  });
});
