import { BadRequestException, PayloadTooLargeException } from '@nestjs/common';
import {
  FILE_MIME_TYPES,
  MAX_FILE_BYTES,
  type FileMimeType,
} from '@mdarj/shared';
import type { MulterOptions } from '@nestjs/platform-express/multer/interfaces/multer-options.interface.js';
import type {} from 'multer';

export type UploadedFile = Pick<Express.Multer.File, 'buffer' | 'mimetype'>;

function invalidFile(key: string): never {
  throw new BadRequestException({
    message: 'validationFailed',
    errors: { file: key },
  });
}

/** Used by feature FileInterceptor('file', FILE_UPLOAD_OPTIONS), before buffering. */
export const FILE_UPLOAD_OPTIONS: MulterOptions = {
  limits: {
    fileSize: MAX_FILE_BYTES,
    files: 1,
    fields: 10,
    parts: 11,
    fieldSize: 16 * 1024,
  },
  fileFilter: (_req, file, done) => {
    if (!FILE_MIME_TYPES.includes(file.mimetype as FileMimeType)) {
      done(
        new BadRequestException({
          message: 'validationFailed',
          errors: { file: 'fileTypeInvalid' },
        }),
        false,
      );
    } else done(null, true);
  },
};

/** Never trust a filename or browser MIME alone. Enforce these checks for all callers. */
export function validateFile(file: UploadedFile | undefined): {
  mimeType: FileMimeType;
  extension: string;
} {
  if (!file?.buffer || file.buffer.length === 0) invalidFile('fileRequired');
  if (file.buffer.length > MAX_FILE_BYTES)
    throw new PayloadTooLargeException({
      message: 'fileTooLarge',
      errors: { file: 'fileTooLarge' },
    });
  const bytes = file.buffer;
  let detected: FileMimeType | undefined;
  if (bytes.subarray(0, 5).equals(Buffer.from('%PDF-')))
    detected = 'application/pdf';
  else if (
    bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
  )
    detected = 'image/png';
  else if (
    bytes.length >= 3 &&
    bytes[0] === 255 &&
    bytes[1] === 216 &&
    bytes[2] === 255
  )
    detected = 'image/jpeg';
  if (!detected || detected !== file.mimetype) invalidFile('fileTypeInvalid');
  return {
    mimeType: detected,
    extension: {
      'application/pdf': 'pdf',
      'image/png': 'png',
      'image/jpeg': 'jpg',
    }[detected],
  };
}
