import React, { useEffect, useMemo, useState } from "react";
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
  where,
} from "firebase/firestore";

// Firebase config (filled from your console)
const firebaseConfig = {
  apiKey: "AIzaSyD-a6DYhlalLboFFDClMJbzGw-9bozhg",
  authDomain: "faith-habit-tracker.firebaseapp.com",
  projectId: "faith-habit-tracker",
  storageBucket: "faith-habit-tracker.firebasestorage.app",
  messagingSenderId: "608118770475",
  appId: "1:608118770475:web:8825dff77baf7be712326e",
  measurementId: "G-G4M310M8HW"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

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

const toISODate = (d=new Date()) => d.toISOString().slice(0,10);

function getWeekRange(date = new Date()) {
  const d = new Date(date);
  const day = d.getDay(); // 0 Sun ... 6 Sat
  const diffToMonday = day === 0 ? 6 : day - 1;
  const start = new Date(d);
  start.setDate(d.getDate() - diffToMonday);
  start.setHours(0,0,0,0);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23,59,59,999);
  return { start, end };
}

function startOfToday() {
  const d = new Date();
  d.setHours(0,0,0,0);
  return d;
}

const DEFAULT_GOALS = {
  anger: 0,
  social: 0,
  porn: 0,
  devotional: 7,
  pages: 100,
  reps: 100,
};

function AuthPanel() {
  const [mode, setMode] = useState("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      if (mode === "signin") {
        await signInWithEmailAndPassword(auth, email.trim(), password);
      } else {
        await createUserWithEmailAndPassword(auth, email.trim(), password);
        const u = auth.currentUser;
        if (u) {
          await setDoc(doc(db, "users", u.uid), { createdAt: serverTimestamp(), goals: DEFAULT_GOALS });
        }
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center", background:"#f8fafc", padding:"1rem"}}>
      <div style={{width:"100%", maxWidth:420, background:"#fff", borderRadius:16, boxShadow:"0 10px 30px rgba(2,6,23,.1)", padding:24}}>
        <h1 style={{fontSize:24, fontWeight:700, textAlign:"center", marginBottom:8}}>Faith Habit Tracker</h1>
        <p style={{textAlign:"center", fontSize:12, color:"#64748b", marginBottom:24}}>Log daily. Grow weekly. Walk with Jesus.</p>
        <form onSubmit={submit} style={{display:"grid", gap:12}}>
          <input style={{padding:"12px 14px", border:"1px solid #cbd5e1", borderRadius:12}} type="email" placeholder="Email" value={email} onChange={(e)=>setEmail(e.target.value)} required />
          <input style={{padding:"12px 14px", border:"1px solid #cbd5e1", borderRadius:12}} type="password" placeholder="Password" value={password} onChange={(e)=>setPassword(e.target.value)} required />
          {error && <div style={{color:"#dc2626", fontSize:12}}>{error}</div>}
          <button disabled={loading} style={{padding:"12px 14px", borderRadius:12, background:"#0f172a", color:"#fff", fontWeight:600}}>
            {loading ? "Please wait…" : (mode === "signin" ? "Sign In" : "Create Account")}
          </button>
        </form>
        <div style={{textAlign:"center", marginTop:16, fontSize:13}}>
          {mode === "signin" ? (
            <button onClick={()=>setMode("signup")} style={{textDecoration:"underline"}}>Need an account? Sign up</button>
          ) : (
            <button onClick={()=>setMode("signin")} style={{textDecoration:"underline"}}>Have an account? Sign in</button>
          )}
        </div>
      </div>
    </div>
  );
}

function Dashboard({ user }) {
  const [goals, setGoals] = useState(DEFAULT_GOALS);
  const [today, setToday] = useState(toISODate());
  const [entry, setEntry] = useState({ devotional: false, pages: 0, reps: 0, anger: 0, social: 0, porn: 0 });
  const [weekEntries, setWeekEntries] = useState([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const userDocRef = doc(db, "users", user.uid);
    const unsub = onSnapshot(userDocRef, (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setGoals({ ...DEFAULT_GOALS, ...(data.goals || {}) });
      }
    });
    return () => unsub();
  }, [user.uid]);

  useEffect(() => {
    (async () => {
      const ref = doc(db, "users", user.uid, "entries", today);
      const snap = await getDoc(ref);
      if (snap.exists()) {
        const d = snap.data();
        setEntry({
          devotional: !!d.devotional, pages: d.pages||0, reps: d.reps||0,
          anger: d.anger||0, social: d.social||0, porn: d.porn||0
        });
      } else {
        setEntry({ devotional: false, pages: 0, reps: 0, anger: 0, social: 0, porn: 0 });
      }
    })();
  }, [user.uid, today]);

  useEffect(() => {
    const { start, end } = getWeekRange(new Date());
    const q = query(
      collection(db, "users", user.uid, "entries"),
      where("dateTs", ">=", start.getTime()),
      where("dateTs", "<=", end.getTime()),
      orderBy("dateTs", "asc")
    );
    const unsub = onSnapshot(q, (snap) => {
      const rows = [];
      snap.forEach(d => rows.push({ id: d.id, ...d.data() }));
      setWeekEntries(rows);
    });
    return () => unsub();
  }, [user.uid]);

  const totals = useMemo(() => weekEntries.reduce((acc, e) => {
    acc.pages += e.pages || 0;
    acc.reps += e.reps || 0;
    acc.devotional += e.devotional ? 1 : 0;
    acc.anger += e.anger || 0;
    acc.social += e.social || 0;
    acc.porn += e.porn || 0;
    return acc;
  }, { pages:0, reps:0, devotional:0, anger:0, social:0, porn:0 }), [weekEntries]);

  const progress = useMemo(() => ({
    pages: Math.min(100, Math.round((totals.pages / goals.pages) * 100)),
    reps: Math.min(100, Math.round((totals.reps / goals.reps) * 100)),
    devotional: Math.min(100, Math.round((totals.devotional / goals.devotional) * 100)),
    anger: Math.max(0, Math.min(100, 100 - Math.round(((totals.anger) / Math.max(1, goals.anger || 1)) * 100))),
    social: Math.max(0, Math.min(100, 100 - Math.round(((totals.social) / Math.max(1, goals.social || 1)) * 100))),
    porn: Math.max(0, Math.min(100, 100 - Math.round(((totals.porn) / Math.max(1, goals.porn || 1)) * 100))),
  }), [totals, goals]);

  const milestones = useMemo(() => {
    const list = [];
    if (totals.devotional >= 7) list.push({ label: "Weekly Devotional Streak", detail: "7/7 devotionals" });
    if (totals.pages >= 100) list.push({ label: "Book Worm", detail: "100 pages this week" });
    if (totals.reps >= 100) list.push({ label: "Temple Care", detail: "100 reps this week" });
    if (totals.anger === 0 && totals.social === 0 && totals.porn === 0) list.push({ label: "Eyes & Heart Guarded", detail: "No anger/social/porn" });
    return list;
  }, [totals]);

  const verse = useMemo(() => VERSES[Math.floor(Math.random()*VERSES.length)], []);

  const saveToday = async () => {
    setSaving(true);
    try {
      const ref = doc(db, "users", user.uid, "entries", today);
      await setDoc(ref, {
        ...entry,
        date: today,
        dateTs: startOfToday().getTime(),
        updatedAt: serverTimestamp(),
      }, { merge: true });
    } finally {
      setSaving(false);
    }
  };

  const signout = async () => { await signOut(auth); };

  const Bar = ({ value, good=true }) => (
    <div style={{width:"100%", height:12, background:"#e2e8f0", borderRadius:999}}>
      <div style={{height:12, width:`${value}%`, background: good ? "#10b981" : "#ef4444", borderRadius:999}}/>
    </div>
  );

  return (
    <div style={{minHeight:"100vh", background:"#f8fafc"}}>
      <header style={{padding:16, display:"flex", justifyContent:"space-between", alignItems:"center"}}>
        <div>
          <h1 style={{fontSize:18, fontWeight:700}}>Hello, {user.email}</h1>
          <p style={{fontSize:12, color:"#64748b"}}>Today: {today}</p>
        </div>
        <button onClick={signout} style={{padding:"8px 12px", borderRadius:12, background:"#0f172a", color:"#fff"}}>Sign out</button>
      </header>

      <main style={{maxWidth:1100, margin:"0 auto", padding:16, display:"grid", gap:16, gridTemplateColumns:"repeat(auto-fit, minmax(280px, 1fr))"}}>
        <div style={{gridColumn:"1/-1", background:"linear-gradient(135deg,#0f172a,#334155)", color:"#fff", borderRadius:16, padding:24, boxShadow:"0 10px 30px rgba(2,6,23,.2)"}}>
          <p style={{fontStyle:"italic", fontSize:18, marginBottom:6}}>“{verse.text}”</p>
          <p style={{opacity:.8, fontSize:12}}>— {verse.ref}</p>
        </div>

        <div style={{background:"#fff", borderRadius:16, boxShadow:"0 10px 30px rgba(2,6,23,.08)", padding:20}}>
          <h2 style={{fontWeight:600, fontSize:18, marginBottom:12}}>Log Today</h2>
          <div style={{display:"grid", gap:12, gridTemplateColumns:"repeat(auto-fit, minmax(180px, 1fr))"}}>
            <label style={{display:"flex", alignItems:"center", gap:8, border:"1px solid #e2e8f0", borderRadius:12, padding:12}}>
              <input type="checkbox" checked={entry.devotional} onChange={e=>setEntry(v=>({...v, devotional: e.target.checked}))} />
              <span>Devotional & Prayer (done)</span>
            </label>
            <div style={{border:"1px solid #e2e8f0", borderRadius:12, padding:12}}>
              <div style={{fontSize:12, color:"#64748b"}}>Pages Read</div>
              <input type="number" min={0} value={entry.pages} onChange={e=>setEntry(v=>({...v, pages: Number(e.target.value)}))}
                style={{width:"100%", marginTop:6, padding:"10px 12px", border:"1px solid #cbd5e1", borderRadius:10}} />
            </div>
            <div style={{border:"1px solid #e2e8f0", borderRadius:12, padding:12}}>
              <div style={{fontSize:12, color:"#64748b"}}>Exercise Reps</div>
              <input type="number" min={0} value={entry.reps} onChange={e=>setEntry(v=>({...v, reps: Number(e.target.value)}))}
                style={{width:"100%", marginTop:6, padding:"10px 12px", border:"1px solid #cbd5e1", borderRadius:10}} />
            </div>
          </div>

          <div style={{display:"grid", gap:12, gridTemplateColumns:"repeat(auto-fit, minmax(180px, 1fr))", marginTop:12}}>
            <div style={{border:"1px solid #e2e8f0", borderRadius:12, padding:12}}>
              <div style={{fontSize:12, color:"#64748b"}}>Anger (count)</div>
              <input type="number" min={0} value={entry.anger} onChange={e=>setEntry(v=>({...v, anger: Number(e.target.value)}))}
                style={{width:"100%", marginTop:6, padding:"10px 12px", border:"1px solid #cbd5e1", borderRadius:10}} />
            </div>
            <div style={{border:"1px solid #e2e8f0", borderRadius:12, padding:12}}>
              <div style={{fontSize:12, color:"#64748b"}}>Social Media (count)</div>
              <input type="number" min={0} value={entry.social} onChange={e=>setEntry(v=>({...v, social: Number(e.target.value)}))}
                style={{width:"100%", marginTop:6, padding:"10px 12px", border:"1px solid #cbd5e1", borderRadius:10}} />
            </div>
            <div style={{border:"1px solid #e2e8f0", borderRadius:12, padding:12}}>
              <div style={{fontSize:12, color:"#64748b"}}>Porn/Masturbation (count)</div>
              <input type="number" min={0} value={entry.porn} onChange={e=>setEntry(v=>({...v, porn: Number(e.target.value)}))}
                style={{width:"100%", marginTop:6, padding:"10px 12px", border:"1px solid #cbd5e1", borderRadius:10}} />
            </div>
          </div>

          <button onClick={saveToday} disabled={saving}
            style={{marginTop:12, width:"100%", padding:"12px 14px", borderRadius:12, background:"#10b981", color:"#fff", fontWeight:700}}>
            {saving ? "Saving…" : "Save Today"}
          </button>
        </div>

        <div style={{background:"#fff", borderRadius:16, boxShadow:"0 10px 30px rgba(2,6,23,.08)", padding:20}}>
          <h2 style={{fontWeight:600, fontSize:18, marginBottom:12}}>This Week</h2>
          <div style={{display:"grid", gap:10}}>
            <div>
              <div style={{display:"flex", justifyContent:"space-between", fontSize:12}}><span>Devotional</span><span>{totals.devotional}/{goals.devotional}</span></div>
              <Bar value={progress.devotional} />
            </div>
            <div>
              <div style={{display:"flex", justifyContent:"space-between", fontSize:12}}><span>Pages</span><span>{totals.pages}/{goals.pages}</span></div>
              <Bar value={progress.pages} />
            </div>
            <div>
              <div style={{display:"flex", justifyContent:"space-between", fontSize:12}}><span>Reps</span><span>{totals.reps}/{goals.reps}</span></div>
              <Bar value={progress.reps} />
            </div>
            <div>
              <div style={{display:"flex", justifyContent:"space-between", fontSize:12}}><span>Anger (lower is better)</span><span>{totals.anger}/{goals.anger}</span></div>
              <Bar value={progress.anger} good />
            </div>
            <div>
              <div style={{display:"flex", justifyContent:"space-between", fontSize:12}}><span>Social Media (lower is better)</span><span>{totals.social}/{goals.social}</span></div>
              <Bar value={progress.social} good />
            </div>
            <div>
              <div style={{display:"flex", justifyContent:"space-between", fontSize:12}}><span>Porn (lower is better)</span><span>{totals.porn}/{goals.porn}</span></div>
              <Bar value={progress.porn} good />
            </div>
          </div>

          {(() => {
            const items = [];
            if (totals.devotional >= 7) items.push({ label: "Weekly Devotional Streak", detail: "7/7 devotionals" });
            if (totals.pages >= 100) items.push({ label: "Book Worm", detail: "100 pages this week" });
            if (totals.reps >= 100) items.push({ label: "Temple Care", detail: "100 reps this week" });
            if (totals.anger === 0 && totals.social === 0 && totals.porn === 0) items.push({ label: "Eyes & Heart Guarded", detail: "No anger/social/porn" });
            return items.length ? (
              <div style={{marginTop:12}}>
                <h3 style={{fontWeight:600, marginBottom:6}}>Milestones</h3>
                <ul>
                  {items.map((m,i)=>(<li key={i}><strong>{m.label}</strong> – <span style={{color:"#475569"}}>{m.detail}</span></li>))}
                </ul>
              </div>
            ) : null;
          })()}
        </div>

        <div style={{gridColumn:"1/-1", background:"#fff", borderRadius:16, boxShadow:"0 10px 30px rgba(2,6,23,.08)", padding:20}}>
          <h2 style={{fontWeight:600, fontSize:18, marginBottom:12}}>Week Log</h2>
          <div style={{overflowX:"auto"}}>
            <table style={{minWidth:640, fontSize:13}}>
              <thead>
                <tr style={{color:"#64748b", textAlign:"left"}}>
                  <th style={{padding:8}}>Date</th>
                  <th style={{padding:8}}>Devo</th>
                  <th style={{padding:8}}>Pages</th>
                  <th style={{padding:8}}>Reps</th>
                  <th style={{padding:8}}>Anger</th>
                  <th style={{padding:8}}>Social</th>
                  <th style={{padding:8}}>Porn</th>
                </tr>
              </thead>
              <tbody>
                {/* Entries will appear here after saving */}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      <footer style={{maxWidth:1100, margin:"0 auto", padding:16, textAlign:"center", fontSize:12, color:"#64748b"}}>
        Built for accountability, grace, and growth.
      </footer>
    </div>
  );
}

export default function App() {
  const [user, setUser] = useState(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u || null);
      setChecking(false);
    });
    return () => unsub();
  }, []);

  if (checking) {
    return (
      <div style={{minHeight:"100vh", display:"grid", placeItems:"center", background:"#f8fafc"}}>
        <div style={{opacity:.6}}>Loading…</div>
      </div>
    );
  }

  return user ? <Dashboard user={user} /> : <AuthPanel />;
}
