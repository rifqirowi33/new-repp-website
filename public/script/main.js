let waitingMainChoice = false;
let waitingSubChoice  = false;
let waitingProjList   = false;
let isAFKQuotes = false;
let isAFKTyping = false;
let specialAFKTriggered = false;
let lastAFKShown = 0;

let mainBtns=[], mainIdx=0;
let subBtns =[], subIdx =0;
let projBtns=[], projIdx=0;

let menuUnlocked=false, menuIdx=0;
let currentUrl   ="";

let lockInteraction = false;

let waitingTentangku = false;
let tentangBtns = [], tentangIdx = 0;

let projects=[];
async function loadProjects(){
  try{
    const r=await fetch(`/data/projects.json?t=${Date.now()}`);
    projects=await r.json();
  }catch(e){
    console.warn("projects.json gagal:",e);
    projects=[];
  }
}

let dialogGlobal={}, dialogProyek={}, dialogTentangku={};
let afkDialog = [], afkQuotes = [];
let afkSpecial = [];
async function loadDialogGlobal(){
  try{
    const r=await fetch(`/data/dialog.json?t=${Date.now()}`);
    dialogGlobal=await r.json();
  }catch(e){
    console.warn("dialog.json gagal:",e);
    dialogGlobal={
      firstVisit:["Halo!","<askName> Siapa namamu?>"],
      guest     :["Halo tamu!","Silahkan pilih!"],
      named     :["Halo {name}!","Silahkan pilih!"],
      returning :["Halo {name}!","Silahkan pilih!"]
    };
  }
}
async function loadDialogProyek(){
  try{
    const r=await fetch(`/data/dialog_proyek.json?t=${Date.now()}`);
    dialogProyek=await r.json();
  }catch(e){
    console.warn("dialog_proyek.json gagal:",e);
    dialogProyek={};
  }
}

async function loadDialogTentangku(){
  try{
    const r=await fetch(`/data/dialog_tentang.json?t=${Date.now()}`);
    dialogTentangku=await r.json();
  }catch(e){
    console.warn("dialog_tentang.json gagal:",e);
    dialogTentangku={ intro:["Kamu ingin berkenalan dengan penciptaku ya?"], choices:{yes:"Boleh",no:"Ngga dulu"}, reject:["Ohh, kamu tidak tertarik ya?","atau mungkin kamu ingin mengetahui hal yang lain?","Silahkan pilih!"], expand:["Halo <askName>, aku REPP!","Di sini kamu bisa tahu lebih banyak tentangku."] };
  }
}

async function loadAFKDialog(){
  try{
    const quotes = await fetch(`/data/quotes.json?t=${Date.now()}`).then(r=>r.json());
    const dialog = await fetch(`/data/afk.json?t=${Date.now()}`).then(r=>r.json());
    const special = await fetch(`/data/afkspecial.json?t=${Date.now()}`).then(r=>r.json());
    afkQuotes = quotes;
    afkDialog = dialog;
    afkSpecial = special;
  }catch(e){
    console.warn("quotes.json / afk.json gagal:",e);
    afkQuotes = ["Setiap baris kode yang dibuat dengan tulus adalah langkah kecil menuju perubahan besar."];
    afkDialog = ["...sedang tidak aktif..."];
    afkSpecial = ["..."];
  }
}

const parse=l=>{const m=l.match(/^<(\w+)>/);return m?{content:l.slice(m[0].length).trimStart(),tag:m[1]}:{content:l,tag:null}};
const linkRX=/<link\s+href=['"]([^'" ]+)['"](?:\s+color=['"]([^'" ]+)['"])?>(.*?)<\/link>/g;
const render=l=>l.replace(linkRX,(_,h,c="blue",t)=>`<a target="_blank" href="${h}" class="link-${c}">${t}</a>`);
const strip =html=>{const d=document.createElement("div");d.innerHTML=html;return d.textContent||""};
const qs=s=>document.querySelector(s);
const ce=(t,c)=>Object.assign(document.createElement(t),{className:c||""});
const mkBtn=(t,type,sel)=>{const b=ce("button","choice-btn"+(sel?" selected":""));b.textContent=t;b.dataset.type=type;return b;};

function getCookie(name){
  const m=document.cookie.match('(?:^|; )'+name.replace(/[-.]/g,"\\$&")+'=([^;]*)');
  return m?decodeURIComponent(m[1]):null;
}
function setCookie(name,val,durationDays=365){
  const exp=new Date(Date.now()+durationDays*864e5).toUTCString();
  document.cookie=`${name}=${encodeURIComponent(val)}; expires=${exp}; path=/; SameSite=Lax`;
}


document.addEventListener("DOMContentLoaded",async()=>{
  await Promise.all([loadDialogGlobal(),loadProjects(),loadAFKDialog(),]);
  const isSafari=/^((?!chrome|android).)*safari/i.test(navigator.userAgent);
  let savedName = getCookie("name");
  let seenIntro = getCookie("seenIntro")==="true";
  if(!savedName || !seenIntro){
    const who = await fetch("/api/whoami").then(r=>r.json()).catch(()=>({}));
    savedName = savedName || who.name || null;
    seenIntro = seenIntro || !!who.seenIntro;
  }
  
  const $txt=qs("#dialogText"), $arrow=qs("#arrow"), $dlg=qs("#dialogBox");
  const $choices=qs("#choicesContainer"), $menu=qs("#menu");
  const $modal=qs("#nameModal"), $blur=qs("#blurBackground");
  const $input=qs("#nameInput"), $ok=qs("#confirmBtn"), $cancel=qs("#cancelBtn");
  const menuItems=[...$menu.querySelectorAll("li")];

  let q;
  if(!savedName)      q=[...dialogGlobal.firstVisit];
  else if(!seenIntro) q=dialogGlobal.named.map(l=>l.replace("{name}",savedName));
  else                q=dialogGlobal.returning.map(l=>l.replace("{name}",savedName));

  let idx=0,pos=0,typing=false,skip=false;
  const speed=35;

  const highlightMenu=i=>{
    menuItems.forEach((li,x)=>li.querySelector(".icon-btn").classList.toggle("selected",x===i));
    menuIdx=i;
  };

 function type(){
  if(idx >= q.length){ console.warn("queue selesai"); return; }

  typing = true;
  skip   = false;

  $arrow.style.opacity = 0;
  $arrow.classList.remove("blink");

  const { content, tag } = parse(q[idx]);
  const html  = render(content);
  const plain = strip(html);

  $txt.textContent = plain.slice(0, ++pos);

  if(pos < plain.length && !skip){
    setTimeout(type, speed);
    return;
  }

  typing = false;
  if (typing || skip) return;
  if (afkMode && idx >= q.length - 1) {
    isAFKTyping = false;
  }
  $txt.innerHTML = html;

  setTimeout(() => {
    $arrow.style.opacity = 1;
    $arrow.classList.add("blink");

    if (afkMode) {
      const isQuotes = afkQuotes.includes(currentAFKLine);
      const delayBaris = isAFKQuotes ? 5000 : 2000;
      
      setTimeout(() => {
        idx++;
        if (idx < q.length) {
          pos = 0;
          $txt.textContent = "";
          type();
        }
      }, delayBaris);
    }
  }, 100); 

  if(tag==="askName")       setTimeout(spawnMainChoices,600);
  if(tag==="askProject")    setTimeout(()=>spawnSubChoices(doProyekYes,doProyekNo),600);
  if(tag==="askMore")       setTimeout(()=>spawnSubChoices(doProyekMoreYes,doProyekNo,"Boleh","Ngga perlu"),600);
  if(tag==="askVisit")      setTimeout(spawnVisit,600);
  if(tag==="askProjPrompt") setTimeout(doProyekList,600);
  if(tag==="askSiteAgain"){
    const launch=()=>spawnSubChoices(doSiteAgainYes,doSiteAgainNo,"Boleh","Cukup!");
    isSafari ? requestAnimationFrame(()=>setTimeout(launch,0)) : setTimeout(launch,600);
  }
  if(tag==="askTentangku"){
    const launch = ()=> doTentangkuChoice();
    isSafari ? requestAnimationFrame(()=>setTimeout(launch,0)) : setTimeout(launch,600);
  }
  if(tag==="afterPreExpand"){
    setTimeout(() => {
      q = [...(dialogTentangku.expand || ["(kosong)"])];
      idx = pos = 0;
      type();
      expandTentangku();
    }, 600);
  }
  if(tag==="openTentangkuNow"){ 
    expandTentangku();
    return;
  }

  if(!menuUnlocked && plain.toLowerCase().includes("silahkan pilih")){
    $menu.classList.remove("disabled"); 
    menuUnlocked = true;
    highlightMenu(menuIdx);

    if(savedName && !seenIntro){
      fetch("/api/introDone", { method: "POST" });
      setCookie("seenIntro", "true");
      seenIntro = true;
    }
  }
}

  function spawnMainChoices(force=false){
    if(waitingMainChoice&&!force)return;
    waitingMainChoice=true; mainIdx=0; $choices.innerHTML="";
    const wrap=ce("div","choices");
    const g=mkBtn("Tamu","guest",true), n=mkBtn("Isi Nama","name");
    wrap.append(g,n); $choices.append(wrap); mainBtns=[g,n]; setMain(0);
    mainBtns.forEach((b,x)=>{b.onmouseenter=()=>setMain(x);b.onclick=()=>chooseMain(b.dataset.type);});
  }
  const setMain=i=>mainBtns.forEach((b,x)=>b.classList.toggle("selected",(mainIdx=i)===x));
  function chooseMain(t){
    waitingMainChoice=false;$choices.innerHTML="";$menu.classList.add("disabled");menuUnlocked=false;
    if(t==="guest"){q=[...dialogGlobal.guest];idx=pos=0;type();return;}
    openModal();
  }

  function spawnSubChoices(yesCB,noCB,yesT="Tentu",noT="Tidak"){
    if(waitingSubChoice)return;
    waitingSubChoice=true;subIdx=0;$choices.innerHTML="";
    const w=ce("div","choices"), y=mkBtn(yesT,"yes",true), n=mkBtn(noT,"no");
    w.append(y,n);$choices.append(w);subBtns=[y,n];setSub(0);
    subBtns.forEach((b,x)=>b.onmouseenter=()=>setSub(x));
    y.onclick=()=>{waitingSubChoice=false;$choices.innerHTML="";yesCB();};
    n.onclick=()=>{waitingSubChoice=false;$choices.innerHTML="";noCB();};
  }
  const setSub=i=>subBtns.forEach((b,x)=>b.classList.toggle("selected",(subIdx=i)===x));

  const doProyekYes=()=>{q=[...(dialogProyek.proyekYes||["(data kosong)","Silahkan pilih!"])];idx=pos=0;type();};
  const doProyekNo =()=>{q=[...(dialogProyek.proyekNo ||["Silahkan pilih!"])];idx=pos=0;type();};
  const doProyekMoreYes=()=>{q=["<askProjPrompt>Mau Lihat yang Mana?"];idx=pos=0;type();};

  function doProyekList(){
    waitingProjList=true;projIdx=0;$choices.innerHTML="";
    const wrap=ce("div","choices proj-list");
    projects.forEach((p,i)=>wrap.append(mkBtn(p.title,p.id,i===0)));
    wrap.append(mkBtn("Tidak jadi","cancel"));$choices.append(wrap);
    projBtns=[...wrap.querySelectorAll("button")];setProj(0);
    projBtns.forEach((b,x)=>b.onmouseenter=()=>setProj(x));
    projBtns.forEach(b=>b.onclick=()=>chooseProject(b.dataset.type));
  }
  const setProj=i=>projBtns.forEach((b,x)=>b.classList.toggle("selected",(projIdx=i)===x));

  function chooseProject(id){
    waitingProjList=false;$choices.innerHTML="";
    if(id==="cancel"){doProyekNo();return;}
    const p=projects.find(pr=>pr.id===id);
    if(!p){q=["Proyek tidak ditemukan","Silahkan pilih!"];idx=pos=0;type();return;}
    currentUrl=p.url;
    q=[...p.desc,"<askVisit>apakah kamu ingin mengunjunginya?"];idx=pos=0;type();
  }

  function doSiteIntroAgain(){
    const nama=savedName||"kamu";
    const siteIntro=dialogProyek.proyekSiteAgain||["(penjelasan situs kosong)"];
    q=[`Baiklah, akan kujelaskan lagi padamu, ${nama}!`,...siteIntro,"<askSiteAgain>apa kamu ingin mengetahui tentang situs ini lagi?"];
    idx=pos=0;type();
  }
  const doSiteAgainYes=()=>doSiteIntroAgain();
  const doSiteAgainNo =()=>{ q=[...(dialogProyek.proyekNoSiteAgain||["wahh kamu sudah tahu ya?","Bagus deh!"]), "Oh, iya!","aku juga punya beberapa proyek selain ini", "<askMore>apa kamu mau melihat proyekku yang lain?>"]; idx=pos=0;type(); };

  function spawnVisit(){
    spawnSubChoices(
      ()=>{q=["tunggu sebentar, aku akan membawamu"];idx=pos=0;type();setTimeout(()=>window.location.href=currentUrl,1600);},
      ()=>{q=["yahh sayang sekali, padahal proyek yang kubuat ini sangat keren","<askProjPrompt>Mau Lihat yang Mana?"];idx=pos=0;type();},
      "bawa aku","Tidak"
    );
  }

  function openModal(){
    $modal.classList.remove("hidden");$blur.classList.remove("hidden");
    $input.value="";$input.focus();

    const close=back=>{
      $modal.classList.add("hidden");$blur.classList.add("hidden");
      if(back){waitingMainChoice=true;spawnMainChoices(true);}else waitingMainChoice=false;
    };
    async function confirm(){
      const n=$input.value.trim();if(!n)return;
      try{await fetch("/api/visit",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({name:n})});}catch{}
      setCookie("name",n); setCookie("seenIntro","true");
      close(false);
      savedName=n;
      q=dialogGlobal.named.map(l=>l.replace("{name}",n));idx=pos=0;type();
    }
    $ok.onclick=confirm;$cancel.onclick=()=>close(true);
    $input.onkeydown=e=>{if(e.key==="Enter")confirm();if(e.key==="Escape")close(true);};
  }

  const next=()=>{if(typing||waitingMainChoice||waitingSubChoice||waitingProjList||lockInteraction)return;
    idx++;if(idx>=q.length){$arrow.style.opacity=0;return;}pos=0;$txt.textContent="";type();};
  $dlg.onclick=next;

  document.addEventListener("keydown",e=>{
    const k=e.key;
    if(waitingMainChoice){if(k==="ArrowLeft")setMain((mainIdx-1+mainBtns.length)%mainBtns.length);else if(k==="ArrowRight")setMain((mainIdx+1)%mainBtns.length);else if(k==="Enter")mainBtns[mainIdx].click();return;}
    if(waitingSubChoice){if(k==="ArrowLeft") setSub((subIdx-1+subBtns.length)%subBtns.length);else if(k==="ArrowRight") setSub((subIdx+1)%subBtns.length);else if(k==="Enter"){ subBtns[subIdx].click(); 
    return;
  }
  return;
}

  if(waitingTentangku){
    if(k==="ArrowLeft") setTentang((tentangIdx-1+tentangBtns.length)%tentangBtns.length);
    else if(k==="ArrowRight") setTentang((tentangIdx+1)%tentangBtns.length);
    else if(k==="Enter"){ tentangBtns[tentangIdx].click(); return; }
    return;
  }
    if(waitingProjList){if(k==="ArrowLeft")setProj((projIdx-1+projBtns.length)%projBtns.length);else if(k==="ArrowRight")setProj((projIdx+1)%projBtns.length);else if(k==="Enter")projBtns[projIdx].click();return;}
    if(menuUnlocked&&!typing){if(k==="ArrowLeft")highlightMenu((menuIdx-1+menuItems.length)%menuItems.length);else if(k==="ArrowRight")highlightMenu((menuIdx+1)%menuItems.length);else if(k==="Enter")menuItems[menuIdx].querySelector(".icon-btn").click();if(["ArrowLeft","ArrowRight","Enter"].includes(k))return;}
    if(k==="Enter")next();
  });

  menuItems.forEach((li,i)=>{
  const btn = li.querySelector(".icon-btn");

  btn.onclick = async () => {
    if($menu.classList.contains("disabled")) return;
    const path = btn.dataset.link;

    if(path==="/proyek"){
      $menu.classList.add("disabled"); menuUnlocked=false;
      await loadDialogProyek();
      let intro=dialogProyek.proyekIntro||dialogProyek.intro||["<askProject>Kamu ingin mengetahui tentang Proyek ya?>"];
      if(!Array.isArray(intro)) intro=["<askProject>Kamu ingin mengetahui tentang Proyek ya?>"];
      q=[...intro]; idx=pos=0; type();

    } else if(path==="/tentang"){
      openTentangkuDialog();
    } else if(path==="/catatan"){
      loadDialogCatatan();
    } else if(path==="/pesan"){
      loadDialogPesan();
    } else {
      window.location.href=path;
    }
  };
});

async function loadDialogCatatan() {
  $menu.classList.add("disabled");
  menuUnlocked = false;

  showDialog("Kamu ingin melihat catatanku?", [
    { text: "Iya", action: showCatatan },
    { text: "Tidak", action: returnToMenu }
  ]);
}

function showCatatan() {
  const lines = [
    "Wahh sayang sekali,",
    "Aku belum menemukan catatanku",
    "karena catatanku telah hilang,",
    "Aku sedang mencarinya,",
    "Silahkan kembali lain waktu"
  ];

  let idxLine = 0;
  function nextLine() {
    if (idxLine < lines.length) {
      showDialog(lines[idxLine], [], () => {
        idxLine++;
        nextLine();
      });
    } else {
      returnToMenu();
    }
  }
  nextLine();
}

function loadDialogPesan() {
  $menu.classList.add("disabled");
  menuUnlocked = false;

  showDialog("Kamu ingin mengirim pesan padaku?", [
    { text: "Iya", action: showPesan },
    { text: "Tidak", action: returnToMenu }
  ]);
}

function showPesan() {
  const lines = [
    "Wahh, jaringanku masih bermasalah,",
    "aku tidak bisa menerima pesan dari mu",
    "akan kuperbaiki",
    "Silahkan kembali lain waktu"
  ];

  let idxLine = 0;
  function nextLine() {
    if (idxLine < lines.length) {
      showDialog(lines[idxLine], [], () => {
        idxLine++;
        nextLine();
      });
    } else {
      returnToMenu();
    }
  }
  nextLine();
}

function returnToMenu() {
  $menu.classList.remove("disabled");
  menuUnlocked = true;
  highlightMenu(menuIdx);

  q = ["Silahkan pilih!"];
  idx = pos = 0;
  type();
}

function doTentangkuChoice(){
  spawnSubChoices(
    () => {
      const pre = dialogTentangku.preExpand || [
        "Ikut aku",
        "Aku akan mengantarkanmu",
        "Untuk menemui penciptaku"
      ];
      q = [...pre, "<afterPreExpand>"];
      idx = pos = 0;
      type();
    },
    () => {
      q = [...(dialogTentangku.reject || ["Ohh, kamu tidak tertarik ya?"])];
      idx = pos = 0;
      type();
    },
    dialogTentangku.choices?.yes || "Boleh",
    dialogTentangku.choices?.no  || "Ngga dulu"
  );
}

const setTentang = i => tentangBtns.forEach((b,x)=>
  b.classList.toggle("selected",(tentangIdx=i)===x)
);

function chooseTentang(choice){
  waitingTentangku = false;
  $choices.innerHTML="";

  if(choice==="yes"){
    q = [...(dialogTentangku.expand || ["(kosong)"])];
    idx=pos=0; 
    type(); 
    expandTentangku();
  } else {
    q = [...(dialogTentangku.reject || ["Ohh, kamu tidak tertarik ya?"])];
    idx=pos=0; 
    type();
  }
}

async function openTentangkuDialog() {
  await Promise.all([loadDialogTentangku(), loadTentangku()]);

  $menu.classList.add("disabled");
  menuUnlocked = false;

  if (!Array.isArray(dialogTentangku.intro) || dialogTentangku.intro.length === 0) {
    q = [`<askTentangku>Kamu ingin berkenalan dengan penciptaku ya?`];
  } else {
    q = dialogTentangku.intro.map((line, i, arr) => (i === arr.length - 1 ? `<askTentangku>${line}` : line));
  }

  idx = pos = 0;
  type();
}

async function loadTentangku() {
  try {
    const res = await fetch("/data/about/about.html");
    const html = await res.text();
    document.getElementById("tentangkuContainer").innerHTML = html;

    const closeBtn = document.getElementById("closeTentangku");
    if (closeBtn) {
      closeBtn.addEventListener("click", () => {
        const win = document.getElementById("tentangkuWindow");
        win.classList.add("hidden");
        document.getElementById("blurBackground").classList.add("hidden");
        
        $menu.classList.remove("disabled");
        menuUnlocked = true;
        highlightMenu(menuIdx);
      });
    }
  } catch (err) {
    console.error("Gagal load tentangku:", err);
  }
}

loadTentangku();

function showDialog(text, options = [], callback) {
  const $txt = document.getElementById("dialogText");
  const $choices = document.getElementById("choicesContainer");

  $txt.textContent = "";
  $choices.innerHTML = "";

  let i = 0;
  let typing = true;

  let dialogBtns = [];
  let dialogIdx = 0;

  function typeChar() {
    if (i < text.length) {
      $txt.textContent += text.charAt(i);
      i++;
      setTimeout(typeChar, 40);
    } else {
      typing = false;

      if (options.length > 0) {
        const wrap = document.createElement("div");
        wrap.className = "choices";

        options.forEach((opt, x) => {
          const btn = document.createElement("button");
          btn.className = "choice-btn";
          btn.textContent = opt.text;
          btn.onclick = () => {
            cleanup();
            $choices.innerHTML = "";
            opt.action();
          };
          wrap.appendChild(btn);
        });

        $choices.appendChild(wrap);
        dialogBtns = [...wrap.querySelectorAll("button")];
        dialogIdx = 0;
        highlightDialogBtn();
      }

      // klik teks untuk lanjut jika tidak ada pilihan
      if (options.length === 0 && callback) {
        $txt.addEventListener("click", proceed);
        document.addEventListener("keydown", onEnter);
      }
    }
  }

  function highlightDialogBtn() {
    dialogBtns.forEach((b,x)=>b.classList.toggle("selected", x===dialogIdx));
  }

  function onKey(e) {
    if (typing) return;

    const k = e.key;
    if(dialogBtns.length){
      if(k==="ArrowLeft") dialogIdx = (dialogIdx-1+dialogBtns.length)%dialogBtns.length;
      else if(k==="ArrowRight") dialogIdx = (dialogIdx+1)%dialogBtns.length;
      else if(k==="Enter") dialogBtns[dialogIdx].click();
      highlightDialogBtn();
    } else if(k==="Enter" && callback){
      proceed();
    }
  }

  function proceed() {
    document.removeEventListener("keydown", onKey);
    $txt.removeEventListener("click", proceed);
    if(callback) callback();
  }

  function cleanup() {
    document.removeEventListener("keydown", onKey);
    $txt.removeEventListener("click", proceed);
  }

  document.addEventListener("keydown", onKey);
  typeChar();
}

function expandTentangku() {
  const win = document.getElementById("tentangkuWindow");

  let closeBtn = win.querySelector("#closeTentangku");
  if (!closeBtn) {
    closeBtn = ce("button", "close-btn");
    closeBtn.id = "closeTentangku";
    closeBtn.textContent = "×";
    win.appendChild(closeBtn);
  }

  closeBtn.onclick = () => {
    win.classList.add("hidden");
    win.classList.remove("expand", "show-content");

    q = ["Silahkan pilih!"];
    idx = pos = 0;
    type();

    $menu.classList.remove("disabled");
    menuUnlocked = true;
    highlightMenu(menuIdx);
  };

  win.classList.remove("expand", "show-content", "hidden");
  setTimeout(() => win.classList.add("expand"), 50);
  setTimeout(() => win.classList.add("show-content"), 1000);
}


let lastActive = Date.now();
  const AFK_TIMEOUT = 45000;
  const AFK_SPECIAL_DELAY = 120000;
  let afkMode = false;
  let afkTimer = null;
  let afkBackup = null;
  let currentAFKLine = "";

  function resetAFKTimer() {
    lastActive = Date.now();
    if (afkMode) {
      afkMode = false;
      if (afkBackup) {
        q = [...afkBackup.q];
        idx = afkBackup.idx;
        pos = 0;
        afkBackup = null;
        type();
      }
    }
  }

  function random(arr) {
    return arr[Math.floor(Math.random()*arr.length)];
  }

function enterAFKMode() {
  if (typing || isAFKTyping || afkMode || lockInteraction) return;

  afkMode = true;
  isAFKTyping = true;
  lockInteraction = false;
  lastAFKShown = Date.now();
  afkBackup = { q: [...q], idx };

  const source = Math.random() < 0.5 ? afkDialog : afkQuotes;
  isAFKQuotes = (source === afkQuotes);
  const line = random(source);
  const lines = Array.isArray(line) ? line : [line];

  currentAFKLine = lines.map(l => String(l));
  q = currentAFKLine;
  idx = 0;
  pos = 0;
  type();
}

function checkAFK() {
  const now = Date.now();
  const afkDuration = now - lastActive;

  if (typing || isAFKTyping || waitingMainChoice || waitingSubChoice || waitingProjList) return;

  if (!afkMode && afkDuration > AFK_SPECIAL_DELAY && savedName && !specialAFKTriggered) {
    specialAFKTriggered = true;
    fetch("/api/whoami")
      .then(r => r.json())
      .then(data => {
        const loc = data.location || "tempatmu";
        enterSpecialAFK(loc);
      })
      .catch(() => {
        enterSpecialAFK("tempatmu");
      });
    return;
  }

  if (!afkMode && afkDuration > AFK_TIMEOUT) {
    enterAFKMode();
    return;
  }

  const sinceLastAFK = now - lastAFKShown;
  if (afkMode && !isAFKTyping && sinceLastAFK > AFK_TIMEOUT) {
    lastAFKShown = Date.now();
    const source = Math.random() < 0.5 ? afkDialog : afkQuotes;
    isAFKQuotes = (source === afkQuotes);
    const randomLine = random(source);
    const lines = Array.isArray(randomLine) ? randomLine : [randomLine];

    currentAFKLine = lines.map(l => String(l));
    q = currentAFKLine;
    idx = 0;
    pos = 0;
    isAFKTyping = true;
    type();
  }
}

  ["mousemove","keydown","mousedown","touchstart"].forEach(e=>
    document.addEventListener(e,()=>{if(!lockInteraction)resetAFKTimer();}));
  setInterval(checkAFK, 5000);

  function enterSpecialAFK(location) {
  afkMode = true;
  isAFKTyping = true;
  lockInteraction = true;
  specialAFKTriggered = false;

  const personalized = afkSpecial.map(line => line.replace("{location}", location || "tempatmu"));
  currentAFKLine = personalized;

  q = [...personalized];
  idx = 0;
  pos = 0;
  type();

  setTimeout(() => {
    lockInteraction = false;
    q = afkSpecial.slice(-4).map(l => l.replace("{location}", location || "tempatmu"));
    idx = 0;
    pos = 0;
    type();

    setTimeout(() => {
      afkMode = false;
      if (afkBackup) {
        q = [...afkBackup.q];
        idx = afkBackup.idx;
        pos = 0;
        afkBackup = null;
        type();
      }
    }, 8000); 
  }, 60000);
}
  type();
});