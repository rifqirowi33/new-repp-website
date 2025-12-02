// managers/UIManager.js
export class UIManager {
  constructor() {
    this.elements = {
      dialogText: document.querySelector('#dialogText'),
      arrow: document.querySelector('#arrow'),
      dialogBox: document.querySelector('#dialogBox'),
      choicesContainer: document.querySelector('#choicesContainer'),
      menu: document.querySelector('#menu'),
      nameModal: document.querySelector('#nameModal'),
      blurBackground: document.querySelector('#blurBackground'),
      nameInput: document.querySelector('#nameInput'),
      confirmBtn: document.querySelector('#confirmBtn'),
      cancelBtn: document.querySelector('#cancelBtn'),
      tentangkuWindow: document.querySelector('#tentangkuWindow'),
      tentangkuContainer: document.querySelector('#tentangkuContainer')
    };

    this.menuItems = [...this.elements.menu.querySelectorAll('li')];
  }

  // ========================================
  // Dialog Text Methods
  // ========================================
  setDialogText(text) {
    this.elements.dialogText.textContent = text;
  }

  setDialogHTML(html) {
    this.elements.dialogText.innerHTML = html;
  }

  clearDialogText() {
    this.elements.dialogText.textContent = '';
  }

  // ========================================
  // Arrow Methods
  // ========================================
  showArrow() {
    this.elements.arrow.style.opacity = 1;
    this.elements.arrow.classList.add('blink');
  }

  hideArrow() {
    this.elements.arrow.style.opacity = 0;
    this.elements.arrow.classList.remove('blink');
  }

  // ========================================
  // Choices Methods
  // ========================================
  clearChoices() {
    this.elements.choicesContainer.innerHTML = '';
  }

  appendChoice(element) {
    this.elements.choicesContainer.appendChild(element);
  }

  // ========================================
  // Menu Methods
  // ========================================
  disableMenu() {
    this.elements.menu.classList.add('disabled');
  }

  enableMenu() {
    this.elements.menu.classList.remove('disabled');
  }

  highlightMenuItem(index) {
    this.menuItems.forEach((li, i) => {
      const btn = li.querySelector('.icon-btn');
      btn.classList.toggle('selected', i === index);
    });
  }

  getMenuItems() {
    return this.menuItems;
  }

  // ========================================
  // Modal Methods
  // ========================================
  showModal() {
    this.elements.nameModal.classList.remove('hidden');
    this.elements.blurBackground.classList.remove('hidden');
    this.elements.nameInput.value = '';
    this.elements.nameInput.focus();
  }

  hideModal() {
    this.elements.nameModal.classList.add('hidden');
    this.elements.blurBackground.classList.add('hidden');
  }

  getModalInput() {
    return this.elements.nameInput.value.trim();
  }

  // ========================================
  // Tentangku Window Methods
  // ========================================
  showTentangku() {
    this.elements.tentangkuWindow.classList.remove('hidden');
    this.elements.blurBackground.classList.remove('hidden');
  }

  hideTentangku() {
    this.elements.tentangkuWindow.classList.add('hidden');
    this.elements.blurBackground.classList.add('hidden');
  }

  expandTentangku() {
    this.elements.tentangkuWindow.classList.remove('expand', 'show-content', 'hidden');
    setTimeout(() => this.elements.tentangkuWindow.classList.add('expand'), 50);
    setTimeout(() => this.elements.tentangkuWindow.classList.add('show-content'), 1000);
  }

  collapseTentangku() {
    this.elements.tentangkuWindow.classList.remove('expand', 'show-content');
    this.elements.tentangkuWindow.classList.add('hidden');
  }

  setTentangkuContent(html) {
    this.elements.tentangkuContainer.innerHTML = html;
  }

  // ========================================
  // Helper Methods - Create Elements
  // ========================================
  createButton(text, type, selected = false) {
    const button = document.createElement('button');
    button.className = 'choice-btn' + (selected ? ' selected' : '');
    button.textContent = text;
    button.dataset.type = type;
    return button;
  }

  createChoicesWrapper() {
    const wrapper = document.createElement('div');
    wrapper.className = 'choices';
    return wrapper;
  }

  createProjectListWrapper() {
    const wrapper = document.createElement('div');
    wrapper.className = 'choices proj-list';
    return wrapper;
  }
}