// managers/MenuManager.js
export class MenuManager {
  constructor(uiManager, dialogManager, choiceManager, dataManager, state) {
    this.ui = uiManager;
    this.dialog = dialogManager;
    this.choice = choiceManager;
    this.data = dataManager;
    this.state = state;

    this.currentIndex = 0;
    this.setupMenuItems();
  }

  setupMenuItems() {
    const menuItems = this.ui.getMenuItems();

    menuItems.forEach((li, i) => {
      const btn = li.querySelector('.icon-btn');
      
      btn.onclick = async () => {
        if (this.ui.elements.menu.classList.contains('disabled')) return;
        
        const path = btn.dataset.link;
        await this.handleMenuClick(path);
      };
    });
  }

  async handleMenuClick(path) {
    if (path === '/proyek') {
      await this.openProyek();
    } else if (path === '/tentang') {
      await this.openTentang();
    } else if (path === '/catatan') {
      await this.openCatatan();
    } else if (path === '/pesan') {
      await this.openPesan();
    } else {
      window.location.href = path;
    }
  }

  async openProyek() {
    this.ui.disableMenu();
    this.state.menuUnlocked = false;

    await this.data.loadDialogProyek();
    const proyekData = this.data.getDialog('proyek');
    
    let intro = proyekData.proyekIntro || proyekData.intro || [
      '<askProject>Kamu ingin mengetahui tentang Proyek ya?>'
    ];

    if (!Array.isArray(intro)) {
      intro = ['<askProject>Kamu ingin mengetahui tentang Proyek ya?>'];
    }

    this.dialog.setQueue([...intro]);
    this.dialog.startTyping();
  }

  async openTentang() {
    await Promise.all([
      this.data.loadDialogTentangku(),
      this.data.loadTentangkuHTML()
    ]);

    this.ui.disableMenu();
    this.state.menuUnlocked = false;

    const tentangData = this.data.getDialog('tentangku');
    
    let intro = tentangData.intro;
    if (!Array.isArray(intro) || intro.length === 0) {
      intro = ['<askTentangku>Kamu ingin berkenalan dengan penciptaku ya?'];
    } else {
      intro = intro.map((line, i, arr) => 
        i === arr.length - 1 ? `<askTentangku>${line}` : line
      );
    }

    this.dialog.setQueue(intro);
    this.dialog.startTyping();
  }

  async openCatatan() {
    this.ui.disableMenu();
    this.state.menuUnlocked = false;

    this.showSimpleDialog('Kamu ingin melihat catatanku?', [
      { text: 'Iya', action: () => this.showCatatanContent() },
      { text: 'Tidak', action: () => this.returnToMenu() }
    ]);
  }

  showCatatanContent() {
    const lines = [
      'Wahh sayang sekali,',
      'Aku belum menemukan catatanku',
      'karena catatanku telah hilang,',
      'Aku sedang mencarinya,',
      'Silahkan kembali lain waktu'
    ];

    let idx = 0;
    const showNext = () => {
      if (idx < lines.length) {
        this.showSimpleDialog(lines[idx], [], () => {
          idx++;
          showNext();
        });
      } else {
        this.returnToMenu();
      }
    };
    showNext();
  }

  async openPesan() {
    this.ui.disableMenu();
    this.state.menuUnlocked = false;

    this.showSimpleDialog('Kamu ingin mengirim pesan padaku?', [
      { text: 'Iya', action: () => this.showPesanContent() },
      { text: 'Tidak', action: () => this.returnToMenu() }
    ]);
  }

  showPesanContent() {
    const lines = [
      'Wahh, jaringanku masih bermasalah,',
      'aku tidak bisa menerima pesan dari mu',
      'akan kuperbaiki',
      'Silahkan kembali lain waktu'
    ];

    let idx = 0;
    const showNext = () => {
      if (idx < lines.length) {
        this.showSimpleDialog(lines[idx], [], () => {
          idx++;
          showNext();
        });
      } else {
        this.returnToMenu();
      }
    };
    showNext();
  }

  returnToMenu() {
    this.ui.enableMenu();
    this.state.menuUnlocked = true;
    this.highlight(this.currentIndex);

    this.dialog.setQueue(['Silahkan pilih!']);
    this.dialog.startTyping();
  }

  showSimpleDialog(text, options = [], callback) {
    const dialogText = this.ui.elements.dialogText;
    const choicesContainer = this.ui.elements.choicesContainer;

    dialogText.textContent = '';
    choicesContainer.innerHTML = '';

    let i = 0;
    let typing = true;
    let dialogBtns = [];
    let dialogIdx = 0;

    const typeChar = () => {
      if (i < text.length) {
        dialogText.textContent += text.charAt(i);
        i++;
        setTimeout(typeChar, 40);
      } else {
        typing = false;

        if (options.length > 0) {
          const wrapper = this.ui.createChoicesWrapper();

          options.forEach((opt) => {
            const btn = this.ui.createButton(opt.text, 'simple');
            btn.onclick = () => {
              cleanup();
              choicesContainer.innerHTML = '';
              opt.action();
            };
            wrapper.appendChild(btn);
          });

          choicesContainer.appendChild(wrapper);
          dialogBtns = [...wrapper.querySelectorAll('button')];
          dialogIdx = 0;
          highlightDialogBtn();
        }

        if (options.length === 0 && callback) {
          dialogText.addEventListener('click', proceed);
          document.addEventListener('keydown', onEnter);
        }
      }
    };

    const highlightDialogBtn = () => {
      dialogBtns.forEach((b, x) => b.classList.toggle('selected', x === dialogIdx));
    };

    const onKey = (e) => {
      if (typing) return;

      const k = e.key;
      if (dialogBtns.length) {
        if (k === 'ArrowLeft') {
          dialogIdx = (dialogIdx - 1 + dialogBtns.length) % dialogBtns.length;
        } else if (k === 'ArrowRight') {
          dialogIdx = (dialogIdx + 1) % dialogBtns.length;
        } else if (k === 'Enter') {
          dialogBtns[dialogIdx].click();
        }
        highlightDialogBtn();
      } else if (k === 'Enter' && callback) {
        proceed();
      }
    };

    const proceed = () => {
      document.removeEventListener('keydown', onKey);
      dialogText.removeEventListener('click', proceed);
      if (callback) callback();
    };

    const cleanup = () => {
      document.removeEventListener('keydown', onKey);
      dialogText.removeEventListener('click', proceed);
    };

    const onEnter = (e) => {
      if (e.key === 'Enter' && !typing && callback) {
        proceed();
      }
    };

    document.addEventListener('keydown', onKey);
    typeChar();
  }

  highlight(index) {
    this.currentIndex = index;
    this.ui.highlightMenuItem(index);
  }

  handleMenuKey(key) {
    const menuItems = this.ui.getMenuItems();

    if (key === 'ArrowLeft') {
      this.highlight((this.currentIndex - 1 + menuItems.length) % menuItems.length);
      return true;
    } else if (key === 'ArrowRight') {
      this.highlight((this.currentIndex + 1) % menuItems.length);
      return true;
    } else if (key === 'Enter') {
      menuItems[this.currentIndex].querySelector('.icon-btn').click();
      return true;
    }

    return false;
  }

  unlock() {
    this.ui.enableMenu();
    this.highlight(this.currentIndex);
  }
}