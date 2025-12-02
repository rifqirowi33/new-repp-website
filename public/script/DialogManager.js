// managers/DialogManager.js
export class DialogManager {
  constructor(uiManager, dialogParser, state, mainApp = null) {
    this.ui = uiManager;
    this.parser = dialogParser;
    this.state = state;
    this.mainApp = mainApp; // Reference ke MainApp untuk unlock menu

    this.queue = [];
    this.index = 0;
    this.position = 0;
    this.typing = false;
    this.skip = false;
    this.speed = 35;

    this.tagHandlers = {};
    this.afkMode = false;
    this.isAFKTyping = false;
    this.isAFKQuotes = false;
    this.currentAFKLine = "";
  }

  setQueue(queue) {
    this.queue = queue;
    this.index = 0;
    this.position = 0;
  }

  isTyping() {
    return this.typing;
  }

  registerTagHandler(tag, handler) {
    this.tagHandlers[tag] = handler;
  }

  startTyping() {
    if (this.index >= this.queue.length) {
      console.warn('Queue selesai');
      return;
    }

    this.typing = true;
    this.skip = false;
    this.ui.hideArrow();

    const { content, tag } = this.parser.parse(this.queue[this.index]);
    const html = this.parser.renderLinks(content);
    const plainText = this.parser.stripHTML(html);

    this.typeCharacter(plainText, html, tag);
  }

  typeCharacter(plainText, html, tag) {
    if (this.position < plainText.length && !this.skip) {
      this.ui.setDialogText(plainText.slice(0, ++this.position));
      setTimeout(() => this.typeCharacter(plainText, html, tag), this.speed);
      return;
    }

    this.typing = false;

    if (this.afkMode && this.index >= this.queue.length - 1) {
      this.isAFKTyping = false;
    }

    this.ui.setDialogHTML(html);

    setTimeout(() => {
      this.ui.showArrow();

      if (this.afkMode) {
        const delayBaris = this.isAFKQuotes ? 5000 : 2000;
        setTimeout(() => {
          this.index++;
          if (this.index < this.queue.length) {
            this.position = 0;
            this.ui.clearDialogText();
            this.startTyping();
          }
        }, delayBaris);
      }
    }, 100);

    // Handle tags
    if (tag && this.tagHandlers[tag]) {
      setTimeout(() => this.tagHandlers[tag](), 600);
    }

    // Handle menu unlock
    if (!this.state.menuUnlocked && plainText.toLowerCase().includes('silahkan pilih')) {
      if (this.mainApp) {
        this.mainApp.unlockMenu();
      }
    }
  }

  next() {
    if (this.typing || this.state.lockInteraction) {
      return;
    }

    this.index++;
    if (this.index >= this.queue.length) {
      this.ui.hideArrow();
      return;
    }

    this.position = 0;
    this.ui.clearDialogText();
    this.startTyping();
  }

  skipTyping() {
    this.skip = true;
  }

  // AFK Mode Methods
  enterAFKMode(lines, isQuotes = false) {
    this.afkMode = true;
    this.isAFKTyping = true;
    this.isAFKQuotes = isQuotes;
    this.currentAFKLine = lines;
    this.setQueue(lines);
    this.startTyping();
  }

  exitAFKMode() {
    this.afkMode = false;
    this.isAFKTyping = false;
    this.isAFKQuotes = false;
  }

  isInAFKMode() {
    return this.afkMode;
  }

  isTypingAFK() {
    return this.isAFKTyping;
  }
}