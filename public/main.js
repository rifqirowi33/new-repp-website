/* =========================================================
   main.js — FINAL (cookie + modal, keyboard, proyek‑loop,
   intro‑flag, askSiteAgain, Safari‑fallback)
   ========================================================= */

/* ---------- GLOBAL STATE ---------- */
let waitingMainChoice = false;
let waitingSubChoice  = false;
let waitingProjList   = false;

let mainBtns=[], mainIdx=0;
let subBtns =[], subIdx =0;
let projBtns=[], projIdx=0;

let menuUnlocked=false, menuIdx=0;
let currentUrl   ="";

/* ---------- DATA PROYEK ---------- */
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

/* ---------- DIALOG ---------- */
let dialogGlobal={}, dialogProyek={};
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

/* ---------- UTIL ---------- */
const parse=l=>{const m=l.match(/^<(\w+)>/);return m?{content:l.slice(m[0].length).trimStart(),tag:m[1]}:{content:l,tag:null}};
const linkRX=/<link\s+href=['"]([^'" ]+)['"](?:\s+color=['"]([^'" ]+)['"])?>(.*?)<\/link>/g;
const render=l=>l.replace(linkRX,(_,h,c="blue",t)=>`<a target="_blank" href="${h}" class="link-${c}">${t}</a>`);
const strip =html=>{const d=document.createElement("div");d.innerHTML=html;return d.textContent||""};
const qs=s=>document.querySelector(s);
const ce=(t,c)=>Object.assign(document.createElement(t),{className:c||""});
const mkBtn=(t,type,sel)=>{const b=ce("button","choice-btn"+(sel?" selected":""));b.textContent=t;b.dataset.type=type;return b;};

/* ---------- COOKIE HELPERS ---------- */
function getCookie(name){
  const m=document.cookie.match('(?:^|; )'+name.replace(/[-.]/g,"\\$&")+'=([^;]*)');
  return m?decodeURIComponent(m[1]):null;
}
function setCookie(name,val,durationDays=365){
  const exp=new Date(Date.now()+durationDays*864e5).toUTCString();
  document.cookie=`${name}=${encodeURIComponent(val)}; expires=${exp}; path=/; SameSite=Lax`;
}

/* =========================================================
   MAIN
   ========================================================= */
document.addEventListener("DOMContentLoaded",async()=>{
  await Promise.all([loadDialogGlobal(),loadProjects()]);

  /* ---------- VISITOR INFO ---------- */
  const isSafari=/^((?!chrome|android).)*safari/i.test(navigator.userAgent);

  /* 1️⃣ baca cookie dahulu */
  let savedName = getCookie("name");
  let seenIntro = getCookie("seenIntro")==="true";

  /* 2️⃣ fallback ke backend jika belum ada */
  if(!savedName || !seenIntro){
    const who = await fetch("/api/whoami").then(r=>r.json()).catch(()=>({}));
    savedName = savedName || who.name || null;
    seenIntro = seenIntro || !!who.seenIntro;
  }

  /* ---------- REFS ---------- */
  const $txt=qs("#dialogText"), $arrow=qs("#arrow"), $dlg=qs("#dialogBox");
  const $choices=qs("#choicesContainer"), $menu=qs("#menu");
  const $modal=qs("#nameModal"), $blur=qs("#blurBackground");
  const $input=qs("#nameInput"), $ok=qs("#confirmBtn"), $cancel=qs("#cancelBtn");
  const menuItems=[...$menu.querySelectorAll("li")];

  /* ---------- QUEUE INIT ---------- */
  let q;
  if(!savedName)      q=[...dialogGlobal.firstVisit];
  else if(!seenIntro) q=dialogGlobal.named.map(l=>l.replace("{name}",savedName));
  else                q=dialogGlobal.returning.map(l=>l.replace("{name}",savedName));

  let idx=0,pos=0,typing=false,skip=false;
  const speed=35;

  /* ---------- HELPERS ---------- */
  const highlightMenu=i=>{
    menuItems.forEach((li,x)=>li.querySelector(".icon-btn").classList.toggle("selected",x===i));
    menuIdx=i;
  };

  /* ========== TYPEWRITER LOOP ========== */
 function type(){
  if(idx >= q.length){ console.warn("queue selesai"); return; }

  typing = true;
  skip   = false;

  // Sembunyikan dan matikan animasi panah sebelum mulai
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

  // Typing benar-benar selesai di sini
  typing = false;
  $txt.innerHTML = html;

  // Baru tampilkan panah + blink setelah selesai
  setTimeout(() => {
    $arrow.style.opacity = 1;
    $arrow.classList.add("blink");
  }, 100); // delay opsional supaya terasa smooth

  // Hook tag dialog
  if(tag==="askName")       setTimeout(spawnMainChoices,600);
  if(tag==="askProject")    setTimeout(()=>spawnSubChoices(doProyekYes,doProyekNo),600);
  if(tag==="askMore")       setTimeout(()=>spawnSubChoices(doProyekMoreYes,doProyekNo,"Boleh","Ngga perlu"),600);
  if(tag==="askVisit")      setTimeout(spawnVisit,600);
  if(tag==="askProjPrompt") setTimeout(doProyekList,600);
  if(tag==="askSiteAgain"){
    const launch=()=>spawnSubChoices(doSiteAgainYes,doSiteAgainNo,"Boleh","Cukup!");
    isSafari ? requestAnimationFrame(()=>setTimeout(launch,0)) : setTimeout(launch,600);
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

  /* ---------- MAIN CHOICE ---------- */
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

  /* ---------- YES / NO GENERIC ---------- */
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

  /* ---------- PROYEK BRANCH ---------- */
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

  /* ----- penjelasan situs ulang ----- */
  function doSiteIntroAgain(){
    const nama=savedName||"kamu";
    const siteIntro=dialogProyek.proyekSiteAgain||["(penjelasan situs kosong)"];
    q=[`Baiklah, akan kujelaskan lagi padamu, ${nama}!`,...siteIntro,"<askSiteAgain>apa kamu ingin mengetahui tentang situs ini lagi?"];
    idx=pos=0;type();
  }
  const doSiteAgainYes=()=>doSiteIntroAgain();
  const doSiteAgainNo =()=>{
    q=[...(dialogProyek.proyekNoSiteAgain||["wahh kamu sudah tahu ya?","Bagus deh!"]),
       "Oh, iya!","aku juga punya beberapa proyek selain ini",
       "<askMore>apa kamu mau melihat proyekku yang lain?>"];
    idx=pos=0;type();
  };

  /* ---------- VISIT PROMPT ---------- */
  function spawnVisit(){
    spawnSubChoices(
      ()=>{q=["tunggu sebentar, aku akan membawamu"];idx=pos=0;type();setTimeout(()=>window.location.href=currentUrl,1600);},
      ()=>{q=["yahh sayang sekali, padahal proyek yang kubuat ini sangat keren","<askProjPrompt>Mau Lihat yang Mana?"];idx=pos=0;type();},
      "bawa aku","Tidak"
    );
  }

  /* ---------- MODAL (Isi Nama) ---------- */
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
      setCookie("name",n); setCookie("seenIntro","true"); // seenIntro true agar langsung named flow nanti
      close(false);
      savedName=n;
      q=dialogGlobal.named.map(l=>l.replace("{name}",n));idx=pos=0;type();
    }
    $ok.onclick=confirm;$cancel.onclick=()=>close(true);
    $input.onkeydown=e=>{if(e.key==="Enter")confirm();if(e.key==="Escape")close(true);};
  }

  /* ---------- NEXT ---------- */
  const next=()=>{if(typing||waitingMainChoice||waitingSubChoice||waitingProjList)return;
    idx++;if(idx>=q.length){$arrow.style.opacity=0;return;}pos=0;$txt.textContent="";type();};
  $dlg.onclick=next;

  /* ---------- KEYBOARD NAV ---------- */
  document.addEventListener("keydown",e=>{
    const k=e.key;
    if(waitingMainChoice){if(k==="ArrowLeft")setMain((mainIdx-1+mainBtns.length)%mainBtns.length);else if(k==="ArrowRight")setMain((mainIdx+1)%mainBtns.length);else if(k==="Enter")mainBtns[mainIdx].click();return;}
    if(waitingSubChoice){if(k==="ArrowLeft")setSub((subIdx-1+subBtns.length)%subBtns.length);else if(k==="ArrowRight")setSub((subIdx+1)%subBtns.length);else if(k==="Enter")subBtns[subIdx].click();return;}
    if(waitingProjList){if(k==="ArrowLeft")setProj((projIdx-1+projBtns.length)%projBtns.length);else if(k==="ArrowRight")setProj((projIdx+1)%projBtns.length);else if(k==="Enter")projBtns[projIdx].click();return;}
    if(menuUnlocked&&!typing){if(k==="ArrowLeft")highlightMenu((menuIdx-1+menuItems.length)%menuItems.length);else if(k==="ArrowRight")highlightMenu((menuIdx+1)%menuItems.length);else if(k==="Enter")menuItems[menuIdx].querySelector(".icon-btn").click();if(["ArrowLeft","ArrowRight","Enter"].includes(k))return;}
    if(k==="Enter")next();
  });

  /* ---------- MENU ICON ---------- */
  menuItems.forEach((li,i)=>{
    const btn=li.querySelector(".icon-btn");
    btn.onmouseenter=()=>!$menu.classList.contains("disabled")&&($txt.textContent=li.dataset.dialog,highlightMenu(i));
    btn.onclick=async()=>{
      if($menu.classList.contains("disabled"))return;
      const path=btn.dataset.link;
      if(path==="/proyek"){
        $menu.classList.add("disabled");menuUnlocked=false;
        await loadDialogProyek();
        let intro=dialogProyek.proyekIntro||dialogProyek.intro||["<askProject>Kamu ingin mengetahui tentang Proyek ya?>"];
        if(!Array.isArray(intro)) intro=["<askProject>Kamu ingin mengetahui tentang Proyek ya?>"];
        q=[...intro];idx=pos=0;type();
      }else window.location.href=path;
    };
  });

  /* ---------- START ---------- */
  type();
});
