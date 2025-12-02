// managers/DataManager.js
export class DataManager {
  constructor() {
    this.data = {
      global: {},
      proyek: {},
      tentangku: {},
      afkDialog: [],
      afkQuotes: [],
      afkSpecial: [],
      projects: []
    };
  }

  async loadAll() {
    await Promise.all([
      this.loadDialogGlobal(),
      this.loadDialogProyek(),
      this.loadDialogTentangku(),
      this.loadProjects(),
      this.loadAFKData()
    ]);
  }

  async loadDialogGlobal() {
    try {
      const response = await fetch(`/data/dialog.json?t=${Date.now()}`);
      this.data.global = await response.json();
    } catch (error) {
      console.warn('Failed to load dialog.json:', error);
      this.data.global = {
        firstVisit: ["Halo!", "<askName> Siapa namamu?>"],
        guest: ["Halo tamu!", "Silahkan pilih!"],
        named: ["Halo {name}!", "Silahkan pilih!"],
        returning: ["Halo {name}!", "Silahkan pilih!"]
      };
    }
  }

  async loadDialogProyek() {
    try {
      const response = await fetch(`/data/dialog_proyek.json?t=${Date.now()}`);
      this.data.proyek = await response.json();
    } catch (error) {
      console.warn('Failed to load dialog_proyek.json:', error);
      this.data.proyek = {};
    }
  }

  async loadDialogTentangku() {
    try {
      const response = await fetch(`/data/dialog_tentang.json?t=${Date.now()}`);
      this.data.tentangku = await response.json();
    } catch (error) {
      console.warn('Failed to load dialog_tentang.json:', error);
      this.data.tentangku = {
        intro: ["Kamu ingin berkenalan dengan penciptaku ya?"],
        choices: { yes: "Boleh", no: "Ngga dulu" },
        reject: ["Ohh, kamu tidak tertarik ya?", "atau mungkin kamu ingin mengetahui hal yang lain?", "Silahkan pilih!"],
        expand: ["Halo <askName>, aku REPP!", "Di sini kamu bisa tahu lebih banyak tentangku."]
      };
    }
  }

  async loadProjects() {
    try {
      const response = await fetch(`/data/projects.json?t=${Date.now()}`);
      this.data.projects = await response.json();
    } catch (error) {
      console.warn('Failed to load projects.json:', error);
      this.data.projects = [];
    }
  }

  async loadAFKData() {
    try {
      const [quotes, dialog, special] = await Promise.all([
        fetch(`/data/quotes.json?t=${Date.now()}`).then(r => r.json()),
        fetch(`/data/afk.json?t=${Date.now()}`).then(r => r.json()),
        fetch(`/data/afkspecial.json?t=${Date.now()}`).then(r => r.json())
      ]);
      
      this.data.afkQuotes = quotes;
      this.data.afkDialog = dialog;
      this.data.afkSpecial = special;
    } catch (error) {
      console.warn('Failed to load AFK data:', error);
      this.data.afkQuotes = ["Setiap baris kode yang dibuat dengan tulus adalah langkah kecil menuju perubahan besar."];
      this.data.afkDialog = ["...sedang tidak aktif..."];
      this.data.afkSpecial = ["..."];
    }
  }

  async loadTentangkuHTML() {
    try {
      const response = await fetch('/data/about/about.html');
      return await response.text();
    } catch (error) {
      console.error('Failed to load tentangku HTML:', error);
      return '<p>Gagal memuat konten</p>';
    }
  }

  getDialog(type) {
    return this.data[type] || {};
  }

  getProjects() {
    return this.data.projects;
  }

  getProject(id) {
    return this.data.projects.find(p => p.id === id);
  }

  getAFKQuotes() {
    return this.data.afkQuotes;
  }

  getAFKDialog() {
    return this.data.afkDialog;
  }

  getAFKSpecial() {
    return this.data.afkSpecial;
  }
}