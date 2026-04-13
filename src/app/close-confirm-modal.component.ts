import { Component, input, output, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';

export interface CloseConfirmState {
  visible: boolean;
  tabId: string;
  tabTitle: string;
  hasDiskPath: boolean;
  hasContent: boolean;
}

@Component({
  selector: 'app-close-confirm',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="cc-backdrop" (click)="onBackdrop($event)">
      <div class="cc-modal" (click)="$event.stopPropagation()">
        <div class="cc-noise"></div>
        <div class="cc-glow"></div>

        <!-- Icon -->
        <div class="cc-icon" [class.cc-icon-warn]="!state().hasDiskPath">
          @if (state().hasDiskPath) {
            <!-- Existing file: save icon -->
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75">
              <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
              <polyline points="17 21 17 13 7 13 7 21"/>
              <polyline points="7 3 7 8 15 8"/>
            </svg>
          } @else {
            <!-- Unsaved new file: warning icon -->
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
              <line x1="12" y1="9" x2="12" y2="13"/>
              <line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
          }
        </div>

        <!-- Title & message -->
        <div class="cc-content">
          <h3 class="cc-title">
            @if (state().hasDiskPath) {
              Save changes?
            } @else {
              Unsaved file
            }
          </h3>

          @if (state().hasDiskPath) {
            <p class="cc-msg">
              <span class="cc-filename">{{ state().tabTitle || 'Untitled' }}</span>
              has unsaved changes. Save before closing?
            </p>
          } @else {
            <p class="cc-msg">
              <span class="cc-filename">{{ state().tabTitle || 'Untitled' }}</span>
              has never been saved to disk. What would you like to do?
            </p>
          }
        </div>

        <!-- Actions -->
        <div class="cc-actions">
          <!-- Cancel — always present -->
          <button class="cc-btn cc-btn-cancel" (click)="cancel.emit()">
            Cancel
          </button>

          <div class="cc-actions-right">
            <!-- Discard — always present -->
            <button class="cc-btn cc-btn-discard" (click)="discard.emit()">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="3 6 5 6 21 6"/>
                <path d="M19 6l-1 14H6L5 6"/>
                <path d="M10 11v6M14 11v6"/>
                <path d="M9 6V4h6v2"/>
              </svg>
              @if (state().hasDiskPath) { Discard changes } @else { Don't save }
            </button>

            <!-- Save — always present -->
            <button class="cc-btn cc-btn-save" (click)="save.emit()" cdkFocusInitial>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
                <polyline points="17 21 17 13 7 13 7 21"/>
                <polyline points="7 3 7 8 15 8"/>
              </svg>
              @if (state().hasDiskPath) { Save } @else { Save as… }
            </button>
          </div>
        </div>

      </div>
    </div>
  `,
  styles: [`
    /* ── Backdrop ── */
    .cc-backdrop {
      position: fixed;
      inset: 0;
      z-index: 10000;
      background: rgba(0, 0, 0, 0.6);
      backdrop-filter: blur(8px);
      -webkit-backdrop-filter: blur(8px);
      display: flex;
      align-items: center;
      justify-content: center;
      animation: ccFadeIn 0.15s ease both;
    }
    @keyframes ccFadeIn {
      from { opacity: 0; }
      to   { opacity: 1; }
    }

    /* ── Modal ── */
    .cc-modal {
      position: relative;
      width: 400px;
      max-width: calc(100vw - 32px);
      background: rgba(10, 6, 24, 0.90);
      backdrop-filter: blur(64px) saturate(200%);
      -webkit-backdrop-filter: blur(64px) saturate(200%);
      border: 1px solid rgba(255, 255, 255, 0.11);
      border-top-color: rgba(255, 255, 255, 0.2);
      border-radius: 18px;
      padding: 28px 24px 20px;
      box-shadow:
        0 32px 80px rgba(0, 0, 0, 0.65),
        inset 0 1px 0 rgba(255, 255, 255, 0.07);
      animation: ccSlideUp 0.22s cubic-bezier(0.22, 1, 0.36, 1) both;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 16px;
      overflow: hidden;
    }
    @keyframes ccSlideUp {
      from { opacity: 0; transform: translateY(20px) scale(0.96); filter: blur(6px); }
      to   { opacity: 1; transform: translateY(0)    scale(1);    filter: blur(0); }
    }

    /* Noise texture */
    .cc-noise {
      position: absolute;
      inset: 0;
      border-radius: inherit;
      pointer-events: none;
      opacity: 0.2;
      background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.05'/%3E%3C/svg%3E");
    }

    /* Ambient glow */
    .cc-glow {
      position: absolute;
      top: -40px;
      left: 50%;
      transform: translateX(-50%);
      width: 200px;
      height: 120px;
      background: radial-gradient(ellipse, rgba(192, 132, 252, 0.12), transparent 70%);
      pointer-events: none;
      filter: blur(20px);
    }

    /* ── Icon ── */
    .cc-icon {
      position: relative;
      z-index: 1;
      width: 52px;
      height: 52px;
      border-radius: 14px;
      background: rgba(192, 132, 252, 0.1);
      border: 1px solid rgba(192, 132, 252, 0.22);
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }
    .cc-icon svg {
      width: 24px;
      height: 24px;
      color: #c084fc;
    }
    .cc-icon.cc-icon-warn {
      background: rgba(251, 191, 36, 0.08);
      border-color: rgba(251, 191, 36, 0.22);
    }
    .cc-icon.cc-icon-warn svg {
      color: #fde68a;
    }

    /* ── Content ── */
    .cc-content {
      position: relative;
      z-index: 1;
      text-align: center;
    }
    .cc-title {
      font-family: 'Roboto', sans-serif;
      font-size: 17px;
      font-weight: 700;
      color: rgba(255, 255, 255, 0.92);
      margin: 0 0 8px;
      letter-spacing: -0.2px;
    }
    .cc-msg {
      font-family: 'Roboto', sans-serif;
      font-size: 13px;
      color: rgba(255, 255, 255, 0.45);
      margin: 0;
      line-height: 1.6;
    }
    .cc-filename {
      color: rgba(192, 132, 252, 0.85);
      font-weight: 600;
    }

    /* ── Actions ── */
    .cc-actions {
      position: relative;
      z-index: 1;
      width: 100%;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      margin-top: 4px;
    }
    .cc-actions-right {
      display: flex;
      gap: 8px;
    }

    /* Shared button base */
    .cc-btn {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 8px 16px;
      border-radius: 9px;
      font-family: 'Roboto', sans-serif;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.15s;
      white-space: nowrap;
    }
    .cc-btn svg {
      width: 13px;
      height: 13px;
      flex-shrink: 0;
    }

    /* Cancel */
    .cc-btn-cancel {
      background: transparent;
      border: 1px solid rgba(255, 255, 255, 0.1);
      color: rgba(255, 255, 255, 0.35);
    }
    .cc-btn-cancel:hover {
      background: rgba(255, 255, 255, 0.06);
      color: rgba(255, 255, 255, 0.6);
      border-color: rgba(255, 255, 255, 0.18);
    }

    /* Discard / Don't save */
    .cc-btn-discard {
      background: rgba(239, 68, 68, 0.08);
      border: 1px solid rgba(239, 68, 68, 0.2);
      color: rgba(252, 165, 165, 0.7);
    }
    .cc-btn-discard:hover {
      background: rgba(239, 68, 68, 0.15);
      border-color: rgba(239, 68, 68, 0.35);
      color: rgba(252, 165, 165, 0.95);
      transform: translateY(-1px);
    }
    .cc-btn-discard:active { transform: translateY(0); }

    /* Save / Save as */
    .cc-btn-save {
      background: linear-gradient(135deg, rgba(129, 140, 248, 0.35), rgba(192, 132, 252, 0.3));
      border: 1px solid rgba(192, 132, 252, 0.4);
      color: #e9d5ff;
      box-shadow: 0 4px 16px rgba(139, 92, 246, 0.2);
    }
    .cc-btn-save:hover {
      background: linear-gradient(135deg, rgba(129, 140, 248, 0.5), rgba(192, 132, 252, 0.45));
      box-shadow: 0 6px 24px rgba(139, 92, 246, 0.35);
      transform: translateY(-1px);
    }
    .cc-btn-save:active { transform: translateY(0); }
  `]
})
export class CloseConfirmModalComponent {
  state = input.required<CloseConfirmState>();
  save    = output<void>();
  discard = output<void>();
  cancel  = output<void>();

  onBackdrop(e: MouseEvent) {
    if ((e.target as HTMLElement).classList.contains('cc-backdrop')) {
      this.cancel.emit();
    }
  }

  @HostListener('document:keydown', ['$event'])
  onKey(e: KeyboardEvent) {
    if (e.key === 'Escape') { e.preventDefault(); this.cancel.emit(); }
    if (e.key === 'Enter')  { e.preventDefault(); this.save.emit(); }
  }
}
