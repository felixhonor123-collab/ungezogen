import {
  AfterViewInit,
  Component,
  ElementRef,
  EventEmitter,
  OnDestroy,
  Output,
  ViewChild,
  signal,
} from '@angular/core';

declare const BarcodeDetector: any;

@Component({
  selector: 'app-qr-scanner',
  templateUrl: './qr-scanner.component.html',
  styleUrl: './qr-scanner.component.scss',
})
export class QrScannerComponent implements AfterViewInit, OnDestroy {
  @Output() scanned = new EventEmitter<string>();
  @Output() closed = new EventEmitter<void>();

  @ViewChild('video') videoRef!: ElementRef<HTMLVideoElement>;
  @ViewChild('canvas') canvasRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('fileInput') fileInputRef!: ElementRef<HTMLInputElement>;

  useFileInput = !this.isBarcodeDetectorSupported();
  error = signal<string | null>(null);
  scanning = signal(false);

  private stream: MediaStream | null = null;
  private detector: any = null;
  private rafId: number | null = null;

  ngAfterViewInit() {
    this.startScanner();
  }

  ngOnDestroy() {
    this.stopStream();
  }

  startScanner() {
    if (this.useFileInput) {
      this.fileInputRef.nativeElement.click();
      return;
    }
    this.error.set(null);
    this.scanning.set(true);

    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: 'environment' } })
      .then((stream) => {
        this.stream = stream;
        const video = this.videoRef.nativeElement;
        video.srcObject = stream;
        video.setAttribute('playsinline', 'true');
        video.muted = true;
        video.play().then(() => this.scheduleDetect());
      })
      .catch(() => {
        this.scanning.set(false);
        this.error.set('Kamera konnte nicht geöffnet werden.');
      });
  }

  close() {
    this.stopStream();
    this.closed.emit();
  }

  onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0);
      URL.revokeObjectURL(url);

      if (this.isBarcodeDetectorSupported()) {
        const detector = new BarcodeDetector({ formats: ['qr_code'] });
        detector
          .detect(canvas)
          .then((codes: any[]) => {
            if (codes.length > 0) this.emitResult(codes[0].rawValue);
            else this.error.set('Kein QR-Code im Bild gefunden.');
          })
          .catch(() => this.error.set('QR-Code konnte nicht gelesen werden.'));
      } else {
        this.error.set('QR-Code-Scan wird auf diesem Gerät nicht unterstützt.');
      }
      input.value = '';
    };
    img.src = url;
  }

  private scheduleDetect() {
    if (!this.detector) {
      this.detector = new BarcodeDetector({ formats: ['qr_code'] });
    }
    const detect = async () => {
      const video = this.videoRef?.nativeElement;
      if (!video || video.readyState < 2 || !this.stream) return;

      try {
        const codes = await this.detector.detect(video);
        if (codes.length > 0) {
          this.emitResult(codes[0].rawValue);
          return;
        }
      } catch {
        // kurz ignorieren, nächster Frame
      }
      this.rafId = requestAnimationFrame(detect);
    };
    this.rafId = requestAnimationFrame(detect);
  }

  private emitResult(value: string) {
    this.stopStream();
    this.scanned.emit(value);
  }

  private stopStream() {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    if (this.stream) {
      this.stream.getTracks().forEach((t) => t.stop());
      this.stream = null;
    }
    this.scanning.set(false);
  }

  private isBarcodeDetectorSupported(): boolean {
    return typeof window !== 'undefined' && 'BarcodeDetector' in window;
  }
}
