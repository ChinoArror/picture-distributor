const TIFF_TYPES = new Map([
  [1, 1], // BYTE
  [3, 2], // SHORT
  [4, 4], // LONG
  [7, 1], // UNDEFINED
  [13, 4], // IFD
]);

export const DNG_CONTENT_TYPE = "image/x-adobe-dng";

export function isDngContentType(value, filename = "") {
  const type = String(value || "").toLowerCase().split(";")[0].trim();
  return type === DNG_CONTENT_TYPE || type === "image/dng" || /\.dng$/i.test(String(filename || ""));
}

export function inspectDng(input, totalBytes = byteView(input).byteLength, maximumPreviewBytes = Infinity) {
  const bytes = byteView(input);
  const layout = tiffLayout(bytes);
  if (!layout) return { isDng: false, preview: null };

  const { view, little, firstIfd } = layout;
  const pending = [firstIfd];
  const visited = new Set();
  const candidates = [];
  let isDng = false;

  while (pending.length && visited.size < 64) {
    const offset = pending.shift();
    if (!Number.isSafeInteger(offset) || offset < 8 || offset + 2 > bytes.byteLength || visited.has(offset)) continue;
    visited.add(offset);
    const count = Math.min(read16(view, offset, little), 256);
    if (offset + 2 + count * 12 + 4 > bytes.byteLength) continue;

    const tags = new Map();
    for (let index = 0; index < count; index += 1) {
      const entry = offset + 2 + index * 12;
      const tag = read16(view, entry, little);
      const values = entryNumbers(view, entry, little);
      if (values.length) tags.set(tag, values);
      if (tag === 0xc612 && values.length >= 4) isDng = true;
      if (tag === 0x014a) pending.push(...values);
    }

    const next = read32(view, offset + 2 + count * 12, little);
    if (next) pending.push(next);
    const width = tags.get(0x0100)?.[0] || 0;
    const height = tags.get(0x0101)?.[0] || 0;
    const subfile = tags.get(0x00fe)?.[0];
    const jpegOffset = tags.get(0x0201)?.[0];
    const jpegLength = tags.get(0x0202)?.[0];
    addCandidate(candidates, jpegOffset, jpegLength, width, height, subfile, 2);

    if (tags.get(0x0103)?.[0] === 7) {
      const offsets = tags.get(0x0111) || [];
      const lengths = tags.get(0x0117) || [];
      for (let index = 0; index < Math.min(offsets.length, lengths.length); index += 1) {
        addCandidate(candidates, offsets[index], lengths[index], width, height, subfile, 1);
      }
    }
  }

  if (!isDng) return { isDng: false, preview: null };
  const preview = candidates
    .filter(({ offset, length }) => length <= maximumPreviewBytes && offset + length <= totalBytes)
    .filter(({ offset, length }) => isDisplayJpeg(bytes, offset, length, offset >= bytes.byteLength))
    .sort((left, right) =>
      right.previewRank - left.previewRank ||
      right.area - left.area ||
      right.sourceRank - left.sourceRank ||
      right.length - left.length
    )[0] || null;
  return { isDng: true, preview };
}

export function extractDngJpegPreview(input, maximumPreviewBytes = Infinity) {
  const bytes = byteView(input);
  const { isDng, preview } = inspectDng(bytes, bytes.byteLength, maximumPreviewBytes);
  if (!isDng) throw new Error("The file is not a valid DNG image");
  if (!preview) throw new Error("The DNG image does not contain a supported JPEG preview");
  return bytes.slice(preview.offset, preview.offset + preview.length);
}

export async function readDngJpegPreview(bucket, key, maximumPreviewBytes = Infinity, knownSize = 0) {
  const object = knownSize ? { size: knownSize } : await bucket.head(key);
  if (!object) throw new Error("Original DNG object was not found");
  const headerObject = await bucket.get(key, {
    range: { offset: 0, length: Math.min(object.size, 1024 * 1024) },
  });
  if (!headerObject?.body) throw new Error("Original DNG header was not found");
  const header = new Uint8Array(await headerObject.arrayBuffer());
  const { isDng, preview } = inspectDng(header, object.size, maximumPreviewBytes);
  if (!isDng) throw new Error("The file is not a valid DNG image");
  if (!preview) throw new Error("The DNG image does not contain a supported JPEG preview");

  if (preview.offset + preview.length <= header.byteLength) {
    return new Blob([header.slice(preview.offset, preview.offset + preview.length)], { type: "image/jpeg" });
  }
  const previewObject = await bucket.get(key, {
    range: { offset: preview.offset, length: preview.length },
  });
  if (!previewObject?.body) throw new Error("The DNG JPEG preview was not found");
  const blob = await previewObject.blob();
  const signature = new Uint8Array(await blob.slice(0, 3).arrayBuffer());
  if (signature[0] !== 0xff || signature[1] !== 0xd8 || signature[2] !== 0xff) {
    throw new Error("The DNG JPEG preview is invalid");
  }
  return new Blob([blob], { type: "image/jpeg" });
}

function tiffLayout(bytes) {
  if (bytes.byteLength < 8) return null;
  const little = bytes[0] === 0x49 && bytes[1] === 0x49;
  const big = bytes[0] === 0x4d && bytes[1] === 0x4d;
  if (!little && !big) return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (read16(view, 2, little) !== 42) return null;
  return { view, little, firstIfd: read32(view, 4, little) };
}

function entryNumbers(view, entry, little) {
  const type = read16(view, entry + 2, little);
  const count = read32(view, entry + 4, little);
  const size = TIFF_TYPES.get(type);
  if (!size || !count || count > 4096 || count * size > Number.MAX_SAFE_INTEGER) return [];
  const byteLength = count * size;
  const offset = byteLength <= 4 ? entry + 8 : read32(view, entry + 8, little);
  if (offset < 0 || offset + byteLength > view.byteLength) return [];
  const values = [];
  for (let index = 0; index < count; index += 1) {
    const position = offset + index * size;
    values.push(size === 1 ? view.getUint8(position) : size === 2
      ? read16(view, position, little)
      : read32(view, position, little));
  }
  return values;
}

function addCandidate(candidates, offset, length, width, height, subfile, sourceRank) {
  if (!Number.isSafeInteger(offset) || !Number.isSafeInteger(length) || offset < 8 || length < 4) return;
  candidates.push({
    offset,
    length,
    area: Number(width) * Number(height) || 0,
    previewRank: subfile === 1 || subfile === 0x10001 ? 1 : 0,
    sourceRank,
  });
}

function isDisplayJpeg(bytes, offset, length, unavailable) {
  if (unavailable) return true;
  if (offset + 4 > bytes.byteLength || bytes[offset] !== 0xff || bytes[offset + 1] !== 0xd8) return false;
  const end = Math.min(bytes.byteLength, offset + length, offset + 64 * 1024);
  for (let cursor = offset + 2; cursor + 4 <= end;) {
    if (bytes[cursor] !== 0xff) { cursor += 1; continue; }
    const marker = bytes[cursor + 1];
    if (marker === 0xda || marker === 0xd9) break;
    if ([0xc0, 0xc1, 0xc2, 0xc5, 0xc6, 0xc9, 0xca, 0xcd, 0xce].includes(marker)) return true;
    if ([0xc3, 0xc7, 0xcb, 0xcf].includes(marker)) return false;
    if (marker === 0x00 || marker === 0xff || (marker >= 0xd0 && marker <= 0xd8)) {
      cursor += 2;
      continue;
    }
    const size = read16(new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength), cursor + 2, false);
    if (size < 2) return false;
    cursor += 2 + size;
  }
  return false;
}

function byteView(input) {
  if (input instanceof Uint8Array) return input;
  if (input instanceof ArrayBuffer) return new Uint8Array(input);
  if (ArrayBuffer.isView(input)) return new Uint8Array(input.buffer, input.byteOffset, input.byteLength);
  throw new TypeError("Expected DNG bytes");
}

function read16(view, offset, little) {
  return view.getUint16(offset, little);
}

function read32(view, offset, little) {
  return view.getUint32(offset, little);
}
