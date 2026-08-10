import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-avatar',
  imports: [CommonModule],
  template: `
    <div class="avatar" [style.background]="foto ? 'transparent' : farbe">
      @if (foto) {
        <img [src]="foto" alt="" class="avatar-img" />
      } @else {
        <span>{{ initialen }}</span>
      }
    </div>
  `,
  styles: [`
    .avatar {
      width: var(--avatar-size, 2.6rem);
      height: var(--avatar-size, 2.6rem);
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      overflow: hidden;
      font-size: calc(var(--avatar-size, 2.6rem) * 0.35);
      font-weight: 700;
      color: #fff;
      text-transform: uppercase;
      letter-spacing: 0.02em;
      user-select: none;
    }
    .avatar-img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
  `],
})
export class AvatarComponent {
  @Input() vorname = '';
  @Input() nachname = '';
  @Input() foto = '';

  get initialen(): string {
    return (this.vorname[0] ?? '') + (this.nachname[0] ?? '');
  }

  get farbe(): string {
    const farben = ['#2e8b57', '#2980b9', '#8e44ad', '#c0392b', '#d35400', '#16a085'];
    const hash = [...(this.vorname + this.nachname)].reduce((a, c) => a + c.charCodeAt(0), 0);
    return farben[hash % farben.length];
  }
}
