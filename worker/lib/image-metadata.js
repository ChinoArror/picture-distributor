const MAX_HEADER_BYTES = 512 * 1024;

export async function extractPhotoMetadata(file) {
  const bytes = new Uint8Array(await file.slice(0, MAX_HEADER_BYTES).arrayBuffer());
  const metadata = {};
  if (bytes[0] === 0xff && bytes[1] === 0xd8) readJpeg(bytes, metadata);
  else if (ascii(bytes, 1, 3) === "PNG" && bytes.length >= 24) {
    metadata.width = uint32(bytes, 16);
    metadata.height = uint32(bytes, 20);
  } else if (["GIF87a", "GIF89a"].includes(ascii(bytes, 0, 6)) && bytes.length >= 10) {
    metadata.width = uint16(bytes, 6, true);
    metadata.height = uint16(bytes, 8, true);
  } else if (ascii(bytes, 0, 4) === "RIFF" && ascii(bytes, 8, 4) === "WEBP" && ascii(bytes, 12, 4) === "VP8X" && bytes.length >= 30) {
    metadata.width = 1 + uint24(bytes, 24);
    metadata.height = 1 + uint24(bytes, 27);
  }
  return Object.fromEntries(Object.entries(metadata).filter(([, value]) => value !== "" && value != null));
}

function readJpeg(bytes, metadata) {
  for (let offset = 2; offset + 4 <= bytes.length;) {
    if (bytes[offset] !== 0xff) { offset += 1; continue; }
    const marker = bytes[offset + 1];
    if (marker === 0xd9 || marker === 0xda) break;
    const length = uint16(bytes, offset + 2);
    if (length < 2 || offset + 2 + length > bytes.length) break;
    const payload = offset + 4;
    if ([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker) && payload + 5 <= bytes.length) {
      metadata.height = uint16(bytes, payload + 1);
      metadata.width = uint16(bytes, payload + 3);
    } else if (marker === 0xe1 && ascii(bytes, payload, 6) === "Exif\u0000\u0000") {
      readExif(bytes, payload + 6, metadata);
    }
    offset += 2 + length;
  }
}

function readExif(bytes, base, metadata) {
  if (base + 8 > bytes.length) return;
  const little = uint16(bytes, base) === 0x4949;
  if ((!little && uint16(bytes, base) !== 0x4d4d) || uint16(bytes, base + 2, little) !== 42) return;
  const primary = readIfd(bytes, base, base + uint32(bytes, base + 4, little), little);
  const make = clean(primary.get(0x010f));
  const model = clean(primary.get(0x0110));
  metadata.camera = clean([make, model].filter((value, index, all) => value && all.indexOf(value) === index).join(" "));
  metadata.takenAt = clean(primary.get(0x0132));
  const exifOffset = Number(primary.get(0x8769));
  if (!Number.isFinite(exifOffset) || exifOffset <= 0) return;
  const exif = readIfd(bytes, base, base + exifOffset, little);
  metadata.takenAt = clean(exif.get(0x9003)) || metadata.takenAt;
  metadata.exposureSeconds = finite(exif.get(0x829a));
  metadata.aperture = finite(exif.get(0x829d));
  metadata.iso = finite(exif.get(0x8827));
  metadata.focalLengthMm = finite(exif.get(0x920a));
}

function readIfd(bytes, base, offset, little) {
  const values = new Map();
  if (offset < base || offset + 2 > bytes.length) return values;
  const count = Math.min(uint16(bytes, offset, little), 128);
  for (let index = 0; index < count; index += 1) {
    const entry = offset + 2 + index * 12;
    if (entry + 12 > bytes.length) break;
    const tag = uint16(bytes, entry, little);
    const type = uint16(bytes, entry + 2, little);
    const items = uint32(bytes, entry + 4, little);
    const size = ({ 2: 1, 3: 2, 4: 4, 5: 8 })[type];
    if (!size || !items || items > 1024) continue;
    const total = size * items;
    const valueOffset = total <= 4 ? entry + 8 : base + uint32(bytes, entry + 8, little);
    if (valueOffset < base || valueOffset + total > bytes.length) continue;
    if (type === 2) values.set(tag, ascii(bytes, valueOffset, items).replace(/\0.*$/, ""));
    else if (type === 3) values.set(tag, uint16(bytes, valueOffset, little));
    else if (type === 4) values.set(tag, uint32(bytes, valueOffset, little));
    else if (type === 5) {
      const denominator = uint32(bytes, valueOffset + 4, little);
      if (denominator) values.set(tag, uint32(bytes, valueOffset, little) / denominator);
    }
  }
  return values;
}

function ascii(bytes, offset, length) {
  return String.fromCharCode(...bytes.slice(offset, offset + length));
}

function uint16(bytes, offset, little = false) {
  return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint16(offset, little);
}

function uint24(bytes, offset) {
  return bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16);
}

function uint32(bytes, offset, little = false) {
  return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(offset, little);
}

function clean(value) {
  return String(value || "").replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, 120);
}

function finite(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : null;
}
