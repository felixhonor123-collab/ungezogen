import { Component, OnInit, signal, computed } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService } from '../auth/auth.service';
import { SchuldService, Strafart } from '../services/schuld.service';
import { ToastService } from '../services/toast.service';
import { ConfirmDialog } from '../shared/confirm-dialog';

@Component({
  selector: 'app-strafarten-verwaltung',
  imports: [CommonModule, ConfirmDialog],
  templateUrl: './strafarten-verwaltung.html',
  styleUrl: './strafarten-verwaltung.scss',
})
export class StrafartenverwaltungComponent implements OnInit {
  laden = signal(true);
  strafarten = signal<Strafart[]>([]);
  confirmId = signal<string | null>(null);

  zeigeForm = signal(false);
  neueBezeichnung = signal('');
  neueBetragRaw = signal('');
  speichert = signal(false);

  betragUngueltig = computed(() => {
    const v = this.neueBetragRaw().trim();
    if (!v) return false;
    return !/^\d+([,]\d{0,2})?$/.test(v);
  });

  formValid = computed(() =>
    this.neueBezeichnung().trim().length > 0 &&
    this.neueBetragRaw().trim().length > 0 &&
    !this.betragUngueltig()
  );

  constructor(
    private schuldService: SchuldService,
    private router: Router,
    private auth: AuthService,
    private toast: ToastService,
  ) {}

  ngOnInit() {
    this.ladeStrafarten();
  }

  private ladeStrafarten() {
    this.laden.set(true);
    this.schuldService.getStrafarten().subscribe((data) => {
      this.strafarten.set(data);
      this.laden.set(false);
    });
  }

  formOeffnen() {
    this.neueBezeichnung.set('');
    this.neueBetragRaw.set('');
    this.zeigeForm.set(true);
  }

  formAbbrechen() {
    this.zeigeForm.set(false);
  }

  speichern() {
    if (!this.formValid()) return;
    this.speichert.set(true);
    const betrag = parseFloat(this.neueBetragRaw().trim().replace(',', '.'));
    this.schuldService.strafart_hinzufuegen(this.neueBezeichnung().trim(), betrag).subscribe({
      next: (neu) => {
        this.strafarten.update((list) => [...list, neu]);
        this.speichert.set(false);
        this.zeigeForm.set(false);
        this.toast.show('Strafart gespeichert.');
      },
      error: () => {
        this.speichert.set(false);
        this.toast.error('Fehler beim Speichern.');
      },
    });
  }

  loeschenAnfragen(id: string) {
    this.confirmId.set(id);
  }

  loeschenBestaetigt() {
    const id = this.confirmId();
    if (!id) return;
    this.confirmId.set(null);
    this.schuldService.strafart_loeschen(id).subscribe({
      next: () => {
        this.strafarten.update((list) => list.filter((s) => s.id !== id));
        this.toast.show('Strafart gelöscht.');
      },
      error: () => this.toast.error('Fehler beim Löschen.'),
    });
  }

  formatBetrag(betrag: number): string {
    return betrag.toFixed(2).replace('.', ',') + ' €';
  }

  logout() {
    this.auth.logout();
    this.router.navigate(['/login']);
  }
}
