import { MAX_FILE_BYTES } from '@mdarj/shared';
import { validateFile } from './file-upload.js';

describe('File validation (FND-06)', () => {
  it.each([
    ['application/pdf', Buffer.from('%PDF-1.7\n%%EOF'), 'pdf'],
    ['image/png', Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), 'png'],
    ['image/jpeg', Buffer.from([255, 216, 255, 224]), 'jpg'],
  ])('recognizes %s by its bytes', (mimetype, buffer, extension) => {
    expect(validateFile({ mimetype, buffer })).toEqual({
      mimeType: mimetype,
      extension,
    });
  });

  it.each([
    undefined,
    { mimetype: 'application/pdf', buffer: Buffer.alloc(0) },
    {
      mimetype: 'application/pdf',
      buffer: Buffer.from('<script>alert(1)</script>'),
    },
    { mimetype: 'image/png', buffer: Buffer.from('%PDF-1.7\n%%EOF') },
    { mimetype: 'image/svg+xml', buffer: Buffer.from('<svg/>') },
  ])('refuses missing, empty, disguised or unsupported files', (file) => {
    expect(() => validateFile(file)).toThrow();
  });

  it('accepts exactly 10 MiB, refuses one byte more regardless of reported size', () => {
    const buffer = Buffer.alloc(MAX_FILE_BYTES);
    buffer.write('%PDF-1.7');
    expect(
      validateFile({ mimetype: 'application/pdf', buffer }).extension,
    ).toBe('pdf');
    const tooLarge = Buffer.alloc(MAX_FILE_BYTES + 1);
    expect(() =>
      validateFile({ mimetype: 'application/pdf', buffer: tooLarge }),
    ).toThrow();
  });
});
