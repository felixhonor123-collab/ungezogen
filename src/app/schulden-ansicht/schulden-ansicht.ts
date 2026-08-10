import { Component, OnInit, signal, computed } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { benutzerName, Benutzer, Schuld } from '../services/schuld.service';
import { AuthService } from '../auth/auth.service';

@Component({
  selector: 'app-schulden-ansicht',
  imports: [CommonModule],
  templateUrl: './schulden-ansicht.html',
  styleUrl: './schulden-ansicht.scss',
})
export class SchuldenAnsicht implements OnInit {
  benutzer = signal<Benutzer | undefined>(undefined);
  schulden = signal<Schuld[]>([]);
  laden = signal(true);
  fehler = signal(false);

  gesamt = computed(() => this.schulden().reduce((s, x) => s + x.betrag, 0));
  readonly benutzerName = benutzerName;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private http: HttpClient,
    private auth: AuthService,
  ) {}

  ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id') ?? '';

    if (this.auth.isLoggedIn()) {
      this.router.navigate(['/benutzer', id]);
      return;
    }

    this.http.get<Benutzer>(`/api/public/benutzer/${id}`).subscribe({
      next: (b) => {
        this.benutzer.set(b);
        this.http.get<Schuld[]>(`/api/public/benutzer/${id}/schulden`).subscribe({
          next: (s) => { this.schulden.set(s); this.laden.set(false); },
          error: () => { this.fehler.set(true); this.laden.set(false); },
        });
      },
      error: () => { this.fehler.set(true); this.laden.set(false); },
    });
  }

  formatBetrag(betrag: number): string {
    return betrag.toFixed(2).replace('.', ',') + ' €';
  }

  formatDatum(datum: string): string {
    return new Date(datum).toLocaleDateString('de-DE');
  }

  formatDatumMitUhrzeit(datum: string): string {
    const d = new Date(datum);
    return d.toLocaleDateString('de-DE') + ' · ' + d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
  }
}
