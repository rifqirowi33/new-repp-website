/* =========================================================
   main.js — versi FINAL  (multi‑dialog, proyek OK, keyboard OK)
   ========================================================= */

/* ---------- GLOBAL STATE ---------- */
let waitingMainChoice = false;
let waitingSubChoice  = false;
let waitingProjList   = false;

let mainBtns=[], mainIdx=0;
let subBtns =[], subIdx =0;
let projBtns=[], projIdx=0;

let menuUnlocked=false, menuIdx=0;
let currentUrl = "";

/* ---------- DATA PROYEK ---------- */
let projects = [];

async function loadProjects(){
  try {
    const res = await fetch(`/data/projects.json?t=${Date.now()}`);
    projects = await res.json();
  } catch (e) {
    console.warn("Gagal memuat projects.json:", e);
    projects = []; // fallback kosong
  }
}

/* ---------- 1. loader dialog ---------- */
let dialogGlobal = {};         // dialog.json
let dialogProyek = {};         // dialog_proyek.json

async function loadDialog(){
  try{
    const r=await fetch(`/data/dialog.json?t=${Date.now()}`);
    dialogGlobal=await r.json();
  }catch(e){
    console.warn("dialog.json gagal:",e);
    dialogGlobal={firstVisit:["Halo!","<askName> Siapa namamu?"],
                  guest:["Halo tamu!","Silahkan pilih!"],
                  named:["Halo {name}!","Silahkan pilih!"],
                  returning:["Halo {name}!","Silahkan pilih!"]};
  }
}

async function loadDialogFor(section){
  try{
    const r=await fetch(`/data/dialog_${section}.json?t=${Date.now()}`);
    return await r.json();
  }catch(e){
    console.warn(`dialog_${section}.json gagal:`,e);
    return null;
  }
}

/* ---------- 2. siapa saya ---------- */
const fetchName=async()=>{try{return (await (await fetch("/api/whoami")).json()).name}catch{return null}};

/* ---------- 3. util ---------- */
const parse=l=>{const m=l.match(/^<(\w+)>/);return m?{content:l.slice(m[0].length).trimStart(),tag:m[1]}:{content:l,tag:null}};
const linkRX=/<link\s+href=['"]([^'"]+)['"](?:\s+color=['"]([^'"]+)['"])?>(.*?)<\/link>/g;
const render=l=>l.replace(linkRX,(_,h,c="blue",t)=>`<a target="_blank" href="${h}" class="link-${c}">${t}</a>`);
const strip=h=>{const d=document.createElement("div");d.innerHTML=h;return d.textContent||""};
const qs=s=>document.querySelector(s);
const ce=(t,c)=>Object.assign(document.createElement(t),{className:c||""});
const mkBtn=(txt,type,sel)=>{const b=ce("button","choice-btn"+(sel?" selected":""));b.textContent=txt;b.dataset.type=type;return b;};

/* =========================================================
   DOM & LOGIC
   ========================================================= */
document.addEventListener("DOMContentLoaded",async()=>{
  await loadDialog();
  await loadProjects();
  const saved=await fetchName();

  /* refs */
  const $txt=qs("#dialogText"), $arrow=qs("#arrow"), $dlg=qs("#dialogBox");
  const $choices=qs("#choicesContainer"), $menu=qs("#menu");
  const $modal=qs("#nameModal"), $blur=qs("#blurBackground");
  const $input=qs("#nameInput"), $ok=qs("#confirmBtn"), $cancel=qs("#cancelBtn");
  const menuItems=[...$menu.querySelectorAll("li")];

  /* queue init */
  let q=saved? dialogGlobal.returning.map(l=>l.replace("{name}",saved))
             : [...dialogGlobal.firstVisit];
  let idx=0,pos=0,typing=false,skip=false; const speed=35;

  /* ---------- helper ---------- */
  const highlightMenu=i=>{menuItems.forEach((li,x)=>li.querySelector(".icon-btn").classList.toggle("selected",x===i));menuIdx=i;};

  /* ---------- typewriter ---------- */
  function type(){
    if(idx>=q.length){console.warn("queue selesai");return;}
    typing=true;$arrow.style.opacity=0;

    const {content,tag}=parse(q[idx]);
    const html=render(content), plain=strip(html);
    $txt.textContent=plain.slice(0,++pos);

    if(pos<plain.length && !skip){setTimeout(type,speed);return;}

    typing=false;skip=false;$txt.innerHTML=html;$arrow.style.opacity=1;

    if(tag==="askName")   setTimeout(spawnMainChoices,600);
    if(tag==="askProject")setTimeout(()=>spawnSubChoices(doProyekYes,doProyekNo),600);
    if(tag==="askMore")   setTimeout(()=>spawnSubChoices(doProyekList,doProyekNo,"Boleh","Ngga perlu"),600);
    if(tag==="askVisit")  setTimeout(spawnVisit,600);

    if(!menuUnlocked && plain.toLowerCase().includes("silahkan pilih")){
      $menu.classList.remove("disabled"); menuUnlocked=true; highlightMenu(menuIdx);
    }
  }

  /* ---------- MAIN choice ---------- */
  function spawnMainChoices(){
    if(waitingMainChoice)return;
    waitingMainChoice=true; mainIdx=0; $choices.innerHTML="";
    const box=ce("div","choices");
    const g=mkBtn("Tamu","guest",true), n=mkBtn("Isi Nama","name");
    box.append(g,n); $choices.append(box); mainBtns=[g,n];
    mainBtns.forEach((b,x)=>{b.onmouseenter=()=>setMain(x);b.onclick=()=>chooseMain(b.dataset.type)});
    setMain(0);
  }
  const setMain=i=>{mainIdx=i; mainBtns.forEach((b,x)=>b.classList.toggle("selected",x===i));};
  function chooseMain(t){
    waitingMainChoice=false;$choices.innerHTML="";
    $menu.classList.add("disabled"); menuUnlocked=false;
    if(t==="guest"){q=[...dialogGlobal.guest]; idx=pos=0; type(); return;}
    openModal();
  }

  /* ---------- YES / NO generic ---------- */
  function spawnSubChoices(yesCB,noCB,yesT="Tentu",noT="Tidak"){
    if(waitingSubChoice)return;
    waitingSubChoice=true; subIdx=0; $choices.innerHTML="";
    const w=ce("div","choices"), y=mkBtn(yesT,"yes",true), n=mkBtn(noT,"no");
    w.append(y,n); $choices.append(w); subBtns=[y,n]; setSub(0);
    subBtns.forEach((b,x)=>b.onmouseenter=()=>setSub(x));
    y.onclick=()=>{waitingSubChoice=false;$choices.innerHTML="";yesCB();};
    n.onclick=()=>{waitingSubChoice=false;$choices.innerHTML="";noCB();};
  }
  const setSub=i=>{subIdx=i; subBtns.forEach((b,x)=>b.classList.toggle("selected",x===i));};

  /* ---------- Proyek branch ---------- */
  const doProyekYes=()=>{q=[...(dialogProyek.proyekYes||["(tidak ada data)","Silahkan pilih!"])];idx=pos=0;type();};
  const doProyekNo =()=>{q=[...(dialogProyek.proyekNo ||["Silahkan pilih!"])];idx=pos=0;type();};

  function doProyekList(){
    waitingProjList=true; projIdx=0; $choices.innerHTML="";
    const wrap=ce("div","choices proj-list");
    projects.forEach((p,i)=>wrap.append(mkBtn(p.title,p.id,i===0)));
    wrap.append(mkBtn("Tidak jadi","cancel"));
    $choices.append(wrap);
    projBtns=[...wrap.querySelectorAll("button")]; setProj(0);
    projBtns.forEach((b,x)=>b.onmouseenter=()=>setProj(x));
    projBtns.forEach(b=>b.onclick=()=>chooseProject(b.dataset.type));
  }
  const setProj=i=>{projIdx=i;projBtns.forEach((b,x)=>b.classList.toggle("selected",x===i));};
  function chooseProject(id){
    waitingProjList=false;$choices.innerHTML="";
    if(id==="cancel"){doProyekNo();return;}
    const p=projects.find(pr=>pr.id===id);
    if(!p){q=["Proyek tidak ditemukan","Silahkan pilih!"];idx=pos=0;type();return;}
    currentUrl=p.url;
    q=[...p.desc,"<askVisit>apakah kamu ingin mengunjunginya?"];idx=pos=0;type();
  }

  /* visit */
  function spawnVisit(){
    spawnSubChoices(
      ()=>{q=["tunggu sebentar, aku akan membawamu"];idx=pos=0;type();setTimeout(()=>window.location.href=currentUrl,1200);},
      ()=>{q=["yahh sayang sekali, padahal proyek yang kubuat ini sangat keren","Silahkan pilih!"];idx=pos=0;type();},
      "bawa aku","Tidak"
    );
  }

  /* modal */
  function openModal(){
    $modal.classList.remove("hidden");$blur.classList.remove("hidden");
    $input.value="";$input.focus();
    const close=()=>{$modal.classList.add("hidden");$blur.classList.add("hidden");};
    $cancel.onclick=close;
    $ok.onclick=async()=>{const n=$input.value.trim();if(!n)return;
      try{await fetch("/api/visit",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({name:n})});}catch{}
      close();q=dialogGlobal.named.map(l=>l.replace("{name}",n));idx=pos=0;type();};
  }

  /* next */
  const next=()=>{if(typing||waitingMainChoice||waitingSubChoice||waitingProjList)return;
    idx++; if(idx>=q.length){$arrow.style.opacity=0;return;} pos=0;$txt.textContent="";type();};

  /* events */
  $dlg.onclick=next;
  document.addEventListener("keydown",e=>{
    const k=e.key;
    if(waitingMainChoice){
      if(k==="ArrowLeft") setMain((mainIdx-1+mainBtns.length)%mainBtns.length);
      else if(k==="ArrowRight")setMain((mainIdx+1)%mainBtns.length);
      else if(k==="Enter") mainBtns[mainIdx].click();
      return;
    }
    if(waitingSubChoice){
      if(k==="ArrowLeft") setSub((subIdx-1+subBtns.length)%subBtns.length);
      else if(k==="ArrowRight")setSub((subIdx+1)%subBtns.length);
      else if(k==="Enter") subBtns[subIdx].click();
      return;
    }
    if(waitingProjList){
      if(k==="ArrowLeft") setProj((projIdx-1+projBtns.length)%projBtns.length);
      else if(k==="ArrowRight")setProj((projIdx+1)%projBtns.length);
      else if(k==="Enter") projBtns[projIdx].click();
      return;
    }
    if(menuUnlocked&&!typing){
      if(k==="ArrowLeft") highlightMenu((menuIdx-1+menuItems.length)%menuItems.length);
      else if(k==="ArrowRight")highlightMenu((menuIdx+1)%menuItems.length);
      else if(k==="Enter") menuItems[menuIdx].querySelector(".icon-btn").click();
      if(["ArrowLeft","ArrowRight","Enter"].includes(k))return;
    }
    if(k==="Enter") next();
  });

  /* menu click */
  menuItems.forEach((li,i)=>{
    const btn=li.querySelector(".icon-btn");
    btn.onmouseenter=()=>{if(!$menu.classList.contains("disabled")){$txt.textContent=li.dataset.dialog;highlightMenu(i);}};
    btn.onclick = async () => {
  if ($menu.classList.contains("disabled")) return;
  const path = btn.dataset.link;

  if (path === "/proyek") {
    $menu.classList.add("disabled");
    menuUnlocked = false;

    dialogProyek = await loadDialogFor("proyek") || {};
    let intro = dialogProyek?.intro;
    if (!Array.isArray(intro)) {
      console.warn("dialog_proyek.json.intro tidak valid:", intro);
      intro = ["<askProject>Kamu ingin mengetahui tentang Proyek ya?"];
    }

    q = [...intro];
    idx = pos = 0;
    type();
  } else {
    window.location.href = path;
  }
};
  });

  /* start */
  type();
});
