import { Injectable, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, throwError, tap, map } from 'rxjs';

interface LoginResponse {
  access_token: string;
  expires_in: number;
}

const TOKEN_KEY   = 'auth_token';
const EXPIRY_KEY  = 'auth_expiry';
const REFRESH_KEY = 'auth_refresh_expiry';
const REFRESH_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
const TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;

@Injectable({ providedIn: 'root' })
export class AuthService {
  private _token = signal<string | null>(this.loadToken());

  isLoggedIn = computed(() => this._token() !== null);
  token = computed(() => this._token());

  constructor(private http: HttpClient) {}

  login(code: string): Observable<LoginResponse> {
    return this.http.post<{ token: string }>('/api/auth/login', { code }).pipe(
      tap(r => this.persistToken(r.token, TOKEN_TTL_MS / 1000)),
      map(r => ({ access_token: r.token, expires_in: TOKEN_TTL_MS / 1000 })),
    );
  }

  canRefresh(): boolean {
    const refreshExpiry = localStorage.getItem(REFRESH_KEY);
    if (!refreshExpiry) return false;
    return Date.now() < Number(refreshExpiry);
  }

  refresh(): Observable<string> {
    return this.http.post<{ token: string }>('/api/auth/refresh', {}).pipe(
      tap(r => this.persistToken(r.token, TOKEN_TTL_MS / 1000)),
      map(r => r.token),
    );
  }

  logout() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(EXPIRY_KEY);
    localStorage.removeItem(REFRESH_KEY);
    this._token.set(null);
  }

  private persistToken(token: string, expiresIn: number) {
    const expiry = Date.now() + expiresIn * 1000;
    const refreshExpiry = Date.now() + REFRESH_WINDOW_MS;
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(EXPIRY_KEY, String(expiry));
    localStorage.setItem(REFRESH_KEY, String(refreshExpiry));
    this._token.set(token);
  }

  private loadToken(): string | null {
    const token = localStorage.getItem(TOKEN_KEY);
    const expiry = localStorage.getItem(EXPIRY_KEY);
    if (!token || !expiry) return null;
    if (Date.now() > Number(expiry)) {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(EXPIRY_KEY);
      return null;
    }
    return token;
  }
}
