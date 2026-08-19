import { Component, OnInit, signal, computed } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService } from '../auth/auth.service';
import { SchuldService, Benutzer, Schuld, benutzerName } from '../services/schuld.service';
import { ToastService } from '../services/toast.service';
import { ConfirmDialog } from '../shared/confirm-dialog';
import { forkJoin } from 'rxjs';

export interface StrafEintrag {
  schuld: Schuld;
  benutzer: Benutzer;
}

@Component({
  selector: 'app-strafen-verwaltung',
  imports: [CommonModule, ConfirmDialog],
  templateUrl: './strafen-verwaltung.html',
  styleUrl: './strafen-verwaltung.scss',
})
export class StrafenVerwaltung implements OnInit {
  laden = signal(true);
  eintraege = signal<StrafEintrag[]>([]);
  confirmSchuldId = signal<string | null>(null);

  readonly benutzerName = benutzerName;

  filterBenutzer = signal<string>('');

  gefilterteEintraege = computed(() => {
    const f = this.filterBenutzer();
    const alle = this.eintraege();
    if (!f) return alle;
    return alle.filter((e) => e.benutzer.id === f);
  });

  benutzerListe = computed(() => {
    const ids = new Set<string>();
    const result: Benutzer[] = [];
    for (const e of this.eintraege()) {
      if (!ids.has(e.benutzer.id)) {
        ids.add(e.benutzer.id);
        result.push(e.benutzer);
      }
    }
    return result;
  });

  constructor(
    private schuldService: SchuldService,
    private router: Router,
    private auth: AuthService,
    private toast: ToastService,
  ) {}

  ngOnInit() {
    this.ladeAlleSchulden();
  }

  private ladeAlleSchulden() {
    this.laden.set(true);
    this.schuldService.getBenutzer().subscribe((benutzerListe) => {
      if (benutzerListe.length === 0) {
        this.eintraege.set([]);
        this.laden.set(false);
        return;
      }
      forkJoin(
        benutzerListe.map((b) =>
          this.schuldService.getSchuldenFuerBenutzer(b.id)
        )
      ).subscribe((schuldenListen) => {
        const eintraege: StrafEintrag[] = [];
        schuldenListen.forEach((schulden, i) => {
          schulden.forEach((s) => eintraege.push({ schuld: s, benutzer: benutzerListe[i] }));
        });
        eintraege.sort((a, b) => b.schuld.datum.localeCompare(a.schuld.datum));
        this.eintraege.set(eintraege);
        this.laden.set(false);
      });
    });
  }

  loeschenAnfragen(id: string) {
    this.confirmSchuldId.set(id);
  }

  loeschenBestaetigt() {
    const id = this.confirmSchuldId();
    if (!id) return;
    this.confirmSchuldId.set(null);
    this.schuldService.schuld_loeschen(id).subscribe({
      next: () => {
        this.eintraege.update((list) => list.filter((e) => e.schuld.id !== id));
        this.toast.show('Strafe gelöscht.');
      },
      error: () => this.toast.error('Fehler beim Löschen.'),
    });
  }

  benutzerAnzeigeName(b: Benutzer): string {
    return b.spitzname ? b.spitzname : benutzerName(b);
  }

  formatBetrag(betrag: number): string {
    return betrag.toFixed(2).replace('.', ',') + ' €';
  }

  formatDatum(datum: string): string {
    const d = new Date(datum);
    return d.toLocaleDateString('de-DE') + ' · ' + d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
  }

  logout() {
    this.auth.logout();
    this.router.navigate(['/login']);
  }
}
