import { Injectable } from '@angular/core';
import { generateQrMatrix } from '../qr-code/qr-generator';

@Injectable({ providedIn: 'root' })
export class PdfService {

  async downloadQrPdf(benutzerListe: { id: string; name: string; spitzname?: string; bezeichnung?: string }[], origin: string): Promise<void> {
    const items = benutzerListe.map((b) => ({
      name: b.name,
      spitzname: b.spitzname ?? '',
      bezeichnung: b.bezeichnung ?? '',
      url: `${origin}/schulden/${b.id}`,
      dataUrl: this.renderQrToDataUrl(`${origin}/schulden/${b.id}`, 360),
    }));

    const html = this.buildPrintHtml(items);
    const win = window.open('', '_blank', 'width=900,height=700');
    if (!win) return;
    win.document.write(html);
    win.document.close();
    win.addEventListener('load', () => {
      setTimeout(() => {
        win.focus();
        win.print();
      }, 300);
    });
  }

  private renderQrToDataUrl(text: string, px: number): string {
    const matrix = generateQrMatrix(text);
    const modules = matrix.length;
    const quiet = 4;
    const total = modules + quiet * 2;
    const scale = Math.max(1, Math.floor(px / total));
    const size = total * scale;

    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, size, size);
    ctx.fillStyle = '#000000';
    for (let r = 0; r < modules; r++)
      for (let c = 0; c < modules; c++)
        if (matrix[r][c])
          ctx.fillRect((c + quiet) * scale, (r + quiet) * scale, scale, scale);

    return canvas.toDataURL('image/png');
  }

  private buildPrintHtml(items: { name: string; spitzname: string; bezeichnung: string; url: string; dataUrl: string }[]): string {
    const cells = items.map((item) => `
      <div class="qr-cell">
        ${item.spitzname
          ? `<div class="qr-spitzname">${this.escapeHtml(item.spitzname)}</div>
        <div class="qr-name">${this.escapeHtml(item.name)}</div>`
          : `<div class="qr-spitzname">${this.escapeHtml(item.name)}</div>`}
        <img class="qr-img" src="${item.dataUrl}" alt="QR ${this.escapeHtml(item.spitzname || item.name)}" />
        ${item.bezeichnung ? `<div class="qr-bezeichnung">${this.escapeHtml(item.bezeichnung)}</div>` : ''}
      </div>
    `).join('');

    return `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="utf-8" />
  <title>QR-Codes</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      font-family: Helvetica, Arial, sans-serif;
      background: #fff;
    }

    .grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 0;
      width: 210mm;
      margin: 0 auto;
    }

    .qr-cell {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 8pt;
      padding: 20mm 15mm;
      border: 0.5pt solid #ddd;
      page-break-inside: avoid;
      break-inside: avoid;
    }

    .qr-spitzname {
      font-size: 18pt;
      font-weight: 700;
      color: #1a1a1a;
      text-align: center;
    }

    .qr-name {
      font-size: 9pt;
      font-weight: 400;
      color: #888;
      text-align: center;
    }

    .qr-img {
      width: 55mm;
      height: 55mm;
      image-rendering: pixelated;
      display: block;
    }

    .qr-bezeichnung {
      font-size: 8pt;
      font-weight: 600;
      color: #555;
      text-align: center;
      max-width: 60mm;
    }

    @page {
      size: A4 portrait;
      margin: 10mm;
    }

    @media print {
      body { margin: 0; }
      .grid { width: 100%; }
    }
  </style>
</head>
<body>
  <div class="grid">${cells}</div>
</body>
</html>`;
  }

  private escapeHtml(s: string): string {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
}
