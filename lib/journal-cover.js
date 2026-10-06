// Only bounded JPEGs produced by the image picker are accepted; never remote URLs or SVG.
export function validateJournalCover(value) {
  if (value === null) return null;
  const prefix = 'data:image/jpeg;base64,';
  if (typeof value !== 'string' || !value.startsWith(prefix) || value.length > 700000) throw new Error('Choose a JPEG photo smaller than 512 KB.');
  const encoded = value.slice(prefix.length);
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(encoded)) throw new Error('Unable to read this photo.');
  const bytes = Buffer.from(encoded, 'base64');
  if (bytes.length > 512 * 1024 || bytes.length < 16 || bytes.toString('base64') !== encoded || bytes.readUInt16BE(0) !== 0xffd8 || bytes.readUInt16BE(bytes.length - 2) !== 0xffd9) throw new Error('Unable to read this JPEG photo.');
  let position = 2;
  while (position + 4 <= bytes.length) {
    if (bytes[position++] !== 0xff) break;
    while (bytes[position] === 0xff) position++;
    const marker = bytes[position++];
    if (marker === 0xda || marker === 0xd9) break;
    const length = bytes.readUInt16BE(position);
    if (length < 2 || position + length > bytes.length) break;
    if ([0xc0, 0xc1, 0xc2].includes(marker) && length >= 8) {
      const height = bytes.readUInt16BE(position + 3), width = bytes.readUInt16BE(position + 5);
      if (width > 0 && height > 0 && width <= 2048 && height <= 2048) return value;
      throw new Error('Photo dimensions must be no larger than 2048 pixels.');
    }
    position += length;
  }
  throw new Error('Unable to read this JPEG photo.');
}
