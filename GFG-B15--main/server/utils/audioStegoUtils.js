/**
 * WAV (PCM 16-bit) LSB steganography helpers.
 *
 * Notes/constraints:
 * - Supports RIFF/WAVE, PCM (audioFormat=1), 16-bit little-endian samples.
 * - Embeds 1 bit per 16-bit sample by modifying the LSB of the least-significant byte.
 * - Works best with WAV (lossless). MP3/AAC are not suitable for LSB robustness.
 */

const RIFF = 'RIFF';
const WAVE = 'WAVE';
const FMT = 'fmt ';
const DATA = 'data';

function fourCC(buf, offset) {
  return buf.toString('ascii', offset, offset + 4);
}

function parseWav(buffer) {
  if (buffer.length < 44) throw new Error('Invalid WAV: too small');
  if (fourCC(buffer, 0) !== RIFF) throw new Error('Invalid WAV: missing RIFF');
  if (fourCC(buffer, 8) !== WAVE) throw new Error('Invalid WAV: missing WAVE');

  let offset = 12;
  let fmtChunk = null;
  let dataChunk = null;

  while (offset + 8 <= buffer.length) {
    const id = fourCC(buffer, offset);
    const size = buffer.readUInt32LE(offset + 4);
    const chunkDataOffset = offset + 8;

    if (chunkDataOffset + size > buffer.length) break;

    if (id === FMT) {
      const audioFormat = buffer.readUInt16LE(chunkDataOffset + 0);
      const numChannels = buffer.readUInt16LE(chunkDataOffset + 2);
      const sampleRate = buffer.readUInt32LE(chunkDataOffset + 4);
      const bitsPerSample = buffer.readUInt16LE(chunkDataOffset + 14);
      fmtChunk = { audioFormat, numChannels, sampleRate, bitsPerSample };
    } else if (id === DATA) {
      dataChunk = { offset: chunkDataOffset, size };
      break; // data usually last; we can stop here
    }

    // Chunks are word-aligned (pad byte if odd)
    offset = chunkDataOffset + size + (size % 2);
  }

  if (!fmtChunk) throw new Error('Invalid WAV: missing fmt chunk');
  if (!dataChunk) throw new Error('Invalid WAV: missing data chunk');

  if (fmtChunk.audioFormat !== 1) throw new Error('Unsupported WAV: only PCM (format 1) is supported');
  if (fmtChunk.bitsPerSample !== 16) throw new Error('Unsupported WAV: only 16-bit PCM is supported');

  return { fmtChunk, dataChunk };
}

export function calculateWavCapacityBits(wavBuffer, delimiterBitsLength = 16) {
  const { dataChunk } = parseWav(wavBuffer);
  const samplesCount = Math.floor(dataChunk.size / 2); // 2 bytes per 16-bit sample (interleaved channels)
  return Math.max(0, samplesCount);
}

export function embedBitsInWav(wavBuffer, messageBits) {
  const { dataChunk } = parseWav(wavBuffer);
  const out = Buffer.from(wavBuffer); // copy

  let bitIndex = 0;
  const totalBits = messageBits.length;

  // Iterate each 16-bit sample: modify the least-significant byte (little-endian)
  for (let i = dataChunk.offset; i + 1 < dataChunk.offset + dataChunk.size && bitIndex < totalBits; i += 2) {
    const bit = messageBits[bitIndex] === '1' ? 1 : 0;
    out[i] = (out[i] & 0xfe) | bit;
    bitIndex++;
  }

  if (bitIndex < totalBits) {
    throw new Error('Message too large for this WAV capacity');
  }

  return out;
}

export function extractBitsFromWav(wavBuffer, endDelimiterBits) {
  const { dataChunk } = parseWav(wavBuffer);

  let bits = '';
  const limitSamples = Math.floor(dataChunk.size / 2);

  for (let si = 0; si < limitSamples; si++) {
    const byteOffset = dataChunk.offset + si * 2;
    bits += (wavBuffer[byteOffset] & 1).toString();
    if (bits.endsWith(endDelimiterBits)) return bits;
  }

  return bits;
}

