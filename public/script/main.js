// main.js
import { DataManager } from './DataManager.js';
import { DialogManager } from './DialogManager.js';
import { UIManager } from './UIManager.js';
import { ChoiceManager } from './ChoiceManager.js';
import { MenuManager } from './MenuManager.js';
import { AFKManager } from './AFKManager.js';
import { CookieManager } from './CookieManager.js';
import { DialogParser } from './DialogParser.js';

class MainApp {
  constructor() {
    this.dataManager = null;
    this.dialogManager = null;
    this.uiManager = null;
    this.choiceManager = null;
    this.menuManager = null;
    this.afkManager = null;
    this.cookieManager = new CookieManager();
    this.dialogParser = new DialogParser();
    
    this.state = {
      savedName: null,
      seenIntro: false,
      menuUnlocked: false,
      lockInteraction: false,
      currentUrl: "",
      sessionId: null
    };
  }

  /**
   * Ambil Session ID dengan prioritas:
   * 1. Local Storage
   * 2. Cookie (fallback)
   * 3. Query Parameter (untuk persistence setelah reload)
   */
  getSessionId() {
    // 1. Local Storage
    let sessionId = null;
    try {
      sessionId = localStorage.getItem('sessionId');
      if (sessionId) {
        console.log('[CLIENT] Session ID found in localStorage:', sessionId);
        return sessionId;
      }
    } catch (e) {
      console.warn('[CLIENT] localStorage unavailable:', e);
    }

    // 2. Cookie
    sessionId = this.cookieManager.get('sessionId');
    if (sessionId) {
      console.log('[CLIENT] Session ID found in cookie:', sessionId);
      // Sync ke localStorage jika ada
      try {
        localStorage.setItem('sessionId', sessionId);
      } catch (e) {}
      return sessionId;
    }

    // 3. Query Parameter
    const params = new URLSearchParams(window.location.search);
    sessionId = params.get('sessionId');
    if (sessionId) {
      console.log('[CLIENT] Session ID found in URL query:', sessionId);
      // Sync ke localStorage & cookie
      try {
        localStorage.setItem('sessionId', sessionId);
        this.cookieManager.set('sessionId', sessionId, 365);
      } catch (e) {}
      
      // Clean URL (hapus query param)
      this.cleanURLParam();
      return sessionId;
    }

    console.log('[CLIENT] No session ID found');
    return null;
  }

  /**
   * Simpan Session ID ke localStorage dan cookie
   */
  saveSessionId(id) {
    console.log('[CLIENT] Saving session ID:', id);
    
    // Simpan ke localStorage
    try {
      localStorage.setItem('sessionId', id);
      console.log('[CLIENT] Session ID saved to localStorage');
    } catch (e) {
      console.warn('[CLIENT] Failed to save to localStorage:', e);
    }

    // Simpan ke cookie sebagai backup
    this.cookieManager.set('sessionId', id, 365);
    console.log('[CLIENT] Session ID saved to cookie');
    
    this.state.sessionId = id;
  }

  /**
   * Hapus sessionId dari query parameter tanpa reload
   */
  cleanURLParam() {
    const url = new URL(window.location.href);
    if (url.searchParams.has('sessionId')) {
      url.searchParams.delete('sessionId');
      window.history.replaceState({}, '', url.toString());
      console.log('[CLIENT] Cleaned sessionId from URL');
    }
  }

  /**
   * Buat headers untuk fetch request
   */
  getHeaders() {
    const sessionId = this.getSessionId();
    const headers = {
      'Content-Type': 'application/json',
    };
    
    if (sessionId) {
      headers['Authorization'] = `Bearer ${sessionId}`;
    }
    
    return headers;
  }

  async init() {
    console.log('[CLIENT] Initializing app...');
    
    // 1. Load session ID
    this.state.sessionId = this.getSessionId();
    
    // 2. Initialize data manager
    this.dataManager = new DataManager();
    await this.dataManager.loadAll();

    // 3. Fetch user data dari server
    await this.fetchUserData();

    // 4. Initialize UI managers
    this.uiManager = new UIManager();
    this.dialogManager = new DialogManager(
      this.uiManager,
      this.dialogParser,
      this.state,
      this // Pass MainApp instance untuk unlock menu
    );
    
    this.choiceManager = new ChoiceManager(
      this.uiManager,
      this.dialogManager,
      this.dataManager,
      this.state,
      this // Pass MainApp instance untuk akses saveUserName
    );
    
    this.menuManager = new MenuManager(
      this.uiManager,
      this.dialogManager,
      this.choiceManager,
      this.dataManager,
      this.state
    );
    
    this.afkManager = new AFKManager(
      this.dialogManager,
      this.dataManager,
      this.state
    );

    // 5. Setup event listeners
    this.setupEventListeners();

    // 6. Start initial dialog
    this.startInitialDialog();
    
    console.log('[CLIENT] App initialized successfully');
  }

  async fetchUserData() {
    const sessionId = this.state.sessionId;
    
    if (!sessionId) {
      console.log('[CLIENT] No session ID, treating as new visitor');
      this.state.savedName = null;
      this.state.seenIntro = false;
      return;
    }

    try {
      // Kirim session ID via query parameter
      const url = `/api/whoami?sessionId=${sessionId}`;
      console.log('[CLIENT] Fetching user data from:', url);
      
      const response = await fetch(url);
      const data = await response.json();
      
      console.log('[CLIENT] User data received:', data);
      
      if (data.name) {
        this.state.savedName = data.name;
        this.state.seenIntro = !!data.seenIntro;
        console.log(`[CLIENT] Welcome back: ${data.name}`);
      } else {
        console.log('[CLIENT] Session exists but no name found');
        this.state.savedName = null;
        this.state.seenIntro = false;
      }
    } catch (error) {
      console.error('[CLIENT] Failed to fetch user data:', error);
      this.state.savedName = null;
      this.state.seenIntro = false;
    }
  }

  startInitialDialog() {
    const dialogData = this.dataManager.getDialog('global');
    let queue;

    if (!this.state.savedName) {
      console.log('[CLIENT] Starting as new visitor');
      queue = [...dialogData.firstVisit];
    } else if (!this.state.seenIntro) {
      console.log('[CLIENT] Starting as named visitor (intro not seen)');
      queue = dialogData.named.map(line => 
        line.replace('{name}', this.state.savedName)
      );
    } else {
      console.log('[CLIENT] Starting as returning visitor');
      queue = dialogData.returning.map(line => 
        line.replace('{name}', this.state.savedName)
      );
    }

    this.dialogManager.setQueue(queue);
    this.dialogManager.startTyping();
  }

  setupEventListeners() {
    // Click event for dialog box
    this.uiManager.elements.dialogBox.addEventListener('click', () => {
      this.dialogManager.next();
    });

    // Keyboard navigation
    document.addEventListener('keydown', (e) => {
      this.handleKeydown(e);
    });

    // AFK detection
    ['mousemove', 'keydown', 'mousedown', 'touchstart'].forEach(event => {
      document.addEventListener(event, () => {
        if (!this.state.lockInteraction) {
          this.afkManager.resetTimer();
        }
      });
    });

    // Start AFK checker
    this.afkManager.startChecking();
  }

  handleKeydown(e) {
    const key = e.key;

    // Handle choice navigation
    if (this.choiceManager.isWaitingMainChoice()) {
      this.choiceManager.handleMainChoiceKey(key);
      return;
    }

    if (this.choiceManager.isWaitingSubChoice()) {
      this.choiceManager.handleSubChoiceKey(key);
      return;
    }

    if (this.choiceManager.isWaitingTentangChoice()) {
      this.choiceManager.handleTentangChoiceKey(key);
      return;
    }

    if (this.choiceManager.isWaitingProjList()) {
      this.choiceManager.handleProjListKey(key);
      return;
    }

    // Handle menu navigation
    if (this.state.menuUnlocked && !this.dialogManager.isTyping()) {
      if (this.menuManager.handleMenuKey(key)) {
        return;
      }
    }

    // Handle dialog advance
    if (key === 'Enter') {
      this.dialogManager.next();
    }
  }

  async saveUserName(name) {
    console.log('[CLIENT] Saving user name:', name);
    
    try {
      const headers = this.getHeaders();
      
      const response = await fetch('/api/visit', {
        method: 'POST',
        headers: headers,
        body: JSON.stringify({ name })
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      console.log('[CLIENT] Server response:', data);
      
      if (data.ok && data.sessionId) {
        // Simpan session ID
        this.saveSessionId(data.sessionId);
        
        // Update state
        this.state.savedName = name;
        this.state.seenIntro = true;
        
        console.log('[CLIENT] User name saved successfully, session ID:', data.sessionId);
        
        // Lanjutkan dengan dialog
        const dialogData = this.dataManager.getDialog('global');
        const queue = dialogData.named.map(line => line.replace('{name}', name));
        this.dialogManager.setQueue(queue);
        this.dialogManager.startTyping();
        
        return true;
      } else {
        console.error('[CLIENT] Invalid response from server:', data);
        return false;
      }
    } catch (error) {
      console.error('[CLIENT] Failed to save user name:', error);
      return false;
    }
  }

  async markIntroDone() {
    if (!this.state.sessionId) {
      console.warn('[CLIENT] Cannot mark intro done: no session ID');
      return;
    }
    
    try {
      const headers = this.getHeaders();
      
      await fetch('/api/introDone', { 
        method: 'POST', 
        headers: headers 
      });
      
      this.state.seenIntro = true;
      console.log('[CLIENT] Intro marked as done');
    } catch (error) {
      console.warn('[CLIENT] Failed to mark intro done:', error);
    }
  }

  unlockMenu() {
    this.state.menuUnlocked = true;
    this.menuManager.unlock();
    
    // Mark intro as done jika user punya nama
    if (this.state.savedName && !this.state.seenIntro) {
      this.markIntroDone();
    }
  }
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', async () => {
  const app = new MainApp();
  await app.init();
  
  // Expose app to window for debugging
  window.app = app;
});