import { Component, OnInit, signal } from '@angular/core';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { AvatarComponent } from '../shared/avatar.component';
import { benutzerName } from '../services/schuld.service';

interface LeaderboardEintrag {
  id: string;
  vorname: string;
  nachname: string;
  spitzname: string;
  bezeichnung: string;
  telefon: string;
  foto: string;
  gesamtStrafe: number;
  anzahlStrafen: number;
}

@Component({
  selector: 'app-leaderboard',
  imports: [CommonModule, AvatarComponent],
  templateUrl: './leaderboard.html',
  styleUrl: './leaderboard.scss',
})
export class Leaderboard implements OnInit {
  eintraege = signal<LeaderboardEintrag[]>([]);
  laden = signal(true);
  fehler = signal(false);

  readonly benutzerName = benutzerName;

  constructor(private http: HttpClient, private router: Router) {}

  ngOnInit() {
    this.http.get<LeaderboardEintrag[]>('/api/public/leaderboard').subscribe({
      next: (data) => {
        this.eintraege.set(data);
        this.laden.set(false);
      },
      error: () => {
        this.fehler.set(true);
        this.laden.set(false);
      },
    });
  }

  anzeigeName(e: LeaderboardEintrag): string {
    return e.spitzname || benutzerName(e);
  }

  formatBetrag(betrag: number): string {
    return betrag.toFixed(2).replace('.', ',') + ' €';
  }

  zurueck() {
    this.router.navigate(['/login']);
  }

  rangKlasse(rang: number): string {
    if (rang === 1) return 'rang--gold';
    if (rang === 2) return 'rang--silber';
    if (rang === 3) return 'rang--bronze';
    return '';
  }

  rangIcon(rang: number): string {
    if (rang === 1) return '🥇';
    if (rang === 2) return '🥈';
    if (rang === 3) return '🥉';
    return String(rang);
  }
}
