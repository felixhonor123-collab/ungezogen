import { Component, OnInit, signal, computed } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { forkJoin } from 'rxjs';
import { AuthService } from '../auth/auth.service';
import { SchuldService, Benutzer, Schuld, benutzerName } from '../services/schuld.service';
import { ToastService } from '../services/toast.service';
import { QrCodeComponent } from '../qr-code/qr-code.component';
import { ConfirmDialog } from '../shared/confirm-dialog';
import { AvatarComponent } from '../shared/avatar.component';

type SortOption = 'datum-desc' | 'datum-asc' | 'betrag-desc' | 'betrag-asc';

@Component({
  selector: 'app-benutzer-detail',
  imports: [CommonModule, FormsModule, QrCodeComponent, ConfirmDialog, AvatarComponent],
  templateUrl: './benutzer-detail.html',
  styleUrl: './benutzer-detail.scss',
})
export class BenutzerDetail implements OnInit {
  benutzer = signal<Benutzer | undefined>(undefined);
  schulden = signal<Schuld[]>([]);
  qrUrl = signal('');
  laden = signal(true);

  bearbeitetName = signal(false);
  editVorname = signal('');
  editNachname = signal('');
  editTelefon = signal('');
  editBezeichnung = signal('');
  speichertName = signal(false);

  zeigeOffen = signal(true);
  zeigeBezahlt = signal(false);
  sortierung = signal<SortOption>('datum-desc');

  confirmSchuldId = signal<string | null>(null);
  confirmBenutzerLoeschen = signal(false);
  loeschenPhrase = signal('');

  editFormValid = computed(() => this.editVorname().trim().length > 0);

  offeneSchulden = computed(() =>
    this.sortiert(this.schulden().filter((s) => !s.bezahlt))
  );

  bezahlteSchulden = computed(() =>
    this.sortiert(this.schulden().filter((s) => s.bezahlt))
  );

  gesamtOffen = computed(() =>
    this.offeneSchulden().reduce((sum, s) => sum + s.betrag, 0)
  );

  gesamtBezahlt = computed(() =>
    this.bezahlteSchulden().reduce((sum, s) => sum + s.betrag, 0)
  );

  whatsappUebersichtUrl = computed(() => {
    const b = this.benutzer();
    const schulden = this.offeneSchulden();
    if (!b?.telefon || schulden.length === 0) return null;
    const nummer = b.telefon.trim().replace(/\s+/g, '').replace(/^0/, '+49');
    const zeilen = schulden.map((s) => `• ${s.bezeichnung}: ${this.formatBetrag(s.betrag)}`).join('\n');
    const gesamt = this.formatBetrag(this.gesamtOffen());
    const text = `Hallo ${b.vorname}, hier ist deine aktuelle Schuldenübersicht:\n\n${zeilen}\n\nGesamt: ${gesamt}`;
    return `https://wa.me/${encodeURIComponent(nummer)}?text=${encodeURIComponent(text)}`;
  });

  readonly benutzerName = benutzerName;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private schuldService: SchuldService,
    private auth: AuthService,
    private toast: ToastService
  ) {}

  ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id') ?? '';
    forkJoin({
      benutzer: this.schuldService.getBenutzerById(id),
      schulden: this.schuldService.getSchuldenFuerBenutzer(id),
    }).subscribe(({ benutzer, schulden }) => {
      this.benutzer.set(benutzer);
      this.schulden.set(schulden);
      this.qrUrl.set(`${window.location.origin}/schulden/${id}`);
      this.laden.set(false);
    });
  }

  private ladeSchulden(id: string) {
    this.schuldService.getSchuldenFuerBenutzer(id).subscribe((data) => this.schulden.set(data));
  }

  private sortiert(list: Schuld[]): Schuld[] {
    return [...list].sort((a, b) => {
      switch (this.sortierung()) {
        case 'datum-desc': return b.datum.localeCompare(a.datum);
        case 'datum-asc':  return a.datum.localeCompare(b.datum);
        case 'betrag-desc': return b.betrag - a.betrag;
        case 'betrag-asc':  return a.betrag - b.betrag;
      }
    });
  }

  schuld_loeschen_anfragen(id: string) {
    this.confirmSchuldId.set(id);
  }

  schuld_loeschen_bestaetigt() {
    const id = this.confirmSchuldId();
    if (!id) return;
    this.confirmSchuldId.set(null);
    this.schuldService.schuld_loeschen(id).subscribe(() => {
      const bid = this.route.snapshot.paramMap.get('id') ?? '';
      this.ladeSchulden(bid);
      this.toast.show('Schuld gelöscht.');
    });
  }

  schuld_bezahlt(schuldId: string, event: MouseEvent) {
    if (navigator.vibrate) navigator.vibrate(30);
    const scrollY = window.scrollY;

    const btn = event.currentTarget as HTMLElement;
    for (let i = 0; i < 4; i++) {
      const coin = document.createElement('span');
      coin.textContent = '💵';
      coin.className = 'coin-anim';
      coin.style.left = (btn.getBoundingClientRect().left + Math.random() * btn.offsetWidth) + 'px';
      coin.style.top  = (btn.getBoundingClientRect().top  + window.scrollY) + 'px';
      coin.style.animationDelay = (i * 80) + 'ms';
      document.body.appendChild(coin);
      setTimeout(() => coin.remove(), 900);
    }

    const vorher = this.schulden();
    this.schulden.update(list =>
      list.map(s => s.id === schuldId ? { ...s, bezahlt: true, bezahltAm: new Date().toISOString().slice(0, 10) } : s)
    );
    requestAnimationFrame(() => window.scrollTo({ top: scrollY, behavior: 'instant' }));

    this.schuldService.schuld_als_bezahlt_markieren(schuldId).subscribe({
      next: () => this.toast.show('Als bezahlt markiert ✓'),
      error: () => {
        this.schulden.set(vorher);
        this.toast.error('Fehler – bitte erneut versuchen.');
      },
    });
  }

  schuld_wieder_offen(schuldId: string) {
    const scrollY = window.scrollY;
    const vorher = this.schulden();
    this.schulden.update(list =>
      list.map(s => s.id === schuldId ? { ...s, bezahlt: false, bezahltAm: undefined } : s)
    );
    requestAnimationFrame(() => window.scrollTo({ top: scrollY, behavior: 'instant' }));
    this.schuldService.schuld_als_offen_markieren(schuldId).subscribe({
      next: () => this.toast.show('Wieder als offen markiert'),
      error: () => {
        this.schulden.set(vorher);
        this.toast.error('Fehler – bitte erneut versuchen.');
      },
    });
  }

  swipeStartX = new Map<string, number>();
  swipeOffsets = signal<Record<string, number>>({});

  onSwipeStart(id: string, e: TouchEvent) {
    this.swipeStartX.set(id, e.touches[0].clientX);
  }

  onSwipeMove(id: string, e: TouchEvent) {
    const startX = this.swipeStartX.get(id);
    if (startX === undefined) return;
    const dx = e.touches[0].clientX - startX;
    if (dx > 0) return;
    this.swipeOffsets.update(o => ({ ...o, [id]: Math.max(dx, -80) }));
  }

  onSwipeEnd(id: string) {
    const offset = this.swipeOffsets()[id] ?? 0;
    if (offset < -50) {
      this.schuld_loeschen_anfragen(id);
    }
    this.swipeOffsets.update(o => ({ ...o, [id]: 0 }));
    this.swipeStartX.delete(id);
  }

  swipeStyle(id: string): string {
    const offset = this.swipeOffsets()[id] ?? 0;
    return offset !== 0 ? `translateX(${offset}px)` : '';
  }

  fotoAendern(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    const id = this.benutzer()?.id;
    if (!id) return;

    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX = 300;
        const ratio = Math.min(MAX / img.width, MAX / img.height);
        canvas.width  = Math.round(img.width  * ratio);
        canvas.height = Math.round(img.height * ratio);
        canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
        const foto = canvas.toDataURL('image/jpeg', 0.8);
        this.schuldService.benutzer_foto_speichern(id, foto).subscribe(b => {
          this.benutzer.set(b);
          this.toast.show('Foto gespeichert.');
        });
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  }

  benutzer_loeschen_anfragen() {
    this.loeschenPhrase.set('');
    this.confirmBenutzerLoeschen.set(true);
  }

  benutzer_loeschen_bestaetigt() {
    const id = this.benutzer()?.id;
    if (!id) return;
    this.confirmBenutzerLoeschen.set(false);
    this.schuldService.benutzer_loeschen(id).subscribe(() => {
      this.toast.show('Benutzer gelöscht.');
      this.router.navigate(['/benutzer']);
    });
  }

  nameBearbeitenStarten() {
    const b = this.benutzer();
    if (!b) return;
    this.editVorname.set(b.vorname);
    this.editNachname.set(b.nachname);
    this.editTelefon.set(b.telefon);
    this.editBezeichnung.set(b.bezeichnung);
    this.bearbeitetName.set(true);
  }

  nameBearbeitenAbbrechen() { this.bearbeitetName.set(false); }

  nameBearbeitenSpeichern() {
    if (!this.editFormValid()) return;
    const id = this.benutzer()?.id;
    if (!id) return;
    this.speichertName.set(true);
    this.schuldService
      .benutzer_bearbeiten(id, this.editVorname().trim(), this.editNachname().trim(), this.editTelefon().trim(), this.editBezeichnung().trim())
      .subscribe((b) => {
        this.benutzer.set(b);
        this.speichertName.set(false);
        this.bearbeitetName.set(false);
        this.toast.show('Gespeichert.');
      });
  }

  sendWhatsappUebersicht() {
    const url = this.whatsappUebersichtUrl();
    if (url) window.open(url, '_blank');
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

  zurueck() { this.router.navigate(['/benutzer']); }

  schuld_erfassen() {
    const id = this.benutzer()?.id;
    if (id) this.router.navigate(['/'], { queryParams: { benutzerId: id } });
  }

  logout() {
    this.auth.logout();
    this.router.navigate(['/login']);
  }
}
