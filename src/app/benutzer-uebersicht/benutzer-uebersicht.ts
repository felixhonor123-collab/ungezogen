import { Component, OnInit, signal, computed } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../auth/auth.service';
import { SchuldService, Benutzer, benutzerName } from '../services/schuld.service';
import { PdfService } from '../services/pdf.service';
import { AvatarComponent } from '../shared/avatar.component';

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

  zeigeNeuerBenutzerForm = signal(false);
  neuerVorname = signal('');
  neuerNachname = signal('');
  neuerTelefon = signal('');
  neuerBezeichnung = signal('');
  speichert = signal(false);

  neuerFormValid = computed(() => this.neuerVorname().trim().length > 0);

  readonly benutzerName = benutzerName;

  constructor(
    private schuldService: SchuldService,
    private router: Router,
    private pdfService: PdfService,
    private auth: AuthService
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
    this.zeigeNeuerBenutzerForm.set(true);
  }

  neuerBenutzerAbbrechen() {
    this.zeigeNeuerBenutzerForm.set(false);
  }

  neuerBenutzerSpeichern() {
    if (!this.neuerFormValid()) return;
    this.speichert.set(true);
    this.schuldService
      .benutzer_hinzufuegen(this.neuerVorname().trim(), this.neuerNachname().trim(), this.neuerTelefon().trim(), this.neuerBezeichnung().trim())
      .subscribe(() => {
        this.speichert.set(false);
        this.zeigeNeuerBenutzerForm.set(false);
        this.ladeBenutzerliste();
      });
  }

  async qrPdfDownload() {
    this.downloading.set(true);
    try {
      await this.pdfService.downloadQrPdf(
        this.benutzer().map((b) => ({ id: b.id, name: benutzerName(b) })),
        window.location.origin
      );
    } finally {
      this.downloading.set(false);
    }
  }

  zurueck() {
    this.router.navigate(['/']);
  }

  logout() {
    this.auth.logout();
    this.router.navigate(['/login']);
  }
}
