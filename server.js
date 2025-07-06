/* =========================================================
   server.js – geolocation ipwho.is + coords + Google Maps
   (log IP) + frontend cookie hybrid
   ========================================================= */
import express from "express";
import path, { dirname } from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import helmet from "helmet";
import compression from "compression";
import rateLimit from "express-rate-limit";
import cors from "cors";
import { UAParser } from "ua-parser-js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const app  = express();
const PORT = 3333;

/* ---------- security & perf ---------- */
app.use(helmet());
app.use(compression());
app.use(express.json());
app.use(express.urlencoded({ extended:true }));
app.use(cors({origin:"*"}));
app.use(rateLimit({windowMs:15*60*1000,max:100,standardHeaders:true,legacyHeaders:false}));

/* ---------- proxy ---------- */
if (process.env.NODE_ENV === "production") {
  app.set("trust proxy", true);
}

/* ---------- no‑store for html/js ---------- */
app.use((req,res,next)=>{
  if(req.url.endsWith(".js")||req.url.endsWith(".html"))
    res.setHeader("Cache-Control","no-store");
  next();
});

/* ---------- static ---------- */
app.use(express.static(path.join(__dirname,"public")));

/* ---------- data helpers ---------- */
const DATA_DIR=path.join(__dirname,"data");
const VIS_PATH=path.join(DATA_DIR,"visitors.json");
if(!fs.existsSync(DATA_DIR))fs.mkdirSync(DATA_DIR);
if(!fs.existsSync(VIS_PATH))fs.writeFileSync(VIS_PATH,"[]","utf-8");
const readVisitors=()=>JSON.parse(fs.readFileSync(VIS_PATH,"utf-8"));
const writeVisitors=d=>fs.writeFileSync(VIS_PATH,JSON.stringify(d,null,2));

/* ---------- POST /api/visit ---------- */
app.post("/api/visit",async(req,res)=>{
  const {name}=req.body;
  if(!name)return res.status(400).json({error:"name required"});

  const ip=req.ip;
  const ua=req.headers["user-agent"]||"";
  const now=new Date().toISOString();

  const parser=new UAParser(ua);
  const browser=parser.getBrowser().name||"Unknown";
  const os=parser.getOS().name||"Unknown";
  const device=parser.getDevice().type||"desktop";

  let location="Unknown",coords="",maps="";
  try{
    const geo=await fetch(`https://ipwho.is/${ip}`).then(r=>r.json());
    if(geo&&geo.success){
      location=`${geo.city}, ${geo.region}, ${geo.country}`;
      coords=`${geo.latitude},${geo.longitude}`;
      maps=`https://www.google.com/maps?q=${coords}`;
    }
  }catch{
    console.warn("ipwho.is gagal:",ip);
  }

  const visitors=readVisitors();
  const idx=visitors.findIndex(v=>v.ip===ip);
  const existing=visitors[idx];
  const item={
    ip,name,timestamp:now,
    seenIntro: existing?.seenIntro ?? false,
    location,coords,maps,browser,os,device
  };
  if(idx>=0){visitors[idx]=item;console.log(`[REVISIT] ${ip} → "${name}"`);}
  else      {visitors.push(item);console.log(`[VISIT] ${ip} → "${name}"`);}
  writeVisitors(visitors);
  res.json({ok:true});
});

/* ---------- GET /api/whoami ---------- */
app.get("/api/whoami",(req,res)=>{
  const v=readVisitors().find(x=>x.ip===req.ip);
  res.json({name:v?.name||null,seenIntro:v?.seenIntro||false});
});

/* ---------- POST /api/introDone ---------- */
app.post("/api/introDone",(req,res)=>{
  const visitors=readVisitors();
  const v=visitors.find(x=>x.ip===req.ip);
  if(v){v.seenIntro=true;writeVisitors(visitors);}
  res.json({ok:true});
});

app.listen(PORT,()=>console.log(`Server running on http://localhost:${PORT}`));
