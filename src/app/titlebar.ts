import { Component, OnInit, OnDestroy, signal, output, HostListener, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { LogicalSize } from '@tauri-apps/api/dpi';

@Component({
    selector: 'app-titlebar',
    standalone: true,
    imports: [CommonModule],
    template: `
    <div class="titlebar" data-tauri-drag-region>

      <!-- Noise grain -->
      <div class="titlebar-noise" data-tauri-drag-region></div>
      <!-- Bottom shimmer -->
      <div class="titlebar-shimmer"></div>

      <!-- ── Left: Logo + App name ── -->
      <div class="titlebar-left" data-tauri-drag-region>
        <div class="titlebar-logo">
          <img src="assets/logo.png" alt="logo" height="14">
        </div>
        <span class="app-name">XEditor</span>
      </div>

      <!-- ── Center: live clock + date ── -->
      <div class="titlebar-center" data-tauri-drag-region *ngIf="router.url !== '/login'">
        <div class="clock-wrap" data-tauri-drag-region>
          <span class="clock-time">{{ currentTime() }}</span>
          <span class="clock-sep" data-tauri-drag-region>·</span>
          <span class="clock-date" data-tauri-drag-region>{{ currentDate() }}</span>
        </div>
      </div>

      <!-- ── Right: settings + window controls ── -->
      <div class="titlebar-right" data-tauri-drag-region>

        <!-- Settings button -->
        <button
          class="ctrl-btn settings-btn"
          (click)="openSettings.emit()"
          title="Settings"
          *ngIf="router.url !== '/login'"
        >
<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"><path d="M10.546 2.438a1.957 1.957 0 0 0 2.908 0L14.4 1.4a1.959 1.959 0 0 1 3.41 1.413l-.071 1.4a1.96 1.96 0 0 0 2.051 2.054l1.4-.071a1.96 1.96 0 0 1 1.41 3.41l-1.042.94a1.96 1.96 0 0 0 0 2.909l1.042.94a1.96 1.96 0 0 1-1.413 3.41l-1.4-.071a1.96 1.96 0 0 0-2.056 2.056l.071 1.4A1.96 1.96 0 0 1 14.4 22.6l-.941-1.041a1.96 1.96 0 0 0-2.908 0L9.606 22.6A1.96 1.96 0 0 1 6.2 21.192l.072-1.4a1.96 1.96 0 0 0-2.056-2.056l-1.4.071A1.957 1.957 0 0 1 1.4 14.4l1.041-.94a1.96 1.96 0 0 0 0-2.909L1.4 9.606A1.958 1.958 0 0 1 2.809 6.2l1.4.071a1.96 1.96 0 0 0 2.058-2.06L6.2 2.81A1.959 1.959 0 0 1 9.606 1.4z"/><path d="M7.5 12.001a4.5 4.5 0 1 0 9 0a4.5 4.5 0 0 0-9 0"/></g></svg>
        </button>

        <!-- Separator -->
        <div class="ctrl-separator"></div>

        <!-- Window controls -->
        <div class="titlebar-controls">
          <button class="ctrl-btn minimize" (click)="minimize()" title="Minimize">
            <svg viewBox="0 0 24 24" fill="none"><line x1="5" y1="12" x2="19" y2="12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
          </button>
          <button class="ctrl-btn maximize" (click)="toggleMaximize()" [title]="isMaximized() ? 'Restore' : 'Maximize'" *ngIf="router.url !== '/login'">
            @if (isMaximized()) {
              <svg viewBox="0 0 24 24" fill="none">
                <rect x="3" y="7" width="11" height="11" rx="1.5" stroke="currentColor" stroke-width="1.75"/>
                <path d="M7 7V5.5A1.5 1.5 0 0 1 8.5 4H18.5A1.5 1.5 0 0 1 20 5.5v10A1.5 1.5 0 0 1 18.5 17H17" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"/>
              </svg>
            } @else {
              <svg viewBox="0 0 24 24" fill="none">
                <rect x="4" y="4" width="16" height="16" rx="2" stroke="currentColor" stroke-width="1.75"/>
              </svg>
            }
          </button>
          <button class="ctrl-btn close" (click)="close()" title="Close">
            <svg viewBox="0 0 24 24" fill="none"><line x1="6" y1="6" x2="18" y2="18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><line x1="18" y1="6" x2="6" y2="18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
          </button>
        </div>

      </div>
    </div>
  `,
    styles: [`
    :host {
      display: block;
      position: fixed;
      top: 0; left: 0; right: 0;
      z-index: 9999;
    }

    .titlebar {
      height: 42px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 4px 0 14px;
      position: relative;
      overflow: visible;
      background: rgba(255, 255, 255, 0.06);
      backdrop-filter: blur(48px) saturate(180%) brightness(1.08);
      -webkit-backdrop-filter: blur(48px) saturate(180%) brightness(1.08);
      border-bottom: 1px solid rgba(255, 255, 255, 0.10);
      user-select: none;
      -webkit-user-select: none;
    }

    .titlebar-noise {
      position: absolute;
      inset: 0;
      pointer-events: none;
      opacity: 0.3;
      background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.05'/%3E%3C/svg%3E");
    }
    .titlebar-shimmer {
      position: absolute;
      bottom: 0; left: 0; right: 0;
      height: 1px;
      pointer-events: none;
      background: linear-gradient(90deg, transparent 0%, rgba(192,132,252,0.3) 30%, rgba(129,140,248,0.3) 70%, transparent 100%);
    }

    .titlebar-left {
      display: flex;
      align-items: center;
      gap: 4px;
      height: 100%;
      -webkit-app-region: drag;
      user-select: none;
    }

    .titlebar-logo {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 22px;
      height: 22px;
      background: rgba(255, 255, 255, 0.15);
      border-radius: 6px;
      backdrop-filter: blur(4px);
      flex-shrink: 0;
    }
    .titlebar-logo img {
      width: 18px;
      height: 18px;
      object-fit: contain;
    }
    .app-name {
      font-family: 'SF Pro Display', -apple-system, 'Segoe UI', sans-serif;
      font-size: 13px;
      font-weight: 600;
      color: rgba(255, 255, 255, 0.92);
    }

    .titlebar-center {
      position: absolute;
      left: 50%; top: 50%;
      transform: translate(-50%, -50%);
      z-index: 1;
      pointer-events: none;
    }
    .clock-wrap {
      display: flex;
      align-items: center;
      gap: 7px;
      pointer-events: none;
    }
    .clock-time {
      font-family: 'JetBrains Mono', monospace;
      font-size: 12px;
      font-weight: 500;
      color: rgba(255, 255, 255, 0.75);
      letter-spacing: 0.5px;
      min-width: 58px;
      text-align: right;
    }
    .clock-sep { font-size: 10px; color: rgba(255, 255, 255, 0.2); }
    .clock-date {
      font-family: 'Syne', sans-serif;
      font-size: 11px;
      font-weight: 500;
      color: rgba(255, 255, 255, 0.35);
      letter-spacing: 0.2px;
      white-space: nowrap;
    }

    .titlebar-right {
      display: flex;
      align-items: center;
      gap: 0;
      flex: 1;
      justify-content: flex-end;
      position: relative;
      z-index: 2;
    }

    .ctrl-separator {
      width: 1px;
      height: 16px;
      background: rgba(255,255,255,0.10);
      margin: 0 4px;
    }

    .titlebar-controls { display: flex; align-items: center; gap: 2px; }

    .ctrl-btn {
      width: 36px; height: 32px;
      display: inline-flex; align-items: center; justify-content: center;
      border: none;
      background: transparent;
      border-radius: 8px;
      color: rgba(255,255,255,0.40);
      cursor: pointer;
      transition: all 0.15s ease;
    }
    .ctrl-btn svg { width: 14px; height: 14px; }
    .ctrl-btn:hover { color: rgba(255,255,255,0.9); }

    .settings-btn:hover {
      background: rgba(192,132,252,0.12);
      color: rgba(192,132,252,0.9);
    }
    .minimize:hover  { background: rgba(255,255,255,0.08); }
    .maximize:hover  { background: rgba(192,132,252,0.12); color: rgba(192,132,252,0.9); }
    .close:hover     { background: rgba(239,68,68,0.18);   color: rgba(252,165,165,0.95); }
    .ctrl-btn:active { transform: scale(0.9); opacity: 0.7; }
  `]
})
export class TitlebarComponent implements OnInit, OnDestroy {

    router = inject(Router);

    isMaximized = signal(false);
    currentTime = signal('');
    currentDate = signal('');

    // Emits when the settings gear is clicked
    openSettings = output<void>();

    private ticker: any;

    ngOnInit() {
        this.tick();
        this.ticker = setInterval(() => this.tick(), 1000);
        this.initWindow();
    }

    ngOnDestroy() {
        clearInterval(this.ticker);
    }

    private tick() {
        const now = new Date();
        this.currentTime.set(now.toLocaleTimeString('en-US', {
            hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true
        }));
        this.currentDate.set(now.toLocaleDateString('en-US', {
            weekday: 'short', month: 'short', day: 'numeric', year: 'numeric'
        }));
    }

    private async initWindow() {
        try {
            const { getCurrentWindow } = await import('@tauri-apps/api/window');
            const win = getCurrentWindow();
            this.isMaximized.set(await win.isMaximized());
            await win.onResized(async () => {
                this.isMaximized.set(await win.isMaximized());
            });
        } catch (e) {
            console.warn('Tauri window API not available:', e);
        }
    }

    async minimize() {
        try {
            const { getCurrentWindow } = await import('@tauri-apps/api/window');
            await getCurrentWindow().minimize();
        } catch (e) { console.warn(e); }
    }

    async toggleMaximize() {
        try {
            const { getCurrentWindow } = await import('@tauri-apps/api/window');
            const win = getCurrentWindow();
            await win.toggleMaximize();
            this.isMaximized.set(await win.isMaximized());
        } catch (e) { console.warn(e); }
    }

    async close() {
        try {
            const { getCurrentWindow } = await import('@tauri-apps/api/window');
            await getCurrentWindow().close();
        } catch (e) { console.warn(e); }
    }
}