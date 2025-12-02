// managers/ChoiceManager.js
export class ChoiceManager {
  constructor(uiManager, dialogManager, dataManager, state, mainApp) {
    this.ui = uiManager;
    this.dialog = dialogManager;
    this.data = dataManager;
    this.state = state;
    this.mainApp = mainApp; // Reference ke MainApp untuk akses saveUserName

    this.mainChoices = { buttons: [], index: 0, waiting: false };
    this.subChoices = { buttons: [], index: 0, waiting: false };
    this.tentangChoices = { buttons: [], index: 0, waiting: false };
    this.projectList = { buttons: [], index: 0, waiting: false };

    this.setupDialogTagHandlers();
  }

  setupDialogTagHandlers() {
    this.dialog.registerTagHandler('askName', () => this.spawnMainChoices());
    this.dialog.registerTagHandler('askProject', () => this.spawnSubChoices(
      () => this.handleProyekYes(),
      () => this.handleProyekNo()
    ));
    this.dialog.registerTagHandler('askMore', () => this.spawnSubChoices(
      () => this.handleProyekMoreYes(),
      () => this.handleProyekNo(),
      'Boleh',
      'Ngga perlu'
    ));
    this.dialog.registerTagHandler('askVisit', () => this.spawnVisitChoices());
    this.dialog.registerTagHandler('askProjPrompt', () => this.showProjectList());
    this.dialog.registerTagHandler('askSiteAgain', () => this.spawnSubChoices(
      () => this.handleSiteAgainYes(),
      () => this.handleSiteAgainNo(),
      'Boleh',
      'Cukup!'
    ));
    this.dialog.registerTagHandler('askTentangku', () => this.spawnTentangkuChoices());
    this.dialog.registerTagHandler('afterPreExpand', () => this.handleAfterPreExpand());
  }

  // Main Choices (Guest / Name)
  spawnMainChoices(force = false) {
    if (this.mainChoices.waiting && !force) return;

    this.mainChoices.waiting = true;
    this.mainChoices.index = 0;
    this.ui.clearChoices();

    const wrapper = this.ui.createChoicesWrapper();
    const guestBtn = this.ui.createButton('Tamu', 'guest', true);
    const nameBtn = this.ui.createButton('Isi Nama', 'name');

    wrapper.append(guestBtn, nameBtn);
    this.ui.appendChoice(wrapper);

    this.mainChoices.buttons = [guestBtn, nameBtn];
    this.highlightMainChoice(0);

    this.mainChoices.buttons.forEach((btn, i) => {
      btn.onmouseenter = () => this.highlightMainChoice(i);
      btn.onclick = () => this.selectMainChoice(btn.dataset.type);
    });
  }

  highlightMainChoice(index) {
    this.mainChoices.index = index;
    this.mainChoices.buttons.forEach((btn, i) => {
      btn.classList.toggle('selected', i === index);
    });
  }

  selectMainChoice(type) {
    this.mainChoices.waiting = false;
    this.ui.clearChoices();
    this.ui.disableMenu();
    this.state.menuUnlocked = false;

    if (type === 'guest') {
      const dialogData = this.data.getDialog('global');
      this.dialog.setQueue([...dialogData.guest]);
      this.dialog.startTyping();
    } else {
      this.openNameModal();
    }
  }

  // Sub Choices (Yes / No)
  spawnSubChoices(yesCallback, noCallback, yesText = 'Tentu', noText = 'Tidak') {
    if (this.subChoices.waiting) return;

    this.subChoices.waiting = true;
    this.subChoices.index = 0;
    this.ui.clearChoices();

    const wrapper = this.ui.createChoicesWrapper();
    const yesBtn = this.ui.createButton(yesText, 'yes', true);
    const noBtn = this.ui.createButton(noText, 'no');

    wrapper.append(yesBtn, noBtn);
    this.ui.appendChoice(wrapper);

    this.subChoices.buttons = [yesBtn, noBtn];
    this.highlightSubChoice(0);

    yesBtn.onclick = () => {
      this.subChoices.waiting = false;
      this.ui.clearChoices();
      yesCallback();
    };

    noBtn.onclick = () => {
      this.subChoices.waiting = false;
      this.ui.clearChoices();
      noCallback();
    };

    this.subChoices.buttons.forEach((btn, i) => {
      btn.onmouseenter = () => this.highlightSubChoice(i);
    });
  }

  highlightSubChoice(index) {
    this.subChoices.index = index;
    this.subChoices.buttons.forEach((btn, i) => {
      btn.classList.toggle('selected', i === index);
    });
  }

  // Project List
  showProjectList() {
    this.projectList.waiting = true;
    this.projectList.index = 0;
    this.ui.clearChoices();

    const wrapper = this.ui.createProjectListWrapper();
    const projects = this.data.getProjects();

    projects.forEach((project, i) => {
      wrapper.append(this.ui.createButton(project.title, project.id, i === 0));
    });

    wrapper.append(this.ui.createButton('Tidak jadi', 'cancel'));
    this.ui.appendChoice(wrapper);

    this.projectList.buttons = [...wrapper.querySelectorAll('button')];
    this.highlightProjectList(0);

    this.projectList.buttons.forEach((btn, i) => {
      btn.onmouseenter = () => this.highlightProjectList(i);
      btn.onclick = () => this.selectProject(btn.dataset.type);
    });
  }

  highlightProjectList(index) {
    this.projectList.index = index;
    this.projectList.buttons.forEach((btn, i) => {
      btn.classList.toggle('selected', i === index);
    });
  }

  selectProject(id) {
    this.projectList.waiting = false;
    this.ui.clearChoices();

    if (id === 'cancel') {
      this.handleProyekNo();
      return;
    }

    const project = this.data.getProject(id);
    if (!project) {
      this.dialog.setQueue(['Proyek tidak ditemukan', 'Silahkan pilih!']);
      this.dialog.startTyping();
      return;
    }

    this.state.currentUrl = project.url;
    this.dialog.setQueue([...project.desc, '<askVisit>apakah kamu ingin mengunjunginya?']);
    this.dialog.startTyping();
  }

  spawnVisitChoices() {
    this.spawnSubChoices(
      () => {
        this.dialog.setQueue(['tunggu sebentar, aku akan membawamu']);
        this.dialog.startTyping();
        setTimeout(() => window.location.href = this.state.currentUrl, 1600);
      },
      () => {
        this.dialog.setQueue([
          'yahh sayang sekali, padahal proyek yang kubuat ini sangat keren',
          '<askProjPrompt>Mau Lihat yang Mana?'
        ]);
        this.dialog.startTyping();
      },
      'bawa aku',
      'Tidak'
    );
  }

  // Tentangku Choices
  spawnTentangkuChoices() {
    const tentangData = this.data.getDialog('tentangku');
    this.spawnSubChoices(
      () => {
        const pre = tentangData.preExpand || [
          'Ikut aku',
          'Aku akan mengantarkanmu',
          'Untuk menemui penciptaku'
        ];
        this.dialog.setQueue([...pre, '<afterPreExpand>']);
        this.dialog.startTyping();
      },
      () => {
        this.dialog.setQueue([...(tentangData.reject || ['Ohh, kamu tidak tertarik ya?'])]);
        this.dialog.startTyping();
      },
      tentangData.choices?.yes || 'Boleh',
      tentangData.choices?.no || 'Ngga dulu'
    );
  }

  handleAfterPreExpand() {
    setTimeout(() => {
      const tentangData = this.data.getDialog('tentangku');
      this.dialog.setQueue([...(tentangData.expand || ['(kosong)'])]);
      this.dialog.startTyping();
      this.expandTentangku();
    }, 600);
  }

  async expandTentangku() {
    const html = await this.data.loadTentangkuHTML();
    this.ui.setTentangkuContent(html);

    const closeBtn = document.getElementById('closeTentangku') || this.createTentangkuCloseButton();
    closeBtn.onclick = () => this.closeTentangku();

    this.ui.expandTentangku();
  }

  createTentangkuCloseButton() {
    const btn = document.createElement('button');
    btn.className = 'close-btn';
    btn.id = 'closeTentangku';
    btn.textContent = '×';
    document.getElementById('tentangkuWindow').appendChild(btn);
    return btn;
  }

  closeTentangku() {
    this.ui.collapseTentangku();
    this.ui.hideTentangku();
    this.dialog.setQueue(['Silahkan pilih!']);
    this.dialog.startTyping();
    this.ui.enableMenu();
    this.state.menuUnlocked = true;
  }

  // Project Handlers
  handleProyekYes() {
    const proyekData = this.data.getDialog('proyek');
    this.dialog.setQueue([...(proyekData.proyekYes || ['(data kosong)', 'Silahkan pilih!'])]);
    this.dialog.startTyping();
  }

  handleProyekNo() {
    const proyekData = this.data.getDialog('proyek');
    this.dialog.setQueue([...(proyekData.proyekNo || ['Silahkan pilih!'])]);
    this.dialog.startTyping();
  }

  handleProyekMoreYes() {
    this.dialog.setQueue(['<askProjPrompt>Mau Lihat yang Mana?']);
    this.dialog.startTyping();
  }

  handleSiteAgainYes() {
    const nama = this.state.savedName || 'kamu';
    const proyekData = this.data.getDialog('proyek');
    const siteIntro = proyekData.proyekSiteAgain || ['(penjelasan situs kosong)'];
    this.dialog.setQueue([
      `Baiklah, akan kujelaskan lagi padamu, ${nama}!`,
      ...siteIntro,
      '<askSiteAgain>apa kamu ingin mengetahui tentang situs ini lagi?'
    ]);
    this.dialog.startTyping();
  }

  handleSiteAgainNo() {
    const proyekData = this.data.getDialog('proyek');
    this.dialog.setQueue([
      ...(proyekData.proyekNoSiteAgain || ['wahh kamu sudah tahu ya?', 'Bagus deh!']),
      'Oh, iya!',
      'aku juga punya beberapa proyek selain ini',
      '<askMore>apa kamu mau melihat proyekku yang lain?>'
    ]);
    this.dialog.startTyping();
  }

  // Name Modal
  openNameModal() {
    this.ui.showModal();

    const confirmHandler = async () => {
      const name = this.ui.getModalInput();
      if (!name) return;

      // Gunakan saveUserName dari MainApp
      const success = await this.mainApp.saveUserName(name);
      
      if (success) {
        this.ui.hideModal();
      } else {
        alert('Gagal menyimpan nama. Silakan coba lagi.');
      }
    };

    const cancelHandler = () => {
      this.ui.hideModal();
      this.mainChoices.waiting = true;
      this.spawnMainChoices(true);
    };

    this.ui.elements.confirmBtn.onclick = confirmHandler;
    this.ui.elements.cancelBtn.onclick = cancelHandler;
    this.ui.elements.nameInput.onkeydown = (e) => {
      if (e.key === 'Enter') confirmHandler();
      if (e.key === 'Escape') cancelHandler();
    };
  }

  // Keyboard Navigation
  handleMainChoiceKey(key) {
    if (key === 'ArrowLeft') {
      this.highlightMainChoice((this.mainChoices.index - 1 + this.mainChoices.buttons.length) % this.mainChoices.buttons.length);
    } else if (key === 'ArrowRight') {
      this.highlightMainChoice((this.mainChoices.index + 1) % this.mainChoices.buttons.length);
    } else if (key === 'Enter') {
      this.mainChoices.buttons[this.mainChoices.index].click();
    }
  }

  handleSubChoiceKey(key) {
    if (key === 'ArrowLeft') {
      this.highlightSubChoice((this.subChoices.index - 1 + this.subChoices.buttons.length) % this.subChoices.buttons.length);
    } else if (key === 'ArrowRight') {
      this.highlightSubChoice((this.subChoices.index + 1) % this.subChoices.buttons.length);
    } else if (key === 'Enter') {
      this.subChoices.buttons[this.subChoices.index].click();
    }
  }

  handleTentangChoiceKey(key) {
    if (key === 'ArrowLeft') {
      this.highlightSubChoice((this.tentangChoices.index - 1 + this.tentangChoices.buttons.length) % this.tentangChoices.buttons.length);
    } else if (key === 'ArrowRight') {
      this.highlightSubChoice((this.tentangChoices.index + 1) % this.tentangChoices.buttons.length);
    } else if (key === 'Enter') {
      this.tentangChoices.buttons[this.tentangChoices.index].click();
    }
  }

  handleProjListKey(key) {
    if (key === 'ArrowLeft') {
      this.highlightProjectList((this.projectList.index - 1 + this.projectList.buttons.length) % this.projectList.buttons.length);
    } else if (key === 'ArrowRight') {
      this.highlightProjectList((this.projectList.index + 1) % this.projectList.buttons.length);
    } else if (key === 'Enter') {
      this.projectList.buttons[this.projectList.index].click();
    }
  }

  // State Checkers
  isWaitingMainChoice() {
    return this.mainChoices.waiting;
  }

  isWaitingSubChoice() {
    return this.subChoices.waiting;
  }

  isWaitingTentangChoice() {
    return this.tentangChoices.waiting;
  }

  isWaitingProjList() {
    return this.projectList.waiting;
  }
}