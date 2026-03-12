import { useState, useEffect } from "react";

// ============================================================
// 🔥 FIREBASE - Real Connection
// ============================================================
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged }
  from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, collection, addDoc, getDocs, doc, updateDoc, getDoc, query, where }
  from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyAlxy8yr0QknK8wOMCVacNRP32HxA9UWc0",
  authDomain: "siddipetbazaar.firebaseapp.com",
  projectId: "siddipetbazaar",
  storageBucket: "siddipetbazaar.firebasestorage.app",
  messagingSenderId: "184788701418",
  appId: "1:184788701418:web:b4eaba1e36cd9d6c2b0793",
  measurementId: "G-F28E2L82VB"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// ============================================================
const CATEGORIES = ["All", "Food", "Medical", "Shopping", "Services", "Automobile", "Transport", "Education"];
const CATEGORY_ICONS = { Food: "🍛", Medical: "💊", Shopping: "🛍️", Services: "⚙️", Automobile: "🔧", Transport: "🚌", Education: "📚", All: "🏪" };

export default function SiddipetBazaar() {
  const [view, setView] = useState("home");
  const [user, setUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [businesses, setBusinesses] = useState([]);
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState("All");
  const [selectedBusiness, setSelectedBusiness] = useState(null);
  const [language, setLanguage] = useState("en");
  const [notification, setNotification] = useState(null);
  const [loadingData, setLoadingData] = useState(true);
  const [authLoading, setAuthLoading] = useState(false);

  const [authForm, setAuthForm] = useState({ email: "", password: "", businessName: "" });
  const [authError, setAuthError] = useState("");
  const [addForm, setAddForm] = useState({ name: "", telugu: "", category: "Food", address: "", phone: "", tags: "", icon: "🏪" });

  const showNotif = (msg, type = "success") => {
    setNotification({ msg, type });
    setTimeout(() => setNotification(null), 3500);
  };

  // ── Auth listener ──────────────────────────────────────────
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        // Check if admin
        const adminDoc = await getDoc(doc(db, "admins", firebaseUser.email));
        const admin = adminDoc.exists();
        setUser({ email: firebaseUser.email, uid: firebaseUser.uid, name: firebaseUser.email.split("@")[0] });
        setIsAdmin(admin);
        setView(admin ? "admin" : "dashboard");
      } else {
        setUser(null);
        setIsAdmin(false);
      }
    });
    return () => unsub();
  }, []);

  // ── Load businesses ────────────────────────────────────────
  const loadBusinesses = async () => {
    setLoadingData(true);
    try {
      const snap = await getDocs(collection(db, "businesses"));
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setBusinesses(list);
    } catch (e) {
      showNotif("Error loading businesses", "error");
    }
    setLoadingData(false);
  };

  useEffect(() => { loadBusinesses(); }, []);

  // ── Login ──────────────────────────────────────────────────
  const handleLogin = async () => {
    setAuthLoading(true);
    setAuthError("");
    try {
      await signInWithEmailAndPassword(auth, authForm.email, authForm.password);
      showNotif("Welcome back! 👋");
    } catch (e) {
      setAuthError(e.code === "auth/invalid-credential" ? "Wrong email or password" :
        e.code === "auth/user-not-found" ? "No account found with this email" :
        e.code === "auth/too-many-requests" ? "Too many attempts. Try again later" :
        "Login failed. Please try again.");
    }
    setAuthLoading(false);
  };

  // ── Signup ─────────────────────────────────────────────────
  const handleSignup = async () => {
    setAuthLoading(true);
    setAuthError("");
    if (!authForm.businessName) { setAuthError("Please enter your business name"); setAuthLoading(false); return; }
    try {
      const cred = await createUserWithEmailAndPassword(auth, authForm.email, authForm.password);
      // Save user profile to Firestore
      await addDoc(collection(db, "users"), {
        uid: cred.user.uid,
        email: authForm.email,
        businessName: authForm.businessName,
        createdAt: new Date().toISOString(),
      });
      showNotif("Account created! Submit your listing 🎉");
    } catch (e) {
      setAuthError(e.code === "auth/email-already-in-use" ? "This email is already registered. Please login." :
        e.code === "auth/weak-password" ? "Password must be at least 6 characters" :
        e.code === "auth/invalid-email" ? "Please enter a valid email address" :
        "Signup failed. Please try again.");
    }
    setAuthLoading(false);
  };

  // ── Logout ─────────────────────────────────────────────────
  const handleLogout = async () => {
    await signOut(auth);
    setView("home");
    showNotif("Logged out successfully");
  };

  // ── Submit listing ─────────────────────────────────────────
  const handleAddListing = async () => {
    if (!addForm.name || !addForm.phone || !addForm.address) {
      showNotif("Please fill all required fields", "error"); return;
    }
    try {
      await addDoc(collection(db, "businesses"), {
        ...addForm,
        tags: addForm.tags.split(",").map(t => t.trim()).filter(Boolean),
        rating: 0,
        open: true,
        status: "pending",
        ownerEmail: user.email,
        ownerUid: user.uid,
        submittedAt: new Date().toISOString(),
      });
      setAddForm({ name: "", telugu: "", category: "Food", address: "", phone: "", tags: "", icon: "🏪" });
      await loadBusinesses();
      showNotif("Submitted! Admin will review it shortly ⏳");
    } catch (e) {
      showNotif("Failed to submit. Please try again.", "error");
    }
  };

  // ── Approve / Reject ───────────────────────────────────────
  const handleApprove = async (id) => {
    await updateDoc(doc(db, "businesses", id), { status: "approved" });
    await loadBusinesses();
    showNotif("Business approved! ✅");
  };
  const handleReject = async (id) => {
    await updateDoc(doc(db, "businesses", id), { status: "rejected" });
    await loadBusinesses();
    showNotif("Business rejected ❌", "error");
  };

  const approvedBusinesses = businesses.filter(b => b.status === "approved");
  const pendingBusinesses = businesses.filter(b => b.status === "pending");
  const myListings = user ? businesses.filter(b => b.ownerEmail === user.email) : [];

  const filtered = approvedBusinesses.filter(b => {
    const matchSearch = b.name?.toLowerCase().includes(search.toLowerCase()) || b.telugu?.includes(search);
    const matchCat = activeCategory === "All" || b.category === activeCategory;
    return matchSearch && matchCat;
  });

  return (
    <div style={{ fontFamily: "'Poppins', 'Noto Sans Telugu', sans-serif", minHeight: "100vh", background: "#F7F3EE" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700;800;900&family=Noto+Sans+Telugu&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        .btn { padding: 12px 24px; border-radius: 10px; border: none; cursor: pointer; font-family: inherit; font-weight: 600; font-size: 14px; transition: all 0.2s; }
        .btn-primary { background: #E8450A; color: white; }
        .btn-primary:hover { background: #c93a07; transform: translateY(-1px); box-shadow: 0 6px 20px rgba(232,69,10,0.3); }
        .btn-outline { background: transparent; border: 2px solid #E8450A; color: #E8450A; }
        .btn-ghost { background: rgba(255,255,255,0.15); color: white; border: 1px solid rgba(255,255,255,0.3); }
        .btn-ghost:hover { background: rgba(255,255,255,0.25); }
        .btn-green { background: #1DB954; color: white; }
        .btn-green:hover { background: #17a348; }
        .btn-red { background: #e74c3c; color: white; }
        .btn-red:hover { background: #c0392b; }
        .input { width: 100%; padding: 13px 16px; border-radius: 10px; border: 2px solid #E8E0D8; font-family: inherit; font-size: 14px; outline: none; transition: border 0.2s; background: white; }
        .input:focus { border-color: #E8450A; }
        .select { width: 100%; padding: 13px 16px; border-radius: 10px; border: 2px solid #E8E0D8; font-family: inherit; font-size: 14px; outline: none; background: white; cursor: pointer; }
        .card { background: white; border-radius: 18px; padding: 20px; cursor: pointer; transition: all 0.25s cubic-bezier(0.34,1.4,0.64,1); border: 2px solid transparent; }
        .card:hover { transform: translateY(-5px); box-shadow: 0 16px 40px rgba(0,0,0,0.1); border-color: #E8450A22; }
        .cat-pill { padding: 8px 18px; border-radius: 50px; border: 2px solid #DDD; background: white; cursor: pointer; font-size: 13px; font-weight: 600; transition: all 0.2s; white-space: nowrap; font-family: inherit; }
        .cat-pill.active { background: #E8450A; border-color: #E8450A; color: white; }
        .cat-pill:hover:not(.active) { border-color: #E8450A; color: #E8450A; }
        .notif { position: fixed; top: 20px; right: 20px; z-index: 9999; padding: 14px 20px; border-radius: 12px; font-weight: 600; font-size: 14px; animation: slideIn 0.3s ease; box-shadow: 0 8px 30px rgba(0,0,0,0.15); max-width: 300px; }
        @keyframes slideIn { from { transform: translateX(100px); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
        .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.5); backdrop-filter: blur(6px); z-index: 1000; display: flex; align-items: flex-end; justify-content: center; }
        .modal { background: white; border-radius: 24px 24px 0 0; padding: 28px; width: 100%; max-width: 560px; animation: slideUp 0.3s cubic-bezier(0.34,1.4,0.64,1); max-height: 90vh; overflow-y: auto; }
        @keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
        .status-badge { display: inline-block; padding: 3px 12px; border-radius: 50px; font-size: 12px; font-weight: 700; }
        .badge-approved { background: #d4edda; color: #155724; }
        .badge-pending { background: #fff3cd; color: #856404; }
        .badge-rejected { background: #f8d7da; color: #721c24; }
        .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(270px, 1fr)); gap: 16px; }
        .nav { background: #1a1208; padding: 14px 24px; display: flex; justify-content: space-between; align-items: center; position: sticky; top: 0; z-index: 100; }
        .hero { background: linear-gradient(135deg, #1a1208 0%, #2d1f0e 60%, #3d2910 100%); padding: 50px 24px 60px; position: relative; overflow: hidden; }
        .hero::after { content: ''; position: absolute; bottom: -2px; left: 0; right: 0; height: 40px; background: #F7F3EE; clip-path: ellipse(55% 100% at 50% 100%); }
        .spinner { width: 40px; height: 40px; border: 4px solid #f3f3f3; border-top: 4px solid #E8450A; border-radius: 50%; animation: spin 0.8s linear infinite; margin: 0 auto; }
        @keyframes spin { to { transform: rotate(360deg); } }
        @media(max-width:600px) { .grid { grid-template-columns: 1fr; } }
      `}</style>

      {/* NOTIFICATION */}
      {notification && (
        <div className="notif" style={{ background: notification.type === "error" ? "#e74c3c" : "#1DB954", color: "white" }}>
          {notification.msg}
        </div>
      )}

      {/* NAVBAR */}
      <nav className="nav">
        <div style={{ color: "white", fontWeight: 900, fontSize: 20, cursor: "pointer" }} onClick={() => setView("home")}>
          Siddipet <span style={{ color: "#E8450A" }}>బజార్</span>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button className="btn btn-ghost" style={{ fontSize: 12, padding: "8px 14px" }}
            onClick={() => setLanguage(l => l === "en" ? "te" : "en")}>
            {language === "en" ? "తెలుగు" : "English"}
          </button>
          {user ? (
            <>
              <button className="btn btn-ghost" style={{ fontSize: 12, padding: "8px 14px" }}
                onClick={() => setView(isAdmin ? "admin" : "dashboard")}>
                {isAdmin ? "⚙️ Admin" : "📋 My Listings"}
              </button>
              <button className="btn btn-ghost" style={{ fontSize: 12, padding: "8px 14px" }} onClick={handleLogout}>
                Logout
              </button>
            </>
          ) : (
            <>
              <button className="btn btn-ghost" style={{ fontSize: 12, padding: "8px 14px" }} onClick={() => { setView("login"); setAuthError(""); }}>Login</button>
              <button className="btn btn-primary" style={{ fontSize: 12, padding: "8px 14px" }} onClick={() => { setView("signup"); setAuthError(""); }}>+ Add Business</button>
            </>
          )}
        </div>
      </nav>

      {/* ==================== HOME ==================== */}
      {view === "home" && (
        <>
          <div className="hero">
            <div style={{ maxWidth: 680, margin: "0 auto", textAlign: "center" }}>
              <div style={{ color: "#E8450A", fontSize: 12, fontWeight: 700, letterSpacing: 3, textTransform: "uppercase", marginBottom: 12 }}>
                🏙️ Siddipet District · Telangana
              </div>
              <h1 style={{ fontSize: 42, fontWeight: 900, color: "white", lineHeight: 1.15, marginBottom: 12 }}>
                Find Every Local<br /><span style={{ color: "#E8450A" }}>Business Near You</span>
              </h1>
              <p style={{ color: "rgba(255,255,255,0.55)", marginBottom: 32, fontSize: 15 }}>
                {language === "en" ? "Trusted directory of shops, doctors, services & more in Siddipet"
                  : "సిద్దిపేటలో దుకాణాలు, డాక్టర్లు, సేవలు మరియు మరిన్ని"}
              </p>
              <div style={{ position: "relative", maxWidth: 480, margin: "0 auto 28px" }}>
                <span style={{ position: "absolute", left: 18, top: "50%", transform: "translateY(-50%)", fontSize: 18 }}>🔍</span>
                <input className="input" style={{ paddingLeft: 50, fontSize: 15, borderRadius: 50, border: "none" }}
                  placeholder={language === "en" ? "Search businesses, doctors, food..." : "వ్యాపారాలు వెతకండి..."}
                  value={search} onChange={e => setSearch(e.target.value)} />
              </div>
              <div style={{ display: "flex", justifyContent: "center", gap: 40 }}>
                {[["🏪", approvedBusinesses.length + "+", "Businesses"], ["⭐", "Live", "Database"], ["📍", "Siddipet", "Telangana"]].map(([icon, val, label]) => (
                  <div key={label} style={{ textAlign: "center" }}>
                    <div style={{ color: "#E8450A", fontWeight: 900, fontSize: 20 }}>{icon} {val}</div>
                    <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 12 }}>{label}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div style={{ maxWidth: 760, margin: "0 auto", padding: "32px 20px" }}>
            <div style={{ display: "flex", gap: 10, overflowX: "auto", paddingBottom: 8, marginBottom: 24 }}>
              {CATEGORIES.map(cat => (
                <button key={cat} className={`cat-pill ${activeCategory === cat ? "active" : ""}`}
                  onClick={() => setActiveCategory(cat)}>
                  {CATEGORY_ICONS[cat]} {cat}
                </button>
              ))}
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h2 style={{ fontWeight: 800, fontSize: 18 }}>
                {activeCategory === "All" ? "All Businesses" : activeCategory}
                <span style={{ background: "#E8450A", color: "white", borderRadius: 50, padding: "2px 10px", fontSize: 12, marginLeft: 10 }}>{filtered.length}</span>
              </h2>
              {!user && (
                <button className="btn btn-primary" style={{ fontSize: 12, padding: "8px 16px" }} onClick={() => setView("signup")}>
                  + List Your Business
                </button>
              )}
            </div>

            {loadingData ? (
              <div style={{ padding: "60px 0", textAlign: "center" }}>
                <div className="spinner" style={{ marginBottom: 16 }}></div>
                <div style={{ color: "#aaa" }}>Loading businesses from Firebase...</div>
              </div>
            ) : filtered.length === 0 ? (
              <div style={{ textAlign: "center", padding: "60px 0", color: "#aaa" }}>
                <div style={{ fontSize: 48, marginBottom: 12 }}>🔍</div>
                <div style={{ fontWeight: 700, fontSize: 18 }}>No businesses found</div>
                <div style={{ fontSize: 14, marginTop: 6 }}>
                  {businesses.length === 0 ? "Be the first to list your business!" : "Try a different search or category"}
                </div>
                {!user && <button className="btn btn-primary" style={{ marginTop: 20 }} onClick={() => setView("signup")}>Add First Business</button>}
              </div>
            ) : (
              <div className="grid">
                {filtered.map(b => (
                  <div key={b.id} className="card" onClick={() => setSelectedBusiness(b)}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
                      <div style={{ fontSize: 38, background: "#FFF3EE", borderRadius: 14, width: 58, height: 58, display: "flex", alignItems: "center", justifyContent: "center" }}>
                        {b.icon || "🏪"}
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12 }}>
                        <span style={{ width: 8, height: 8, borderRadius: "50%", background: b.open ? "#1DB954" : "#e74c3c", display: "inline-block" }}></span>
                        <span style={{ color: b.open ? "#1DB954" : "#e74c3c", fontWeight: 600 }}>{b.open ? "Open" : "Closed"}</span>
                      </div>
                    </div>
                    <h3 style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>{language === "te" && b.telugu ? b.telugu : b.name}</h3>
                    <div style={{ color: "#999", fontSize: 13, marginBottom: 12 }}>📍 {b.address}</div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ background: "#FFF3EE", color: "#E8450A", borderRadius: 50, padding: "3px 12px", fontSize: 12, fontWeight: 600 }}>{b.category}</span>
                      {b.rating > 0 && <span style={{ fontWeight: 700, color: "#f39c12", fontSize: 13 }}>⭐ {b.rating}</span>}
                    </div>
                    {b.tags?.length > 0 && (
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginTop: 10 }}>
                        {b.tags.map(tag => <span key={tag} style={{ background: "#F5F3F0", color: "#666", borderRadius: 50, padding: "2px 10px", fontSize: 11 }}>{tag}</span>)}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {/* ==================== LOGIN ==================== */}
      {view === "login" && (
        <div style={{ minHeight: "80vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
          <div style={{ background: "white", borderRadius: 24, padding: 40, width: "100%", maxWidth: 420, boxShadow: "0 20px 60px rgba(0,0,0,0.1)" }}>
            <div style={{ textAlign: "center", marginBottom: 32 }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>👋</div>
              <h2 style={{ fontWeight: 800, fontSize: 24 }}>Welcome Back</h2>
              <p style={{ color: "#999", fontSize: 14, marginTop: 6 }}>Login to manage your business listing</p>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, color: "#555", display: "block", marginBottom: 6 }}>Email Address</label>
                <input className="input" type="email" placeholder="your@email.com"
                  value={authForm.email} onChange={e => setAuthForm(f => ({ ...f, email: e.target.value }))} />
              </div>
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, color: "#555", display: "block", marginBottom: 6 }}>Password</label>
                <input className="input" type="password" placeholder="••••••••"
                  value={authForm.password} onChange={e => setAuthForm(f => ({ ...f, password: e.target.value }))}
                  onKeyDown={e => e.key === "Enter" && handleLogin()} />
              </div>
              {authError && <div style={{ background: "#fee", color: "#c00", borderRadius: 8, padding: "10px 14px", fontSize: 13 }}>⚠️ {authError}</div>}
              <button className="btn btn-primary" style={{ width: "100%", padding: 14 }} onClick={handleLogin} disabled={authLoading}>
                {authLoading ? "⏳ Logging in..." : "Login →"}
              </button>
              <p style={{ textAlign: "center", color: "#999", fontSize: 13 }}>
                Don't have an account?{" "}
                <span style={{ color: "#E8450A", cursor: "pointer", fontWeight: 600 }} onClick={() => setView("signup")}>Sign up</span>
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ==================== SIGNUP ==================== */}
      {view === "signup" && (
        <div style={{ minHeight: "80vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
          <div style={{ background: "white", borderRadius: 24, padding: 40, width: "100%", maxWidth: 420, boxShadow: "0 20px 60px rgba(0,0,0,0.1)" }}>
            <div style={{ textAlign: "center", marginBottom: 28 }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>🏪</div>
              <h2 style={{ fontWeight: 800, fontSize: 24 }}>List Your Business</h2>
              <p style={{ color: "#999", fontSize: 14, marginTop: 6 }}>Create account → Submit listing → Admin approves → Go live!</p>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, color: "#555", display: "block", marginBottom: 6 }}>Business Name *</label>
                <input className="input" placeholder="e.g. Sri Lakshmi Store"
                  value={authForm.businessName} onChange={e => setAuthForm(f => ({ ...f, businessName: e.target.value }))} />
              </div>
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, color: "#555", display: "block", marginBottom: 6 }}>Email Address *</label>
                <input className="input" type="email" placeholder="your@email.com"
                  value={authForm.email} onChange={e => setAuthForm(f => ({ ...f, email: e.target.value }))} />
              </div>
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, color: "#555", display: "block", marginBottom: 6 }}>Password * (min 6 characters)</label>
                <input className="input" type="password" placeholder="••••••••"
                  value={authForm.password} onChange={e => setAuthForm(f => ({ ...f, password: e.target.value }))} />
              </div>
              {authError && <div style={{ background: "#fee", color: "#c00", borderRadius: 8, padding: "10px 14px", fontSize: 13 }}>⚠️ {authError}</div>}
              <div style={{ background: "#F0FFF4", borderRadius: 10, padding: "12px 14px", fontSize: 13, color: "#1a6630" }}>
                ✅ After signup, submit your listing. Admin reviews & approves before it goes live.
              </div>
              <button className="btn btn-primary" style={{ width: "100%", padding: 14 }} onClick={handleSignup} disabled={authLoading}>
                {authLoading ? "⏳ Creating account..." : "Create Account →"}
              </button>
              <p style={{ textAlign: "center", color: "#999", fontSize: 13 }}>
                Already have an account?{" "}
                <span style={{ color: "#E8450A", cursor: "pointer", fontWeight: 600 }} onClick={() => setView("login")}>Login</span>
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ==================== OWNER DASHBOARD ==================== */}
      {view === "dashboard" && user && (
        <div style={{ maxWidth: 720, margin: "0 auto", padding: "32px 20px" }}>
          <div style={{ background: "linear-gradient(135deg, #1a1208, #3d2910)", borderRadius: 20, padding: 28, marginBottom: 28, color: "white" }}>
            <div style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", marginBottom: 6 }}>Welcome back,</div>
            <h2 style={{ fontWeight: 800, fontSize: 24 }}>🏪 {user.name}</h2>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", marginTop: 4 }}>{user.email}</div>
            <div style={{ marginTop: 16, display: "flex", gap: 24 }}>
              {[["📋", myListings.length, "Total"], ["✅", myListings.filter(b => b.status === "approved").length, "Approved"], ["⏳", myListings.filter(b => b.status === "pending").length, "Pending"]].map(([icon, val, label]) => (
                <div key={label}>
                  <div style={{ fontWeight: 800, fontSize: 22, color: "#E8450A" }}>{icon} {val}</div>
                  <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 12 }}>{label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Add listing form */}
          <div style={{ background: "white", borderRadius: 20, padding: 28, marginBottom: 24 }}>
            <h3 style={{ fontWeight: 800, fontSize: 18, marginBottom: 20 }}>➕ Submit New Listing</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "#666", display: "block", marginBottom: 5 }}>Business Name *</label>
                  <input className="input" placeholder="English name" value={addForm.name} onChange={e => setAddForm(f => ({ ...f, name: e.target.value }))} />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "#666", display: "block", marginBottom: 5 }}>Telugu Name</label>
                  <input className="input" placeholder="తెలుగు పేరు" value={addForm.telugu} onChange={e => setAddForm(f => ({ ...f, telugu: e.target.value }))} />
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "#666", display: "block", marginBottom: 5 }}>Category *</label>
                  <select className="select" value={addForm.category} onChange={e => setAddForm(f => ({ ...f, category: e.target.value }))}>
                    {CATEGORIES.filter(c => c !== "All").map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "#666", display: "block", marginBottom: 5 }}>Emoji Icon</label>
                  <input className="input" placeholder="e.g. 🏪 💊 🍛" value={addForm.icon} onChange={e => setAddForm(f => ({ ...f, icon: e.target.value }))} />
                </div>
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: "#666", display: "block", marginBottom: 5 }}>Full Address *</label>
                <input className="input" placeholder="e.g. Main Road, Siddipet" value={addForm.address} onChange={e => setAddForm(f => ({ ...f, address: e.target.value }))} />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: "#666", display: "block", marginBottom: 5 }}>Phone Number *</label>
                <input className="input" placeholder="10-digit mobile number" value={addForm.phone} onChange={e => setAddForm(f => ({ ...f, phone: e.target.value }))} />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: "#666", display: "block", marginBottom: 5 }}>Tags (comma separated)</label>
                <input className="input" placeholder="e.g. Home Delivery, Open 24hrs, Veg" value={addForm.tags} onChange={e => setAddForm(f => ({ ...f, tags: e.target.value }))} />
              </div>
              <button className="btn btn-primary" style={{ alignSelf: "flex-start", padding: "12px 28px" }} onClick={handleAddListing}>
                Submit for Review →
              </button>
            </div>
          </div>

          {/* My listings */}
          <h3 style={{ fontWeight: 800, fontSize: 18, marginBottom: 16 }}>📋 My Listings</h3>
          {myListings.length === 0 ? (
            <div style={{ background: "white", borderRadius: 16, padding: 32, textAlign: "center", color: "#aaa" }}>
              No listings yet. Submit your first business above!
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {myListings.map(b => (
                <div key={b.id} style={{ background: "white", borderRadius: 14, padding: "16px 20px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                    <span style={{ fontSize: 28 }}>{b.icon || "🏪"}</span>
                    <div>
                      <div style={{ fontWeight: 700 }}>{b.name}</div>
                      <div style={{ color: "#999", fontSize: 13 }}>📍 {b.address}</div>
                    </div>
                  </div>
                  <span className={`status-badge badge-${b.status}`}>
                    {b.status === "approved" ? "✅ Approved" : b.status === "pending" ? "⏳ Pending Review" : "❌ Rejected"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ==================== ADMIN PANEL ==================== */}
      {view === "admin" && isAdmin && (
        <div style={{ maxWidth: 760, margin: "0 auto", padding: "32px 20px" }}>
          <div style={{ background: "linear-gradient(135deg, #1a1208, #3d2910)", borderRadius: 20, padding: 28, marginBottom: 28, color: "white" }}>
            <div style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", marginBottom: 6 }}>⚙️ Admin Panel</div>
            <h2 style={{ fontWeight: 800, fontSize: 24 }}>Siddipet బజార్ Admin</h2>
            <div style={{ marginTop: 16, display: "flex", gap: 28 }}>
              {[["⏳", pendingBusinesses.length, "Awaiting Review"], ["✅", businesses.filter(b => b.status === "approved").length, "Approved"], ["❌", businesses.filter(b => b.status === "rejected").length, "Rejected"]].map(([icon, val, label]) => (
                <div key={label}>
                  <div style={{ fontWeight: 800, fontSize: 22, color: "#E8450A" }}>{icon} {val}</div>
                  <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 12 }}>{label}</div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <h3 style={{ fontWeight: 800, fontSize: 18 }}>⏳ Pending Approvals</h3>
            <button className="btn btn-outline" style={{ fontSize: 12, padding: "8px 16px" }} onClick={loadBusinesses}>🔄 Refresh</button>
          </div>

          {pendingBusinesses.length === 0 ? (
            <div style={{ background: "white", borderRadius: 16, padding: 32, textAlign: "center", color: "#aaa", marginBottom: 24 }}>
              🎉 No pending approvals! All caught up.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 14, marginBottom: 28 }}>
              {pendingBusinesses.map(b => (
                <div key={b.id} style={{ background: "white", borderRadius: 16, padding: "20px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
                    <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                      <span style={{ fontSize: 32 }}>{b.icon || "🏪"}</span>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 16 }}>{b.name}</div>
                        {b.telugu && <div style={{ color: "#888", fontSize: 13 }}>{b.telugu}</div>}
                      </div>
                    </div>
                    <span className="status-badge badge-pending">⏳ Pending</span>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, fontSize: 13, color: "#666", marginBottom: 14 }}>
                    <div>📍 {b.address}</div>
                    <div>📞 {b.phone}</div>
                    <div>🏷️ {b.category}</div>
                    <div>✉️ {b.ownerEmail}</div>
                  </div>
                  {b.tags?.length > 0 && (
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 14 }}>
                      {b.tags.map(t => <span key={t} style={{ background: "#F5F3F0", color: "#666", borderRadius: 50, padding: "2px 10px", fontSize: 11 }}>{t}</span>)}
                    </div>
                  )}
                  <div style={{ display: "flex", gap: 10 }}>
                    <button className="btn btn-green" style={{ flex: 1, padding: 12 }} onClick={() => handleApprove(b.id)}>✅ Approve — Go Live!</button>
                    <button className="btn btn-red" style={{ flex: 1, padding: 12 }} onClick={() => handleReject(b.id)}>❌ Reject</button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <h3 style={{ fontWeight: 800, fontSize: 18, marginBottom: 16 }}>🏪 All Businesses ({businesses.length})</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {businesses.map(b => (
              <div key={b.id} style={{ background: "white", borderRadius: 12, padding: "14px 18px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                  <span style={{ fontSize: 24 }}>{b.icon || "🏪"}</span>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{b.name}</div>
                    <div style={{ color: "#aaa", fontSize: 12 }}>{b.category} · {b.ownerEmail}</div>
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <span className={`status-badge badge-${b.status}`}>
                    {b.status === "approved" ? "✅" : b.status === "pending" ? "⏳" : "❌"} {b.status}
                  </span>
                  {b.status !== "approved" && <button className="btn btn-green" style={{ fontSize: 11, padding: "5px 12px" }} onClick={() => handleApprove(b.id)}>Approve</button>}
                  {b.status !== "rejected" && <button className="btn btn-red" style={{ fontSize: 11, padding: "5px 12px" }} onClick={() => handleReject(b.id)}>Reject</button>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* BUSINESS DETAIL MODAL */}
      {selectedBusiness && (
        <div className="modal-overlay" onClick={() => setSelectedBusiness(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 20 }}>
              <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
                <div style={{ fontSize: 44, background: "#FFF3EE", borderRadius: 14, width: 64, height: 64, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {selectedBusiness.icon || "🏪"}
                </div>
                <div>
                  <h2 style={{ fontWeight: 800, fontSize: 18 }}>{selectedBusiness.name}</h2>
                  {selectedBusiness.telugu && <div style={{ color: "#888", fontSize: 13 }}>{selectedBusiness.telugu}</div>}
                </div>
              </div>
              <button onClick={() => setSelectedBusiness(null)} style={{ background: "#F5F5F5", border: "none", borderRadius: "50%", width: 34, height: 34, cursor: "pointer", fontSize: 16 }}>✕</button>
            </div>
            <div style={{ display: "flex", gap: 10, marginBottom: 18, flexWrap: "wrap" }}>
              <span style={{ background: "#FFF3EE", color: "#E8450A", borderRadius: 50, padding: "4px 14px", fontSize: 12, fontWeight: 700 }}>{selectedBusiness.category}</span>
              <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12 }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: selectedBusiness.open ? "#1DB954" : "#e74c3c", display: "inline-block" }}></span>
                <span style={{ color: selectedBusiness.open ? "#1DB954" : "#e74c3c", fontWeight: 600 }}>{selectedBusiness.open ? "Open Now" : "Closed"}</span>
              </span>
              {selectedBusiness.rating > 0 && <span style={{ fontWeight: 700, color: "#f39c12" }}>⭐ {selectedBusiness.rating}/5</span>}
            </div>
            <div style={{ background: "#F8F7F5", borderRadius: 12, padding: 16, marginBottom: 20 }}>
              <div style={{ fontSize: 14, color: "#555", marginBottom: 8 }}>📍 {selectedBusiness.address}</div>
              <div style={{ fontSize: 14, color: "#555" }}>📞 +91 {selectedBusiness.phone}</div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <a href={`tel:${selectedBusiness.phone}`} style={{ textDecoration: "none" }}>
                <button className="btn btn-primary" style={{ width: "100%", padding: 14, fontSize: 15 }}>📞 Call Now</button>
              </a>
              <a href={`https://wa.me/91${selectedBusiness.phone}`} target="_blank" rel="noreferrer" style={{ textDecoration: "none" }}>
                <button className="btn" style={{ width: "100%", padding: 14, fontSize: 15, background: "#25D366", color: "white" }}>💬 WhatsApp</button>
              </a>
              <a href={`https://maps.google.com/?q=${encodeURIComponent(selectedBusiness.address + " Siddipet Telangana")}`} target="_blank" rel="noreferrer" style={{ textDecoration: "none" }}>
                <button className="btn" style={{ width: "100%", padding: 14, fontSize: 15, background: "#F5F5F5", color: "#333" }}>🗺️ Get Directions</button>
              </a>
            </div>
          </div>
        </div>
      )}

      <div style={{ background: "#1a1208", color: "rgba(255,255,255,0.4)", textAlign: "center", padding: 18, fontSize: 12, marginTop: 40 }}>
        సిద్దిపేట్ బజార్ · Powered by Firebase 🔥 · Made for Siddipet, Telangana
      </div>
    </div>
  );
}
