import React, { useEffect, useMemo, useState } from "react";
// ======= 🔧 Firebase (v9 modular) =======
// Replace with YOUR Firebase config (keep your working values)
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

// 🔁 PASTE YOUR WORKING CONFIG HERE
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

// ======= 📖 Bible Verses (motivation) =======
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

// ======= 🧮 Helpers =======
const toISODate = (d=new Date()) => d.toISOString().slice(0,10); // YYYY-MM-DD

// Asia/Manila week (Mon–Sun)
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

// ======= 🔐 Auth UI =======
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
        // also create default settings
        const u = auth.currentUser;
        if (u) {
          await setDoc(doc(db, "users", u.uid), {
            createdAt: serverTimestamp(),
            goals: DEFAULT_GOALS,
            streak: { count: 0, lastDevoDate: null },
          }, { merge: true });
        }
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <div className="w-full max-w-md bg-white shadow-xl rounded-2xl p-6">
        <h1 className="text-2xl font-bold text-center mb-2">Faith Habit Tracker</h1>
        <p className="text-center text-sm text-slate-500 mb-6">Log daily. Grow weekly. Walk with Jesus.</p>
        <form onSubmit={submit} className="space-y-4">
          <input className="w-full border rounded-xl px-4 py-3" type="email" placeholder="Email"
                 value={email} onChange={(e)=>setEmail(e.target.value)} required />
          <input className="w-full border rounded-xl px-4 py-3" type="password" placeholder="Password"
                 value={password} onChange={(e)=>setPassword(e.target.value)} required />
          {error && <div className="text-red-600 text-sm">{error}</div>}
          <button disabled={loading} className="w-full rounded-xl py-3 font-semibold bg-black text-white shadow">
            {loading ? "Please wait…" : (mode === "signin" ? "Sign In" : "Create Account")}
          </button>
        </form>
        <div className="text-center mt-4 text-sm">
          {mode === "signin" ? (
            <button className="underline" onClick={()=>setMode("signup")}>Need an account? Sign up</button>
          ) : (
            <button className="underline" onClick={()=>setMode("signin")}>Have an account? Sign in</button>
          )}
        </div>
      </div>
    </div>
  );
}

// ======= ⚙️ Goals Modal =======
function GoalsModal({ open, onClose, goals, onSave }){
  const [local, setLocal] = useState(goals);
  useEffect(()=>{ setLocal(goals); }, [goals, open]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 bg-black/40 grid place-items-center p-4 z-50">
      <div className="bg-white rounded-2xl p-5 w-full max-w-lg shadow-xl">
        <h3 className="text-lg font-semibold mb-3">Edit Weekly Goals</h3>
        <div className="grid grid-cols-2 gap-3">
          {Object.keys(DEFAULT_GOALS).map((k)=> (
            <label key={k} className="text-sm">
              <span className="block text-slate-500 mb-1 capitalize">{k}</span>
              <input type="number" className="w-full border rounded-lg px-3 py-2" min={0}
                     value={local[k]} onChange={e=>setLocal(v=>({...v,[k]:Number(e.target.value)}))} />
            </label>
          ))}
        </div>
        <div className="flex gap-2 justify-end mt-5">
          <button onClick={onClose} className="px-4 py-2 rounded-xl border">Cancel</button>
          <button onClick={()=>onSave(local)} className="px-4 py-2 rounded-xl bg-emerald-600 text-white">Save</button>
        </div>
      </div>
    </div>
  );
}

// ======= 📊 Dashboard (with Phase 2) =======
function Dashboard({ user }) {
  const [goals, setGoals] = useState(DEFAULT_GOALS);
  const [today, setToday] = useState(toISODate());
  const [entry, setEntry] = useState({ devotional: false, pages: 0, reps: 0, anger: 0, social: 0, porn: 0 });
  const [weekEntries, setWeekEntries] = useState([]);
  const [saving, setSaving] = useState(false);
  const [userDoc, setUserDoc] = useState(null);
  const [showGoals, setShowGoals] = useState(false);

  // Load user doc + goals in realtime
  useEffect(() => {
    const userDocRef = doc(db, "users", user.uid);
    const unsub = onSnapshot(userDocRef, (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setUserDoc({ id: snap.id, ...data });
        setGoals({ ...DEFAULT_GOALS, ...(data.goals || {}) });
      }
    });
    return () => unsub();
  }, [user.uid]);

  // Load today's entry
  useEffect(() => {
    const run = async () => {
      const ref = doc(db, "users", user.uid, "entries", today);
      const snap = await getDoc(ref);
      if (snap.exists()) {
        setEntry({ devotional: !!snap.data().devotional, pages: snap.data().pages||0, reps: snap.data().reps||0, anger: snap.data().anger||0, social: snap.data().social||0, porn: snap.data().porn||0 });
      } else {
        setEntry({ devotional: false, pages: 0, reps: 0, anger: 0, social: 0, porn: 0 });
      }
    };
    run();
  }, [user.uid, today]);

  // Load this week's entries
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

  // 🎯 Milestones / Badges (client-side)
  const milestones = useMemo(() => {
    const list = [];
    if (totals.devotional >= goals.devotional) list.push({ label: "Weekly Devotional Streak", detail: `${totals.devotional}/${goals.devotional}` });
    if (totals.pages >= goals.pages) list.push({ label: "Book Worm", detail: `${totals.pages} pages` });
    if (totals.reps >= goals.reps) list.push({ label: "Temple Care", detail: `${totals.reps} reps` });
    if (totals.anger === 0 && totals.social === 0 && totals.porn === 0) list.push({ label: "Eyes & Heart Guarded", detail: "No anger/social/porn" });
    return list;
  }, [totals, goals]);

  // 📅 Streak logic (devotional day-to-day)
  const verseOfDay = useMemo(() => {
    const idx = Number(new Date().toISOString().slice(0,10).replaceAll('-','')) % VERSES.length;
    return VERSES[idx];
  }, []);

  const saveToday = async () => {
    setSaving(true);
    try {
      const ref = doc(db, "users", user.uid, "entries", today);
      await setDoc(ref, { ...entry, date: today, dateTs: startOfToday().getTime(), updatedAt: serverTimestamp() }, { merge: true });

      // Update streak if devotional checked
      if (entry.devotional) {
        const uref = doc(db, "users", user.uid);
        const snap = await getDoc(uref);
        let count = 1; let lastDate = today;
        if (snap.exists()) {
          const s = snap.data().streak || { count: 0, lastDevoDate: null };
          // did they also do yesterday?
          const y = new Date(startOfToday()); y.setDate(y.getDate()-1);
          const yISO = toISODate(y);
          if (s.lastDevoDate === yISO) count = (s.count||0) + 1; else count = 1;
        }
        await updateDoc(uref, { streak: { count, lastDevoDate: today } });
      }
    } finally {
      setSaving(false);
    }
  };

  const signout = async () => { await signOut(auth); };

  // ⏰ Reminder banner (after 9:30pm and not yet logged today)
  const showReminder = (() => {
    const now = new Date();
    const logged = weekEntries.find(e=>e.id===today);
    return now.getHours() >= 21 && !logged; // 9pm onwards
  })();

  const Bar = ({ value, good=true }) => (
    <div className="w-full h-3 bg-slate-200 rounded-full">
      <div className={`h-3 rounded-full ${good ? 'bg-emerald-500' : 'bg-rose-500'}`} style={{ width: `${value}%` }} />
    </div>
  );

  // 📊 Weekly summary (Sunday night) – client-side card
  const weeklySummaryCard = (() => {
    const day = new Date().getDay();
    if (day !== 0) return null; // show on Sunday only
    return (
      <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
        <div className="font-semibold mb-1">Weekly Summary</div>
        <div className="text-sm text-slate-700">Devotional: {totals.devotional}/{goals.devotional} • Pages: {totals.pages}/{goals.pages} • Reps: {totals.reps}/{goals.reps}</div>
        <div className="text-xs text-slate-500 mt-1">“{verseOfDay.text}” — {verseOfDay.ref}</div>
      </div>
    );
  })();

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="p-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Hello, {user.email}</h1>
          <p className="text-sm text-slate-500">Today: {today}</p>
        </div>
        <div className="flex gap-2">
          <button onClick={()=>setShowGoals(true)} className="px-3 py-2 rounded-xl border">Goals</button>
          <button onClick={signout} className="px-3 py-2 rounded-xl bg-slate-900 text-white">Sign out</button>
        </div>
      </header>

      {showReminder && (
        <div className="mx-auto max-w-5xl px-4">
          <div className="bg-indigo-50 border border-indigo-200 rounded-2xl p-3 text-sm">⏰ Don’t forget to log today’s habits before sleep.</div>
        </div>
      )}

      <main className="max-w-5xl mx-auto p-4 grid md:grid-cols-3 gap-4">
        {/* Verse Card (Verse of the Day) */}
        <div className="md:col-span-3 bg-gradient-to-br from-slate-900 to-slate-700 text-white rounded-2xl p-6 shadow">
          <p className="text-lg italic mb-1">“{verseOfDay.text}”</p>
          <p className="text-sm opacity-80">— {verseOfDay.ref}</p>
        </div>

        {/* Today Form */}
        <div className="bg-white rounded-2xl shadow p-5 space-y-4 md:col-span-2">
          <h2 className="font-semibold text-lg">Log Today</h2>
          <div className="grid sm:grid-cols-3 gap-3">
            <label className="flex items-center gap-2 border rounded-xl p-3">
              <input type="checkbox" checked={entry.devotional} onChange={e=>setEntry(v=>({...v, devotional: e.target.checked}))} />
              <span>Devotional & Prayer (done)</span>
            </label>
            <div className="border rounded-xl p-3">
              <div className="text-sm text-slate-500">Pages Read</div>
              <input type="number" className="w-full mt-1 border rounded-lg px-3 py-2" min={0}
                     value={entry.pages} onChange={e=>setEntry(v=>({...v, pages: Number(e.target.value)}))} />
            </div>
            <div className="border rounded-xl p-3">
              <div className="text-sm text-slate-500">Exercise Reps</div>
              <input type="number" className="w-full mt-1 border rounded-lg px-3 py-2" min={0}
                     value={entry.reps} onChange={e=>setEntry(v=>({...v, reps: Number(e.target.value)}))} />
            </div>
          </div>

          <div className="grid sm:grid-cols-3 gap-3">
            <div className="border rounded-xl p-3">
              <div className="text-sm text-slate-500">Anger (count)</div>
              <input type="number" className="w-full mt-1 border rounded-lg px-3 py-2" min={0}
                     value={entry.anger} onChange={e=>setEntry(v=>({...v, anger: Number(e.target.value)}))} />
            </div>
            <div className="border rounded-xl p-3">
              <div className="text-sm text-slate-500">Social Media (count)</div>
              <input type="number" className="w-full mt-1 border rounded-lg px-3 py-2" min={0}
                     value={entry.social} onChange={e=>setEntry(v=>({...v, social: Number(e.target.value)}))} />
            </div>
            <div className="border rounded-xl p-3">
              <div className="text-sm text-slate-500">Porn/Masturbation (count)</div>
              <input type="number" className="w-full mt-1 border rounded-lg px-3 py-2" min={0}
                     value={entry.porn} onChange={e=>setEntry(v=>({...v, porn: Number(e.target.value)}))} />
            </div>
          </div>

          <button onClick={saveToday} disabled={saving}
                  className="w-full py-3 rounded-xl bg-emerald-600 text-white font-semibold shadow">
            {saving ? "Saving…" : "Save Today"}
          </button>
        </div>

        {/* Weekly Progress */}
        <div className="bg-white rounded-2xl shadow p-5 space-y-4">
          <h2 className="font-semibold text-lg">This Week</h2>
          <div className="space-y-3">
            <div>
              <div className="flex justify-between text-sm"><span>Devotional</span><span>{totals.devotional}/{goals.devotional}</span></div>
              <Bar value={progress.devotional} />
            </div>
            <div>
              <div className="flex justify-between text-sm"><span>Pages</span><span>{totals.pages}/{goals.pages}</span></div>
              <Bar value={progress.pages} />
            </div>
            <div>
              <div className="flex justify-between text-sm"><span>Reps</span><span>{totals.reps}/{goals.reps}</span></div>
              <Bar value={progress.reps} />
            </div>
            <div>
              <div className="flex justify-between text-sm"><span>Anger (lower is better)</span><span>{totals.anger}/{goals.anger}</span></div>
              <Bar value={progress.anger} good />
            </div>
            <div>
              <div className="flex justify-between text-sm"><span>Social Media (lower is better)</span><span>{totals.social}/{goals.social}</span></div>
              <Bar value={progress.social} good />
            </div>
            <div>
              <div className="flex justify-between text-sm"><span>Porn (lower is better)</span><span>{totals.porn}/{goals.porn}</span></div>
              <Bar value={progress.porn} good />
            </div>
          </div>

          {milestones.length > 0 && (
            <div className="mt-4">
              <h3 className="font-semibold mb-2">Badges</h3>
              <ul className="list-disc pl-5 space-y-1">
                {milestones.map((m,i)=>(<li key={i}><span className="font-medium">{m.label}</span> – <span className="text-slate-600">{m.detail}</span></li>))}
              </ul>
            </div>
          )}

          {weeklySummaryCard}

          {/* Streak display */}
          {userDoc?.streak && (
            <div className="mt-4 text-sm text-slate-600">Devotional streak: <span className="font-semibold">{userDoc.streak.count} day(s)</span></div>
          )}
        </div>

        {/* History Table */}
        <div className="md:col-span-3 bg-white rounded-2xl shadow p-5">
          <h2 className="font-semibold text-lg mb-3">Week Log</h2>
          <div className="overflow-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-slate-500">
                  <th className="p-2">Date</th>
                  <th className="p-2">Devo</th>
                  <th className="p-2">Pages</th>
                  <th className="p-2">Reps</th>
                  <th className="p-2">Anger</th>
                  <th className="p-2">Social</th>
                  <th className="p-2">Porn</th>
                </tr>
              </thead>
              <tbody>
                {weekEntries.length === 0 && (
                  <tr><td className="p-2 text-slate-500" colSpan={7}>No logs yet this week.</td></tr>
                )}
                {weekEntries.map((e) => (
                  <tr key={e.id} className="border-t">
                    <td className="p-2">{e.date}</td>
                    <td className="p-2">{e.devotional ? "✓" : "—"}</td>
                    <td className="p-2">{e.pages||0}</td>
                    <td className="p-2">{e.reps||0}</td>
                    <td className="p-2">{e.anger||0}</td>
                    <td className="p-2">{e.social||0}</td>
                    <td className="p-2">{e.porn||0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      <footer className="max-w-5xl mx-auto p-4 text-center text-xs text-slate-500">
        Built for accountability, grace, and growth.
      </footer>

      <GoalsModal open={showGoals} onClose={()=>setShowGoals(false)} goals={goals}
        onSave={async (g)=>{ await updateDoc(doc(db, 'users', user.uid), { goals: g }); setShowGoals(false); }} />
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
      <div className="min-h-screen grid place-items-center bg-slate-50">
        <div className="animate-pulse text-slate-600">Loading…</div>
      </div>
    );
  }

  return user ? <Dashboard user={user} /> : <AuthPanel />;
}

/* ======= 🔒 Firestore Rules (paste in Firebase Console > Firestore Database > Rules) =======
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{uid} {
      allow read, write: if request.auth != null && request.auth.uid == uid;
      match /entries/{date} {
        allow read, write: if request.auth != null && request.auth.uid == uid;
      }
    }
  }
}

===== 🧱 Data Model =====
users/{uid}
  goals: { anger:0, social:0, porn:0, devotional:7, pages:100, reps:100 }
  streak: { count: number, lastDevoDate: 'YYYY-MM-DD' | null }
  createdAt: serverTimestamp()
users/{uid}/entries/{YYYY-MM-DD}
  date: "YYYY-MM-DD"
  dateTs: <ms since epoch at 00:00 local>
  devotional: boolean
  pages: number
  reps: number
  anger: number
  social: number
  porn: number
  updatedAt: serverTimestamp()

===== 🚀 Deploy tips =====
- Commit this file to GitHub (src/App.jsx) and Vercel will redeploy
- Ensure Authentication > Settings > Authorized domains includes your .vercel.app url
*/
