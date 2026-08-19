import { Component, OnInit, signal, computed } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { CommonModule } from '@angular/common';
import { Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';
import { ToastService } from './services/toast.service';

const ROUTE_DEPTH: Record<string, number> = {
  '/login':     0,
  '/leaderboard': 0,
  '/':          1,
  '/strafen':   1,
  '/benutzer':  2,
};

function routeDepth(url: string): number {
  if (ROUTE_DEPTH[url] !== undefined) return ROUTE_DEPTH[url];
  if (url.startsWith('/benutzer/')) return 3;
  if (url.startsWith('/schulden/')) return 1;
  return 1;
}

function showBottomNav(url: string): boolean {
  if (url === '/login') return false;
  if (url.startsWith('/schulden/')) return false;
  if (url.startsWith('/leaderboard')) return false;
  if (url.startsWith('/benutzer/') && url !== '/benutzer') return false;
  return true;
}
@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, CommonModule],
  template: `
    <div class="page-wrap" [class.slide-forward]="slideForward()" [class.slide-back]="slideBack()">
      <router-outlet />
    </div>

    @if (zeigeNav()) {
      <nav class="bottom-nav">
        <a class="nav-item" routerLink="/" routerLinkActive="nav-item--active" [routerLinkActiveOptions]="{exact: true}">
          <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 2L2 7l10 5 10-5-10-5z"/>
            <path d="M2 17l10 5 10-5"/>
            <path d="M2 12l10 5 10-5"/>
          </svg>
          <span class="nav-label">Erfassen</span>
        </a>
        <a class="nav-item" routerLink="/strafen" routerLinkActive="nav-item--active">
          <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="3" y="4" width="18" height="18" rx="2"/>
            <line x1="16" y1="2" x2="16" y2="6"/>
            <line x1="8" y1="2" x2="8" y2="6"/>
            <line x1="3" y1="10" x2="21" y2="10"/>
            <line x1="8" y1="15" x2="16" y2="15"/>
          </svg>
          <span class="nav-label">Strafen</span>
        </a>
        <a class="nav-item" routerLink="/strafarten" routerLinkActive="nav-item--active">
          <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="8" y1="6" x2="21" y2="6"/>
            <line x1="8" y1="12" x2="21" y2="12"/>
            <line x1="8" y1="18" x2="21" y2="18"/>
            <circle cx="3" cy="6" r="1" fill="currentColor" stroke="none"/>
            <circle cx="3" cy="12" r="1" fill="currentColor" stroke="none"/>
            <circle cx="3" cy="18" r="1" fill="currentColor" stroke="none"/>
          </svg>
          <span class="nav-label">Strafarten</span>
        </a>
        <a class="nav-item" routerLink="/benutzer" routerLinkActive="nav-item--active">
          <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="9" cy="7" r="4"/>
            <path d="M3 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2"/>
            <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
            <path d="M21 21v-2a4 4 0 0 0-3-3.85"/>
          </svg>
          <span class="nav-label">Schützen</span>
        </a>
      </nav>
    }

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
    :host {
      display: block;
      overflow-x: hidden;
      position: relative;
    }

    .page-wrap {
      overflow-x: hidden;
    }

    .slide-forward {
      animation: slideInFromRight 0.25s cubic-bezier(0.25, 0.46, 0.45, 0.94) both;
    }

    .slide-back {
      animation: slideInFromLeft 0.25s cubic-bezier(0.25, 0.46, 0.45, 0.94) both;
    }

    @keyframes slideInFromRight {
      from { transform: translateX(20px); opacity: 0; }
      to   { transform: translateX(0);    opacity: 1; }
    }

    @keyframes slideInFromLeft {
      from { transform: translateX(-20px); opacity: 0; }
      to   { transform: translateX(0);     opacity: 1; }
    }

    .bottom-nav {
      position: fixed;
      bottom: 0;
      left: 0;
      right: 0;
      z-index: 200;
      background: #fff;
      border-top: 1px solid #e2e8e2;
      box-shadow: 0 -1px 12px rgba(0, 0, 0, 0.07);
      display: flex;
      justify-content: space-around;
      align-items: stretch;
      padding-bottom: env(safe-area-inset-bottom);
    }

    .nav-item {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 0.2rem;
      padding: 0.6rem 0.25rem;
      text-decoration: none;
      color: #aab8aa;
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 0.7rem;
      font-weight: 600;
      letter-spacing: 0.01em;
      min-height: 56px;
      touch-action: manipulation;
      -webkit-tap-highlight-color: transparent;
      transition: color 0.15s;

      &:active { color: #2e8b57; }
    }

    .nav-item--active {
      color: #2e8b57;
    }

    .nav-icon {
      width: 22px;
      height: 22px;
      flex-shrink: 0;
    }

    .nav-label {
      line-height: 1;
    }

    .global-toast {
      position: fixed;
      bottom: calc(4.5rem + env(safe-area-inset-bottom));
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
      bottom: calc(4.5rem + env(safe-area-inset-bottom));
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
  zeigeNav = signal(false);
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
      this.zeigeNav.set(showBottomNav(url));
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

