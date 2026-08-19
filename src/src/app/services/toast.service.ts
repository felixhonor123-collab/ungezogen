import { Injectable, signal } from '@angular/core';

export interface ToastMessage {
  text: string;
  type: 'success' | 'error';
}

@Injectable({ providedIn: 'root' })
export class ToastService {
  message = signal<ToastMessage | null>(null);
  private timer: ReturnType<typeof setTimeout> | null = null;

  show(text: string, type: ToastMessage['type'] = 'success', duration = 4000) {
    if (this.timer) clearTimeout(this.timer);
    this.message.set({ text, type });
    this.timer = setTimeout(() => this.message.set(null), duration);
  }

  error(text: string) {
    this.show(text, 'error', 5000);
  }
}
