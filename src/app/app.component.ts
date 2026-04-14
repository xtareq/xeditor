import {
  Component, signal, computed, ElementRef, inject, OnInit, OnDestroy,
  AfterViewInit, ViewChild, HostListener
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { TitlebarComponent } from './titlebar';
import { SettingsModalComponent, AppSettings, DEFAULT_SETTINGS } from './settings-modal.component';
import { CloseConfirmModalComponent } from './close-confirm-modal.component';
import { invoke } from '@tauri-apps/api/core';
import { save, open } from '@tauri-apps/plugin-dialog';
import { listen } from '@tauri-apps/api/event';
import { Store } from '@tauri-apps/plugin-store';
import { open as OpenShell } from '@tauri-apps/plugin-shell';
import { marked, Renderer } from 'marked';
import hljs from 'highlight.js';

interface JournalTab {
  id: string;
  title: string;
  content: string;
  createdAt: Date;
  updatedAt: Date;
  wordCount: number;
  pinned: boolean;
  fileType: string;
  diskPath: string | null;
  fontSize: number;
}

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, TitlebarComponent, SettingsModalComponent, CloseConfirmModalComponent],
  templateUrl: "./app.component.html",
  styleUrl: "./app.component.css"
})
export class AppComponent implements OnInit, AfterViewInit, OnDestroy {



  tabs = signal<JournalTab[]>([]);
  activeTabId = signal<string | null>(null);
  searchQuery = '';
  searchFocused = signal(false);
  saved = signal(true);
  charCount = signal(0);
  lineCount = signal(1);
  sidebarCollapsed = signal(true);
  colorPickerOpen = signal(false);
  activeColor = signal<string>('rgba(255,255,255,0.92)');
  editorMode = signal<'edit' | 'preview' | 'split'>('split'); // ← default split
  renderedMd = signal('');
  fontSize = signal<number>(14);
  contextMenu = signal<{ x: number; y: number; visible: boolean }>({ x: 0, y: 0, visible: false });
  settingsOpen = signal(false);
  settings = signal<AppSettings>({ ...DEFAULT_SETTINGS });
  tabListDropdownOpen = signal(false);
  newFileMenuOpen = signal(false);

  // ── Close confirm modal ───────────────────────────────────────────────────
  closeConfirm = signal<{
    visible: boolean;
    tabId: string;
    tabTitle: string;
    hasDiskPath: boolean;
    hasContent: boolean;
  } | null>(null);

  // ── Find & Replace ────────────────────────────────────────────────────────
  findReplaceOpen = signal(false);
  findQuery = signal('');
  replaceQuery = signal('');
  findMatchCase = signal(false);
  findWholeWord = signal(false);
  findMatches = signal<{ start: number; end: number }[]>([]);
  findCurrentIndex = signal(0);

  private savedSelection: Range | null = null;
  private store!: Store;
  private saveTimer: any;
  private el = inject(ElementRef);
  private viewReady = false;
  private pendingActiveId: string | null = null;

  themeColors = [
    { label: 'White', value: 'rgba(255,255,255,0.92)' },
    { label: 'Muted', value: 'rgba(255,255,255,0.50)' },
    { label: 'Purple', value: '#c084fc' },
    { label: 'Indigo', value: '#818cf8' },
    { label: 'Blue', value: '#93c5fd' },
    { label: 'Cyan', value: '#67e8f9' },
    { label: 'Green', value: '#86efac' },
    { label: 'Amber', value: '#fde68a' },
  ];

  paletteColors = [
    { label: 'Red', value: '#fca5a5' },
    { label: 'Orange', value: '#fdba74' },
    { label: 'Yellow', value: '#fef08a' },
    { label: 'Lime', value: '#bef264' },
    { label: 'Teal', value: '#5eead4' },
    { label: 'Sky', value: '#7dd3fc' },
    { label: 'Violet', value: '#a78bfa' },
    { label: 'Pink', value: '#f9a8d4' },
  ];

  textColor = this.paletteColors[1].value;

  // ── Computed ──────────────────────────────────────────────────────────────

  activeTab = computed(() => this.tabs().find(t => t.id === this.activeTabId()) ?? null);
  pinnedTabs = computed(() => this.tabs().filter(t => t.pinned));
  filteredTabs = computed(() => {
    const q = this.searchQuery.toLowerCase().trim();
    return this.tabs().filter(t => !t.pinned).filter(t =>
      !q || t.title.toLowerCase().includes(q) || t.content.toLowerCase().includes(q)
    );
  });
  totalWords = computed(() => this.tabs().reduce((sum, t) => sum + t.wordCount, 0));
  // Pinned tabs first, then unpinned — for the top tab bar
  orderedTabs = computed(() => [
    ...this.tabs().filter(t => t.pinned),
    ...this.tabs().filter(t => !t.pinned),
  ]);

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  async ngOnInit() {
    this.store = await Store.load('journal.json', { defaults: {}, autoSave: true });
    await this.loadFromStorage();
    await this.loadSettings();
    this.setupMarked();
    this.registerFileOpenListener();
    await this.checkPendingFile();
  }

  private async checkPendingFile() {
    try {
      const path = await invoke<string | null>('get_pending_file');
      console.log('checkPendingFile result:', path);
      if (path) await this.openFileFromPath(path);
    } catch (e) {
      console.error('checkPendingFile error:', e);
    }
  }

  ngAfterViewInit() {
    this.viewReady = true;
    // If loadFromStorage resolved before the view was ready, activate now.
    if (this.pendingActiveId) {
      this.setActive(this.pendingActiveId);
      this.pendingActiveId = null;
    }
  }

  ngOnDestroy() { clearTimeout(this.saveTimer); }

  // ── File open listener (CLI arg / single instance passthrough) ────────────

  private async registerFileOpenListener() {
    await listen<string>('open-file', async (event) => {
      const path = event.payload;
      if (!path) return;

      const existing = this.tabs().find(t => t.diskPath === path);
      if (existing) {
        this.setActive(existing.id);
        return;
      }

      await this.openFileFromPath(path);
    });
  }

  // ── Tab management ────────────────────────────────────────────────────────

  toggleSidebar() { this.sidebarCollapsed.update(v => !v); }

  toggleTabListDropdown() { this.tabListDropdownOpen.update(v => !v); this.newFileMenuOpen.set(false); }
  closeTabListDropdown() { this.tabListDropdownOpen.set(false); }
  toggleNewFileMenu() { this.newFileMenuOpen.update(v => !v); this.tabListDropdownOpen.set(false); }
  closeNewFileMenu() { this.newFileMenuOpen.set(false); }

  newTabOfType(type: 'txt' | 'md') {
    this.newFileMenuOpen.set(false);
    if (type === 'md') { this.newMarkdownTab(); } else { this.newTab(); }
  }

  setEditorMode(mode: 'edit' | 'preview' | 'split') {
    this.editorMode.set(mode);
    if (mode === 'preview') {
      this.renderMarkdown();
    } else {
      // Switching back to edit or split — the editor pane re-appears in the DOM,
      // so we must repopulate it. setTimeout lets Angular render the pane first.
      setTimeout(() => {
        this.syncEditorContent();
        if (mode === 'split') this.renderMarkdown();
      }, 0);
    }
  }

  newTab() {
    const tab: JournalTab = {
      id: crypto.randomUUID(), title: '', content: '',
      createdAt: new Date(), updatedAt: new Date(), wordCount: 0, pinned: false,
      fileType: 'txt',
      diskPath: null,
      fontSize: 14,
    };
    this.tabs.update(t => [...t, tab]);
    this.setActive(tab.id);
  }

  newMarkdownTab() {
    const tab: JournalTab = {
      id: crypto.randomUUID(), title: '', content: '',
      createdAt: new Date(), updatedAt: new Date(), wordCount: 0, pinned: false,
      fileType: 'md',
      diskPath: null,
      fontSize: 14,
    };
    this.tabs.update(t => [...t, tab]);
    this.setActive(tab.id);
  }


  setActive(id: string) {
    this.activeTabId.set(id);
    const tab = this.tabs().find(t => t.id === id);
    this.fontSize.set(tab?.fontSize ?? 14);

    // For non-MD files, force edit mode so syncEditorContent never
    // hits the early-return preview branch and skips rendering content.
    if (tab && !this.isMdFile(tab.fileType)) {
      this.editorMode.set('edit');
    }

    // Do NOT touch the editor DOM here — Angular hasn't re-rendered yet
    // and getEditorEl() still points at the previous tab's element.
    // All style + content application happens inside syncEditorContent()
    // after the setTimeout lets the view update first.

    if (this.isMdFile(tab?.fileType ?? '') && this.editorMode() !== 'edit') {
      setTimeout(() => { this.syncEditorContent(); this.renderMarkdown(); }, 0);
    } else {
      setTimeout(() => this.syncEditorContent(), 0);
    }
    setTimeout(() => {
      const tabEl = this.el.nativeElement.querySelector(`.tabbar-tab[data-id="${id}"]`);
      tabEl?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
    }, 0);
  }

  closeTab(id: string, e: Event) {
    e.stopPropagation();
    const tab = this.tabs().find(t => t.id === id);
    if (!tab) return;

    // Case 1: empty & never saved — close silently, nothing to lose
    if (!tab.content.trim() && !tab.diskPath) {
      this.doCloseTab(id);
      return;
    }

    // Case 2: file exists on disk AND no pending unsaved changes — close silently
    // (saved signal only tracks the active tab, so compare updatedAt as fallback)
    const isActiveTab = this.activeTabId() === id;
    const alreadySaved = tab.diskPath && (isActiveTab ? this.saved() : true);
    if (alreadySaved) {
      this.doCloseTab(id);
      return;
    }

    // Case 3: has unsaved changes — show confirm modal
    this.closeConfirm.set({
      visible: true,
      tabId: id,
      tabTitle: tab.title || 'Untitled',
      hasDiskPath: !!tab.diskPath,
      hasContent: !!tab.content.trim(),
    });
  }

  // Called by confirm modal buttons
  async confirmSaveAndClose() {
    const c = this.closeConfirm();
    if (!c) return;
    this.closeConfirm.set(null);
    // Switch to the tab so saveToDisk works on the right tab
    const prevActive = this.activeTabId();
    this.activeTabId.set(c.tabId);
    await this.saveToDisk();
    this.doCloseTab(c.tabId);
    // Restore active if a different tab was active before
    if (prevActive && prevActive !== c.tabId) {
      const stillExists = this.tabs().find(t => t.id === prevActive);
      if (stillExists) setTimeout(() => this.setActive(prevActive), 0);
    }
  }

  confirmDiscardAndClose() {
    const c = this.closeConfirm();
    if (!c) return;
    this.closeConfirm.set(null);
    this.doCloseTab(c.tabId);
  }

  confirmCancelClose() {
    this.closeConfirm.set(null);
  }

  private doCloseTab(id: string) {
    const remaining = this.tabs().filter(t => t.id !== id);
    this.tabs.set(remaining);
    if (this.activeTabId() === id) {
      const nextId = remaining[0]?.id ?? null;
      this.activeTabId.set(nextId);
      if (nextId) setTimeout(() => this.setActive(nextId), 0);
    }
    this.saveToStorage();
  }

  togglePin() {
    const id = this.activeTabId();
    if (!id) return;
    this.tabs.update(tabs => tabs.map(t => t.id === id ? { ...t, pinned: !t.pinned } : t));
    this.saveToStorage();
  }

  // ── Font size ─────────────────────────────────────────────────────────────

  applyFontSize(delta: number) {
    const newSize = Math.min(48, Math.max(10, this.fontSize() + delta));
    this.fontSize.set(newSize);
    const id = this.activeTabId();
    if (!id) return;
    this.tabs.update(tabs => tabs.map(t => t.id === id ? { ...t, fontSize: newSize } : t));
    const editor = this.getEditorEl();
    if (editor) editor.style.fontSize = `${newSize}px`;
    this.scheduleSave();
  }

  // ── Monaco ────────────────────────────────────────────────────────────────

  getMonacoLanguage(ext: string): string {
    const map: Record<string, string> = {
      js: 'javascript', ts: 'typescript', json: 'json',
      html: 'html', css: 'css', scss: 'scss',
      rs: 'rust', py: 'python', java: 'java',
      c: 'c', cpp: 'cpp', h: 'cpp',
      xml: 'xml', svg: 'xml', yaml: 'yaml', yml: 'yaml',
      toml: 'ini', sh: 'shell', md: 'markdown',
      sql: 'sql', cs: 'csharp', go: 'go', rb: 'ruby',
      php: 'php', swift: 'swift', kt: 'kotlin',
      ini: 'ini', env: 'plaintext', log: 'plaintext',
    };
    return map[ext] ?? 'plaintext';
  }

  buildMonacoOptions(tab: JournalTab): object {
    return {
      language: this.getMonacoLanguage(tab.fileType),
      theme: 'vs-dark',
      fontSize: tab.fontSize ?? 14,
      fontFamily: 'JetBrains Mono, Fira Code, monospace',
      fontLigatures: true,
      minimap: { enabled: false },
      scrollBeyondLastLine: false,
      wordWrap: 'on',
      automaticLayout: true,
      lineNumbers: 'on',
      renderLineHighlight: 'line',
      tabSize: 2,
      insertSpaces: true,
      contextmenu: false,
      scrollbar: { verticalScrollbarSize: 4, horizontalScrollbarSize: 4 },
      padding: { top: 16, bottom: 16 },
    };
  }

  // ── Color picker ──────────────────────────────────────────────────────────

  openColorPicker() {
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0) {
      this.savedSelection = sel.getRangeAt(0).cloneRange();
    }
    this.colorPickerOpen.update(v => !v);
  }

  applyColor(color: string) {
    this.activeColor.set(color);
    this.colorPickerOpen.set(false);

    const editor = this.getEditorEl();
    if (!editor) return;

    if (this.savedSelection) {
      const sel = window.getSelection();
      sel?.removeAllRanges();
      sel?.addRange(this.savedSelection);
      this.savedSelection = null;
    }

    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0 || sel.isCollapsed) {
      editor.focus();
      return;
    }

    const range = sel.getRangeAt(0);
    const selectedContent = range.extractContents();
    const span = document.createElement('span');
    span.style.color = color;
    span.appendChild(selectedContent);
    range.insertNode(span);

    range.setStartAfter(span);
    range.setEndAfter(span);
    sel.removeAllRanges();
    sel.addRange(range);

    editor.focus();
    editor.dispatchEvent(new Event('input', { bubbles: true }));
  }

  resetColor() {
    this.activeColor.set('rgba(255,255,255,0.92)');
    this.colorPickerOpen.set(false);

    const editor = this.getEditorEl();
    if (!editor) return;

    if (this.savedSelection) {
      const sel = window.getSelection();
      sel?.removeAllRanges();
      sel?.addRange(this.savedSelection);
      this.savedSelection = null;
    }

    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0 || sel.isCollapsed) {
      editor.focus();
      return;
    }

    const range = sel.getRangeAt(0);
    const selectedContent = range.extractContents();

    const strip = (node: Node): Node => {
      if (node.nodeType === Node.ELEMENT_NODE) {
        const el = node as HTMLElement;
        el.style.color = '';
        if (el.tagName === 'SPAN' && !el.style.cssText && !el.className) {
          const frag = document.createDocumentFragment();
          Array.from(el.childNodes).forEach(child => frag.appendChild(strip(child)));
          return frag;
        }
        Array.from(el.childNodes).forEach(child => { el.replaceChild(strip(child), child); });
      }
      return node;
    };

    const cleaned = strip(selectedContent);
    range.insertNode(cleaned);
    editor.focus();
    editor.dispatchEvent(new Event('input', { bubbles: true }));
  }

  // ── Context menu ──────────────────────────────────────────────────────────

  showContextMenu(e: MouseEvent) {
    e.preventDefault();
    this.contextMenu.set({ x: e.clientX, y: e.clientY, visible: true });
  }

  hideContextMenu() {
    this.contextMenu.update(m => ({ ...m, visible: false }));
  }

  async ctxCopy() {
    const sel = window.getSelection()?.toString();
    if (sel) await navigator.clipboard.writeText(sel);
    this.hideContextMenu();
  }

  async ctxCut() {
    const sel = window.getSelection()?.toString();
    if (sel) {
      await navigator.clipboard.writeText(sel);
      document.execCommand('delete');
    }
    this.hideContextMenu();
  }

  async ctxPaste() {
    const text = await navigator.clipboard.readText();
    document.execCommand('insertText', false, text);
    this.hideContextMenu();
  }

  ctxSelectAll() {
    const editor = this.getEditorEl();
    if (editor) {
      const range = document.createRange();
      range.selectNodeContents(editor);
      const sel = window.getSelection();
      sel?.removeAllRanges();
      sel?.addRange(range);
    }
    this.hideContextMenu();
  }

  ctxUndo() { document.execCommand('undo'); this.hideContextMenu(); }
  ctxRedo() { document.execCommand('redo'); this.hideContextMenu(); }

  hasSelection(): boolean {
    return (window.getSelection()?.toString().length ?? 0) > 0;
  }

  // ── File I/O 
  async saveToDisk() {
    const tab = this.activeTab();
    if (!tab) return;

    const content = tab.content;

    if (tab.diskPath) {
      try {
        await invoke('save_file', { path: tab.diskPath, content });
        this.saved.set(true);
      } catch (err) {
        console.error('Save failed:', err);
      }
      return;
    }

    try {
      const path = await save({
        defaultPath: `${tab.title || 'untitled'}.${tab.fileType}`,
        filters: [{
          name: tab.fileType === 'md' ? 'Markdown' : 'Text',
          extensions: [tab.fileType]
        }]
      });

      if (!path) return;

      await invoke('save_file', { path, content });

      this.tabs.update(tabs => tabs.map(t =>
        t.id === tab.id ? { ...t, diskPath: path } : t
      ));
      await this.saveToStorage();
      this.saved.set(true);
    } catch (err) {
      console.error('Save As failed:', err);
    }
  }

  async openFile() {
    try {
      const path = await open({
        filters: [
          { name: 'All Editable Files', extensions: ['txt', 'md', 'json', 'yaml', 'yml', 'toml', 'csv', 'html', 'css', 'js', 'ts', 'rs', 'py', 'java', 'c', 'cpp', 'h', 'xml', 'svg', 'sh', 'env', 'ini', 'log'] },
          { name: 'All Files', extensions: ['*'] }
        ]
      }) as string | null;

      if (!path) return;
      await this.openFileFromPath(path);
    } catch (err) {
      console.error('Open failed:', err);
    }
  }

  // Shared open logic used by both openFile() and registerFileOpenListener()
  private async openFileFromPath(path: string) {
    try {
      const content: string = await invoke('read_file', { path });
      const fileName = path.split('/').pop()?.split('\\').pop() ?? 'untitled';
      const ext = fileName.includes('.') ? fileName.split('.').pop()!.toLowerCase() : 'txt';
      const title = fileName.replace(new RegExp(`\\.${ext}$`, 'i'), '');

      const tab: JournalTab = {
        id: crypto.randomUUID(),
        title,
        content: content,
        createdAt: new Date(),
        updatedAt: new Date(),
        wordCount: this.countWords(content),
        pinned: false,
        fileType: ext,
        diskPath: path,
        fontSize: 14,
      };

      this.tabs.update(t => [tab, ...t]);

      // Set appropriate mode before setActive so syncEditorContent uses the right branch
      if (this.isMdFile(ext)) {
        this.editorMode.set('split'); // ← default split for MD files
        this.setActive(tab.id);
        setTimeout(() => this.renderMarkdown(), 50);
      } else {
        this.editorMode.set('edit'); // ← always edit for non-MD
        this.setActive(tab.id);
      }

      await this.saveToStorage();
    } catch (err) {
      console.error('Failed to open file:', err);
    }
  }

  isMdFile(ext: string): boolean {
    return ext === 'md' || ext === 'markdown';
  }

  // ── Editor ────────────────────────────────────────────────────────────────

  private getEditorEl(): HTMLElement | null {
    return this.el.nativeElement.querySelector('.editor-content');
  }

  syncEditorContent() {
    const tab = this.activeTab();

    // Only bail early for preview if this is actually an MD file
    if (this.editorMode() === 'preview') {
      if (tab && this.isMdFile(tab.fileType)) {
        this.renderMarkdown();
        return;
      }
      // Non-MD file — fall through and render content normally
    }

    const editor = this.getEditorEl();

    if (editor && tab) {
      // Single code path — all files treated as plain text, no HTML/rich-text ever.
      editor.style.whiteSpace = 'pre-wrap';
      editor.style.fontFamily = this.isMdFile(tab.fileType) ? 'monospace' : 'inherit';
      editor.style.fontSize = `${tab.fontSize ?? 14}px`;
      editor.innerText = tab.content;
      this.updateStats(tab.content);

      if (this.isMdFile(tab.fileType) && this.editorMode() !== 'edit') {
        setTimeout(() => this.renderMarkdown(), 0);
      }
    }
  }

  onPreviewClick(e: MouseEvent) {
    const target = (e.target as HTMLElement).closest('a');
    if (!target) return;

    const href = target.getAttribute('href');
    if (!href) return;

    e.preventDefault();
    e.stopPropagation();

    if (href.startsWith('http://') || href.startsWith('https://')) {
      OpenShell(href);
    }
  }

  onContentChange(e: Event) {
    const editor = e.target as HTMLElement;
    const tab = this.activeTab();
    const content = editor.innerText || '';
    const text = content;

    this.updateStats(text);
    this.saved.set(false);

    const id = this.activeTabId();
    if (!id) return;

    this.tabs.update(tabs => tabs.map(t =>
      t.id === id ? { ...t, content, wordCount: this.countWords(text), updatedAt: new Date() } : t
    ));

    if (this.isMdFile(tab?.fileType ?? '') && this.editorMode() !== 'edit') {
      this.renderMarkdown();
    }

    clearTimeout(this.saveTimer);
    if (this.settings().autosave) {
      this.saveTimer = setTimeout(() => { this.saveToStorage(); this.saved.set(true); }, this.settings().autosaveDelay);
    }
  }

  updateTitle(title: string) {
    const id = this.activeTabId();
    if (!id) return;
    this.tabs.update(tabs => tabs.map(t => t.id === id ? { ...t, title, updatedAt: new Date() } : t));
    this.scheduleSave();
  }

  format(command: string, value?: string) {
    document.execCommand(command, false, value);
    this.getEditorEl()?.focus();
  }

  onKeyDown(e: KeyboardEvent) {
    if (e.key === 'Tab') { e.preventDefault(); document.execCommand('insertText', false, '    '); }
    if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); this.saveToDisk(); }
    if ((e.ctrlKey || e.metaKey) && e.key === 'f') { e.preventDefault(); this.openFindReplace(false); }
    if ((e.ctrlKey || e.metaKey) && e.key === 'h') { e.preventDefault(); this.openFindReplace(true); }
    if (e.key === 'Escape') { this.closeFindReplace(); }
    if ((e.ctrlKey || e.metaKey) && e.key === 'g') { e.preventDefault(); this.findNext(); }
  }

  @HostListener('document:keydown', ['$event'])
  onGlobalKeyDown(e: KeyboardEvent) {
    if ((e.ctrlKey || e.metaKey) && e.key === 'f') { e.preventDefault(); this.openFindReplace(false); }
    if ((e.ctrlKey || e.metaKey) && e.key === 'h') { e.preventDefault(); this.openFindReplace(true); }
    if (e.key === 'Escape' && this.findReplaceOpen()) { e.preventDefault(); this.closeFindReplace(); }
  }

  @HostListener('document:click', ['$event'])
  onDocClick(e: MouseEvent) {
    if (!(e.target as HTMLElement).closest('.color-picker-wrap')) {
      this.colorPickerOpen.set(false);
    }
    if (!(e.target as HTMLElement).closest('.ctx-menu')) {
      this.hideContextMenu();
    }
  }

  @HostListener('document:contextmenu', ['$event'])
  onDocRightClick(e: MouseEvent) {
    if ((e.target as HTMLElement).closest('.editor-area')) {
      this.showContextMenu(e);
    }
  }

  // ── Markdown renderer ─────────────────────────────────────────────────────

  // No CDN / no network calls — marked and highlight.js are npm dependencies.
  // Run: npm install marked highlight.js
  private setupMarked() {
    const renderer = new Renderer();
    renderer.code = ({ text, lang }: { text: string; lang?: string }) => {
      const validLang = lang && hljs.getLanguage(lang) ? lang : '';
      const highlighted = validLang
        ? hljs.highlight(text, { language: validLang }).value
        : hljs.highlightAuto(text).value;
      return `<pre class="md-pre" data-lang="${validLang || ''}"><code class="hljs">${highlighted}</code></pre>`;
    };
    marked.use({ renderer, breaks: true, gfm: true });
  }

  renderMarkdown() {
    const tab = this.activeTab();
    if (!tab || !this.isMdFile(tab.fileType)) return;
    const result = marked.parse(tab.content);
    if (typeof result === 'string') {
      this.renderedMd.set(result);
    } else {
      (result as Promise<string>).then(html => this.renderedMd.set(html));
    }
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  private updateStats(text: string) {
    this.charCount.set(text.replace(/\n/g, '').length);
    this.lineCount.set((text.match(/\n/g)?.length ?? 0) + 1);
  }

  private countWords(text: string): number {
    return text.trim().split(/\s+/).filter(w => w.length > 0).length;
  }

  private scheduleSave() {
    this.saved.set(false);
    clearTimeout(this.saveTimer);
    if (!this.settings().autosave) return; // manual save only
    this.saveTimer = setTimeout(() => { this.saveToStorage(); this.saved.set(true); }, this.settings().autosaveDelay);
  }

  // ── Persistence (Tauri Store) ─────────────────────────────────────────────

  private async saveToStorage() {
    try {
      await this.store.set('tabs', JSON.stringify(this.tabs()));
      await this.store.set('active', this.activeTabId() ?? '');
    } catch (e) { console.error('saveToStorage error:', e); }
  }

  private async loadFromStorage() {
    try {
      const raw = await this.store.get<string>('tabs');
      if (raw) {
        const parsed = JSON.parse(raw).map((t: any) => ({
          ...t,
          createdAt: new Date(t.createdAt),
          updatedAt: new Date(t.updatedAt),
          fileType: t.fileType ?? 'txt',
          diskPath: t.diskPath ?? null,
          fontSize: t.fontSize ?? 14,
        }));
        this.tabs.set(parsed);

        const activeId = await this.store.get<string>('active');
        const targetId = (activeId && parsed.find((t: JournalTab) => t.id === activeId))
          ? activeId
          : parsed[0]?.id ?? null;

        if (targetId) {
          if (this.viewReady) {
            // View already mounted — safe to call setActive directly.
            setTimeout(() => this.setActive(targetId), 0);
          } else {
            // View not yet mounted — store id and let ngAfterViewInit pick it up.
            this.pendingActiveId = targetId;
            // Still set the signal so the template renders the correct tab shell.
            this.activeTabId.set(targetId);
          }
        }
      }
    } catch (e) { console.error('loadFromStorage error:', e); }
  }

  // ── Find & Replace ────────────────────────────────────────────────────────

  openFindReplace(focusReplace = false) {
    this.findReplaceOpen.set(true);
    // Pre-fill find with current selection if any
    const sel = window.getSelection()?.toString().trim();
    if (sel) this.findQuery.set(sel);
    setTimeout(() => {
      const el = this.el.nativeElement.querySelector(
        focusReplace ? '.fr-replace-input' : '.fr-find-input'
      ) as HTMLInputElement;
      el?.focus();
      el?.select();
      if (this.findQuery()) this.runFind();
    }, 50);
  }

  closeFindReplace() {
    this.findReplaceOpen.set(false);
    this.findMatches.set([]);
    this.findCurrentIndex.set(0);
    this.clearHighlights();
    this.getEditorEl()?.focus();
  }

  onFindQueryChange(val: string) {
    this.findQuery.set(val);
    this.runFind();
  }

  toggleMatchCase() {
    this.findMatchCase.update(v => !v);
    this.runFind();
  }

  toggleWholeWord() {
    this.findWholeWord.update(v => !v);
    this.runFind();
  }

  runFind() {
    const query = this.findQuery();
    const editor = this.getEditorEl();
    if (!editor || !query) {
      this.findMatches.set([]);
      this.findCurrentIndex.set(0);
      this.clearHighlights();
      return;
    }

    const text = editor.innerText;
    const matches: { start: number; end: number }[] = [];
    const flags = this.findMatchCase() ? 'g' : 'gi';
    let pattern = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    if (this.findWholeWord()) pattern = `\\b${pattern}\\b`;

    try {
      const regex = new RegExp(pattern, flags);
      let m: RegExpExecArray | null;
      while ((m = regex.exec(text)) !== null) {
        matches.push({ start: m.index, end: m.index + m[0].length });
        if (matches.length > 5000) break; // safety cap
      }
    } catch { /* invalid regex */ }

    this.findMatches.set(matches);
    this.findCurrentIndex.set(matches.length > 0 ? 0 : -1);
    this.highlightMatches(matches, 0);
  }

  findNext() {
    const matches = this.findMatches();
    if (!matches.length) return;
    const next = (this.findCurrentIndex() + 1) % matches.length;
    this.findCurrentIndex.set(next);
    this.highlightMatches(matches, next);
    this.scrollToMatch(next);
  }

  findPrev() {
    const matches = this.findMatches();
    if (!matches.length) return;
    const prev = (this.findCurrentIndex() - 1 + matches.length) % matches.length;
    this.findCurrentIndex.set(prev);
    this.highlightMatches(matches, prev);
    this.scrollToMatch(prev);
  }

  replaceOne() {
    const matches = this.findMatches();
    const idx = this.findCurrentIndex();
    if (!matches.length || idx < 0) return;

    const tab = this.activeTab();
    if (!tab) return;

    const content = tab.content;
    const match = matches[idx];
    const newContent =
      content.slice(0, match.start) +
      this.replaceQuery() +
      content.slice(match.end);

    this.updateTabContent(newContent);
    // Re-run find after replacement to refresh match positions
    setTimeout(() => this.runFind(), 0);
  }

  replaceAll() {
    const query = this.findQuery();
    const tab = this.activeTab();
    if (!query || !tab) return;

    const flags = this.findMatchCase() ? 'g' : 'gi';
    let pattern = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    if (this.findWholeWord()) pattern = `\\b${pattern}\\b`;

    try {
      const regex = new RegExp(pattern, flags);
      const newContent = tab.content.replace(regex, this.replaceQuery());
      this.updateTabContent(newContent);
    } catch { /* invalid regex */ }

    setTimeout(() => this.runFind(), 0);
  }

  private updateTabContent(newContent: string) {
    const id = this.activeTabId();
    if (!id) return;
    this.tabs.update(tabs => tabs.map(t =>
      t.id === id
        ? { ...t, content: newContent, wordCount: this.countWords(newContent), updatedAt: new Date() }
        : t
    ));
    // Sync editor DOM
    const editor = this.getEditorEl();
    if (editor) {
      editor.innerText = newContent;
      this.updateStats(newContent);
    }
    this.scheduleSave();
    if (this.isMdFile(this.activeTab()?.fileType ?? '') && this.editorMode() !== 'edit') {
      this.renderMarkdown();
    }
  }

  private highlightMatches(matches: { start: number; end: number }[], currentIdx: number) {
    const editor = this.getEditorEl();
    if (!editor) return;

    this.clearHighlights();
    if (!matches.length) return;

    const text = editor.innerText;
    const frag = document.createDocumentFragment();
    let cursor = 0;

    matches.forEach((m, i) => {
      // Text before match
      if (m.start > cursor) {
        frag.appendChild(document.createTextNode(text.slice(cursor, m.start)));
      }
      const span = document.createElement('mark');
      span.className = i === currentIdx ? 'fr-match fr-match-current' : 'fr-match';
      span.textContent = text.slice(m.start, m.end);
      frag.appendChild(span);
      cursor = m.end;
    });

    // Remaining text
    if (cursor < text.length) {
      frag.appendChild(document.createTextNode(text.slice(cursor)));
    }

    editor.innerHTML = '';
    editor.appendChild(frag);
  }

  private scrollToMatch(idx: number) {
    const marks = this.el.nativeElement.querySelectorAll('.fr-match');
    const el = marks[idx] as HTMLElement;
    el?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }

  private clearHighlights() {
    const editor = this.getEditorEl();
    if (!editor) return;
    const marks = editor.querySelectorAll('mark.fr-match');
    if (!marks.length) return;
    // Flatten marks back to plain text without disturbing other content
    marks.forEach(mark => {
      const text = document.createTextNode(mark.textContent || '');
      mark.replaceWith(text);
    });
    // Normalize merges adjacent text nodes
    editor.normalize();
  }

  // ── Settings ──────────────────────────────────────────────────────────────

  openSettings() { this.settingsOpen.set(true); }
  closeSettings() { this.settingsOpen.set(false); }

  onSettingsSaved(s: AppSettings) {
    this.settings.set(s);
    this.saveSettings(s);
    this.applySettings(s);
  }

  private applySettings(s: AppSettings) {
    // Apply font size to active tab
    const id = this.activeTabId();
    if (id) {
      this.fontSize.set(s.fontSize);
      this.tabs.update(tabs => tabs.map(t => t.id === id ? { ...t, fontSize: s.fontSize } : t));
      const editor = this.getEditorEl();
      if (editor) editor.style.fontSize = `${s.fontSize}px`;
    }
    // Apply font color globally
    this.activeColor.set(s.fontColor);

    const alpha = (s.transprency ?? 100) / 100;
    document.body.style.background = `rgba(2, 0, 2, ${alpha})`;
  }

  private async saveSettings(s: AppSettings) {
    try {
      await this.store.set('settings', JSON.stringify(s));
    } catch (e) { console.error('saveSettings error:', e); }
  }

  private async loadSettings() {
    try {
      const raw = await this.store.get<string>('settings');
      if (raw) {
        const s: AppSettings = { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
        this.settings.set(s);
        this.activeColor.set(s.fontColor);
        this.fontSize.set(s.fontSize);
        const alpha = (s.transprency ?? 100) / 100;
        document.body.style.background = `rgba(2, 0, 2, ${alpha})`;
      }
    } catch (e) { console.error('loadSettings error:', e); }
  }

  // ── Date helpers ──────────────────────────────────────────────────────────

  formatRelative(date: Date): string {
    const diff = Date.now() - date.getTime();
    const mins = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  formatFullDate(date: Date): string {
    return date.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  }
}