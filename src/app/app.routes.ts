import { Routes } from '@angular/router';
import { Home } from './home/home';
import { BenutzerUebersicht } from './benutzer-uebersicht/benutzer-uebersicht';
import { BenutzerDetail } from './benutzer-detail/benutzer-detail';
import { Login } from './login/login';
import { SchuldenAnsicht } from './schulden-ansicht/schulden-ansicht';
import { authGuard } from './auth/auth.guard';

export const routes: Routes = [
  { path: 'login', component: Login },
  { path: 'schulden/:id', component: SchuldenAnsicht },
  { path: '', component: Home, canActivate: [authGuard] },
  { path: 'benutzer', component: BenutzerUebersicht, canActivate: [authGuard] },
  { path: 'benutzer/:id', component: BenutzerDetail, canActivate: [authGuard] },
];
