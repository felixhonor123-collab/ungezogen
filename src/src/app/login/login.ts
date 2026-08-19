import { Component, signal, computed, ViewChildren, QueryList, ElementRef, AfterViewInit } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService } from '../auth/auth.service';

@Component({
  selector: 'app-login',
  imports: [CommonModule],
  templateUrl: './login.html',
  styleUrl: './login.scss',
})
export class Login implements AfterViewInit {
  digits = signal<string[]>(['', '', '', '']);
  isLoading = signal(false);
  errorMsg = signal('');

  @ViewChildren('digitInput') digitInputs!: QueryList<ElementRef<HTMLInputElement>>;

  isComplete = computed(() => this.digits().every((d) => d !== ''));

  constructor(private auth: AuthService, private router: Router) {}

  zumLeaderboard() {
    this.router.navigate(['/leaderboard']);
  }

  ngAfterViewInit() {
    this.focusFirst();
  }

  onDigitInput(index: number, event: Event) {
    const input = event.target as HTMLInputElement;
    const val = input.value.replace(/\D/g, '').slice(-1);
    input.value = val;
    const updated = [...this.digits()];
    updated[index] = val;
    this.digits.set(updated);
    this.errorMsg.set('');

    if (val && index < 3) {
      this.focusIndex(index + 1);
    }
    if (val && updated.every((d) => d !== '')) {
      this.submit(updated.join(''));
    }
  }

  onKeydown(index: number, event: KeyboardEvent) {
    if (event.key === 'Backspace') {
      event.preventDefault();
      const updated = [...this.digits()];
      const input = this.digitInputs.toArray()[index].nativeElement;
      if (updated[index]) {
        updated[index] = '';
        input.value = '';
        this.digits.set(updated);
      } else if (index > 0) {
        updated[index - 1] = '';
        this.digitInputs.toArray()[index - 1].nativeElement.value = '';
        this.digits.set(updated);
        this.focusIndex(index - 1);
      }
    }
  }

  onPaste(event: ClipboardEvent) {
    event.preventDefault();
    const text = event.clipboardData?.getData('text') ?? '';
    const digits = text.replace(/\D/g, '').slice(0, 4).split('');
    const updated = ['', '', '', ''];
    digits.forEach((d, i) => (updated[i] = d));
    this.digits.set(updated);
    const nextEmpty = updated.findIndex((d) => !d);
    this.focusIndex(nextEmpty === -1 ? 3 : nextEmpty);
    if (updated.every((d) => d !== '')) {
      this.submit(updated.join(''));
    }
  }

  private submit(code: string) {
    this.isLoading.set(true);
    this.errorMsg.set('');
    this.auth.login(code).subscribe({
      next: () => {
        this.isLoading.set(false);
        this.router.navigate(['/']);
      },
      error: () => {
        this.isLoading.set(false);
        this.errorMsg.set('Ungültiger Code. Bitte erneut versuchen.');
        this.digits.set(['', '', '', '']);
        this.digitInputs.forEach((el) => (el.nativeElement.value = ''));
        setTimeout(() => this.focusFirst(), 50);
      },
    });
  }

  private focusFirst() {
    this.focusIndex(0);
  }

  private focusIndex(index: number) {
    const inputs = this.digitInputs?.toArray();
    if (inputs?.[index]) {
      inputs[index].nativeElement.focus();
    }
  }
}
