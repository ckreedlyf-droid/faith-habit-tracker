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
const toISODate = (d = new Date()) => d.toISOString().slice(0, 10);
function getWeekRange(date = new Date()) {
  const d = new Date(date);
  const day = d.getDay();
  const diffToMonday = day === 0 ? 6 : day - 1;
  const start = new Date(d);
  start.setDate(d.getDate() - diffToMonday);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}
function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

const DEFAULT_GOALS = { anger: 0, social: 0, porn: 0, devotional: 7, pages: 100, reps: 100 };

// ======= UI PRIMITIVES (no Tailwind) =======
const styles = {
  page: { minHeight: "100vh", background: "#f6f7fb", color: "#0f172a" },
  container: { maxWidth: 1200, margin: "0 auto", padding: "24px" },
  header: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  btn: { padding: "10px 14px", borderRadius: 12, border: "1px solid #e2e8f0", background: "#fff", cursor: "pointer" },
  btnPrimary: { padding: "12px 16px", borderRadius: 12, background: "#0f172a", color: "#fff", border: "none", cursor: "pointer" },
  card: { background: "#fff", borderRadius: 16, padding: 20, boxShadow: "0 10px 30px rgba(2,6,23,.08)" },
  grid: { display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fit, minmax(280px,1fr))" },
  h1: { fontSize: 22, fontWeight: 800, margin: 0 },
  h2: { fontSize: 18, fontWeight: 700, margin: "0 0 10px" },
  label: { fontSize: 12, color: "#64748b", marginBottom: 6, display: "block" },
  input: { width: "100%", padding: "10px 12px", border: "1px solid #cbd5e1", borderRadius: 10 },
  tableWrap: { overflowX: "auto" },
  table: { width: "100%", borderCollapse: "collapse", fontSize: 13 },
  th: { textAlign: "left", color: "#64748b", padding: 8, borderBottom: "1px solid #e2e8f0" },
  td: { padding: 8, borderBottom: "1px solid #eef2f7" },
  banner: { background: "#eef2ff", color: "#3730a3", border: "1px solid #c7d2fe", padding: 12, borderRadius: 12 },
  verse: { background: "linear-gradient(135deg,#0f172a,#334155)", color: "#fff", borderRadius: 16, padding: 24, boxShadow: "0 10px 30px rgba(2,6,23,.2)" },
  progressBG: { width: "100%", height: 10, background: "#e2e8f0", borderRadius: 999 },
  progressFill: (v, color = "#10b981") => ({ height: 10, width: `${v}%`, background: color, borderRadius: 999 }),
  modalMask: { position: "fixed", inset: 0, background: "rgba(0,0,0,.4)", display: "grid", placeItems: "center", padding: 16, zIndex: 50 },
  modal: { background: "#fff", borderRadius: 16, padding: 20, width: "100%", maxWidth: 540, boxShadow: "0 20px 50px rgba(0,0,0,.2)" },
};

// ======= Auth =======
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
          await setDoc(
            doc(db, "users", u.uid),
            { createdAt: serverTimestamp(), goals: DEFAULT_GOALS, streak: { count: 0, lastDevoDate: null } },
            { merge: true }
          );
        }
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ ...styles.page, display: "grid", placeItems: "center" }}>
      <div style={{ ...styles.card, width: "100%", maxWidth: 440 }}>
        <h1 style={{ ...styles.h1, textAlign: "center" }}>Faith Habit Tracker</h1>
        <p style={{ textAlign: "center", color: "#64748b", fontSize: 13, marginTop: 6 }}>
          Log daily. Grow weekly. Walk with Jesus.
        </p>
        <form onSubmit={submit} style={{ display: "grid", gap: 12, marginTop: 16 }}>
          <div>
            <label style={styles.label}>Email</label>
            <input style={styles.input} type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div>
            <label style={styles.label}>Password</label>
            <input
              style={styles.input}
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          {error && <div style={{ color: "#dc2626", fontSize: 12 }}>{error}</div>}
          <button style={styles.btnPrimary} disabled={loading}>
            {loading ? "Please wait…" : mode === "signin" ? "Sign In" : "Create Account"}
          </button>
        </form>
        <div style={{ textAlign: "center", marginTop: 12, fontSize: 13 }}>
          {mode === "signin" ? (
            <button onClick={() => setMode("signup")} style={{ textDecoration: "underline" }}>
              Need an account? Sign up
            </button>
          ) : (
            <button onClick={() => setMode("signin")} style={{ textDecoration: "underline" }}>
              Have an account? Sign in
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ======= Goals Modal =======
function GoalsModal({ open, onClose, goals, onSave }) {
  const [local, setLocal] = useState(goals);
  useEffect(() => {
    setLocal(goals);
  }, [goals, open]);
  if (!open) return null;
  return (
    <div style={styles.modalMask}>
      <div style={styles.modal}>
        <h3 style={{ ...styles.h2, marginBottom: 12 }}>Edit Weekly Goals</h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 12 }}>
          {Object.keys(DEFAULT_GOALS).map((k) => (
            <label key={k} style={{ fontSize: 13 }}>
              <span style={{ ...styles.label, textTransform: "capitalize" }}>{k}</span>
              <input
                type="number"
                min={0}
                style={styles.input}
                value={local[k]}
                onChange={(e) => setLocal((v) => ({ ...v, [k]: Number(e.target.value) }))}
              />
            </label>
          ))}
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16 }}>
          <button onClick={onClose} style={styles.btn}>
            Cancel
          </button>
          <button onClick={() => onSave(local)} style={styles.btnPrimary}>
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

// ======= Dashboard =======
function Dashboard({ user }) {
  const [goals, setGoals] = useState(DEFAULT_GOALS);
  const [today] = useState(toISODate());
  const [entry, setEntry] = useState({ devotional: false, pages: 0, reps: 0, anger: 0, social: 0, porn: 0 });
  const [weekEntries, setWeekEntries] = useState([]);
  const [saving, setSaving] = useState(false);
  const [userDoc, setUserDoc] = useState(null);
  const [showGoals, setShowGoals] = useState(false);

  // user doc + goals
  useEffect(() => {
    const ref = doc(db, "users", user.uid);
    const unsub = onSnapshot(ref, (snap) => {
      if (snap.exists()) {
        const d = snap.data();
        setUserDoc({ id: snap.id, ...d });
        setGoals({ ...DEFAULT_GOALS, ...(d.goals || {}) });
      }
    });
    return () => unsub();
  }, [user.uid]);

  // today's entry
  useEffect(() => {
    (async () => {
      const ref = doc(db, "users", user.uid, "entries", today);
      const s = await getDoc(ref);
      if (s.exists()) {
        const d = s.data();
        setEntry({
          devotional: !!d.devotional,
          pages: d.pages || 0,
          reps: d.reps || 0,
          anger: d.anger || 0,
          social: d.social || 0,
          porn: d.porn || 0,
        });
      }
    })();
  }, [user.uid, today]);

  // this week entries
  useEffect(() => {
    const { start, end } = getWeekRange(new Date());
    const qy = query(
      collection(db, "users", user.uid, "entries"),
      where("dateTs", ">=", start.getTime()),
      where("dateTs", "<=", end.getTime()),
      orderBy("dateTs", "asc")
    );
    const unsub = onSnapshot(qy, (snap) => {
      const rows = [];
      snap.forEach((d) => rows.push({ id: d.id, ...d.data() }));
      setWeekEntries(rows);
    });
    return () => unsub();
  }, [user.uid]);

  const totals = useMemo(
    () =>
      weekEntries.reduce(
        (a, e) => {
          a.pages += e.pages || 0;
          a.reps += e.reps || 0;
          a.devotional += e.devotional ? 1 : 0;
          a.anger += e.anger || 0;
          a.social += e.social || 0;
          a.porn += e.porn || 0;
          return a;
        },
        { pages: 0, reps: 0, devotional: 0, anger: 0, social: 0, porn: 0 }
      ),
    [weekEntries]
  );

  const progress = useMemo(
    () => ({
      pages: Math.min(100, Math.round((totals.pages / Math.max(1, goals.pages)) * 100)),
      reps: Math.min(100, Math.round((totals.reps / Math.max(1, goals.reps)) * 100)),
      devotional: Math.min(100, Math.round((totals.devotional / Math.max(1, goals.devotional)) * 100)),
      anger: Math.max(0, Math.min(100, 100 - Math.round(((totals.anger) / Math.max(1, goals.anger || 1)) * 100))),
      social: Math.max(0, Math.min(100, 100 - Math.round(((totals.social) / Math.max(1, goals.social || 1)) * 100))),
      porn: Math.max(0, Math.min(100, 100 - Math.round(((totals.porn) / Math.max(1, goals.porn || 1)) * 100))),
    }),
    [totals, goals]
  );

  // NEW: Good vs Temptation index
  const goodVsEvil = useMemo(() => {
    const devoPct = goals.devotional ? Math.min(1, totals.devotional / goals.devotional) : 0;
    const pagesPct = goals.pages ? Math.min(1, totals.pages / goals.pages) : 0;
    const repsPct = goals.reps ? Math.min(1, totals.reps / goals.reps) : 0;
    const inv = (count, goal) => {
      const g = Math.max(1, goal || 1);
      const pct = Math.min(1, count / g);
      return 1 - pct;
    };
    const angerInv = inv(totals.anger, goals.anger);
    const socialInv = inv(totals.social, goals.social);
    const pornInv = inv(totals.porn, goals.porn);
    const parts = [devoPct, pagesPct, repsPct, angerInv, socialInv, pornInv];
    const avg = parts.reduce((a, b) => a + b, 0) / parts.length;
    const good = Math.round(avg * 100);
    const evil = 100 - good;
    const margin = good - evil;
    return { good, evil, margin };
  }, [totals, goals]);

  const verseOfDay = useMemo(() => {
    const idx = Number(new Date().toISOString().slice(0, 10).replaceAll("-", "")) % VERSES.length;
    return VERSES[idx];
  }, []);

  const milestones = useMemo(() => {
    const L = [];
    if (totals.devotional >= goals.devotional) L.push({ label: "Weekly Devotional Streak", detail: `${totals.devotional}/${goals.devotional}` });
    if (totals.pages >= goals.pages) L.push({ label: "Book Worm", detail: `${totals.pages} pages` });
    if (totals.reps >= goals.reps) L.push({ label: "Temple Care", detail: `${totals.reps} reps` });
    if (totals.anger === 0 && totals.social === 0 && totals.porn === 0) L.push({ label: "Eyes & Heart Guarded", detail: "No anger/social/porn" });
    return L;
  }, [totals, goals]);

  const showReminder = (() => {
    const now = new Date();
    const logged = weekEntries.find((e) => e.id === today);
    return now.getHours() >= 21 && !logged; // after 9pm, not logged
  })();

  const saveToday = async () => {
    setSaving(true);
    try {
      const ref = doc(db, "users", user.uid, "entries", today);
      await setDoc(
        ref,
        { ...entry, date: today, dateTs: startOfToday().getTime(), updatedAt: serverTimestamp() },
        { merge: true }
      );
      // Streak update
      if (entry.devotional) {
        const uref = doc(db, "users", user.uid);
        const snap = await getDoc(uref);
        let count = 1;
        if (snap.exists()) {
          const s = snap.data().streak || { count: 0, lastDevoDate: null };
          const y = new Date(startOfToday());
          y.setDate(y.getDate() - 1);
          const yISO = toISODate(y);
          count = s.lastDevoDate === yISO ? (s.count || 0) + 1 : 1;
        }
        await updateDoc(uref, { streak: { count, lastDevoDate: today } });
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={styles.page}>
      <div style={styles.container}>
        {/* header */}
        <div style={styles.header}>
          <div>
            <h1 style={styles.h1}>Hello, {user.email}</h1>
            <div style={{ color: "#64748b", fontSize: 13 }}>Today: {today}</div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => setShowGoals(true)} style={styles.btn}>
              Goals
            </button>
            <button onClick={() => signOut(auth)} style={styles.btnPrimary}>
              Sign out
            </button>
          </div>
        </div>

        {showReminder && <div style={{ ...styles.banner, marginBottom: 16 }}>⏰ Don’t forget to log today’s habits before sleep.</div>}

        {/* Verse */}
        <div style={{ ...styles.verse, marginBottom: 16 }}>
          <div style={{ fontStyle: "italic", fontSize: 18, marginBottom: 6 }}>“{verseOfDay.text}”</div>
          <div style={{ opacity: 0.9, fontSize: 12 }}>— {verseOfDay.ref}</div>
        </div>

        {/* NEW: Good vs Temptation */}
        <div style={{ ...styles.card, marginBottom: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
            <h2 style={styles.h2}>Good vs Temptation</h2>
            <div style={{ fontSize: 12, color: "#475569" }}>
              {goodVsEvil.margin >= 0 ? (
                <>Good is winning by <strong>+{goodVsEvil.margin}</strong></>
              ) : (
                <>Temptation is ahead by <strong>{Math.abs(goodVsEvil.margin)}</strong></>
              )}
            </div>
          </div>

          <div style={{ position: "relative", height: 20, background: "#e2e8f0", borderRadius: 999, overflow: "hidden" }}>
            <div
              style={{
                position: "absolute",
                left: 0,
                top: 0,
                bottom: 0,
                width: `${goodVsEvil.good}%`,
                background: "linear-gradient(90deg,#10b981,#34d399)",
              }}
            />
            <div
              style={{
                position: "absolute",
                right: 0,
                top: 0,
                bottom: 0,
                width: `${goodVsEvil.evil}%`,
                background: "linear-gradient(90deg,rgba(239,68,68,.15),rgba(248,113,113,.25))",
              }}
            />
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8, fontSize: 12, color: "#475569" }}>
            <span>😇 Good {goodVsEvil.good}%</span>
            <span>{goodVsEvil.evil}% 😈 Temptation</span>
          </div>

          <div style={{ marginTop: 6, fontSize: 11, color: "#94a3b8" }}>
            Based on 6 signals this week: Devotional, Pages, Reps, and inverted Anger/Social/Porn.
          </div>
        </div>

        {/* grid */}
        <div style={styles.grid}>
          {/* Log Today */}
          <div style={styles.card}>
            <h2 style={styles.h2}>Log Today</h2>
            <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(180px,1fr))" }}>
              <label style={{ display: "flex", alignItems: "center", gap: 8, border: "1px solid #e2e8f0", borderRadius: 12, padding: 12 }}>
                <input
                  type="checkbox"
                  checked={entry.devotional}
                  onChange={(e) => setEntry((v) => ({ ...v, devotional: e.target.checked }))}
                />
                <span>Devotional & Prayer (done)</span>
              </label>
              {["pages", "reps", "anger", "social", "porn"].map((k) => (
                <div key={k}>
                  <label style={{ ...styles.label, textTransform: "capitalize" }}>
                    {k === "pages" ? "Pages Read" : k === "reps" ? "Exercise Reps" : k === "porn" ? "Porn/Masturbation (count)" : `${k} (count)`}
                  </label>
                  <input
                    type="number"
                    min={0}
                    style={styles.input}
                    value={entry[k]}
                    onChange={(e) => setEntry((v) => ({ ...v, [k]: Number(e.target.value) }))}
                  />
                </div>
              ))}
            </div>
            <button style={{ ...styles.btnPrimary, width: "100%", marginTop: 12 }} disabled={saving} onClick={saveToday}>
              {saving ? "Saving…" : "Save Today"}
            </button>
          </div>

          {/* This Week */}
          <div style={styles.card}>
            <h2 style={styles.h2}>This Week</h2>
            {[
              { k: "devotional", label: "Devotional", val: progress.devotional, extra: `${totals.devotional}/${goals.devotional}` },
              { k: "pages", label: "Pages", val: progress.pages, extra: `${totals.pages}/${goals.pages}` },
              { k: "reps", label: "Reps", val: progress.reps, extra: `${totals.reps}/${goals.reps}` },
              { k: "anger", label: "Anger (lower is better)", val: progress.anger, extra: `${totals.anger}/${goals.anger}` },
              { k: "social", label: "Social Media (lower is better)", val: progress.social, extra: `${totals.social}/${goals.social}` },
              { k: "porn", label: "Porn (lower is better)", val: progress.porn, extra: `${totals.porn}/${goals.porn}` },
            ].map((row) => (
              <div key={row.k} style={{ marginBottom: 10 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                  <span>{row.label}</span>
                  <span>{row.extra}</span>
                </div>
                <div style={styles.progressBG}>
                  <div style={styles.progressFill(row.val)} />
                </div>
              </div>
            ))}

            {milestones.length > 0 && (
              <div style={{ marginTop: 10 }}>
                <div style={{ fontWeight: 600, marginBottom: 6 }}>Badges</div>
                <ul style={{ margin: 0, paddingLeft: 16 }}>
                  {milestones.map((m, i) => (
                    <li key={i}>
                      <strong>{m.label}</strong> – <span style={{ color: "#475569" }}>{m.detail}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {userDoc?.streak && (
              <div style={{ marginTop: 10, fontSize: 13, color: "#475569" }}>
                Devotional streak: <strong>{userDoc.streak.count} day(s)</strong>
              </div>
            )}
          </div>
        </div>

        {/* Week Log */}
        <div style={{ ...styles.card, marginTop: 16 }}>
          <h2 style={styles.h2}>Week Log</h2>
          <div style={styles.tableWrap}>
            <table style={styles.table}>
              <thead>
                <tr>
                  {["Date", "Devo", "Pages", "Reps", "Anger", "Social", "Porn"].map((h) => (
                    <th key={h} style={styles.th}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {weekEntries.length === 0 && (
                  <tr>
                    <td style={styles.td} colSpan={7}>
                      <span style={{ color: "#64748b" }}>No logs yet this week.</span>
                    </td>
                  </tr>
                )}
                {weekEntries.map((e) => (
                  <tr key={e.id}>
                    <td style={styles.td}>{e.date}</td>
                    <td style={styles.td}>{e.devotional ? "✓" : "—"}</td>
                    <td style={styles.td}>{e.pages || 0}</td>
                    <td style={styles.td}>{e.reps || 0}</td>
                    <td style={styles.td}>{e.anger || 0}</td>
                    <td style={styles.td}>{e.social || 0}</td>
                    <td style={styles.td}>{e.porn || 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div style={{ textAlign: "center", color: "#94a3b8", fontSize: 12, marginTop: 12 }}>
          Built for accountability, grace, and growth.
        </div>
      </div>

      <GoalsModal
        open={showGoals}
        onClose={() => setShowGoals(false)}
        goals={goals}
        onSave={async (g) => {
          await updateDoc(doc(db, "users", user.uid), { goals: g });
          setShowGoals(false);
        }}
      />
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
      <div style={{ ...styles.page, display: "grid", placeItems: "center" }}>
        <div style={{ opacity: 0.6 }}>Loading…</div>
      </div>
    );
  }
  return user ? <Dashboard user={user} /> : <AuthPanel />;
}

/* ======= Firestore Rules (paste in Firebase Console > Firestore > Rules)
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
*/
