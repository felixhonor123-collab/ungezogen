import { Component, OnInit, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { CommonModule } from '@angular/common';
import { Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';
import { ToastService } from './services/toast.service';

const ROUTE_DEPTH: Record<string, number> = {
  '/login':    0,
  '/':         1,
  '/benutzer': 2,
};

function routeDepth(url: string): number {
  if (ROUTE_DEPTH[url] !== undefined) return ROUTE_DEPTH[url];
  if (url.startsWith('/benutzer/')) return 3;
  if (url.startsWith('/schulden/')) return 1;
  return 1;
}

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, CommonModule],
  template: `
    <div class="page-wrap" [class.slide-forward]="slideForward()" [class.slide-back]="slideBack()">
      <router-outlet />
    </div>
    @if (offline()) {
      <div class="offline-banner">Keine Internetverbindung</div>
    }
    @if (toast.message()) {
      <div class="global-toast" [class.global-toast--error]="toast.message()!.type === 'error'">
        {{ toast.message()!.text }}
      </div>
    }
    @if (updateVerfuegbar()) {
      <div class="update-banner">
        <span class="update-text">Eine neue Version ist verfügbar</span>
        <button class="update-btn" type="button" (click)="updateInstallieren()">Jetzt aktualisieren</button>
      </div>
    }
  `,
  styles: [`
    :host { display: block; }

    .page-wrap {
      will-change: transform, opacity;
    }

    .slide-forward {
      animation: slideInFromRight 0.28s cubic-bezier(0.25, 0.46, 0.45, 0.94) both;
    }

    .slide-back {
      animation: slideInFromLeft 0.28s cubic-bezier(0.25, 0.46, 0.45, 0.94) both;
    }

    @keyframes slideInFromRight {
      from { transform: translateX(40px); opacity: 0; }
      to   { transform: translateX(0);    opacity: 1; }
    }

    @keyframes slideInFromLeft {
      from { transform: translateX(-40px); opacity: 0; }
      to   { transform: translateX(0);     opacity: 1; }
    }

    .global-toast {
      position: fixed;
      bottom: calc(1.5rem + env(safe-area-inset-bottom));
      left: 50%;
      transform: translateX(-50%);
      background: #1a1a1a;
      color: #fff;
      padding: 0.75rem 1.25rem;
      border-radius: 10px;
      font-size: 0.95rem;
      font-weight: 500;
      white-space: nowrap;
      box-shadow: 0 4px 16px rgba(0,0,0,0.2);
      z-index: 600;
      animation: toastUp 0.3s cubic-bezier(0.34,1.56,0.64,1);
    }
    .global-toast--error { background: #c0392b; }
    @keyframes toastUp {
      from { transform: translateX(-50%) translateY(2rem); opacity: 0; }
      to   { transform: translateX(-50%) translateY(0);    opacity: 1; }
    }
    .update-banner {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      z-index: 700;
      background: #2e8b57;
      color: #fff;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 1rem;
      padding: 0.85rem 1.25rem;
      box-shadow: 0 2px 12px rgba(0,0,0,0.15);
      animation: slideDown 0.3s cubic-bezier(0.34,1.56,0.64,1);
    }
    @keyframes slideDown {
      from { transform: translateY(-100%); opacity: 0; }
      to   { transform: translateY(0);     opacity: 1; }
    }
    .update-text {
      font-size: 0.95rem;
      font-weight: 500;
    }
    .update-btn {
      background: #fff;
      color: #2e8b57;
      border: none;
      border-radius: 8px;
      padding: 0.45rem 1rem;
      font-size: 0.88rem;
      font-weight: 700;
      cursor: pointer;
      white-space: nowrap;
      &:active { background: #e8f5ee; }
    }
    .offline-banner {
      position: fixed;
      bottom: calc(1.5rem + env(safe-area-inset-bottom));
      left: 50%;
      transform: translateX(-50%);
      background: #555;
      color: #fff;
      padding: 0.6rem 1.25rem;
      border-radius: 10px;
      font-size: 0.88rem;
      font-weight: 500;
      z-index: 650;
      white-space: nowrap;
      box-shadow: 0 4px 16px rgba(0,0,0,0.2);
    }
  `],
})
export class App implements OnInit {
  updateVerfuegbar = signal(false);
  offline = signal(!navigator.onLine);
  slideForward = signal(false);
  slideBack = signal(false);
  private wartendeRegistrierung: ServiceWorkerRegistration | null = null;
  private prevDepth = 1;

  constructor(readonly toast: ToastService, private router: Router) {
    window.addEventListener('online',  () => this.offline.set(false));
    window.addEventListener('offline', () => this.offline.set(true));
  }

  ngOnInit() {
    this.router.events.pipe(
      filter(e => e instanceof NavigationEnd)
    ).subscribe((e) => {
      const url = (e as NavigationEnd).urlAfterRedirects;
      const depth = routeDepth(url);
      const forward = depth >= this.prevDepth;
      this.slideForward.set(false);
      this.slideBack.set(false);
      setTimeout(() => {
        if (forward) this.slideForward.set(true);
        else this.slideBack.set(true);
      }, 0);
      this.prevDepth = depth;
    });

    if (!('serviceWorker' in navigator)) return;

    navigator.serviceWorker.ready.then((reg) => {
      reg.addEventListener('updatefound', () => {
        const neuerSW = reg.installing;
        if (!neuerSW) return;
        neuerSW.addEventListener('statechange', () => {
          if (neuerSW.state === 'installed' && navigator.serviceWorker.controller) {
            this.wartendeRegistrierung = reg;
            this.updateVerfuegbar.set(true);
          }
        });
      });
    });

    navigator.serviceWorker.addEventListener('controllerchange', () => {
      window.location.reload();
    });
  }

  updateInstallieren() {
    const sw = this.wartendeRegistrierung?.waiting;
    if (sw) sw.postMessage('SKIP_WAITING');
  }
}
