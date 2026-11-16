// Shared state between Dor's and Bar's phones (Firestore + anonymous auth).
// Falls back silently to local-only when Firebase is unreachable.
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, doc, onSnapshot, setDoc } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: 'AIzaSyAJXwiw503k7SE46NabtusGcTSFJFfpg34',
  authDomain: 'rome-2026-5c257.firebaseapp.com',
  projectId: 'rome-2026-5c257',
  storageBucket: 'rome-2026-5c257.firebasestorage.app',
  messagingSenderId: '1011816938657',
  appId: '1:1011816938657:web:ced75bf63d54d09141c4e0',
};

let db = null, ready = null;
const status = { value: 'local', subs: new Set() };
const setStatus = (v) => { status.value = v; status.subs.forEach((f) => f(v)); };
export const onStatus = (f) => { status.subs.add(f); f(status.value); return () => status.subs.delete(f); };

function init() {
  if (ready) return ready;
  ready = new Promise((resolve) => {
    try {
      const app = initializeApp(firebaseConfig);
      const auth = getAuth(app);
      db = getFirestore(app);
      onAuthStateChanged(auth, (u) => { if (u) resolve(true); });
      signInAnonymously(auth).catch(() => { setStatus('local'); resolve(false); });
    } catch { resolve(false); }
  });
  return ready;
}

// Subscribe to rome/{key}; returns unsubscribe.
export function subscribe(key, onValue) {
  let unsub = () => {}, dead = false;
  init().then((ok) => {
    if (!ok || dead) return;
    unsub = onSnapshot(doc(db, 'rome', key),
      (snap) => { setStatus('synced'); if (snap.exists()) onValue(snap.data().v ?? {}); },
      () => setStatus('local'));
  });
  return () => { dead = true; unsub(); };
}

export function save(key, value) {
  init().then((ok) => { if (ok) setDoc(doc(db, 'rome', key), { v: value }).catch(() => setStatus('local')); });
}
