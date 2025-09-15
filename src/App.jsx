import React, { useEffect, useMemo, useState } from "react";
// ======= Firebase (v9 modular) =======
import { initializeApp } from "firebase/app";
import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
} from "firebase/auth";
import {
  getFirestore,
  collection,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";

// 🔁 PASTE YOUR WORKING CONFIG BELOW
const firebaseConfig = {
  apiKey: "AIzaSyD-a6aDYhvlaLbboFFDCIMJbzGw-9bOzhg",
  authDomain: "faith-habit-tracker.firebaseapp.com",
  projectId: "faith-habit-tracker",
  storageBucket: "faith-habit-tracker.firebasestorage.app",
  messagingSenderId: "608118770475",
  appId: "1:608118770475:web:8825dff77baf7be712326e",
  measurementId: "G-G4M310M8HW",
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// ======= Bible Verses =======
const VERSES = [
  { ref: "Philippians 4:13", text: "I can do all things through Christ who strengthens me." },
  { ref: "1 Corinthians 10:13", text: "God is faithful; He will not let you be tempted beyond what you can bear." },
  { ref: "Psalm 51:10", text: "Create in me a clean heart, O God, and renew a right spirit within me." },
  { ref: "Galatians 5:22-23", text: "The fruit of the Spirit is love, joy, peace, patience, kindness, goodness, faithfulness, gentleness, and self-control." },
  { ref: "Romans 12:2", text: "Be transformed by the renewing of your mind." },
  { ref: "Matthew 26:41", text: "Watch and pray so that you will not fall into temptation." },
  { ref: "Proverbs 16:32", text: "Better a patient person than a warrior, one with self-control than one who takes a city." },
  { ref: "Psalm 119:11", text: "I have stored up Your word in my heart, that I might not sin against You." },
  { ref: "Isaiah 40:31", text: "Those who hope in the Lord will renew their strength; they will run and not grow weary." },
  { ref: "Joshua 1:9", text: "Be strong and courageous... for the Lord your God is with you." },
];

// ======= Helpers =======
const toISODate = (d=new Date()) => d.toISOString().slice(0,10);
function getWeekRange(date = new Date()) {
  const d = new Date(date);
  const day = d.getDay();
  const diffToMonday = day === 0 ? 6 : day - 1;
  const start = new Date(d); start.setDate(d.getDate()-diffToMonday); start.setHours(0,0,0,0);
  const end = new Date(start); end.setDate(start.getDate()+6); end.setHours(23,59,59,999);
  return { start, end };
}
function startOfToday(){ const d=new Date(); d.setHours(0,0,0,0); return d; }

const DEFAULT_GOALS = { anger:0, social:0, porn:0, devotional:7, pages:100, reps:100 };

// ======= UI PRIMITIVES (no Tailwind) =======
const styles = {
  page: { minHeight:"100vh", background:"#f6f7fb", color:"#0f172a" },
  container: { maxWidth:1200, margin:"0 auto", padding:"24px" },
  header: { display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 },
  btn: { padding:"10px 14px", borderRadius:12, border:"1px solid #e2e8f0", background:"#fff", cursor:"pointer" },
  btnPrimary: { padding:"12px 16px", borderRadius:12, background:"#0f172a", color:"#fff", border:"none", cursor:"pointer" },
  card: { background:"#fff", borderRadius:16, padding:20, boxShadow:"0 10px 30px rgba(2,6,23,.08)" },
  grid: { display:"grid", gap:16, gridTemplateColumns:"repeat(auto-fit, minmax(280px,1fr))" },
  h1: { fontSize:22, fontWeight:800, margin:0 },
  h2: { fontSize:18, fontWeight:700, margin:"0 0 10px" },
  label: { fontSize:12, color:"#64748b", marginBottom:6, display:"block" },
  input: { width:"100%", padding:"10px 12px", border:"1px solid #cbd5e1", borderRadius:10 },
  tableWrap: { overflowX:"auto" },
  table: { width:"100%", borderCollapse:"collapse", fontSize:13 },
  th: { textAlign:"left", color:"#64748b", padding:8, borderBottom:"1px solid #e2e8f0" },
  td: { padding:8, borderBottom:"1px solid #eef2f7" },
  banner: { background:"#eef2ff", color:"#3730a3", border:"1px solid #c7d2fe", padding:12, borderRadius:12 },
  verse: { background:"linear-gradient(135deg,#0f172a,#334155)", color:"#fff", borderRadius:16, padding:24, boxShadow:"0 10px 30px rgba(2,6,23,.2)" },
  progressBG: { width:"100%", height:10, background:"#e2e8f0", borderRadius:999 },
  progressFill: (v,color="#10b981") => ({ height:10, width:`${v}%`, background:color, borderRadius:999 }),
  modalMask: { position:"fixed", inset:0, background:"rgba(0,0,0,.4)", display:"grid", placeItems:"center", padding:16, zIndex:50 },
  modal: { background:"#fff", borderRadius:16, padding:20, width:"100%", maxWidth:540, boxShadow:"0 20px 50px rgba(0,0,0,.2)" },
};

// ======= Auth =======
function AuthPanel(){
  const [mode,setMode]=useState("signin");
  const [email,setEmail]=useState("");
  const [password,setPassword]=useState("");
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState("");

  const submit=async(e)=>{
    e.preventDefault(); setLoading(true); setError("");
    try{
      if(mode==="signin") await signInWithEmailAndPassword(auth,email.trim(),password);
      else{
        await createUserWithEmailAndPassword(auth,email.trim(),password);
        const u=auth.currentUser; if(u){
          await setDoc(doc(db,"users",u.uid),{ createdAt:serverTimestamp(), goals:DEFAULT_GOALS, streak:{count:0,lastDevoDate:null} },{merge:true});
        }
      }
    }catch(err){ setError(err.message); } finally{ setLoading(false); }
  };

  return (
    <div style={{...styles.page, display:"grid", placeItems:"center"}}>
      <div style={{...styles.card, width:"100%", maxWidth:440}}>
        <h1 style={{...styles.h1, textAlign:"center"}}>Faith Habit Tracker</h1>
        <p style={{textAlign:"center", color:"#64748b", fontSize:13, marginTop:6}}>Log daily. Grow weekly. Walk with Jesus.</p>
        <form onSubmit={submit} style={{display:"grid", gap:12, marginTop:16}}>
          <div>
            <label style={styles.label}>Email</label>
            <input style={styles.input} type="email" value={email} onChange={e=>setEmail(e.target.value)} required/>
          </div>
          <div>
            <label style={styles.label}>Password</label>
            <input style={styles.input} type="password" value={password} onChange={e=>setPassword(e.target.value)} required/>
          </div>
          {error && <div style={{color:"#dc2626", fontSize:12}}>{error}</div>}
          <button style={styles.btnPrimary} disabled={loading}>{loading?"Please wait…":(mode==="signin"?"Sign In":"Create Account")}</button>
        </form>
        <div style={{textAlign:"center", marginTop:12, fontSize:13}}>
          {mode==="signin" ? (
            <button onClick={()=>setMode("signup")} style={{textDecoration:"underline"}}>Need an account? Sign up</button>
          ):(
            <button onClick={()=>setMode("signin")} style={{textDecoration:"underline"}}>Have an account? Sign in</button>
          )}
        </div>
      </div>
    </div>
  );
}

// ======= Goals Modal =======
function GoalsModal({open,onClose,goals,onSave}){
  const [local,setLocal]=useState(goals);
  useEffect(()=>{ setLocal(goals); },[goals,open]);
  if(!open) return null;
  return (
    <div style={styles.modalMask}>
      <div style={styles.modal}>
        <h3 style={{...styles.h2, marginBottom:12}}>Edit Weekly Goals</h3>
        <div style={{display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))", gap:12}}>
          {Object.keys(DEFAULT_GOALS).map(k=> (
            <label key={k} style={{fontSize:13}}>
              <span style={{...styles.label, textTransform:"capitalize"}}>{k}</span>
              <input type="number" min={0} style={styles.input} value={local[k]} onChange={e=>setLocal(v=>({...v,[k]:Number(e.target.value)}))}/>
            </label>
          ))}
        </div>
        <div style={{display:"flex", justifyContent:"flex-end", gap:8, marginTop:16}}>
          <button onClick={onClose} style={styles.btn}>Cancel</button>
          <button onClick={()=>onSave(local)} style={styles.btnPrimary}>Save</button>
        </div>
      </div>
    </div>
  );
}

// ======= Dashboard =======
function Dashboard({user}){
  const [goals,setGoals]=useState(DEFAULT_GOALS);
  const [today]=useState(toISODate());
  const [entry,setEntry]=useState({devotional:false,pages:0,reps:0,anger:0,social:0,porn:0});
  const [weekEntries,setWeekEntries]=useState([]);
  const [saving,setSaving]=useState(false);
  const [userDoc,setUserDoc]=useState(null);
  const [showGoals,setShowGoals]=useState(false);

  // user doc + goals
  useEffect(()=>{
    const ref=doc(db,"users",user.uid);
    const unsub=onSnapshot(ref,(snap)=>{ if(snap.exists()){ const d=snap.data(); setUserDoc({id:snap.id,...d}); setGoals({...DEFAULT_GOALS, ...(d.goals||{})}); }});
    return ()=>unsub();
  },[user.uid]);

  // today's entry
  useEffect(()=>{(async()=>{
    const ref=doc(db,"users",user.uid,"entries",today);
    const s=await getDoc(ref);
    if(s.exists()){ const d=s.data(); setEntry({ devotional:!!d.devotional, pages:d.pages||0, reps:d.reps||0, anger:d.anger||0, social:d.social||0, porn:d.porn||0 }); }
  })();},[user.uid,today]);

  // this week entries
  useEffect(()=>{
    const {start,end}=getWeekRange(new Date());
    const q=query(collection(db,"users",user.uid,"entries"), where("dateTs",">=",start.getTime()), where("dateTs","<=",end.getTime()), orderBy("dateTs","asc"));
    const unsub=onSnapshot(q,(snap)=>{ const rows=[]; snap.forEach(d=>rows.push({id:d.id,...d.data()})); setWeekEntries(rows); });
    return ()=>unsub();
  },[user.uid]);

  const totals=useMemo(()=>weekEntries.reduce((a,e)=>{ a.pages+=(e.pages||0); a.reps+=(e.reps||0); a.devotional+=(e.devotional?1:0); a.anger+=(e.anger||0); a.social+=(e.social||0); a.porn+=(e.porn||0); return a; },{pages:0,reps:0,devotional:0,anger:0,social:0,porn:0}),[weekEntries]);

  const progress=useMemo(()=>({
    pages: Math.min(100, Math.round((totals.pages/Math.max(1,goals.pages))*100)),
    reps: Math.min(100, Math.round((totals.reps/Math.max(1,goals.reps))*100)),
    devotional: Math.min(100, Math.round((totals.devotional/Math.max(1,goals.devotional))*100)),
    anger: Math.max(0, Math.min(100, 100-Math.round(((totals.anger)/Math.max(1,goals.anger||1))*100))),
    social: Math.max(0, Math.min(100, 100-Math.round(((totals.social)/Math.max(1,goals.social||1))*100))),
    porn: Math.max(0, Math.min(100, 100-Math.round(((totals.porn)/Math.max(1,goals.porn||1))*100))),
  }),[totals,goals]);

  const verseOfDay=useMemo(()=>{ const idx=Number(new Date().toISOString().slice(0,10).replaceAll('-',''))%VERSES.length; return VERSES[idx]; },[]);

  const milestones=useMemo(()=>{ const L=[]; if(totals.devotional>=goals.devotional)L.push({label:"Weekly Devoti
