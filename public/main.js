/******************* 1. load dialog JSON *******************/
let dialogData = {};
async function loadDialog() {
  try {
    const res = await fetch("/data/dialog.json");
    dialogData = await res.json();
  } catch (e) {
    console.error("dialog.json gagal dimuat:", e);
    dialogData = {
      firstVisit: ["Halo, Saya REPP!", "<askName> Kamu siapa?"],
      guest: ["Halo Tamu! ...", "situs ini telah aktif!"],
      named: ["Halo {name}! ...", "situs ini telah aktif!"],
      returning: ["Halo {name}, selamat datang kembali!"]
    };
  }
}

/******************* 2. util fetch whoami *******************/
async function fetchSavedName() {
  try {
    const res = await fetch("/api/whoami");
    const { name } = await res.json();
    return name;
  } catch {
    return null;
  }
}

/******************* helper: parse line & tag *****************/
function parseDialogLine(line) {
  const tags = [];
  let content = line;

  const match = line.match(/^<(\w+)>/);        // tag di awal baris
  if (match) {
    tags.push(match[1]);
    content = line.replace(/^<\w+>\s*/, "");   // hilangkan tag
  }
  return { content, tags };
}

/******************* 3. main app ****************************/
document.addEventListener("DOMContentLoaded", async () => {
  await loadDialog();
  const savedName = await fetchSavedName();

  /* elements */
  const dialogText  = document.getElementById("dialogText");
  const arrow       = document.getElementById("arrow");
  const dialogBox   = document.getElementById("dialogBox");
  const choicesWrap = document.getElementById("choicesContainer");
  const menu        = document.getElementById("menu");
  const modal       = document.getElementById("nameModal");
  const blurBG      = document.getElementById("blurBackground");
  const nameInput   = document.getElementById("nameInput");
  const confirmBtn  = document.getElementById("confirmBtn");
  const cancelBtn   = document.getElementById("cancelBtn");
  const menuItems   = [...menu.querySelectorAll("li")];

  /* queue setup */
  let queue = savedName
    ? dialogData.returning.map(l => l.replace("{name}", savedName))
    : [...dialogData.firstVisit];

  /* typewriter state */
  let idx = 0, pos = 0, typing = false, skip = false;
  const speed = 35;

  /***************** typeLoop *****************/
  function typeLoop() {
    typing = true;
    arrow.style.opacity = 0;

    const { content, tags } = parseDialogLine(queue[idx]);
    dialogText.textContent = content.slice(0, ++pos);

    if (pos < content.length && !skip) {
      setTimeout(typeLoop, speed);
      return;
    }

    /* kalimat selesai */
    typing = false;
    skip = false;
    arrow.style.opacity = 1;

    if (tags.includes("askName")) {
    setTimeout(() => {
      spawnChoices();
    }, 1000); // ⏱️ Delay 1 detik baru muncul pilihan
    }
  }

  /********* spawn choices *********/
  function spawnChoices() {
    if (choicesWrap.childElementCount) return;

    const wrap = document.createElement("div");
    wrap.className = "choices";

    const btnGuest = document.createElement("button");
    btnGuest.className = "choice-btn selected";
    btnGuest.dataset.type = "guest";
    btnGuest.textContent = "Tamu";

    const btnName = document.createElement("button");
    btnName.className = "choice-btn";
    btnName.dataset.type = "name";
    btnName.textContent = "Isi Nama";

    wrap.append(btnGuest, btnName);
    choicesWrap.append(wrap);

    [btnGuest, btnName].forEach((btn, i, arr) => {
      btn.addEventListener("mouseenter", () =>
        arr.forEach((b, x) => b.classList.toggle("selected", x === i))
      );
      btn.addEventListener("click", () => handleChoice(btn.dataset.type));
    });
  }

  /********* handle choice *********/
  function handleChoice(type) {
    choicesWrap.innerHTML = "";

    if (type === "guest") {
      queue = [...dialogData.guest];
      idx = pos = 0;
      typeLoop();
      return;
    }
    openModal();
  }

  /********* modal *********/
  function openModal() {
    modal.classList.remove("hidden");
    blurBG.classList.remove("hidden");
    nameInput.value = "";
    nameInput.focus();

    const close = () => {
      modal.classList.add("hidden");
      blurBG.classList.add("hidden");
    };
    cancelBtn.onclick = close;

    confirmBtn.onclick = async () => {
      const name = nameInput.value.trim();
      if (!name) return;

      try {
        await fetch("/api/visit", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name })
        });
      } catch (err) {
        console.warn("POST /api/visit error:", err);
      }

      close();
      queue = dialogData.named.map(l => l.replace("{name}", name));
      idx = pos = 0;
      typeLoop();
    };
  }

  /********* next sentence (click / enter) *********/
  function next() {
    if (typing) { skip = true; pos = parseDialogLine(queue[idx]).content.length; dialogText.textContent = parseDialogLine(queue[idx]).content; return; }
    idx++;
    if (idx >= queue.length) { arrow.style.opacity = 0; menu.classList.remove("disabled"); return; }
    pos = 0; dialogText.textContent = ""; typeLoop();
  }

  dialogBox.addEventListener("click", next);
  document.addEventListener("keydown", e => e.key === "Enter" && next());

  /********* menu hover update dialog *********/
  menuItems.forEach(li => {
    const btn = li.querySelector(".icon-btn");
    const msg = li.dataset.dialog;
    const show = () => {
      if (menu.classList.contains("disabled")) return;
      dialogText.textContent = msg;
      menuItems.forEach(l => l.querySelector(".icon-btn").classList.remove("selected"));
      btn.classList.add("selected");
    };
    btn.addEventListener("mouseenter", show);
    btn.addEventListener("focus", show);
    btn.addEventListener("click", () =>
      !menu.classList.contains("disabled") && (window.location.href = btn.dataset.link)
    );
  });

  /* start first line */
  typeLoop();
});