import { HttpInterceptorFn, HttpRequest, HttpHandlerFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, switchMap, throwError } from 'rxjs';
import { AuthService } from './auth.service';
import { Router } from '@angular/router';
import { ToastService } from '../services/toast.service';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const toast = inject(ToastService);

  const authReq = addToken(req, auth.token());

  return next(authReq).pipe(
    catchError((err) => {
      if (err.status === 401) {
        if (auth.canRefresh()) {
          return auth.refresh().pipe(
            switchMap((token) => next(addToken(req, token))),
            catchError(() => {
              auth.logout();
              router.navigate(['/login']);
              return throwError(() => err);
            })
          );
        }
        auth.logout();
        router.navigate(['/login']);
      } else if (err.status >= 500) {
        toast.error('Serverfehler – bitte später erneut versuchen.');
      } else if (err.status === 403) {
        toast.error('Keine Berechtigung für diese Aktion.');
      } else if (err.status === 404) {
        toast.error('Ressource nicht gefunden.');
      } else if (err.status === 0) {
        toast.error('Keine Verbindung zum Server.');
      }
      return throwError(() => err);
    })
  );
};

function addToken(req: HttpRequest<unknown>, token: string | null): HttpRequest<unknown> {
  return token
    ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
    : req;
}
