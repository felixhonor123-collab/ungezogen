import { Component, OnInit, signal, computed } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../auth/auth.service';
import { SchuldService, Benutzer, benutzerName } from '../services/schuld.service';
import { PdfService } from '../services/pdf.service';
import { AvatarComponent } from '../shared/avatar.component';
import { ToastService } from '../services/toast.service';

@Component({
  selector: 'app-benutzer-uebersicht',
  imports: [CommonModule, FormsModule, AvatarComponent],
  templateUrl: './benutzer-uebersicht.html',
  styleUrl: './benutzer-uebersicht.scss',
})
export class BenutzerUebersicht implements OnInit {
  benutzer = signal<Benutzer[]>([]);
  laden = signal(true);
  downloading = signal(false);
  exportiert = signal(false);

  zeigeNeuerBenutzerForm = signal(false);
  neuerVorname = signal('');
  neuerNachname = signal('');
  neuerTelefon = signal('');
  neuerBezeichnung = signal('');
  neuerSpitzname = signal('');
  speichert = signal(false);

  neuerFormValid = computed(() => this.neuerVorname().trim().length > 0);

  zeigeNeueStrafForm = signal(false);
  strafBenutzerId = signal('');
  strafBezeichnung = signal('');
  strafBetrag = signal('');
  strafSpeichert = signal(false);

  strafBetragUngueltig = computed(() => {
    const v = this.strafBetrag().trim();
    if (!v) return false;
    return !/^\d+([,]\d{0,2})?$/.test(v);
  });

  strafFormValid = computed(() =>
    this.strafBenutzerId().length > 0 &&
    this.strafBezeichnung().trim().length > 0 &&
    this.strafBetrag().trim().length > 0 &&
    !this.strafBetragUngueltig()
  );

  readonly benutzerName = benutzerName;

  constructor(
    private schuldService: SchuldService,
    private router: Router,
    private pdfService: PdfService,
    private auth: AuthService,
    private toast: ToastService
  ) {}

  ngOnInit() {
    this.ladeBenutzerliste();
  }

  private ladeBenutzerliste() {
    this.schuldService.getBenutzer().subscribe((data) => {
      this.benutzer.set(data);
      this.laden.set(false);
    });
  }

  navigateToDetail(id: string) {
    this.router.navigate(['/benutzer', id]);
  }

  neuerBenutzerOeffnen() {
    this.neuerVorname.set('');
    this.neuerNachname.set('');
    this.neuerTelefon.set('');
    this.neuerBezeichnung.set('');
    this.neuerSpitzname.set('');
    this.zeigeNeuerBenutzerForm.set(true);
  }

  neuerBenutzerAbbrechen() {
    this.zeigeNeuerBenutzerForm.set(false);
  }

  neuerBenutzerSpeichern() {
    if (!this.neuerFormValid()) return;
    this.speichert.set(true);
    this.schuldService
      .benutzer_hinzufuegen(this.neuerVorname().trim(), this.neuerNachname().trim(), this.neuerTelefon().trim(), this.neuerBezeichnung().trim(), this.neuerSpitzname().trim())
      .subscribe(() => {
        this.speichert.set(false);
        this.zeigeNeuerBenutzerForm.set(false);
        this.ladeBenutzerliste();
      });
  }

  neueStrafOeffnen() {
    this.strafBenutzerId.set('');
    this.strafBezeichnung.set('');
    this.strafBetrag.set('');
    this.zeigeNeueStrafForm.set(true);
  }

  neueStrafAbbrechen() {
    this.zeigeNeueStrafForm.set(false);
  }

  neueStrafSpeichern() {
    if (!this.strafFormValid()) return;
    this.strafSpeichert.set(true);
    const betrag = parseFloat(this.strafBetrag().trim().replace(',', '.'));
    const datum = new Date().toISOString();
    this.schuldService
      .schuld_hinzufuegen({ benutzerId: this.strafBenutzerId(), bezeichnung: this.strafBezeichnung().trim(), betrag, datum })
      .subscribe({
        next: () => {
          this.strafSpeichert.set(false);
          this.zeigeNeueStrafForm.set(false);
          this.toast.show('Strafe erfolgreich hinzugefügt.');
        },
        error: () => {
          this.strafSpeichert.set(false);
          this.toast.error('Fehler beim Speichern. Bitte erneut versuchen.');
        },
      });
  }

  async qrPdfDownload() {
    this.downloading.set(true);
    try {
      await this.pdfService.downloadQrPdf(
        this.benutzer().map((b) => ({ id: b.id, name: benutzerName(b), spitzname: b.spitzname, bezeichnung: b.bezeichnung })),
        window.location.origin
      );
    } finally {
      this.downloading.set(false);
    }
  }

  csvExport() {
    this.exportiert.set(true);
    this.schuldService.getAlleSchuldenMitBenutzer().subscribe({
      next: (eintraege) => {
        const bom = '\uFEFF';
        const header = 'Name;Spitzname;Bezeichnung;Strafe (€);Datum;Status;Bezahlt am';
        const zeilen = eintraege.flatMap(({ benutzer, schulden }) =>
          schulden.map((s) => {
            const name = benutzerName(benutzer);
            const spitzname = benutzer.spitzname ?? '';
            const betrag = s.betrag.toFixed(2).replace('.', ',');
            const datum = new Date(s.datum).toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' });
            const status = s.bezahlt ? 'Bezahlt' : 'Offen';
            const bezahltAm = s.bezahltAm ? new Date(s.bezahltAm).toLocaleDateString('de-DE') : '';
            return [name, spitzname, s.bezeichnung, betrag, datum, status, bezahltAm]
              .map((v) => `"${String(v).replace(/"/g, '""')}"`)
              .join(';');
          })
        );
        const csv = bom + [header, ...zeilen].join('\r\n');
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const now = new Date();
        const pad = (n: number) => String(n).padStart(2, '0');
        const dateiname = `schulden_${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}-${pad(now.getMinutes())}.csv`;
        const a = document.createElement('a');
        a.href = url;
        a.download = dateiname;
        a.click();
        URL.revokeObjectURL(url);
        this.exportiert.set(false);
      },
      error: () => {
        this.exportiert.set(false);
        this.toast.error('Fehler beim CSV-Export.');
      },
    });
  }

  zurueck() {
    this.router.navigate(['/']);
  }

  logout() {
    this.auth.logout();
    this.router.navigate(['/login']);
  }
}
