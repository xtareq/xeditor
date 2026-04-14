import {
  Component, signal, output, input, OnInit, HostListener, inject
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Store } from '@tauri-apps/plugin-store';

export interface AppSettings {
  fontSize: number;
  fontColor: string;
  autosave: boolean;
  autosaveDelay: number; // ms
  transprency: number;
}

export const DEFAULT_SETTINGS: AppSettings = {
  fontSize: 14,
  fontColor: 'rgba(255,255,255,0.92)',
  autosave: true,
  autosaveDelay: 800,
  transprency: 0
};

@Component({
  selector: 'app-settings-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <!-- Backdrop -->
    <div class="settings-backdrop" (click)="onBackdropClick($event)">
      <!-- Modal -->
      <div class="settings-modal" (click)="$event.stopPropagation()">
        <div class="modal-noise"></div>

        <!-- Header -->
        <div class="modal-header">
          <div class="modal-title-row">
            <div class="modal-icon">
       <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"><path d="M10.546 2.438a1.957 1.957 0 0 0 2.908 0L14.4 1.4a1.959 1.959 0 0 1 3.41 1.413l-.071 1.4a1.96 1.96 0 0 0 2.051 2.054l1.4-.071a1.96 1.96 0 0 1 1.41 3.41l-1.042.94a1.96 1.96 0 0 0 0 2.909l1.042.94a1.96 1.96 0 0 1-1.413 3.41l-1.4-.071a1.96 1.96 0 0 0-2.056 2.056l.071 1.4A1.96 1.96 0 0 1 14.4 22.6l-.941-1.041a1.96 1.96 0 0 0-2.908 0L9.606 22.6A1.96 1.96 0 0 1 6.2 21.192l.072-1.4a1.96 1.96 0 0 0-2.056-2.056l-1.4.071A1.957 1.957 0 0 1 1.4 14.4l1.041-.94a1.96 1.96 0 0 0 0-2.909L1.4 9.606A1.958 1.958 0 0 1 2.809 6.2l1.4.071a1.96 1.96 0 0 0 2.058-2.06L6.2 2.81A1.959 1.959 0 0 1 9.606 1.4z"/><path d="M7.5 12.001a4.5 4.5 0 1 0 9 0a4.5 4.5 0 0 0-9 0"/></g></svg>
            </div>
            <div>
              <h2 class="modal-title">Settings</h2>
              <p class="modal-subtitle">Customize your writing experience</p>
            </div>
          </div>
          <button class="modal-close" (click)="close.emit()">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        <div class="modal-body">

          <!-- ── Font Size ── -->
          <div class="setting-group">
            <div class="setting-label-row">
              <div class="setting-label">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75">
                  <polyline points="4 7 4 4 20 4 20 7"/>
                  <line x1="9" y1="20" x2="15" y2="20"/>
                  <line x1="12" y1="4" x2="12" y2="20"/>
                </svg>
                Font Size
              </div>
              <span class="setting-value-badge">{{ draft().fontSize }}px</span>
            </div>
            <div class="font-size-control">
              <button class="fs-btn" (click)="adjustFontSize(-1)" [disabled]="draft().fontSize <= 10">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                  <line x1="5" y1="12" x2="19" y2="12"/>
                </svg>
              </button>
              <div class="fs-slider-wrap">
                <input
                  type="range"
                  class="fs-slider"
                  [min]="10"
                  [max]="48"
                  [value]="draft().fontSize"
                  (input)="onFontSizeSlider($event)"
                />
                <div class="fs-track-fill" [style.width.%]="((draft().fontSize - 10) / 38) * 100"></div>
              </div>
              <button class="fs-btn" (click)="adjustFontSize(1)" [disabled]="draft().fontSize >= 48">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                  <line x1="12" y1="5" x2="12" y2="19"/>
                  <line x1="5" y1="12" x2="19" y2="12"/>
                </svg>
              </button>
            </div>
            <div class="fs-preview" [style.font-size.px]="draft().fontSize" [style.color]="draft().fontColor">
              The quick brown fox jumps over the lazy dog.
            </div>
          </div>

          <div class="setting-divider"></div>

          <!-- ── Font Color ── -->
          <div class="setting-group">
            <div class="setting-label-row">
              <div class="setting-label">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75">
                  <path d="M9 3L5 21"/><path d="M19 3L15 21"/>
                  <path d="M5 9h14"/><path d="M3 15h18"/>
                </svg>
                Font Color
              </div>
              <span class="setting-value-badge" [style.color]="draft().fontColor">
                {{ colorLabel(draft().fontColor) }}
              </span>
            </div>

            <div class="color-palette">
              @for (c of allColors; track c.value) {
                <button
                  class="color-swatch"
                  [style.background]="c.value"
                  [class.active]="draft().fontColor === c.value"
                  [title]="c.label"
                  (click)="setFontColor(c.value)"
                >
                  @if (draft().fontColor === c.value) {
                    <svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3">
                      <polyline points="20 6 9 17 4 12"/>
                    </svg>
                  }
                </button>
              }
            </div>

            <!-- Custom hex input -->
            <div class="custom-color-row">
              <div class="custom-color-preview" [style.background]="draft().fontColor"></div>
              <input
                class="custom-color-input"
                type="text"
                placeholder="Custom: rgba(…) or #hex"
                [value]="customColorInput()"
                (input)="onCustomColor($event)"
                (blur)="applyCustomColor()"
                (keydown.enter)="applyCustomColor()"
              />
            </div>
          </div>

          <div class="setting-divider"></div>

          <!-- ── Autosave ── -->
          <div class="setting-group">
            <div class="setting-label-row">
              <div class="setting-label">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75">
                  <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
                  <polyline points="17 21 17 13 7 13 7 21"/>
                  <polyline points="7 3 7 8 15 8"/>
                </svg>
                Autosave
              </div>
              <!-- Toggle switch -->
              <button
                class="toggle-switch"
                [class.on]="draft().autosave"
                (click)="toggleAutosave()"
                [attr.aria-label]="draft().autosave ? 'Disable autosave' : 'Enable autosave'"
              >
                <span class="toggle-knob"></span>
              </button>
            </div>

            <p class="setting-hint">
              @if (draft().autosave) {
                Changes are automatically saved to app storage after
                <strong>{{ draft().autosaveDelay / 1000 }}s</strong> of inactivity.
              } @else {
                Autosave is off. Use <kbd>Ctrl+S</kbd> to save manually.
              }
            </p>

            @if (draft().autosave) {
              <div class="delay-control">
                <span class="delay-label">Delay</span>
                <div class="delay-options">
                  @for (d of delayOptions; track d.value) {
                    <button
                      class="delay-btn"
                      [class.active]="draft().autosaveDelay === d.value"
                      (click)="setDelay(d.value)"
                    >{{ d.label }}</button>
                  }
                </div>
              </div>
            }
          </div>

           <div class="setting-divider"></div>
            <div class="setting-group">
            <div class="setting-label-row">
              <div class="setting-label">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75">
                  <polyline points="4 7 4 4 20 4 20 7"/>
                  <line x1="9" y1="20" x2="15" y2="20"/>
                  <line x1="12" y1="4" x2="12" y2="20"/>
                </svg>
                Transparency
              </div>
              <span class="setting-value-badge">{{ draft().transprency }}%</span>
            </div>
            <div class="font-size-control">
              <!-- <button class="fs-btn" (click)="adjustFontSize(-1)" [disabled]="draft().fontSize <= 10">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                  <line x1="5" y1="12" x2="19" y2="12"/>
                </svg>
              </button> -->
              <div class="fs-slider-wrap">
                <input
                  type="range"
                  class="fs-slider"
                  [min]="0"
                  [max]="100"
                  [value]="draft().transprency"
                  (input)="onTransparencySlider($event)"
                />
                <div class="fs-track-fill" [style.width.%]="((draft().transprency) / 100) * 100"></div>
              </div>
              <!-- <button class="fs-btn" (click)="adjustFontSize(1)" [disabled]="draft().fontSize >= 48">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                  <line x1="12" y1="5" x2="12" y2="19"/>
                  <line x1="5" y1="12" x2="19" y2="12"/>
                </svg>
              </button> -->
            </div>

          </div>

          <div class="setting-divider"></div>

        </div>

        <!-- Footer -->
        <div class="modal-footer">
          <button class="btn-reset" (click)="resetDefaults()">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
              <path d="M3 3v5h5"/>
            </svg>
            Reset defaults
          </button>
          <div class="footer-actions">
            <button class="btn-cancel" (click)="close.emit()">Cancel</button>
            <button class="btn-save" (click)="save()">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
              Save
            </button>
          </div>
        </div>

      </div>
    </div>
  `,
  styles: [`
    /* ── Backdrop ── */
    .settings-backdrop {
      position: fixed;
      inset: 0;
      z-index: 9998;
      background: rgba(0, 0, 0, 0.55);
      backdrop-filter: blur(6px);
      display: flex;
      align-items: center;
      justify-content: center;
      animation: backdropIn 0.2s ease both;
    }
    @keyframes backdropIn {
      from { opacity: 0; }
      to   { opacity: 1; }
    }

    /* ── Modal ── */
    .settings-modal {
      position: relative;
      width: 460px;
      max-width: calc(100vw - 32px);
      max-height: calc(100vh - 80px);
      display: flex;
      flex-direction: column;
      background: rgba(12, 8, 28, 0.82);
      backdrop-filter: blur(64px) saturate(200%) brightness(1.1);
      -webkit-backdrop-filter: blur(64px) saturate(200%) brightness(1.1);
      border: 1px solid rgba(255,255,255,0.12);
      border-top-color: rgba(255,255,255,0.22);
      border-radius: 18px;
      box-shadow:
        0 32px 80px rgba(0,0,0,0.6),
        0 0 0 1px rgba(192,132,252,0.06),
        inset 0 1px 0 rgba(255,255,255,0.08);
      animation: modalIn 0.28s cubic-bezier(0.22, 1, 0.36, 1) both;
      overflow: hidden;
    }
    @keyframes modalIn {
      from { opacity: 0; transform: translateY(16px) scale(0.97); filter: blur(4px); }
      to   { opacity: 1; transform: translateY(0)   scale(1);    filter: blur(0); }
    }

    .modal-noise {
      position: absolute;
      inset: 0;
      border-radius: inherit;
      pointer-events: none;
      opacity: 0.25;
      background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.05'/%3E%3C/svg%3E");
    }

    /* ── Header ── */
    .modal-header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      padding: 20px 20px 16px;
      border-bottom: 1px solid rgba(255,255,255,0.07);
      position: relative;
      z-index: 1;
      flex-shrink: 0;
    }
    .modal-title-row {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .modal-icon {
      width: 38px;
      height: 38px;
      border-radius: 10px;
      background: rgba(192,132,252,0.12);
      border: 1px solid rgba(192,132,252,0.22);
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }
    .modal-icon svg {
      width: 18px;
      height: 18px;
      color: #c084fc;
    }
    .modal-title {
      font-family: 'Roboto', sans-serif;
      font-size: 16px;
      font-weight: 700;
      color: rgba(255,255,255,0.92);
      margin: 0;
      letter-spacing: -0.2px;
    }
    .modal-subtitle {
      font-size: 11px;
      color: rgba(255,255,255,0.35);
      margin: 2px 0 0;
      font-family: 'JetBrains Mono', monospace;
    }
    .modal-close {
      width: 28px;
      height: 28px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: rgba(255,255,255,0.06);
      border: 1px solid rgba(255,255,255,0.1);
      border-radius: 8px;
      color: rgba(255,255,255,0.4);
      cursor: pointer;
      transition: all 0.15s;
      flex-shrink: 0;
    }
    .modal-close svg { width: 12px; height: 12px; }
    .modal-close:hover {
      background: rgba(239,68,68,0.15);
      border-color: rgba(239,68,68,0.2);
      color: rgba(252,165,165,0.9);
    }

    /* ── Body ── */
    .modal-body {
      flex: 1;
      overflow-y: auto;
      padding: 6px 0;
      position: relative;
      z-index: 1;
      scrollbar-width: thin;
      scrollbar-color: rgba(192,132,252,0.2) transparent;
    }
    .modal-body::-webkit-scrollbar { width: 4px; }
    .modal-body::-webkit-scrollbar-thumb {
      background: rgba(192,132,252,0.2);
      border-radius: 999px;
    }

    /* ── Setting groups ── */
    .setting-group {
      padding: 16px 20px;
    }
    .setting-divider {
      height: 1px;
      background: rgba(255,255,255,0.055);
      margin: 0 20px;
    }
    .setting-label-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 12px;
    }
    .setting-label {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 13px;
      font-weight: 700;
      color: rgba(255,255,255,0.78);
      font-family: 'Roboto', sans-serif;
    }
    .setting-label svg {
      width: 14px;
      height: 14px;
      color: #c084fc;
      flex-shrink: 0;
    }
    .setting-value-badge {
      font-family: 'JetBrains Mono', monospace;
      font-size: 11px;
      font-weight: 600;
      padding: 2px 8px;
      border-radius: 4px;
      background: rgba(192,132,252,0.1);
      border: 1px solid rgba(192,132,252,0.2);
      color: #c084fc;
    }

    /* ── Font size control ── */
    .font-size-control {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 12px;
    }
    .fs-btn {
      width: 30px;
      height: 30px;
      flex-shrink: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      background: rgba(255,255,255,0.06);
      border: 1px solid rgba(255,255,255,0.1);
      border-radius: 8px;
      color: rgba(255,255,255,0.5);
      cursor: pointer;
      transition: all 0.15s;
    }
    .fs-btn svg { width: 12px; height: 12px; }
    .fs-btn:hover:not(:disabled) {
      background: rgba(192,132,252,0.12);
      border-color: rgba(192,132,252,0.25);
      color: #c084fc;
    }
    .fs-btn:disabled { opacity: 0.25; cursor: not-allowed; }

    .fs-slider-wrap {
      flex: 1;
      position: relative;
      height: 20px;
      display: flex;
      align-items: center;
    }
    .fs-slider {
      width: 100%;
      height: 4px;
      appearance: none;
      -webkit-appearance: none;
      background: rgba(255,255,255,0.08);
      border-radius: 999px;
      outline: none;
      position: relative;
      z-index: 2;
      cursor: pointer;
    }
    .fs-slider::-webkit-slider-thumb {
      -webkit-appearance: none;
      width: 16px;
      height: 16px;
      border-radius: 50%;
      background: #c084fc;
      border: 2px solid rgba(12,8,28,0.8);
      box-shadow: 0 0 8px rgba(192,132,252,0.5);
      cursor: pointer;
      transition: transform 0.15s;
    }
    .fs-slider::-webkit-slider-thumb:hover { transform: scale(1.2); }
    .fs-track-fill {
      position: absolute;
      left: 0;
      top: 50%;
      transform: translateY(-50%);
      height: 4px;
      background: linear-gradient(90deg, #818cf8, #c084fc);
      border-radius: 999px;
      pointer-events: none;
      z-index: 1;
      transition: width 0.1s;
    }

    .fs-preview {
      padding: 10px 14px;
      background: rgba(255,255,255,0.03);
      border: 1px solid rgba(255,255,255,0.07);
      border-radius: 10px;
      font-family: 'Roboto', sans-serif;
      line-height: 1.6;
      transition: font-size 0.15s, color 0.2s;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    /* ── Color palette ── */
    .color-palette {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      margin-bottom: 12px;
    }
    .color-swatch {
      width: 28px;
      height: 28px;
      border-radius: 7px;
      border: 1px solid rgba(255,255,255,0.15);
      cursor: pointer;
      transition: all 0.12s;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 0;
    }
    .color-swatch svg { width: 12px; height: 12px; }
    .color-swatch:hover {
      transform: scale(1.18);
      box-shadow: 0 2px 10px rgba(0,0,0,0.4);
      z-index: 1;
    }
    .color-swatch.active {
      border-color: rgba(255,255,255,0.7);
      box-shadow: 0 0 0 2px rgba(255,255,255,0.18);
      transform: scale(1.08);
    }
    .custom-color-row {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .custom-color-preview {
      width: 28px;
      height: 28px;
      border-radius: 7px;
      border: 1px solid rgba(255,255,255,0.15);
      flex-shrink: 0;
      transition: background 0.2s;
    }
    .custom-color-input {
      flex: 1;
      background: rgba(255,255,255,0.05);
      border: 1px solid rgba(255,255,255,0.1);
      border-radius: 8px;
      padding: 6px 10px;
      font-family: 'JetBrains Mono', monospace;
      font-size: 11px;
      color: rgba(255,255,255,0.7);
      outline: none;
      transition: border-color 0.15s;
    }
    .custom-color-input::placeholder { color: rgba(255,255,255,0.2); }
    .custom-color-input:focus { border-color: rgba(192,132,252,0.4); }

    /* ── Autosave toggle ── */
    .toggle-switch {
      width: 42px;
      height: 24px;
      border-radius: 999px;
      background: rgba(255,255,255,0.1);
      border: 1px solid rgba(255,255,255,0.12);
      cursor: pointer;
      position: relative;
      transition: all 0.25s cubic-bezier(0.22,1,0.36,1);
      padding: 0;
      flex-shrink: 0;
    }
    .toggle-switch.on {
      background: rgba(192,132,252,0.35);
      border-color: rgba(192,132,252,0.5);
      box-shadow: 0 0 12px rgba(192,132,252,0.3);
    }
    .toggle-knob {
      position: absolute;
      top: 3px;
      left: 3px;
      width: 16px;
      height: 16px;
      border-radius: 50%;
      background: rgba(255,255,255,0.5);
      transition: all 0.25s cubic-bezier(0.22,1,0.36,1);
      display: block;
    }
    .toggle-switch.on .toggle-knob {
      left: calc(100% - 19px);
      background: #c084fc;
      box-shadow: 0 0 6px rgba(192,132,252,0.6);
    }

    .setting-hint {
      font-size: 11px;
      color: rgba(255,255,255,0.35);
      font-family: 'JetBrains Mono', monospace;
      margin: 0 0 12px;
      line-height: 1.6;
    }
    .setting-hint strong { color: rgba(192,132,252,0.8); }
    kbd {
      font-family: 'JetBrains Mono', monospace;
      font-size: 10px;
      padding: 1px 5px;
      background: rgba(255,255,255,0.08);
      border: 1px solid rgba(255,255,255,0.14);
      border-radius: 4px;
      color: rgba(255,255,255,0.55);
    }

    .delay-control {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .delay-label {
      font-size: 11px;
      font-family: 'JetBrains Mono', monospace;
      color: rgba(255,255,255,0.35);
      flex-shrink: 0;
    }
    .delay-options {
      display: flex;
      gap: 4px;
    }
    .delay-btn {
      padding: 4px 10px;
      border-radius: 6px;
      font-family: 'JetBrains Mono', monospace;
      font-size: 11px;
      font-weight: 600;
      background: rgba(255,255,255,0.05);
      border: 1px solid rgba(255,255,255,0.1);
      color: rgba(255,255,255,0.4);
      cursor: pointer;
      transition: all 0.15s;
    }
    .delay-btn:hover {
      background: rgba(255,255,255,0.08);
      color: rgba(255,255,255,0.7);
    }
    .delay-btn.active {
      background: rgba(192,132,252,0.15);
      border-color: rgba(192,132,252,0.3);
      color: #c084fc;
    }

    /* ── Footer ── */
    .modal-footer {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 14px 20px;
      border-top: 1px solid rgba(255,255,255,0.07);
      position: relative;
      z-index: 1;
      flex-shrink: 0;
    }
    .footer-actions { display: flex; gap: 8px; }

    .btn-reset {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 7px 12px;
      background: transparent;
      border: 1px solid rgba(255,255,255,0.1);
      border-radius: 8px;
      font-family: 'Roboto', sans-serif;
      font-size: 11px;
      font-weight: 600;
      color: rgba(255,255,255,0.35);
      cursor: pointer;
      transition: all 0.15s;
    }
    .btn-reset svg { width: 12px; height: 12px; }
    .btn-reset:hover {
      background: rgba(255,255,255,0.06);
      color: rgba(255,255,255,0.6);
      border-color: rgba(255,255,255,0.18);
    }

    .btn-cancel {
      padding: 7px 16px;
      background: rgba(255,255,255,0.05);
      border: 1px solid rgba(255,255,255,0.1);
      border-radius: 8px;
      font-family: 'Roboto', sans-serif;
      font-size: 12px;
      font-weight: 600;
      color: rgba(255,255,255,0.45);
      cursor: pointer;
      transition: all 0.15s;
    }
    .btn-cancel:hover {
      background: rgba(255,255,255,0.08);
      color: rgba(255,255,255,0.7);
    }

    .btn-save {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 7px 18px;
      background: linear-gradient(135deg, rgba(129,140,248,0.35), rgba(192,132,252,0.3));
      border: 1px solid rgba(192,132,252,0.4);
      border-radius: 8px;
      font-family: 'Roboto', sans-serif;
      font-size: 12px;
      font-weight: 700;
      color: #e9d5ff;
      cursor: pointer;
      transition: all 0.2s;
      box-shadow: 0 4px 16px rgba(139,92,246,0.2);
    }
    .btn-save svg { width: 12px; height: 12px; }
    .btn-save:hover {
      background: linear-gradient(135deg, rgba(129,140,248,0.5), rgba(192,132,252,0.45));
      box-shadow: 0 6px 24px rgba(139,92,246,0.35);
      transform: translateY(-1px);
    }
    .btn-save:active { transform: translateY(0); }
  `]
})
export class SettingsModalComponent implements OnInit {

  // ── I/O ───────────────────────────────────────────────────────────────────
  current = input.required<AppSettings>();
  close = output<void>();
  saved = output<AppSettings>();

  // ── State ─────────────────────────────────────────────────────────────────
  draft = signal<AppSettings>({ ...DEFAULT_SETTINGS });
  customColorInput = signal('');

  delayOptions = [
    { label: '0.5s', value: 500 },
    { label: '1s', value: 1000 },
    { label: '2s', value: 2000 },
    { label: '5s', value: 5000 },
  ];

  allColors = [
    { label: 'White', value: 'rgba(255,255,255,0.92)' },
    { label: 'Black', value: 'rgba(0, 0, 0, 0.94)' },
    { label: 'Muted', value: 'rgba(255,255,255,0.50)' },
    { label: 'Purple', value: '#c084fc' },
    { label: 'Indigo', value: '#818cf8' },
    { label: 'Blue', value: '#93c5fd' },
    { label: 'Cyan', value: '#67e8f9' },
    { label: 'Green', value: '#86efac' },
    { label: 'Amber', value: '#fde68a' },
    { label: 'Red', value: '#fca5a5' },
    { label: 'Orange', value: '#fdba74' },
    { label: 'Yellow', value: '#fef08a' },
    { label: 'Lime', value: '#bef264' },
    { label: 'Teal', value: '#5eead4' },
    { label: 'Sky', value: '#7dd3fc' },
    { label: 'Violet', value: '#a78bfa' },
    { label: 'Pink', value: '#f9a8d4' },
  ];

  // ── Lifecycle ─────────────────────────────────────────────────────────────
  ngOnInit() {
    this.draft.set({ ...this.current() });
  }

  // ── Backdrop click ────────────────────────────────────────────────────────
  onBackdropClick(e: MouseEvent) {
    if ((e.target as HTMLElement).classList.contains('settings-backdrop')) {
      this.close.emit();
    }
  }

  @HostListener('document:keydown.escape')
  onEscape() { this.close.emit(); }

  // ── Font size ─────────────────────────────────────────────────────────────
  adjustFontSize(delta: number) {
    const next = Math.min(48, Math.max(10, this.draft().fontSize + delta));
    this.draft.update(d => ({ ...d, fontSize: next }));
  }

  onFontSizeSlider(e: Event) {
    const val = +(e.target as HTMLInputElement).value;
    this.draft.update(d => ({ ...d, fontSize: val }));
  }

  // ── Font color ────────────────────────────────────────────────────────────
  setFontColor(value: string) {
    this.draft.update(d => ({ ...d, fontColor: value }));
    this.customColorInput.set('');
  }

  onCustomColor(e: Event) {
    this.customColorInput.set((e.target as HTMLInputElement).value);
  }

  applyCustomColor() {
    const v = this.customColorInput().trim();
    if (!v) return;
    this.draft.update(d => ({ ...d, fontColor: v }));
  }

  colorLabel(val: string): string {
    return this.allColors.find(c => c.value === val)?.label ?? 'Custom';
  }

  // ── Autosave ──────────────────────────────────────────────────────────────
  toggleAutosave() {
    this.draft.update(d => ({ ...d, autosave: !d.autosave }));
  }

  setDelay(ms: number) {
    this.draft.update(d => ({ ...d, autosaveDelay: ms }));
  }

  // -- Transparency
  onTransparencySlider(e: Event) {
    const val = +(e.target as HTMLInputElement).value;
    this.draft.update(d => ({ ...d, transprency: val }));
  }

  // ── Actions ───────────────────────────────────────────────────────────────
  resetDefaults() {
    this.draft.set({ ...DEFAULT_SETTINGS });
    this.customColorInput.set('');
  }

  save() {
    this.saved.emit({ ...this.draft() });
    this.close.emit();
  }
}
