import { Component, signal, computed, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { forkJoin } from 'rxjs';
import { SchuldService, Benutzer, Strafart, benutzerName } from '../services/schuld.service';
import { AuthService } from '../auth/auth.service';
import { ToastService } from '../services/toast.service';
import { QrScannerComponent } from '../qr-scanner/qr-scanner.component';

export interface Item {
  label: string;
  price: number | null;
}

const CUSTOM_ITEM: Item = { label: '+ Eigener Posten', price: null };

@Component({
  selector: 'app-home',
  imports: [FormsModule, CommonModule, QrScannerComponent],
  templateUrl: './home.html',
  styleUrl: './home.scss',
})
export class Home implements OnInit {
  benutzerListe = signal<Benutzer[]>([]);
  strafarten = signal<Strafart[]>([]);
  laden = signal(true);

  nameInput = signal('');
  selectedBenutzer = signal<Benutzer | null>(null);
  itemInput = signal('');
  selectedItem = signal<Item | null>(null);
  customLabel = signal('');
  customPrice = signal('');
  isCustomItem = signal(false);
  datum = signal(this.todayLocal());
  uhrzeit = signal(this.nowTimeLocal());

  showNameDropdown = signal(false);
  showItemDropdown = signal(false);

  isValidUser = computed(() => this.selectedBenutzer() !== null);

  showUnknownHint = computed(
    () => this.nameInput().length > 0 && !this.isValidUser()
  );

  isLocked = computed(
    () => this.nameInput().length === 0 || this.showUnknownHint()
  );

  isPriceInvalid = computed(() => {
    const v = this.customPrice().trim();
    if (!v) return false;
    return !/^\d+([,]\d{0,2})?$/.test(v);
  });

  isDateTimeReady = computed(() => {
    if (this.isLocked()) return false;
    if (!this.selectedItem()) return false;
    if (this.isCustomItem() && !this.customLabel().trim()) return false;
    if (!this.customPrice().trim()) return false;
    if (this.isPriceInvalid()) return false;
    return true;
  });

  isSubmitting = signal(false);
  toastVisible = signal(false);
  whatsappUrl = signal<string | null>(null);
  showQrScanner = signal(false);
  private toastTimer: ReturnType<typeof setTimeout> | null = null;

  isSubmitDisabled = computed(() => {
    if (this.isSubmitting()) return true;
    if (!this.isDateTimeReady()) return true;
    if (!this.datum().trim()) return true;
    if (!this.uhrzeit().trim()) return true;
    return false;
  });

  filteredUsers = computed(() => {
    const q = this.nameInput().toLowerCase();
    if (!q) return this.benutzerListe();
    return this.benutzerListe().filter((b) =>
      benutzerName(b).toLowerCase().includes(q) ||
      b.vorname.toLowerCase().includes(q) ||
      b.nachname.toLowerCase().includes(q)
    );
  });

  items = computed((): Item[] =>
    this.strafarten().map((s) => ({ label: s.bezeichnung, price: s.betrag }))
  );

  filteredItems = computed((): Item[] => {
    const q = this.itemInput().toLowerCase();
    const alle = this.items();
    const filtered = q ? alle.filter((i) => i.label.toLowerCase().includes(q)) : alle;
    return [...filtered, CUSTOM_ITEM];
  });

  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private schuldService: SchuldService,
    private auth: AuthService,
    private toastService: ToastService
  ) {}

  ngOnInit() {
    forkJoin({
      benutzer: this.schuldService.getBenutzer(),
      strafarten: this.schuldService.getStrafarten(),
    }).subscribe(({ benutzer, strafarten }) => {
      this.benutzerListe.set(benutzer);
      this.strafarten.set(strafarten);
      this.laden.set(false);
      const benutzerId = this.route.snapshot.queryParamMap.get('benutzerId');
      if (benutzerId) {
        const gefunden = benutzer.find((b) => b.id === benutzerId);
        if (gefunden) {
          this.selectedBenutzer.set(gefunden);
          this.nameInput.set(benutzerName(gefunden));
        }
      }
    });
  }

  onNameInput(value: string) {
    this.nameInput.set(value);
    this.selectedBenutzer.set(null);
    this.showNameDropdown.set(true);
  }

  onItemInput(value: string) {
    this.itemInput.set(value);
    this.isCustomItem.set(false);
    this.showItemDropdown.set(true);
  }

  selectUser(benutzer: Benutzer | null) {
    if (benutzer) {
      this.selectedBenutzer.set(benutzer);
      this.nameInput.set(benutzerName(benutzer));
    } else {
      this.selectedBenutzer.set(null);
      this.nameInput.set('');
    }
    this.showNameDropdown.set(false);
  }

  selectItem(item: Item) {
    if (item === CUSTOM_ITEM) {
      this.isCustomItem.set(true);
      this.itemInput.set('');
      this.selectedItem.set(CUSTOM_ITEM);
      this.customLabel.set('');
      this.customPrice.set('');
    } else {
      this.isCustomItem.set(false);
      this.selectedItem.set(item);
      this.itemInput.set(item.label);
      this.customLabel.set('');
      this.customPrice.set(this.formatPriceInput(item.price!));
    }
    this.showItemDropdown.set(false);
  }

  onPriceInput(value: string) {
    this.customPrice.set(value);
  }

  clearItem() {
    this.itemInput.set('');
    this.selectedItem.set(null);
    this.customPrice.set('');
    this.customLabel.set('');
    this.isCustomItem.set(false);
    this.showItemDropdown.set(false);
  }

  onNameBlur() {
    setTimeout(() => this.showNameDropdown.set(false), 150);
  }

  onItemBlur() {
    setTimeout(() => this.showItemDropdown.set(false), 150);
  }

  formatPrice(price: number | null): string {
    if (price === null) return '';
    return this.formatPriceInput(price) + ' €';
  }

  formatPriceInput(price: number): string {
    if (price % 1 === 0) return String(price);
    const s = price.toFixed(2).replace('.', ',');
    return s.endsWith(',00') ? s.slice(0, -3) : s;
  }

  selectAll(event: FocusEvent) {
    const input = event.target as HTMLInputElement;
    setTimeout(() => input.select());
  }

  hinzufuegen() {
    const benutzer = this.selectedBenutzer()!;
    const bezeichnung = this.isCustomItem()
      ? this.customLabel().trim()
      : this.selectedItem()!.label;
    const betrag = parseFloat(this.customPrice().trim().replace(',', '.'));
    const datum = `${this.datum()}T${this.uhrzeit()}`;

    this.isSubmitting.set(true);
    this.schuldService
      .schuld_hinzufuegen({ benutzerId: benutzer.id, bezeichnung, betrag, datum })
      .subscribe({
        next: () => {
          this.isSubmitting.set(false);
          const url = this.buildWhatsappUrl(benutzer.telefon, benutzer.vorname, bezeichnung, betrag);
          this.whatsappUrl.set(url);
          this.resetForm();
          this.showToast();
        },
        error: () => {
          this.isSubmitting.set(false);
          this.toastService.error('Fehler beim Speichern. Bitte erneut versuchen.');
        },
      });
  }

  openWhatsapp() {
    const url = this.whatsappUrl();
    if (url) window.open(url, '_blank');
  }

  private buildWhatsappUrl(telefon: string, vorname: string, bezeichnung: string, betrag: number): string | null {
    if (!telefon?.trim()) return null;
    const nummer = telefon.trim()
      .replace(/\s+/g, '')
      .replace(/^0/, '+49');
    const betragFormatiert = betrag.toFixed(2).replace('.', ',') + ' €';
    const text = `Hallo ${vorname}, du hast eine neue Schuld: ${bezeichnung} – ${betragFormatiert}.`;
    return `https://wa.me/${encodeURIComponent(nummer)}?text=${encodeURIComponent(text)}`;
  }

  private resetForm() {
    this.nameInput.set('');
    this.selectedBenutzer.set(null);
    this.itemInput.set('');
    this.selectedItem.set(null);
    this.customLabel.set('');
    this.customPrice.set('');
    this.isCustomItem.set(false);
    this.datum.set(this.todayLocal());
    this.uhrzeit.set(this.nowTimeLocal());
  }

  private showToast() {
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.toastVisible.set(true);
    this.toastTimer = setTimeout(() => {
      this.toastVisible.set(false);
      this.whatsappUrl.set(null);
    }, 6000);
  }

  navigateToBenutzerUebersicht() {
    this.router.navigate(['/benutzer']);
  }

  onQrScanned(raw: string) {
    this.showQrScanner.set(false);
    try {
      const url = new URL(raw);
      if (url.origin === window.location.origin) {
        this.router.navigateByUrl(url.pathname + url.search + url.hash);
      } else {
        const path = raw.startsWith('/') ? raw : '/' + raw;
        this.router.navigateByUrl(path);
      }
    } catch {
      if (raw.startsWith('/')) {
        this.router.navigateByUrl(raw);
      }
    }
  }

  logout() {
    this.auth.logout();
    this.router.navigate(['/login']);
  }

  private todayLocal(): string {
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  }

  private nowTimeLocal(): string {
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${pad(now.getHours())}:${pad(now.getMinutes())}`;
  }
}
