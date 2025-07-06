/* =========================================================
   main.js — versi FINAL rapih & responsif
   ========================================================= */

/* ---------- GLOBAL STATE ---------- */
let waitingMainChoice = false;
let waitingSubChoice  = false;
let waitingProjList   = false;

let mainBtns=[], mainIdx=0;
let subBtns =[], subIdx =0;
let projBtns=[], projIdx=0;

let menuUnlocked=false, menuIdx=0;
let currentUrl   = "";

/* ---------- DATA PROYEK ---------- */
let projects = [];
async function loadProjects(){
  try{
    const r = await fetch(`/data/projects.json?t=${Date.now()}`);
    projects = await r.json();
  }catch(e){
    console.warn("projects.json gagal:",e);
    projects = [];                        // kosong → aplikasi tetap jalan
  }
}

/* ---------- DIALOG ---------- */
let dialogGlobal={}, dialogProyek={};

async function loadDialogGlobal(){
  try{
    const r=await fetch(`/data/dialog.json?t=${Date.now()}`);
    dialogGlobal = await r.json();
  }catch(e){
    console.warn("dialog.json gagal:",e);
    dialogGlobal = {
      firstVisit : ["Halo!","<askName> Siapa namamu?"],
      guest      : ["Halo tamu!","Silahkan pilih!"],
      named      : ["Halo {name}!","Silahkan pilih!"],
      returning  : ["Halo {name}!","Silahkan pilih!"]
    };
  }
}

async function loadDialogProyek(){
  try{
    const r=await fetch(`/data/dialog_proyek.json?t=${Date.now()}`);
    dialogProyek = await r.json();
  }catch(e){
    console.warn("dialog_proyek.json gagal:",e);
    dialogProyek = {};
  }
}

/* ---------- UTIL ---------- */
const parse=l=>{const m=l.match(/^<(\w+)>/);return m?{content:l.slice(m[0].length).trimStart(),tag:m[1]}:{content:l,tag:null}};
const linkRX=/<link\s+href=['"]([^'" ]+)['"](?:\s+color=['"]([^'" ]+)['"])?>(.*?)<\/link>/g;
const render=l=>l.replace(linkRX,(_,h,c="blue",t)=>`<a href="${h}" target="_blank" class="link-${c}">${t}</a>`);
const strip =html=>{const d=document.createElement("div");d.innerHTML=html;return d.textContent||""};
const qs=s=>document.querySelector(s);
const ce=(t,c)=>Object.assign(document.createElement(t),{className:c||""});
const mkBtn=(t,type,sel)=>{const b=ce("button","choice-btn"+(sel?" selected":""));b.textContent=t;b.dataset.type=type;return b;};

/* ---------- MAIN ---------- */
document.addEventListener("DOMContentLoaded",async()=>{
  await Promise.all([loadDialogGlobal(),loadProjects()]);

  const savedName = await (async()=>{ try{const r=await fetch("/api/whoami");return (await r.json()).name}catch{return null} })();

  /* refs */
  const $txt=qs("#dialogText"), $arrow=qs("#arrow"), $dlg=qs("#dialogBox");
  const $choices=qs("#choicesContainer"), $menu=qs("#menu");
  const $modal=qs("#nameModal"), $blur=qs("#blurBackground");
  const $input=qs("#nameInput"), $ok=qs("#confirmBtn"), $cancel=qs("#cancelBtn");
  const menuItems=[...$menu.querySelectorAll("li")];

  /* queue init */
  let q = savedName
          ? dialogGlobal.returning.map(l=>l.replace("{name}",savedName))
          : [...dialogGlobal.firstVisit];

  let idx=0,pos=0,typing=false,skip=false;
  const speed=35;

  /* helper */
  const highlightMenu=i=>{menuItems.forEach((li,x)=>li.querySelector(".icon-btn").classList.toggle("selected",x===i));menuIdx=i;};

  /* ---------- TYPEWRITER ---------- */
  function type(){
    if(idx>=q.length){console.warn("queue selesai");return;}
    typing=true;$arrow.style.opacity=0;

    const {content,tag}=parse(q[idx]);
    const html=render(content), plain=strip(html);
    $txt.textContent = plain.slice(0,++pos);

    if(pos<plain.length&&!skip){setTimeout(type,speed);return;}

    typing=false;skip=false;$txt.innerHTML=html;$arrow.style.opacity=1;

    /* tag trigger */
    if(tag==="askName")   setTimeout(spawnMainChoices,600);
    if(tag==="askProject")setTimeout(()=>spawnSubChoices(doProyekYes,doProyekNo),600);
    if(tag==="askMore")   setTimeout(()=>spawnSubChoices(doProyekMoreYes,doProyekNo,"Boleh","Ngga perlu"),600);
    if(tag==="askVisit")  setTimeout(spawnVisit,600);

    /* auto‑unlock ikon */
    if(!menuUnlocked && plain.toLowerCase().includes("silahkan pilih")){
      $menu.classList.remove("disabled"); menuUnlocked=true; highlightMenu(menuIdx);
    }
  }

  /* ---------- CHOICES ---------- */
  /* main */
  function spawnMainChoices(){
    if(waitingMainChoice)return;
    waitingMainChoice=true; mainIdx=0; $choices.innerHTML="";
    const wrap=ce("div","choices");
    const g=mkBtn("Tamu","guest",true), n=mkBtn("Isi Nama","name");
    wrap.append(g,n); $choices.append(wrap); mainBtns=[g,n]; setMain(0);
    mainBtns.forEach((b,x)=>{b.onmouseenter=()=>setMain(x);b.onclick=()=>chooseMain(b.dataset.type)});
  }
  const setMain=i=>{mainIdx=i;mainBtns.forEach((b,x)=>b.classList.toggle("selected",x===i));};
  function chooseMain(t){
    waitingMainChoice=false;$choices.innerHTML="";
    $menu.classList.add("disabled"); menuUnlocked=false;
    if(t==="guest"){q=[...dialogGlobal.guest];idx=pos=0;type();return;}
    openModal();
  }

  /* yes/no generic */
  function spawnSubChoices(yesCB,noCB,yesT="Tentu",noT="Tidak"){
    if(waitingSubChoice)return;
    waitingSubChoice=true; subIdx=0; $choices.innerHTML="";
    const w=ce("div","choices"), y=mkBtn(yesT,"yes",true), n=mkBtn(noT,"no");
    w.append(y,n); $choices.append(w); subBtns=[y,n]; setSub(0);
    subBtns.forEach((b,x)=>b.onmouseenter=()=>setSub(x));
    y.onclick=()=>{waitingSubChoice=false;$choices.innerHTML="";yesCB();};
    n.onclick=()=>{waitingSubChoice=false;$choices.innerHTML="";noCB();};
  }
  const setSub=i=>{subIdx=i;subBtns.forEach((b,x)=>b.classList.toggle("selected",x===i));};

  /* PROYEK branch */
  const doProyekYes = ()=>{ q=[...(dialogProyek.proyekYes||["(data kosong)","Silahkan pilih!"])]; idx=pos=0; type(); };
  const doProyekNo  = ()=>{ q=[...(dialogProyek.proyekNo ||["Silahkan pilih!"])];    idx=pos=0; type(); };
  const doProyekMoreYes = ()=>{ q=["Mau Lihat yang Mana?"]; idx=pos=0; type(); setTimeout(doProyekList,1500); };

  function doProyekList(){
    waitingProjList=true; projIdx=0; $choices.innerHTML="";
    const wrap=ce("div","choices proj-list");
    projects.forEach((p,i)=>wrap.append(mkBtn(p.title,p.id,i===0)));
    wrap.append(mkBtn("Tidak jadi","cancel"));
    $choices.append(wrap); projBtns=[...wrap.querySelectorAll("button")]; setProj(0);
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

  function spawnVisit(){
    spawnSubChoices(
      ()=>{q=["tunggu sebentar, aku akan membawamu"];idx=pos=0;type();setTimeout(()=>window.location.href=currentUrl,1600);},
      ()=>{q=["yahh sayang sekali, padahal proyek yang kubuat ini sangat keren","Silahkan pilih!"];idx=pos=0;type();},
      "bawa aku","Tidak"
    );
  }

  /* modal nama */
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

  /* keyboard + click */
  $dlg.onclick=next;
  document.addEventListener("keydown",e=>{
    const k=e.key;
    if(waitingMainChoice){k==="ArrowLeft"?setMain((mainIdx-1+mainBtns.length)%mainBtns.length):k==="ArrowRight"?setMain((mainIdx+1)%mainBtns.length):k==="Enter"&&mainBtns[mainIdx].click(); if(["ArrowLeft","ArrowRight","Enter"].includes(k))return;}
    if(waitingSubChoice){k==="ArrowLeft"?setSub((subIdx-1+subBtns.length)%subBtns.length):k==="ArrowRight"?setSub((subIdx+1)%subBtns.length):k==="Enter"&&subBtns[subIdx].click(); if(["ArrowLeft","ArrowRight","Enter"].includes(k))return;}
    if(waitingProjList){k==="ArrowLeft"?setProj((projIdx-1+projBtns.length)%projBtns.length):k==="ArrowRight"?setProj((projIdx+1)%projBtns.length):k==="Enter"&&projBtns[projIdx].click(); if(["ArrowLeft","ArrowRight","Enter"].includes(k))return;}
    if(menuUnlocked&&!typing){
      if(k==="ArrowLeft") highlightMenu((menuIdx-1+menuItems.length)%menuItems.length);
      else if(k==="ArrowRight")highlightMenu((menuIdx+1)%menuItems.length);
      else if(k==="Enter") menuItems[menuIdx].querySelector(".icon-btn").click();
      if(["ArrowLeft","ArrowRight","Enter"].includes(k))return;
    }
    if(k==="Enter") next();
  });

  /* icon click */
  menuItems.forEach((li,i)=>{
    const btn=li.querySelector(".icon-btn");
    btn.onmouseenter=()=>!$menu.classList.contains("disabled")&&($txt.textContent=li.dataset.dialog,highlightMenu(i));
    btn.onclick = async()=>{
      if($menu.classList.contains("disabled"))return;
      const path=btn.dataset.link;
      if(path==="/proyek"){
        $menu.classList.add("disabled");menuUnlocked=false;
        await loadDialogProyek();
        let intro=dialogProyek.proyekIntro||dialogProyek.intro||["<askProject>Kamu ingin mengetahui tentang Proyek ya?"];
        if(!Array.isArray(intro)){console.warn("dialog_proyek intro invalid:",intro);intro=["<askProject>Kamu ingin mengetahui tentang Proyek ya?"];}
        q=[...intro]; idx=pos=0; type();
      }else window.location.href=path;
    };
  });

  /* start */
  type();
});
