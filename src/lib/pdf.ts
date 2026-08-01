/**
 * Génération du PDF professionnel du devis (100 % côté client, hors-ligne).
 *
 * Contenu : en-tête logo + coordonnées, bloc client, tableau des lignes,
 * récapitulatif TVA/HT/TTC, conditions générales, zone de signature,
 * QR code (lien de suivi / paiement), et une annexe photos.
 */

import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import QRCode from 'qrcode';
import type { Client, CompanySettings, Devis } from '../types';
import { devisTotals, lineTotals } from './calc';
import { formatDate, formatEUR } from './format';

/**
 * jsPDF utilise la police Helvetica standard, qui ne dispose pas du glyphe
 * « espace fine insécable » (U+202F) employé par le format fr-FR pour séparer
 * les milliers. On le remplace (ainsi que l'espace insécable) par une espace
 * normale afin d'éviter un rendu déformé des montants (« 1 000 »).
 */
const cleanSpaces = (s: string): string => s.replace(/[\u202f\u00a0]/g, ' ');
const money = (n: number): string => cleanSpaces(formatEUR(n));
import { getBlobDataUrl } from './db';

const NAVY = '#16243d';
const MUTE = '#6f7d97';

export async function generateDevisPdf(
  devis: Devis,
  client: Client,
  settings: CompanySettings,
): Promise<jsPDF> {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 14;
  const accent = settings.accentColor || '#ff6a2b';

  /* ---------- En-tête ---------- */
  let y = 16;
  const logo = settings.logoDataUrl;
  if (logo) {
    try {
      doc.addImage(logo, 'PNG', margin, y - 2, 22, 22);
    } catch {
      /* format non supporté : on ignore le logo */
    }
  }
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.setTextColor(NAVY);
  doc.text(settings.name || 'RFD', logo ? margin + 26 : margin, y + 6);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(MUTE);
  const infoLines = [
    settings.legalForm,
    [settings.addressLine1, `${settings.postalCode} ${settings.city}`.trim()]
      .filter(Boolean)
      .join(' — '),
    [settings.phone, settings.email].filter(Boolean).join(' · '),
    settings.siret ? `SIRET ${settings.siret}` : '',
    settings.website,
  ].filter(Boolean);
  doc.text(infoLines, logo ? margin + 26 : margin, y + 12);

  /* ---------- Bloc titre devis (droite) ---------- */
  doc.setFillColor(accent);
  doc.roundedRect(pageW - margin - 62, y - 2, 62, 26, 2, 2, 'F');
  doc.setTextColor('#ffffff');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text('DEVIS', pageW - margin - 56, y + 6);
  doc.setFontSize(10);
  doc.text(devis.number, pageW - margin - 56, y + 13);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text(`Date : ${formatDate(devis.createdAt)}`, pageW - margin - 56, y + 18.5);
  doc.text(`Validité : ${formatDate(devis.validUntil)}`, pageW - margin - 56, y + 22.5);

  y += 34;

  /* ---------- Client ---------- */
  doc.setDrawColor('#e2e8f2');
  doc.setFillColor('#f4f7fc');
  doc.roundedRect(pageW - margin - 80, y, 80, 30, 2, 2, 'F');
  doc.setTextColor(MUTE);
  doc.setFontSize(8);
  doc.text('CLIENT', pageW - margin - 76, y + 6);
  doc.setTextColor(NAVY);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  const clientName = [client.firstName, client.lastName].filter(Boolean).join(' ') || client.company;
  doc.text(clientName || '—', pageW - margin - 76, y + 12);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor('#42506a');
  const cl = [
    client.company && clientName !== client.company ? client.company : '',
    client.addressLine1,
    `${client.postalCode} ${client.city}`.trim(),
    client.phone,
    client.email,
  ].filter(Boolean);
  doc.text(cl, pageW - margin - 76, y + 17);

  // Titre intervention (gauche)
  doc.setTextColor(NAVY);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text(devis.title || 'Intervention', margin, y + 8, { maxWidth: pageW - 2 * margin - 88 });
  if (devis.site.floorArea || devis.site.roundTripKm) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(MUTE);
    const site = [
      devis.site.floorArea ? `Surface : ${devis.site.floorArea} m²` : '',
      devis.site.volume ? `Volume : ${devis.site.volume} m³` : '',
      devis.site.roundTripKm ? `Trajet A/R : ${devis.site.roundTripKm} km` : '',
    ]
      .filter(Boolean)
      .join('  ·  ');
    doc.text(site, margin, y + 15, { maxWidth: pageW - 2 * margin - 88 });
  }

  y += 34;

  /* ---------- Tableau des lignes ---------- */
  const totals = devisTotals(devis, settings);
  const body = devis.lines.map((l) => {
    const t = lineTotals(l);
    return [
      l.description || '—',
      `${trimNum(l.quantity)} ${l.unit}`,
      money(l.unitPrice),
      l.discountPct ? `${trimNum(l.discountPct)} %` : '—',
      settings.vatEnabled ? `${trimNum(l.vatRate)} %` : '—',
      money(t.sellHT),
    ];
  });

  autoTable(doc, {
    startY: y,
    head: [['Désignation', 'Qté', 'PU HT', 'Remise', 'TVA', 'Total HT']],
    body,
    margin: { left: margin, right: margin },
    styles: { fontSize: 9, cellPadding: 3, textColor: '#2a3856', lineColor: '#e2e8f2' },
    headStyles: { fillColor: NAVY, textColor: '#ffffff', fontStyle: 'bold', fontSize: 8.5 },
    alternateRowStyles: { fillColor: '#f7f9fd' },
    columnStyles: {
      0: { cellWidth: 'auto' },
      1: { halign: 'right', cellWidth: 22 },
      2: { halign: 'right', cellWidth: 24 },
      3: { halign: 'right', cellWidth: 20 },
      4: { halign: 'right', cellWidth: 16 },
      5: { halign: 'right', cellWidth: 28, fontStyle: 'bold' },
    },
  });

  // @ts-expect-error lastAutoTable est ajouté par le plugin
  y = (doc.lastAutoTable?.finalY ?? y) + 6;

  /* ---------- Totaux ---------- */
  const boxW = 78;
  const boxX = pageW - margin - boxW;
  y = ensureSpace(doc, y, 40, margin);
  const rows: [string, string, boolean?][] = [['Total HT', money(totals.totalHT)]];
  if (settings.vatEnabled) {
    for (const v of totals.vatByRate) {
      if (v.amount > 0) rows.push([`TVA ${trimNum(v.rate)} %`, money(v.amount)]);
    }
  }
  rows.push(['Total TTC', money(totals.totalTTC), true]);

  let ry = y;
  rows.forEach(([label, val, strong]) => {
    if (strong) {
      doc.setFillColor(accent);
      doc.roundedRect(boxX, ry - 4.5, boxW, 8, 1.5, 1.5, 'F');
      doc.setTextColor('#ffffff');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
    } else {
      doc.setTextColor('#42506a');
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9.5);
    }
    doc.text(label, boxX + 3, ry);
    doc.text(val, boxX + boxW - 3, ry, { align: 'right' });
    ry += strong ? 8 : 6;
  });

  if (!settings.vatEnabled) {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(7.5);
    doc.setTextColor(MUTE);
    doc.text('TVA non applicable, art. 293 B du CGI', margin, y + 2);
  }

  y = Math.max(ry, y) + 8;

  /* ---------- Notes / conditions particulières ---------- */
  if (devis.notes) {
    y = ensureSpace(doc, y, 20, margin);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(NAVY);
    doc.text('Conditions particulières', margin, y);
    y += 5;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor('#42506a');
    const lines = doc.splitTextToSize(devis.notes, pageW - 2 * margin);
    doc.text(lines, margin, y);
    y += lines.length * 4 + 4;
  }

  /* ---------- CGV ---------- */
  if (settings.cgv) {
    y = ensureSpace(doc, y, 30, margin);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(NAVY);
    doc.text('Conditions générales de vente', margin, y);
    y += 5;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(MUTE);
    const lines = doc.splitTextToSize(settings.cgv, pageW - 2 * margin);
    doc.text(lines, margin, y);
    y += lines.length * 3.4 + 4;
  }

  /* ---------- Signature + QR ---------- */
  y = ensureSpace(doc, y, 46, margin);
  y += 2;
  doc.setDrawColor('#cbd5e6');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(NAVY);
  doc.text('Bon pour accord — date et signature du client :', margin, y);
  doc.roundedRect(margin, y + 3, 90, 34, 2, 2, 'S');
  if (devis.signature) {
    try {
      doc.addImage(devis.signature.dataUrl, 'PNG', margin + 2, y + 5, 60, 26);
    } catch {
      /* ignore */
    }
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(MUTE);
    doc.text(
      `Signé par ${devis.signature.signerName} le ${formatDate(devis.signature.signedAt)}`,
      margin,
      y + 42,
    );
  }

  // QR code (lien de suivi sécurisé / paiement)
  try {
    const url = `https://devis.rfd.app/d/${devis.id}`;
    const qr = await QRCode.toDataURL(url, { margin: 0, width: 120 });
    doc.addImage(qr, 'PNG', pageW - margin - 30, y + 3, 30, 30);
    doc.setFontSize(7);
    doc.setTextColor(MUTE);
    doc.text('Suivi & paiement', pageW - margin - 30, y + 37);
  } catch {
    /* ignore */
  }

  /* ---------- Annexe photos ---------- */
  const photoIds = devis.photos.map((p) => p.annotatedBlobId ?? p.blobId);
  if (photoIds.length) {
    doc.addPage();
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(NAVY);
    doc.text('Annexe — Reportage photo', margin, 18);
    let px = margin;
    let py = 26;
    const colW = (pageW - 2 * margin - 8) / 2;
    const imgH = 52;
    for (let i = 0; i < devis.photos.length; i++) {
      const photo = devis.photos[i];
      const dataUrl = await getBlobDataUrl(photo.annotatedBlobId ?? photo.blobId);
      if (!dataUrl) continue;
      if (py + imgH + 12 > doc.internal.pageSize.getHeight() - margin) {
        doc.addPage();
        py = 20;
      }
      doc.setFillColor('#f4f7fc');
      doc.roundedRect(px, py, colW, imgH + 10, 2, 2, 'F');
      try {
        doc.addImage(dataUrl, 'JPEG', px + 2, py + 2, colW - 4, imgH, undefined, 'FAST');
      } catch {
        /* ignore */
      }
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(NAVY);
      doc.text(photo.category || `Photo ${i + 1}`, px + 3, py + imgH + 6);
      if (photo.caption) {
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(MUTE);
        doc.text(doc.splitTextToSize(photo.caption, colW - 20), px + 28, py + imgH + 6);
      }
      if (px === margin) {
        px = margin + colW + 8;
      } else {
        px = margin;
        py += imgH + 16;
      }
    }
  }

  /* ---------- Pied de page (numérotation) ---------- */
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(MUTE);
    const footer = [settings.name, settings.legalMention].filter(Boolean).join(' — ');
    doc.text(footer, margin, doc.internal.pageSize.getHeight() - 8, {
      maxWidth: pageW - 2 * margin - 20,
    });
    doc.text(`${i}/${pages}`, pageW - margin, doc.internal.pageSize.getHeight() - 8, {
      align: 'right',
    });
  }

  return doc;
}

/* ---------- Helpers ---------- */

function ensureSpace(doc: jsPDF, y: number, needed: number, margin: number) {
  if (y + needed > doc.internal.pageSize.getHeight() - margin) {
    doc.addPage();
    return margin + 4;
  }
  return y;
}

function trimNum(n: number): string {
  return cleanSpaces(new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 }).format(n));
}

export async function downloadDevisPdf(devis: Devis, client: Client, settings: CompanySettings) {
  const doc = await generateDevisPdf(devis, client, settings);
  doc.save(`${devis.number}.pdf`);
}

/** Renvoie un blob PDF (pour partage/aperçu). */
export async function devisPdfBlob(devis: Devis, client: Client, settings: CompanySettings) {
  const doc = await generateDevisPdf(devis, client, settings);
  return doc.output('blob');
}
