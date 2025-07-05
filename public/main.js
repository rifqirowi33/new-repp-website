/******************* 1. load dialog JSON *******************/
let dialogData = {};
async function loadDialog() {
  try {
    const res = await fetch(`/data/dialog.json?t=${Date.now()}`); // bust cache
    dialogData = await res.json();
  } catch (e) {
    console.error("dialog.json gagal dimuat:", e);
    dialogData = {
      firstVisit: ["Halo, Saya REPP!", "<askName> Kamu siapa?"],
      guest: ["Halo Tamu!", "situs ini telah aktif!"],
      named: ["Halo {name}!", "situs ini telah aktif!"],
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
  } catch {return null;}
}

/******************* helper: parse line & tag *****************/
function parseDialogLine(line){
  const tags=[];let content=line;
  const m=line.match(/^<(\w+)>/);
  if(m){tags.push(m[1]);content=line.replace(/^<\w+>\s*/,'');}
  return{content,tags};
}

/******************* 3. main app ****************************/
document.addEventListener("DOMContentLoaded",async()=>{
  await loadDialog();
  const savedName=await fetchSavedName();

  /* elements */
  const dialogText=document.getElementById("dialogText");
  const arrow=document.getElementById("arrow");
  const dialogBox=document.getElementById("dialogBox");
  const choicesWrap=document.getElementById("choicesContainer");
  const menu=document.getElementById("menu");
  const modal=document.getElementById("nameModal");
  const blurBG=document.getElementById("blurBackground");
  const nameInput=document.getElementById("nameInput");
  const confirmBtn=document.getElementById("confirmBtn");
  const cancelBtn=document.getElementById("cancelBtn");
  const menuItems=[...menu.querySelectorAll("li")];

  /* queue */
  let queue=savedName?dialogData.returning.map(l=>l.replace("{name}",savedName)):[...dialogData.firstVisit];

  /* state */
  let idx=0,pos=0,typing=false,skip=false;
  let waitingChoice=false,menuUnlocked=false;
  let choiceButtons=[],choiceIndex=0;
  let menuIndex=0;
  const speed=35;

  /***************** typeLoop *****************/
  function typeLoop(){
    typing=true;arrow.style.opacity=0;
    const {content,tags}=parseDialogLine(queue[idx]);
    dialogText.textContent=content.slice(0,++pos);
    if(pos<content.length&&!skip){setTimeout(typeLoop,speed);return;}

    typing=false;skip=false;arrow.style.opacity=1;

    if(tags.includes("askName")){
      setTimeout(spawnChoices,1000);
    }
    if(content.trim()==="Silahkan pilih!"&&!menuUnlocked){
      menu.classList.remove("disabled");
      menuUnlocked=true;
      highlightMenu(menuIndex);
    }
  }

  /********* spawn choices *********/
  function spawnChoices(){
    if(choicesWrap.childElementCount)return;
    waitingChoice=true;choiceIndex=0;
    const wrap=document.createElement("div");wrap.className="choices";
    const btnGuest=document.createElement("button");btnGuest.className="choice-btn selected";btnGuest.dataset.type="guest";btnGuest.textContent="Tamu";
    const btnName=document.createElement("button");btnName.className="choice-btn";btnName.dataset.type="name";btnName.textContent="Isi Nama";
    wrap.append(btnGuest,btnName);choicesWrap.append(wrap);
    choiceButtons=[btnGuest,btnName];
    choiceButtons.forEach((btn,i)=>{
      btn.addEventListener("mouseenter",()=>highlightChoice(i));
      btn.addEventListener("click",()=>handleChoice(btn.dataset.type));
    });
    highlightChoice(0);
  }
  function highlightChoice(i){choiceButtons.forEach((b,x)=>b.classList.toggle("selected",x===i));choiceIndex=i;}

  /********* handle choice *********/
  function handleChoice(type){choicesWrap.innerHTML="";waitingChoice=false;
    if(type==="guest"){queue=[...dialogData.guest];idx=pos=0;typeLoop();return;}
    openModal();
  }

  /********* modal *********/
  function openModal(){modal.classList.remove("hidden");blurBG.classList.remove("hidden");nameInput.value="";nameInput.focus();
    const close=()=>{modal.classList.add("hidden");blurBG.classList.add("hidden");};
    cancelBtn.onclick=close;
    confirmBtn.onclick=async()=>{
      const name=nameInput.value.trim();if(!name)return;
      try{await fetch("/api/visit",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({name})});}catch{}
      close();queue=dialogData.named.map(l=>l.replace("{name}",name));idx=pos=0;typeLoop();
    };
  }

  /********* next sentence *********/
  function next(){
    if(typing||waitingChoice){if(waitingChoice)return;skip=true;const {content}=parseDialogLine(queue[idx]);pos=content.length;dialogText.textContent=content;return;}
    idx++;if(idx>=queue.length){arrow.style.opacity=0;return;}
    pos=0;dialogText.textContent="";typeLoop();
  }

  dialogBox.addEventListener("click",next);
  document.addEventListener("keydown",e=>{
    const key=e.key;
    /* Arrow nav inside choice buttons */
    if(waitingChoice){
      if(key==="ArrowLeft"){choiceIndex=(choiceIndex-1+choiceButtons.length)%choiceButtons.length;highlightChoice(choiceIndex);}
      if(key==="ArrowRight"){choiceIndex=(choiceIndex+1)%choiceButtons.length;highlightChoice(choiceIndex);}
      if(key==="Enter"){choiceButtons[choiceIndex].click();}
      return;
    }

    /* Arrow nav in menu after unlocked */
    if(menuUnlocked&&!typing){
      if(key==="ArrowLeft"){menuIndex=(menuIndex-1+menuItems.length)%menuItems.length;highlightMenu(menuIndex);}
      if(key==="ArrowRight"){menuIndex=(menuIndex+1)%menuItems.length;highlightMenu(menuIndex);}
      if(key==="Enter"){const btn=menuItems[menuIndex].querySelector(".icon-btn");btn.click();}
      if(["ArrowLeft","ArrowRight","Enter"].includes(key))return; // jangan trigger next()
    }

    if(key==="Enter")next();
  });

  function highlightMenu(i){menuItems.forEach((li,x)=>li.querySelector(".icon-btn").classList.toggle("selected",x===i));}

  /********* menu hover update dialog *********/
  menuItems.forEach((li,i)=>{
    const btn=li.querySelector(".icon-btn");
    const msg=li.dataset.dialog;
    const show=()=>{if(menu.classList.contains("disabled"))return;dialogText.textContent=msg;highlightMenu(i);menuIndex=i;};
    btn.addEventListener("mouseenter",show);
    btn.addEventListener("focus",show);
  });

  /* start */
  typeLoop();
});
