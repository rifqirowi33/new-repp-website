// managers/AFKManager.js
export class AFKManager {
  constructor(dialogManager, dataManager, state) {
    this.dialog = dialogManager;
    this.data = dataManager;
    this.state = state;

    this.lastActive = Date.now();
    this.lastAFKShown = 0;
    this.specialAFKTriggered = false;

    this.AFK_TIMEOUT = 45000; // 45 seconds
    this.AFK_SPECIAL_DELAY = 120000; // 2 minutes
    this.CHECK_INTERVAL = 5000; // Check every 5 seconds

    this.afkBackup = null;
  }

  startChecking() {
    setInterval(() => this.checkAFK(), this.CHECK_INTERVAL);
  }

  resetTimer() {
    this.lastActive = Date.now();

    if (this.dialog.isInAFKMode()) {
      this.dialog.exitAFKMode();

      if (this.afkBackup) {
        this.dialog.setQueue([...this.afkBackup.q]);
        this.dialog.index = this.afkBackup.idx;
        this.dialog.position = 0;
        this.afkBackup = null;
        this.dialog.startTyping();
      }
    }
  }

  checkAFK() {
    const now = Date.now();
    const afkDuration = now - this.lastActive;

    // Don't trigger AFK if dialog is typing or waiting for choices
    if (this.dialog.isTyping() || this.dialog.isTypingAFK() || this.state.lockInteraction) {
      return;
    }

    // Special AFK after 2 minutes
    if (!this.dialog.isInAFKMode() && 
        afkDuration > this.AFK_SPECIAL_DELAY && 
        this.state.savedName && 
        !this.specialAFKTriggered) {
      this.specialAFKTriggered = true;
      this.fetchLocationAndEnterSpecialAFK();
      return;
    }

    // Regular AFK after 45 seconds
    if (!this.dialog.isInAFKMode() && afkDuration > this.AFK_TIMEOUT) {
      this.enterAFKMode();
      return;
    }

    // Show next AFK message if already in AFK mode
    const sinceLastAFK = now - this.lastAFKShown;
    if (this.dialog.isInAFKMode() && 
        !this.dialog.isTypingAFK() && 
        sinceLastAFK > this.AFK_TIMEOUT) {
      this.showNextAFKMessage();
    }
  }

  async fetchLocationAndEnterSpecialAFK() {
    try {
      const response = await fetch('/api/whoami');
      const data = await response.json();
      const location = data.location || 'tempatmu';
      this.enterSpecialAFK(location);
    } catch (error) {
      this.enterSpecialAFK('tempatmu');
    }
  }

  enterAFKMode() {
    if (this.dialog.isTyping() || this.dialog.isTypingAFK() || this.dialog.isInAFKMode() || this.state.lockInteraction) {
      return;
    }

    this.lastAFKShown = Date.now();
    
    // Backup current dialog state
    this.afkBackup = {
      q: [...this.dialog.queue],
      idx: this.dialog.index
    };

    // Choose random message from quotes or dialog
    const source = Math.random() < 0.5 ? this.data.getAFKDialog() : this.data.getAFKQuotes();
    const isQuotes = (source === this.data.getAFKQuotes());
    const randomLine = this.getRandomItem(source);
    const lines = Array.isArray(randomLine) ? randomLine : [randomLine];

    this.dialog.enterAFKMode(lines.map(l => String(l)), isQuotes);
  }

  showNextAFKMessage() {
    this.lastAFKShown = Date.now();

    const source = Math.random() < 0.5 ? this.data.getAFKDialog() : this.data.getAFKQuotes();
    const isQuotes = (source === this.data.getAFKQuotes());
    const randomLine = this.getRandomItem(source);
    const lines = Array.isArray(randomLine) ? randomLine : [randomLine];

    this.dialog.enterAFKMode(lines.map(l => String(l)), isQuotes);
  }

  enterSpecialAFK(location) {
    this.dialog.afkMode = true;
    this.dialog.isAFKTyping = true;
    this.state.lockInteraction = true;
    this.specialAFKTriggered = false;

    const specialMessages = this.data.getAFKSpecial();
    const personalized = specialMessages.map(line => 
      line.replace('{location}', location || 'tempatmu')
    );

    this.dialog.currentAFKLine = personalized;
    this.dialog.setQueue([...personalized]);
    this.dialog.startTyping();

    // After 1 minute, show last messages and return to normal
    setTimeout(() => {
      this.state.lockInteraction = false;
      
      const lastMessages = specialMessages.slice(-4).map(l => 
        l.replace('{location}', location || 'tempatmu')
      );
      
      this.dialog.setQueue(lastMessages);
      this.dialog.startTyping();

      // Exit AFK mode after another 8 seconds
      setTimeout(() => {
        this.dialog.exitAFKMode();

        if (this.afkBackup) {
          this.dialog.setQueue([...this.afkBackup.q]);
          this.dialog.index = this.afkBackup.idx;
          this.dialog.position = 0;
          this.afkBackup = null;
          this.dialog.startTyping();
        }
      }, 8000);
    }, 60000);
  }

  getRandomItem(array) {
    return array[Math.floor(Math.random() * array.length)];
  }
}