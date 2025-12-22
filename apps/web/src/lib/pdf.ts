import jsPDF from 'jspdf';
import { formatRon } from './money';
import type { Settings } from './types-extended';

export type PdfInvoice = {
  friendlyId: string;
  date: string;
  clientName: string;
  clientContact?: string;
  pets: Array<{
    petName: string;
    petSpecies?: string;
    items: Array<{ name: string; quantity: number; unitPrice: number }>;
  }>;
};

async function loadLocalLogo(): Promise<{ dataUrl: string; width: number; height: number } | null> {
  try {
    const response = await fetch('/logo.svg');
    if (!response.ok) return null;

    const svgText = await response.text();
    const img = new Image();
    const svgBlob = new Blob([svgText], { type: 'image/svg+xml' });
    const urlObject = URL.createObjectURL(svgBlob);

    return await new Promise((resolve) => {
      img.onload = () => {
        // Get natural dimensions
        const naturalWidth = img.naturalWidth || img.width;
        const naturalHeight = img.naturalHeight || img.height;

        // Calculate dimensions to fit within max size while preserving aspect ratio
        // Use higher resolution for canvas to avoid pixelation, then scale down in PDF
        const maxWidth = 100;
        const maxHeight = 60;
        const scale = 3; // 3x resolution for better quality
        const aspectRatio = naturalWidth / naturalHeight;

        let finalWidth = maxWidth;
        let finalHeight = maxWidth / aspectRatio;

        if (finalHeight > maxHeight) {
          finalHeight = maxHeight;
          finalWidth = maxHeight * aspectRatio;
        }

        const canvas = document.createElement('canvas');
        canvas.width = finalWidth * scale;
        canvas.height = finalHeight * scale;
        const ctx = canvas.getContext('2d');

        if (ctx) {
          ctx.drawImage(img, 0, 0, finalWidth * scale, finalHeight * scale);
          resolve({
            dataUrl: canvas.toDataURL('image/png'),
            width: finalWidth,
            height: finalHeight
          });
        } else {
          resolve(null);
        }
        URL.revokeObjectURL(urlObject);
      };
      img.onerror = () => {
        URL.revokeObjectURL(urlObject);
        resolve(null);
      };
      img.src = urlObject;
    });
  } catch {
    return null;
  }
}

export async function exportInvoicePdf(data: PdfInvoice, settings: Settings) {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const margin = 40;
  let y = margin;

  const clinicName = settings.clinic_name || 'Veterinary Clinic';
  const clinicAddress = settings.clinic_address || '';
  const clinicPhone = settings.clinic_phone || '';
  const clinicCui = settings.clinic_cui || '';
  const clinicIban = settings.clinic_iban || '';
  const clinicSwift = settings.clinic_swift || '';

  const logo = await loadLocalLogo();
  let logoHeight = 0;
  if (logo) {
    try {
      // Position logo on the right side
      // A4 width is 595.28pt, right margin is 40pt, so right edge is at 555pt
      const logoX = 555 - logo.width;
      doc.addImage(logo.dataUrl, 'PNG', logoX, y, logo.width, logo.height);
      logoHeight = logo.height;
    } catch {
      // ignore logo rendering failures
    }
  }

  // Align clinic name with logo if present
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text(clinicName, margin, y);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  y += 16;

  const detailLines: string[] = [];
  if (clinicAddress) detailLines.push(clinicAddress);
  if (clinicPhone) detailLines.push(`Tel: ${clinicPhone}`);
  if (clinicCui) detailLines.push(`CUI: ${clinicCui}`);
  if (clinicIban) {
    const ibanLine = clinicSwift ? `IBAN: ${clinicIban}    SWIFT/BIC: ${clinicSwift}` : `IBAN: ${clinicIban}`;
    detailLines.push(ibanLine);
  }

  detailLines.forEach(line => {
    doc.text(line, margin, y);
    y += 12;
  });

  // Ensure we're below the logo
  if (logoHeight > 0 && y < (margin + logoHeight + 10)) {
    y = margin + logoHeight + 10;
  }
  y += 22;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text(`Invoice: ${data.friendlyId}`, margin, y);

  // Date aligned to right (approx 555 is the line end, let's align right text)
  // jsPDF text align: { align: 'right' } is supported if we pass 'right' as last arg or options object?
  // Current code uses coordinates. 380 is used for unit price. 470 for Total start.
  // "check how it is now in the uploaded picture" -> Date is far right.
  // Page width is A4 (595.28 pt). Margin 40. Right edge = ~555.
  doc.text(`Date: ${data.date}`, 555, y, { align: 'right' });

  y += 18;
  doc.setFont('helvetica', 'normal');

  // Client details on the right side
  // Let's align them to the right as well, or left-aligned starting from right half?
  // "client details should be on the right"
  // Let's align them to the right edge to match the date, or give them a starting X around 300?
  // Usually addresses are block-aligned. Text align right might look weird for multi-line.
  // Let's try right-aligning the block to 555.

  doc.text(`Client: ${data.clientName}`, 555, y, { align: 'right' });
  if (data.clientContact) {
    y += 12; // spacing
    doc.text(data.clientContact, 555, y, { align: 'right' });
  }

  let grandTotal = 0;

  for (const pet of data.pets) {
    y += 22;
    doc.setFont('helvetica', 'bold');
    const petLabel = pet.petSpecies ? `${pet.petName} (${pet.petSpecies})` : pet.petName;
    doc.text(`Pet: ${petLabel}`, margin, y);

    y += 16;
    doc.text('Item', margin, y);
    doc.text('Qty', 330, y);
    doc.text('Unit', 380, y);
    doc.text('Total', 470, y);
    y += 8;
    doc.setLineWidth(1);
    doc.line(margin, y, 555, y);

    y += 16;
    doc.setFont('helvetica', 'normal');

    let petTotal = 0;
    for (const item of pet.items) {
      const line = item.quantity * item.unitPrice;
      petTotal += line;
      grandTotal += line;

      doc.text(item.name, margin, y, { maxWidth: 280 });
      doc.text(String(item.quantity), 330, y);
      doc.text(formatRon(item.unitPrice), 380, y);
      doc.text(formatRon(line), 470, y);
      y += 16;

      if (y > 760) {
        doc.addPage();
        y = margin;
      }
    }

    y += 10;
    doc.setLineWidth(1);
    doc.line(margin, y, 555, y);
    y += 16;
    doc.setFont('helvetica', 'bold');
    doc.text('Subtotal', 380, y);
    doc.text(formatRon(petTotal), 470, y);
    doc.setFont('helvetica', 'normal');
  }

  y += 24;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text('Total', 380, y);
  doc.text(formatRon(grandTotal), 470, y);

  doc.save(`${data.friendlyId}.pdf`);
}
