import { Component, Input, Output, EventEmitter } from '@angular/core';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-confirm-dialog',
  imports: [FormsModule],
  template: `
    <div class="overlay" (click)="abbrechen.emit()">
      <div class="dialog" (click)="$event.stopPropagation()">
        <p class="dialog-text">{{ text }}</p>
        @if (phrase) {
          <div class="phrase-group">
            <p class="phrase-hinweis">Gib <strong>{{ phrase }}</strong> ein um zu bestätigen:</p>
            <input
              class="phrase-input"
              type="text"
              [placeholder]="phrase"
              [(ngModel)]="phraseInput"
              autocomplete="off"
            />
          </div>
        }
        <div class="dialog-actions">
          <button class="btn-ghost" type="button" (click)="abbrechen.emit()">Abbrechen</button>
          <button class="btn-danger" type="button" [disabled]="phrase && phraseInput !== phrase" (click)="bestaetigt.emit()">{{ confirmLabel }}</button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .overlay {
      position: fixed; inset: 0;
      background: rgba(0,0,0,0.45);
      display: flex; align-items: flex-end; justify-content: center;
      z-index: 400;
      padding-bottom: env(safe-area-inset-bottom);
    }
    .dialog {
      background: #fff;
      border-radius: 16px 16px 0 0;
      padding: 1.5rem 1.25rem calc(1.5rem + env(safe-area-inset-bottom));
      width: 100%;
      max-width: 480px;
      display: flex;
      flex-direction: column;
      gap: 1.25rem;
      animation: slideUp 0.25s ease;
    }
    .dialog-text {
      margin: 0;
      font-size: 1rem;
      color: #1a1a1a;
      text-align: center;
      font-weight: 500;
    }
    .dialog-actions {
      display: flex;
      gap: 0.75rem;
    }
    .btn-ghost {
      flex: 1; padding: 0.85rem; background: #fff; color: #6b7c6b;
      border: 1.5px solid #d1ddd1; border-radius: 10px;
      font-size: 1rem; font-weight: 600; cursor: pointer;
      touch-action: manipulation; -webkit-appearance: none; appearance: none;
      &:active { background: #f5f7f5; }
    }
    .btn-danger {
      flex: 1; padding: 0.85rem; background: #c0392b; color: #fff;
      border: none; border-radius: 10px;
      font-size: 1rem; font-weight: 600; cursor: pointer;
      touch-action: manipulation; -webkit-appearance: none; appearance: none;
      &:disabled { background: #e8c4c0; cursor: not-allowed; }
      &:not(:disabled):active { background: #a93226; }
    }
    .phrase-group {
      display: flex; flex-direction: column; gap: 0.5rem;
    }
    .phrase-hinweis {
      margin: 0; font-size: 0.88rem; color: #555;
    }
    .phrase-input {
      width: 100%; padding: 0.65rem 0.85rem;
      border: 1.5px solid #c0392b; border-radius: 8px;
      font-size: 0.95rem; box-sizing: border-box;
      font-family: monospace; outline: none;
      &:focus { border-color: #922b21; box-shadow: 0 0 0 2px rgba(192,57,43,0.15); }
    }
    @keyframes slideUp {
      from { transform: translateY(100%); }
      to   { transform: translateY(0); }
    }
  `],
})
export class ConfirmDialog {
  @Input() text = 'Bist du sicher?';
  @Input() confirmLabel = 'Löschen';
  @Input() phrase = '';
  phraseInput = '';
  @Output() bestaetigt = new EventEmitter<void>();
  @Output() abbrechen = new EventEmitter<void>();
}
