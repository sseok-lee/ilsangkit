import { AppError } from '../lib/errors.js';

export type RasterImageInfo = {
  mimeType: string;
  extension: 'jpg' | 'png' | 'webp' | 'gif';
};

function unsupported(): never {
  throw new AppError(415, '지원하지 않는 이미지 형식입니다', 'UNSUPPORTED_MEDIA_TYPE');
}

function hasBytes(bytes: Buffer, offset: number, length: number): boolean {
  return offset >= 0 && length >= 0 && offset + length <= bytes.length;
}

function isPng(bytes: Buffer): boolean {
  if (!hasBytes(bytes, 0, 33)) return false;
  if (!bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return false;
  }
  if (bytes.readUInt32BE(8) !== 13 || bytes.subarray(12, 16).toString('ascii') !== 'IHDR') return false;
  if (bytes.readUInt32BE(16) === 0 || bytes.readUInt32BE(20) === 0) return false;

  let offset = 8;
  while (hasBytes(bytes, offset, 12)) {
    const length = bytes.readUInt32BE(offset);
    const typeOffset = offset + 4;
    const dataOffset = offset + 8;
    const nextOffset = dataOffset + length + 4;
    if (!hasBytes(bytes, typeOffset, 4) || !hasBytes(bytes, dataOffset, length + 4)) return false;
    if (bytes.subarray(typeOffset, typeOffset + 4).toString('ascii') === 'IEND') {
      return length === 0 && nextOffset === bytes.length;
    }
    offset = nextOffset;
  }
  return false;
}

function isGif(bytes: Buffer): boolean {
  if (!hasBytes(bytes, 0, 14)) return false;
  const header = bytes.subarray(0, 6).toString('ascii');
  if (header !== 'GIF87a' && header !== 'GIF89a') return false;
  if (bytes.readUInt16LE(6) === 0 || bytes.readUInt16LE(8) === 0) return false;
  return bytes[bytes.length - 1] === 0x3b;
}

function isJpeg(bytes: Buffer): boolean {
  if (!hasBytes(bytes, 0, 4)) return false;
  if (bytes[0] !== 0xff || bytes[1] !== 0xd8 || bytes[bytes.length - 2] !== 0xff || bytes[bytes.length - 1] !== 0xd9) {
    return false;
  }

  let offset = 2;
  let sawFrameWithSize = false;
  while (offset < bytes.length - 2) {
    while (offset < bytes.length - 2 && bytes[offset] === 0xff) offset += 1;
    if (offset >= bytes.length - 2) break;
    const marker = bytes[offset];
    offset += 1;
    if (marker === 0xd9) break;
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue;
    if (!hasBytes(bytes, offset, 2)) return false;
    const segmentLength = bytes.readUInt16BE(offset);
    if (segmentLength < 2 || !hasBytes(bytes, offset, segmentLength)) return false;
    const segmentStart = offset + 2;
    const isStartOfFrame =
      (marker >= 0xc0 && marker <= 0xc3) ||
      (marker >= 0xc5 && marker <= 0xc7) ||
      (marker >= 0xc9 && marker <= 0xcb) ||
      (marker >= 0xcd && marker <= 0xcf);
    if (isStartOfFrame) {
      if (segmentLength < 7 || !hasBytes(bytes, segmentStart, 5)) return false;
      const height = bytes.readUInt16BE(segmentStart + 1);
      const width = bytes.readUInt16BE(segmentStart + 3);
      sawFrameWithSize = width > 0 && height > 0;
    }
    if (marker === 0xda) {
      return sawFrameWithSize && bytes[bytes.length - 2] === 0xff && bytes[bytes.length - 1] === 0xd9;
    }
    offset += segmentLength;
  }
  return sawFrameWithSize;
}

function isWebp(bytes: Buffer): boolean {
  if (!hasBytes(bytes, 0, 20)) return false;
  if (bytes.subarray(0, 4).toString('ascii') !== 'RIFF' || bytes.subarray(8, 12).toString('ascii') !== 'WEBP') {
    return false;
  }
  const riffSize = bytes.readUInt32LE(4);
  if (riffSize + 8 !== bytes.length) return false;

  let offset = 12;
  while (hasBytes(bytes, offset, 8)) {
    const type = bytes.subarray(offset, offset + 4).toString('ascii');
    const length = bytes.readUInt32LE(offset + 4);
    const dataOffset = offset + 8;
    const paddedLength = length + (length % 2);
    if (!hasBytes(bytes, dataOffset, paddedLength)) return false;
    if (type === 'VP8 ' || type === 'VP8L' || type === 'VP8X') return length > 0;
    offset = dataOffset + paddedLength;
  }
  return false;
}

export function detectRasterImage(bytes: Buffer): RasterImageInfo {
  if (isPng(bytes)) return { mimeType: 'image/png', extension: 'png' };
  if (isJpeg(bytes)) return { mimeType: 'image/jpeg', extension: 'jpg' };
  if (isWebp(bytes)) return { mimeType: 'image/webp', extension: 'webp' };
  if (isGif(bytes)) return { mimeType: 'image/gif', extension: 'gif' };
  unsupported();
}
