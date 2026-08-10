import {
  Component,
  Input,
  OnChanges,
  ElementRef,
  ViewChild,
  AfterViewInit,
} from '@angular/core';
import { generateQrMatrix } from './qr-generator';

@Component({
  selector: 'app-qr-code',
  template: `<canvas #canvas></canvas>`,
  styles: [':host { display: block; } canvas { display: block; width: 100%; height: auto; image-rendering: pixelated; }'],
})
export class QrCodeComponent implements OnChanges, AfterViewInit {
  @Input() url = '';
  @Input() size = 240;

  @ViewChild('canvas') canvasRef!: ElementRef<HTMLCanvasElement>;

  private ready = false;

  ngAfterViewInit() {
    this.ready = true;
    this.render();
  }

  ngOnChanges() {
    if (this.ready) this.render();
  }

  private render() {
    if (!this.url || !this.canvasRef) return;
    try {
      const matrix = generateQrMatrix(this.url);
      const modules = matrix.length;
      const quiet = 4;
      const total = modules + quiet * 2;
      const canvas = this.canvasRef.nativeElement;
      canvas.width = total;
      canvas.height = total;
      canvas.style.width = this.size + 'px';
      canvas.style.height = this.size + 'px';
      const ctx = canvas.getContext('2d')!;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, total, total);
      ctx.fillStyle = '#1a1a1a';
      for (let r = 0; r < modules; r++)
        for (let c = 0; c < modules; c++)
          if (matrix[r][c]) ctx.fillRect(c + quiet, r + quiet, 1, 1);
    } catch(e) {
      console.error('QR render error:', e);
    }
  }
}
