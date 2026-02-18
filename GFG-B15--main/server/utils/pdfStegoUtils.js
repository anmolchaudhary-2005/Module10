/**
 * PDF metadata-based "steganography" helper.
 *
 * This stores the payload in the PDF document metadata (Subject) with a prefix.
 * It's not LSB steganography, but it enables robust hidden-message storage in PDFs
 * without altering page content.
 */

import { PDFDocument } from 'pdf-lib';
import { decryptMessage, encryptMessage } from './stegoUtils.js';

const PREFIX = 'ROBUSTSTEGO:';

export async function embedMessageInPdf(pdfBuffer, message, password = null) {
  const pdfDoc = await PDFDocument.load(pdfBuffer, { updateMetadata: true });

  const payload = password ? encryptMessage(message, password) : message;
  const wrapped = PREFIX + Buffer.from(payload, 'utf8').toString('base64');

  pdfDoc.setSubject(wrapped);

  const out = await pdfDoc.save();
  return Buffer.from(out);
}

export async function extractMessageFromPdf(pdfBuffer, password = null) {
  const pdfDoc = await PDFDocument.load(pdfBuffer, { updateMetadata: false });
  const subject = pdfDoc.getSubject() || '';

  if (!subject.startsWith(PREFIX)) return '';

  const base64 = subject.slice(PREFIX.length);
  const payload = Buffer.from(base64, 'base64').toString('utf8');

  if (password) {
    return decryptMessage(payload, password);
  }
  return payload;
}

