import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, forkJoin, switchMap, map } from 'rxjs';

export interface Benutzer {
  id: string;
  vorname: string;
  nachname: string;
  telefon: string;
  bezeichnung: string;
  spitzname: string;
  foto: string;
}

export function benutzerName(b: Benutzer): string {
  return `${b.vorname} ${b.nachname}`.trim();
}

export interface Schuld {
  id: string;
  benutzerId: string;
  bezeichnung: string;
  betrag: number;
  datum: string;
  bezahlt: boolean;
  bezahltAm?: string;
}

export interface NeueSchuldDto {
  benutzerId: string;
  bezeichnung: string;
  betrag: number;
  datum: string;
}

export interface Strafart {
  id: string;
  bezeichnung: string;
  betrag: number;
  reihenfolge: number;
}

@Injectable({ providedIn: 'root' })
export class SchuldService {
  constructor(private http: HttpClient) {}

  getBenutzer(): Observable<Benutzer[]> {
    return this.http.get<Benutzer[]>('/api/benutzer');
  }

  getBenutzerById(id: string): Observable<Benutzer> {
    return this.http.get<Benutzer>(`/api/benutzer/${id}`);
  }

  benutzer_hinzufuegen(vorname: string, nachname: string, telefon: string, bezeichnung: string, spitzname: string): Observable<Benutzer> {
    return this.http.post<Benutzer>('/api/benutzer', { vorname, nachname, telefon, bezeichnung, spitzname });
  }

  benutzer_bearbeiten(id: string, vorname: string, nachname: string, telefon: string, bezeichnung: string, spitzname: string): Observable<Benutzer> {
    return this.http.patch<Benutzer>(`/api/benutzer/${id}`, { vorname, nachname, telefon, bezeichnung, spitzname });
  }

  benutzer_foto_speichern(id: string, foto: string): Observable<Benutzer> {
    return this.http.patch<Benutzer>(`/api/benutzer/${id}`, { foto });
  }

  benutzer_loeschen(id: string): Observable<void> {
    return this.http.delete<void>(`/api/benutzer/${id}`);
  }

  getSchuldenFuerBenutzer(benutzerId: string): Observable<Schuld[]> {
    return this.http.get<Schuld[]>(`/api/benutzer/${benutzerId}/schulden`);
  }

  schuld_hinzufuegen(dto: NeueSchuldDto): Observable<Schuld> {
    return this.http.post<Schuld>('/api/schulden', dto);
  }

  schuld_als_bezahlt_markieren(schuldId: string): Observable<Schuld> {
    return this.http.patch<Schuld>(`/api/schulden/${schuldId}/bezahlt`, {});
  }

  schuld_als_offen_markieren(schuldId: string): Observable<Schuld> {
    return this.http.patch<Schuld>(`/api/schulden/${schuldId}/offen`, {});
  }

  schuld_loeschen(schuldId: string): Observable<void> {
    return this.http.delete<void>(`/api/schulden/${schuldId}`);
  }

  getAlleSchuldenMitBenutzer(): Observable<{ benutzer: Benutzer; schulden: Schuld[] }[]> {
    return this.getBenutzer().pipe(
      switchMap((benutzerListe) =>
        benutzerListe.length === 0
          ? new Observable<{ benutzer: Benutzer; schulden: Schuld[] }[]>((obs) => { obs.next([]); obs.complete(); })
          : forkJoin(
              benutzerListe.map((b) =>
                this.getSchuldenFuerBenutzer(b.id).pipe(
                  map((schulden) => ({ benutzer: b, schulden }))
                )
              )
            )
      )
    );
  }

  getStrafarten(): Observable<Strafart[]> {
    return this.http.get<Strafart[]>('/api/strafarten');
  }

  strafart_hinzufuegen(bezeichnung: string, betrag: number): Observable<Strafart> {
    return this.http.post<Strafart>('/api/strafarten', { bezeichnung, betrag });
  }

  strafart_loeschen(id: string): Observable<void> {
    return this.http.delete<void>(`/api/strafarten/${id}`);
  }
}
