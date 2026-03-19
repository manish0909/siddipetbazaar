import { useState, useEffect } from "react";

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged, GoogleAuthProvider, signInWithPopup, RecaptchaVerifier, signInWithPhoneNumber }
  from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, collection, addDoc, getDocs, doc, updateDoc, getDoc }
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

const CATEGORIES = ["All", "Food", "Medical", "Shopping", "Services", "Automobile", "Transport", "Education"];
const CATEGORY_ICONS = { Food: "🍛", Medical: "💊", Shopping: "🛍️", Services: "⚙️", Automobile: "🔧", Transport: "🚌", Education: "📚", All: "🏪" };
const CAT_COLORS = { Food: "#FF6B35", Medical: "#E63946", Shopping: "#7B2D8B", Services: "#1D7874", Automobile: "#2B4162", Transport: "#0D6EFD", Education: "#F4A261", All: "#555" };

const TERMS = `SIDDIPET BAZAAR — TERMS & CONDITIONS

Last updated: ${new Date().toLocaleDateString('en-IN')}

1. ACCEPTANCE
By signing up, you agree to these terms. If you disagree, please do not use this service.

2. BUSINESS LISTINGS
• All listings are subject to admin review and approval before going live.
• You must provide accurate and truthful information about your business.
• Fake, misleading, or duplicate listings will be removed without notice.
• Your phone number will be verified via OTP before submission.

3. PROHIBITED CONTENT
• No fake business names or addresses.
• No listings for illegal products or services.
• No offensive, abusive, or harmful content.

4. PHONE VERIFICATION
• A valid Indian mobile number is required.
• OTP verification is mandatory for all listings.
• We do not share your number with third parties.

5. ADMIN RIGHTS
• Siddipet Bazaar admin reserves the right to approve, reject, or remove any listing at any time without prior notice.

6. PRIVACY
• Your email and phone number are stored securely in Firebase.
• We do not sell your personal data to anyone.
• Your data is used only to manage your listing.

7. CHANGES
• We may update these terms at any time. Continued use of the app means you accept the updated terms.

8. CONTACT
For support or complaints, contact us via the app.

Thank you for being part of Siddipet Bazaar! 🙏`;

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
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);

  const [authForm, setAuthForm] = useState({ email: "", password: "", businessName: "" });
  const [authError, setAuthError] = useState("");
  const [addForm, setAddForm] = useState({ name: "", telugu: "", category: "Food", address: "", phone: "", tags: "", icon: "🏪" });

  const [otpStep, setOtpStep] = useState("idle");
  const [otpCode, setOtpCode] = useState("");
  const [confirmationResult, setConfirmationResult] = useState(null);
  const [phoneError, setPhoneError] = useState("");

  const showNotif = (msg, type = "success") => {
    setNotification({ msg, type });
    setTimeout(() => setNotification(null), 3500);
  };

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        const adminDoc = await getDoc(doc(db, "admins", firebaseUser.email));
        const admin = adminDoc.exists();
        setUser({ email: firebaseUser.email, uid: firebaseUser.uid, name: firebaseUser.displayName || firebaseUser.email.split("@")[0] });
        setIsAdmin(admin);
        if (view === "login" || view === "signup") setView(admin ? "admin" : "dashboard");
      } else {
        setUser(null);
        setIsAdmin(false);
      }
    });
    return () => unsub();
  }, []);

  const loadBusinesses = async () => {
    setLoadingData(true);
    try {
      const snap = await getDocs(collection(db, "businesses"));
      setBusinesses(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (e) { showNotif("Error loading data", "error"); }
    setLoadingData(false);
  };
  useEffect(() => { loadBusinesses(); }, []);

  const handleGoogleLogin = async () => {
    if (view === "signup" && !termsAccepted) {
      showNotif("Please accept Terms & Conditions first", "error"); return;
    }
    setAuthLoading(true); setAuthError("");
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      try { await addDoc(collection(db, "users"), { uid: result.user.uid, email: result.user.email, businessName: result.user.displayName || "", createdAt: new Date().toISOString() }); } catch (e) {}
      showNotif("Welcome! 👋");
    } catch (e) { setAuthError("Google sign-in failed. Please try again."); }
    setAuthLoading(false);
  };

  const handleLogin = async () => {
    setAuthLoading(true); setAuthError("");
    try {
      await signInWithEmailAndPassword(auth, authForm.email, authForm.password);
      showNotif("Welcome back! 👋");
    } catch (e) {
      setAuthError(e.code === "auth/invalid-credential" ? "Wrong email or password" : "Login failed. Try again.");
    }
    setAuthLoading(false);
  };

  const handleSignup = async () => {
    if (!termsAccepted) { setAuthError("Please accept Terms & Conditions to continue"); return; }
    setAuthLoading(true); setAuthError("");
    if (!authForm.businessName) { setAuthError("Please enter your business name"); setAuthLoading(false); return; }
    try {
      const cred = await createUserWithEmailAndPassword(auth, authForm.email, authForm.password);
      await addDoc(collection(db, "users"), { uid: cred.user.uid, email: authForm.email, businessName: authForm.businessName, createdAt: new Date().toISOString() });
      showNotif("Account created! 🎉");
    } catch (e) {
      setAuthError(e.code === "auth/email-already-in-use" ? "Email already registered. Please login." :
        e.code === "auth/weak-password" ? "Password must be at least 6 characters" : "Signup failed. Try again.");
    }
    setAuthLoading(false);
  };

  const handleLogout = async () => { await signOut(auth); setView("home"); showNotif("Logged out"); };

  const validatePhone = (phone) => {
    const c = phone.replace(/\s+/g, "");
    if (!/^\d{10}$/.test(c)) return "Must be exactly 10 digits";
    if (!/^[6-9]/.test(c)) return "Must start with 6, 7, 8 or 9";
    return null;
  };

  const handleSendOtp = async () => {
    setPhoneError("");
    const err = validatePhone(addForm.phone);
    if (err) { setPhoneError(err); return; }
    setOtpStep("sending");
    try {
      if (!window.recaptchaVerifier) {
        window.recaptchaVerifier = new RecaptchaVerifier(auth, "recaptcha-container", { size: "invisible", callback: () => {} });
      }
      const result = await signInWithPhoneNumber(auth, "+91" + addForm.phone, window.recaptchaVerifier);
      setConfirmationResult(result);
      setOtpStep("sent");
      showNotif("OTP sent! Check your SMS 📱");
    } catch (e) {
      setPhoneError("Failed to send OTP. Try again.");
      setOtpStep("idle");
      if (window.recaptchaVerifier) { window.recaptchaVerifier.clear(); window.recaptchaVerifier = null; }
    }
  };

  const handleVerifyOtp = async () => {
    if (!otpCode || otpCode.length !== 6) { setPhoneError("Enter the 6-digit OTP"); return; }
    setOtpStep("verifying");
    try {
      await confirmationResult.confirm(otpCode);
      setOtpStep("verified");
      showNotif("Phone verified! ✅");
    } catch (e) { setPhoneError("Wrong OTP. Try again."); setOtpStep("sent"); }
  };

  const handleAddListing = async () => {
    if (!addForm.name || !addForm.phone || !addForm.address) { showNotif("Fill all required fields", "error"); return; }
    const phoneErr = validatePhone(addForm.phone);
    if (phoneErr) { showNotif(phoneErr, "error"); return; }
    if (otpStep !== "verified") { showNotif("Please verify your phone number first! 📱", "error"); return; }
    try {
      await addDoc(collection(db, "businesses"), { ...addForm, tags: addForm.tags.split(",").map(t => t.trim()).filter(Boolean), rating: 0, open: true, status: "pending", ownerEmail: user.email, ownerUid: user.uid, submittedAt: new Date().toISOString(), phoneVerified: true });
      setAddForm({ name: "", telugu: "", category: "Food", address: "", phone: "", tags: "", icon: "🏪" });
      setOtpStep("idle"); setOtpCode(""); setPhoneError("");
      await loadBusinesses();
      showNotif("Submitted for review! ⏳");
    } catch (e) { showNotif("Failed to submit. Try again.", "error"); }
  };

  const handleApprove = async (id) => { await updateDoc(doc(db, "businesses", id), { status: "approved" }); await loadBusinesses(); showNotif("Approved! ✅"); };
  const handleReject = async (id) => { await updateDoc(doc(db, "businesses", id), { status: "rejected" }); await loadBusinesses(); showNotif("Rejected ❌", "error"); };

  const approved = businesses.filter(b => b.status === "approved");
  const pending = businesses.filter(b => b.status === "pending");
  const myListings = user ? businesses.filter(b => b.ownerEmail === user.email) : [];
  const filtered = approved.filter(b => {
    const ms = b.name?.toLowerCase().includes(search.toLowerCase()) || b.telugu?.includes(search);
    return ms && (activeCategory === "All" || b.category === activeCategory);
  });

  return (
    <div style={{ fontFamily: "'DM Sans', 'Noto Sans Telugu', sans-serif", minHeight: "100vh", background: "#0A0A0F", color: "#F0EDE8" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=DM+Serif+Display:ital@0;1&family=Noto+Sans+Telugu:wght@400;600&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        ::-webkit-scrollbar { width: 4px; } ::-webkit-scrollbar-track { background: #0A0A0F; } ::-webkit-scrollbar-thumb { background: #333; border-radius: 4px; }

        .btn { padding: 13px 24px; border-radius: 12px; border: none; cursor: pointer; font-family: inherit; font-weight: 600; font-size: 14px; transition: all 0.25s cubic-bezier(0.34,1.4,0.64,1); letter-spacing: 0.3px; }
        .btn-gold { background: linear-gradient(135deg, #C9A84C, #E8C96A, #C9A84C); color: #0A0A0F; font-weight: 700; }
        .btn-gold:hover { transform: translateY(-2px); box-shadow: 0 8px 30px rgba(201,168,76,0.4); }
        .btn-dark { background: #1A1A24; color: #F0EDE8; border: 1px solid #2A2A38; }
        .btn-dark:hover { background: #222232; border-color: #C9A84C44; }
        .btn-ghost { background: transparent; color: #C9A84C; border: 1px solid #C9A84C44; }
        .btn-ghost:hover { background: #C9A84C11; }
        .btn-danger { background: #2D1515; color: #FF6B6B; border: 1px solid #FF6B6B33; }
        .btn-danger:hover { background: #3D1515; }
        .btn-success { background: #0D2D1A; color: #4ADE80; border: 1px solid #4ADE8033; }
        .btn-success:hover { background: #0D3D1A; }

        .input { width: 100%; padding: 14px 16px; border-radius: 12px; border: 1px solid #2A2A38; font-family: inherit; font-size: 14px; outline: none; transition: all 0.2s; background: #12121A; color: #F0EDE8; }
        .input:focus { border-color: #C9A84C66; background: #14141E; box-shadow: 0 0 0 3px #C9A84C11; }
        .input::placeholder { color: #444; }
        .select { width: 100%; padding: 14px 16px; border-radius: 12px; border: 1px solid #2A2A38; font-family: inherit; font-size: 14px; outline: none; background: #12121A; color: #F0EDE8; cursor: pointer; }
        .select:focus { border-color: #C9A84C66; }

        .card { background: #12121A; border-radius: 20px; padding: 22px; cursor: pointer; transition: all 0.3s cubic-bezier(0.34,1.4,0.64,1); border: 1px solid #1E1E2A; position: relative; overflow: hidden; }
        .card::before { content: ''; position: absolute; inset: 0; background: linear-gradient(135deg, #C9A84C08, transparent); opacity: 0; transition: opacity 0.3s; }
        .card:hover { transform: translateY(-6px); border-color: #C9A84C33; box-shadow: 0 20px 60px rgba(0,0,0,0.5); }
        .card:hover::before { opacity: 1; }

        .cat-pill { padding: 9px 18px; border-radius: 50px; border: 1px solid #2A2A38; background: #12121A; cursor: pointer; font-size: 13px; font-weight: 500; transition: all 0.2s; white-space: nowrap; font-family: inherit; color: #888; }
        .cat-pill.active { background: #1E1A0A; border-color: #C9A84C66; color: #C9A84C; }
        .cat-pill:hover:not(.active) { border-color: #333; color: #CCC; }

        .notif { position: fixed; top: 24px; right: 24px; z-index: 9999; padding: 14px 20px; border-radius: 14px; font-weight: 600; font-size: 13px; animation: slideIn 0.4s cubic-bezier(0.34,1.4,0.64,1); max-width: 300px; backdrop-filter: blur(20px); }
        @keyframes slideIn { from { transform: translateX(120px) scale(0.9); opacity: 0; } to { transform: translateX(0) scale(1); opacity: 1; } }

        .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.85); backdrop-filter: blur(12px); z-index: 1000; display: flex; align-items: flex-end; justify-content: center; }
        .modal { background: #0E0E18; border-radius: 28px 28px 0 0; border-top: 1px solid #2A2A38; padding: 32px; width: 100%; max-width: 580px; animation: slideUp 0.4s cubic-bezier(0.34,1.4,0.64,1); max-height: 92vh; overflow-y: auto; }
        @keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }

        .terms-modal { background: #0E0E18; border-radius: 20px; border: 1px solid #2A2A38; padding: 32px; width: 90%; max-width: 520px; max-height: 80vh; overflow-y: auto; animation: fadeScale 0.3s ease; }
        .modal-center-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.85); backdrop-filter: blur(12px); z-index: 2000; display: flex; align-items: center; justify-content: center; }
        @keyframes fadeScale { from { transform: scale(0.95); opacity: 0; } to { transform: scale(1); opacity: 1; } }

        .status-dot { width: 7px; height: 7px; border-radius: 50%; display: inline-block; margin-right: 6px; }
        .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 16px; }
        .nav { background: #0A0A0F; border-bottom: 1px solid #1A1A24; padding: 16px 28px; display: flex; justify-content: space-between; align-items: center; position: sticky; top: 0; z-index: 100; backdrop-filter: blur(20px); }
        .logo-text { font-family: 'DM Serif Display', serif; font-size: 22px; color: #F0EDE8; cursor: pointer; letter-spacing: -0.5px; }
        .logo-text span { color: #C9A84C; font-style: italic; }
        .tag { display: inline-block; background: #1A1A24; color: #888; border-radius: 50px; padding: 3px 10px; font-size: 11px; font-weight: 500; }
        .divider { display: flex; align-items: center; gap: 12px; color: #333; font-size: 12px; margin: 4px 0; }
        .divider::before, .divider::after { content: ''; flex: 1; height: 1px; background: #1E1E2A; }
        .spinner { width: 36px; height: 36px; border: 3px solid #1E1E2A; border-top: 3px solid #C9A84C; border-radius: 50%; animation: spin 0.8s linear infinite; margin: 0 auto; }
        @keyframes spin { to { transform: rotate(360deg); } }
        .otp-input { letter-spacing: 10px; font-size: 22px; font-weight: 700; text-align: center; background: #0A0A0F; border: 1px solid #C9A84C44; color: #C9A84C; }
        .otp-input:focus { border-color: #C9A84C; box-shadow: 0 0 0 3px #C9A84C22; }
        .checkbox-row { display: flex; align-items: flex-start; gap: 12px; cursor: pointer; }
        .custom-checkbox { width: 20px; height: 20px; min-width: 20px; border-radius: 6px; border: 2px solid #2A2A38; background: #12121A; display: flex; align-items: center; justify-content: center; transition: all 0.2s; margin-top: 1px; }
        .custom-checkbox.checked { background: #C9A84C; border-color: #C9A84C; }
        .hero-bg { background: radial-gradient(ellipse 80% 60% at 50% -10%, #1E1A0A, transparent), radial-gradient(ellipse 40% 40% at 80% 80%, #0A1020, transparent), #0A0A0F; }
        @media(max-width:600px) { .grid { grid-template-columns: 1fr; } .nav { padding: 12px 16px; } }
      `}</style>

      {/* NOTIFICATION */}
      {notification && (
        <div className="notif" style={{ background: notification.type === "error" ? "#2D0D0D" : "#0D2D1A", color: notification.type === "error" ? "#FF6B6B" : "#4ADE80", border: `1px solid ${notification.type === "error" ? "#FF6B6B33" : "#4ADE8033"}` }}>
          {notification.msg}
        </div>
      )}

      {/* TERMS MODAL */}
      {showTermsModal && (
        <div className="modal-center-overlay" onClick={() => setShowTermsModal(false)}>
          <div className="terms-modal" onClick={e => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <h3 style={{ fontFamily: "'DM Serif Display', serif", fontSize: 20, color: "#C9A84C" }}>Terms & Conditions</h3>
              <button onClick={() => setShowTermsModal(false)} style={{ background: "#1A1A24", border: "none", borderRadius: "50%", width: 32, height: 32, cursor: "pointer", color: "#888", fontSize: 16 }}>✕</button>
            </div>
            <pre style={{ whiteSpace: "pre-wrap", fontSize: 13, lineHeight: 1.8, color: "#AAA", fontFamily: "inherit" }}>{TERMS}</pre>
            <button className="btn btn-gold" style={{ width: "100%", marginTop: 24, padding: 14 }}
              onClick={() => { setTermsAccepted(true); setShowTermsModal(false); showNotif("Terms accepted ✅"); }}>
              I Accept These Terms
            </button>
          </div>
        </div>
      )}

      {/* NAVBAR */}
      <nav className="nav">
        <div className="logo-text" onClick={() => setView("home")}>
          Siddipet <span>బజార్</span>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button className="btn btn-ghost" style={{ fontSize: 12, padding: "8px 14px" }}
            onClick={() => setLanguage(l => l === "en" ? "te" : "en")}>
            {language === "en" ? "తెలుగు" : "English"}
          </button>
          {user ? (
            <>
              <button className="btn btn-dark" style={{ fontSize: 12, padding: "8px 14px" }}
                onClick={() => setView(isAdmin ? "admin" : "dashboard")}>
                {isAdmin ? "⚙️ Admin" : "📋 My Listings"}
              </button>
              <button className="btn btn-ghost" style={{ fontSize: 12, padding: "8px 14px" }} onClick={handleLogout}>Logout</button>
            </>
          ) : (
            <>
              <button className="btn btn-dark" style={{ fontSize: 12, padding: "8px 14px" }} onClick={() => { setView("login"); setAuthError(""); }}>Login</button>
              <button className="btn btn-gold" style={{ fontSize: 12, padding: "8px 14px" }} onClick={() => { setView("signup"); setAuthError(""); setTermsAccepted(false); }}>+ Add Business</button>
            </>
          )}
        </div>
      </nav>

      {/* ==================== HOME ==================== */}
      {view === "home" && (
        <>
          <div className="hero-bg" style={{ padding: "64px 24px 80px", position: "relative", overflow: "hidden" }}>
            {/* Decorative circles */}
            <div style={{ position: "absolute", top: -100, right: -100, width: 400, height: 400, borderRadius: "50%", border: "1px solid #C9A84C11", pointerEvents: "none" }}></div>
            <div style={{ position: "absolute", top: -50, right: -50, width: 250, height: 250, borderRadius: "50%", border: "1px solid #C9A84C22", pointerEvents: "none" }}></div>

            <div style={{ maxWidth: 680, margin: "0 auto", textAlign: "center", position: "relative" }}>
              <div style={{ display: "inline-block", background: "#1E1A0A", border: "1px solid #C9A84C33", borderRadius: 50, padding: "6px 18px", fontSize: 12, color: "#C9A84C", fontWeight: 600, letterSpacing: 1, textTransform: "uppercase", marginBottom: 24 }}>
                🏙️ Siddipet District · Telangana
              </div>
              <h1 style={{ fontFamily: "'DM Serif Display', serif", fontSize: 52, fontWeight: 400, color: "#F0EDE8", lineHeight: 1.1, marginBottom: 16 }}>
                Every Local Business,<br /><em style={{ color: "#C9A84C" }}>Right Here.</em>
              </h1>
              <p style={{ color: "#555", marginBottom: 40, fontSize: 16, lineHeight: 1.6 }}>
                {language === "en"
                  ? "The most trusted directory of shops, doctors, services & more in Siddipet"
                  : "సిద్దిపేటలో అత్యంత విశ్వసనీయమైన వ్యాపార డైరెక్టరీ"}
              </p>

              <div style={{ position: "relative", maxWidth: 500, margin: "0 auto 40px" }}>
                <span style={{ position: "absolute", left: 18, top: "50%", transform: "translateY(-50%)", fontSize: 18, color: "#555" }}>🔍</span>
                <input className="input" style={{ paddingLeft: 50, fontSize: 15, borderRadius: 50, padding: "16px 20px 16px 50px", background: "#12121A", border: "1px solid #2A2A38" }}
                  placeholder={language === "en" ? "Search businesses, doctors, food..." : "వ్యాపారాలు వెతకండి..."}
                  value={search} onChange={e => setSearch(e.target.value)} />
              </div>

              <div style={{ display: "flex", justifyContent: "center", gap: 48 }}>
                {[["🏪", approved.length + "+", "Businesses"], ["✅", "Verified", "Listings"], ["📍", "Siddipet", "Telangana"]].map(([icon, val, label]) => (
                  <div key={label}>
                    <div style={{ fontFamily: "'DM Serif Display', serif", fontSize: 24, color: "#C9A84C" }}>{val}</div>
                    <div style={{ color: "#444", fontSize: 12, marginTop: 2 }}>{icon} {label}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div style={{ maxWidth: 780, margin: "0 auto", padding: "40px 20px" }}>
            {/* Category pills */}
            <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 8, marginBottom: 32 }}>
              {CATEGORIES.map(cat => (
                <button key={cat} className={`cat-pill ${activeCategory === cat ? "active" : ""}`}
                  onClick={() => setActiveCategory(cat)}>
                  {CATEGORY_ICONS[cat]} {cat}
                </button>
              ))}
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <div>
                <h2 style={{ fontFamily: "'DM Serif Display', serif", fontSize: 22, fontWeight: 400 }}>
                  {activeCategory === "All" ? "All Businesses" : activeCategory}
                </h2>
                <div style={{ color: "#555", fontSize: 13, marginTop: 2 }}>{filtered.length} listings found</div>
              </div>
              {!user && (
                <button className="btn btn-gold" style={{ fontSize: 13 }} onClick={() => setView("signup")}>
                  + List Your Business
                </button>
              )}
            </div>

            {loadingData ? (
              <div style={{ padding: "80px 0", textAlign: "center" }}>
                <div className="spinner" style={{ marginBottom: 20 }}></div>
                <div style={{ color: "#444", fontSize: 14 }}>Loading from Firebase...</div>
              </div>
            ) : filtered.length === 0 ? (
              <div style={{ textAlign: "center", padding: "80px 0", color: "#444" }}>
                <div style={{ fontSize: 52, marginBottom: 16 }}>🔍</div>
                <div style={{ fontFamily: "'DM Serif Display', serif", fontSize: 22, color: "#666", marginBottom: 8 }}>Nothing found</div>
                <div style={{ fontSize: 14 }}>
                  {businesses.length === 0 ? "Be the first to list your business!" : "Try a different search"}
                </div>
                {!user && <button className="btn btn-gold" style={{ marginTop: 24 }} onClick={() => setView("signup")}>Add First Business</button>}
              </div>
            ) : (
              <div className="grid">
                {filtered.map(b => (
                  <div key={b.id} className="card" onClick={() => setSelectedBusiness(b)}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
                      <div style={{ fontSize: 36, background: "#1A1A24", borderRadius: 14, width: 56, height: 56, display: "flex", alignItems: "center", justifyContent: "center", border: "1px solid #2A2A38" }}>
                        {b.icon || "🏪"}
                      </div>
                      <div style={{ display: "flex", alignItems: "center", fontSize: 12 }}>
                        <span className="status-dot" style={{ background: b.open ? "#4ADE80" : "#FF6B6B" }}></span>
                        <span style={{ color: b.open ? "#4ADE80" : "#FF6B6B", fontWeight: 600 }}>{b.open ? "Open" : "Closed"}</span>
                      </div>
                    </div>
                    <h3 style={{ fontWeight: 600, fontSize: 15, marginBottom: 6, color: "#F0EDE8" }}>{language === "te" && b.telugu ? b.telugu : b.name}</h3>
                    <div style={{ color: "#555", fontSize: 13, marginBottom: 14 }}>📍 {b.address}</div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ background: CAT_COLORS[b.category] + "22", color: CAT_COLORS[b.category] || "#C9A84C", borderRadius: 50, padding: "3px 12px", fontSize: 12, fontWeight: 600, border: `1px solid ${CAT_COLORS[b.category] + "33"}` }}>
                        {b.category}
                      </span>
                      {b.rating > 0 && <span style={{ fontWeight: 700, color: "#C9A84C", fontSize: 13 }}>★ {b.rating}</span>}
                    </div>
                    {b.tags?.length > 0 && (
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginTop: 12 }}>
                        {b.tags.map(t => <span key={t} className="tag">{t}</span>)}
                      </div>
                    )}
                    {b.phoneVerified && <div style={{ fontSize: 11, color: "#4ADE8088", marginTop: 10 }}>✅ Phone Verified</div>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {/* ==================== LOGIN ==================== */}
      {view === "login" && (
        <div style={{ minHeight: "85vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
          <div style={{ background: "#0E0E18", borderRadius: 28, padding: 44, width: "100%", maxWidth: 420, border: "1px solid #1E1E2A", boxShadow: "0 40px 80px rgba(0,0,0,0.6)" }}>
            <div style={{ textAlign: "center", marginBottom: 36 }}>
              <div style={{ fontFamily: "'DM Serif Display', serif", fontSize: 28, marginBottom: 8 }}>Welcome back</div>
              <div style={{ color: "#555", fontSize: 14 }}>Sign in to manage your listing</div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <button className="btn" onClick={handleGoogleLogin} disabled={authLoading}
                style={{ width: "100%", padding: 14, background: "#12121A", color: "#F0EDE8", border: "1px solid #2A2A38", display: "flex", alignItems: "center", justifyContent: "center", gap: 10, fontSize: 14, borderRadius: 12 }}>
                <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" width="18" />
                Continue with Google
              </button>
              <div className="divider">or</div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: "#555", display: "block", marginBottom: 6 }}>Email</label>
                <input className="input" type="email" placeholder="your@email.com" value={authForm.email} onChange={e => setAuthForm(f => ({ ...f, email: e.target.value }))} />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: "#555", display: "block", marginBottom: 6 }}>Password</label>
                <input className="input" type="password" placeholder="••••••••" value={authForm.password}
                  onChange={e => setAuthForm(f => ({ ...f, password: e.target.value }))}
                  onKeyDown={e => e.key === "Enter" && handleLogin()} />
              </div>
              {authError && <div style={{ background: "#2D0D0D", color: "#FF6B6B", borderRadius: 10, padding: "10px 14px", fontSize: 13, border: "1px solid #FF6B6B22" }}>⚠️ {authError}</div>}
              <button className="btn btn-gold" style={{ width: "100%", padding: 14, marginTop: 4 }} onClick={handleLogin} disabled={authLoading}>
                {authLoading ? "⏳ Signing in..." : "Sign In →"}
              </button>
              <p style={{ textAlign: "center", color: "#444", fontSize: 13 }}>
                No account?{" "}
                <span style={{ color: "#C9A84C", cursor: "pointer", fontWeight: 600 }} onClick={() => { setView("signup"); setTermsAccepted(false); }}>Sign up</span>
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ==================== SIGNUP ==================== */}
      {view === "signup" && (
        <div style={{ minHeight: "85vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
          <div style={{ background: "#0E0E18", borderRadius: 28, padding: 44, width: "100%", maxWidth: 440, border: "1px solid #1E1E2A", boxShadow: "0 40px 80px rgba(0,0,0,0.6)" }}>
            <div style={{ textAlign: "center", marginBottom: 32 }}>
              <div style={{ fontFamily: "'DM Serif Display', serif", fontSize: 28, marginBottom: 8 }}>List your business</div>
              <div style={{ color: "#555", fontSize: 14 }}>Submit → Admin reviews → Go live!</div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

              {/* Google button */}
              <button className="btn" onClick={handleGoogleLogin} disabled={authLoading || !termsAccepted}
                style={{ width: "100%", padding: 14, background: termsAccepted ? "#12121A" : "#0A0A0F", color: termsAccepted ? "#F0EDE8" : "#444", border: `1px solid ${termsAccepted ? "#2A2A38" : "#1A1A24"}`, display: "flex", alignItems: "center", justifyContent: "center", gap: 10, fontSize: 14, borderRadius: 12, cursor: termsAccepted ? "pointer" : "not-allowed" }}>
                <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" width="18" style={{ opacity: termsAccepted ? 1 : 0.3 }} />
                Continue with Google
              </button>

              <div className="divider">or sign up with email</div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: "#555", display: "block", marginBottom: 6 }}>Business Name *</label>
                <input className="input" placeholder="e.g. Sri Lakshmi Store" value={authForm.businessName} onChange={e => setAuthForm(f => ({ ...f, businessName: e.target.value }))} />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: "#555", display: "block", marginBottom: 6 }}>Email *</label>
                <input className="input" type="email" placeholder="your@email.com" value={authForm.email} onChange={e => setAuthForm(f => ({ ...f, email: e.target.value }))} />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: "#555", display: "block", marginBottom: 6 }}>Password * (min 6 chars)</label>
                <input className="input" type="password" placeholder="••••••••" value={authForm.password} onChange={e => setAuthForm(f => ({ ...f, password: e.target.value }))} />
              </div>

              {/* Terms & Conditions checkbox */}
              <div className="checkbox-row" onClick={() => !termsAccepted && setShowTermsModal(true)}>
                <div className={`custom-checkbox ${termsAccepted ? "checked" : ""}`} onClick={e => { e.stopPropagation(); if (termsAccepted) setTermsAccepted(false); else setShowTermsModal(true); }}>
                  {termsAccepted && <span style={{ color: "#0A0A0F", fontSize: 13, fontWeight: 700 }}>✓</span>}
                </div>
                <div style={{ fontSize: 13, color: "#666", lineHeight: 1.5 }}>
                  I have read and agree to the{" "}
                  <span style={{ color: "#C9A84C", cursor: "pointer", fontWeight: 600, textDecoration: "underline" }}
                    onClick={e => { e.stopPropagation(); setShowTermsModal(true); }}>
                    Terms & Conditions
                  </span>
                  {" "}of Siddipet Bazaar
                </div>
              </div>

              {!termsAccepted && (
                <div style={{ background: "#1E1A0A", border: "1px solid #C9A84C22", borderRadius: 10, padding: "10px 14px", fontSize: 12, color: "#C9A84C88" }}>
                  ⚠️ Please read and accept the Terms & Conditions to continue
                </div>
              )}

              {authError && <div style={{ background: "#2D0D0D", color: "#FF6B6B", borderRadius: 10, padding: "10px 14px", fontSize: 13, border: "1px solid #FF6B6B22" }}>⚠️ {authError}</div>}

              <button className="btn btn-gold" style={{ width: "100%", padding: 14, opacity: termsAccepted ? 1 : 0.4, cursor: termsAccepted ? "pointer" : "not-allowed" }}
                onClick={handleSignup} disabled={authLoading || !termsAccepted}>
                {authLoading ? "⏳ Creating account..." : "Create Account →"}
              </button>

              <p style={{ textAlign: "center", color: "#444", fontSize: 13 }}>
                Already registered?{" "}
                <span style={{ color: "#C9A84C", cursor: "pointer", fontWeight: 600 }} onClick={() => setView("login")}>Sign in</span>
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ==================== DASHBOARD ==================== */}
      {view === "dashboard" && user && (
        <div style={{ maxWidth: 740, margin: "0 auto", padding: "40px 20px" }}>
          {/* Profile card */}
          <div style={{ background: "linear-gradient(135deg, #1E1A0A, #12100A)", borderRadius: 24, padding: 32, marginBottom: 28, border: "1px solid #C9A84C22" }}>
            <div style={{ fontSize: 12, color: "#C9A84C88", marginBottom: 6, letterSpacing: 1, textTransform: "uppercase" }}>Business Owner</div>
            <div style={{ fontFamily: "'DM Serif Display', serif", fontSize: 26, color: "#F0EDE8", marginBottom: 4 }}>{user.name}</div>
            <div style={{ color: "#444", fontSize: 13 }}>{user.email}</div>
            <div style={{ display: "flex", gap: 28, marginTop: 24 }}>
              {[["Total", myListings.length], ["Approved", myListings.filter(b => b.status === "approved").length], ["Pending", myListings.filter(b => b.status === "pending").length]].map(([label, val]) => (
                <div key={label}>
                  <div style={{ fontFamily: "'DM Serif Display', serif", fontSize: 26, color: "#C9A84C" }}>{val}</div>
                  <div style={{ color: "#444", fontSize: 12 }}>{label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Add listing */}
          <div style={{ background: "#0E0E18", borderRadius: 24, padding: 32, marginBottom: 24, border: "1px solid #1E1E2A" }}>
            <h3 style={{ fontFamily: "'DM Serif Display', serif", fontSize: 20, marginBottom: 24, color: "#F0EDE8" }}>Submit New Listing</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "#555", display: "block", marginBottom: 6 }}>Business Name *</label>
                  <input className="input" placeholder="English name" value={addForm.name} onChange={e => setAddForm(f => ({ ...f, name: e.target.value }))} />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "#555", display: "block", marginBottom: 6 }}>Telugu Name</label>
                  <input className="input" placeholder="తెలుగు పేరు" value={addForm.telugu} onChange={e => setAddForm(f => ({ ...f, telugu: e.target.value }))} />
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "#555", display: "block", marginBottom: 6 }}>Category *</label>
                  <select className="select" value={addForm.category} onChange={e => setAddForm(f => ({ ...f, category: e.target.value }))}>
                    {CATEGORIES.filter(c => c !== "All").map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "#555", display: "block", marginBottom: 6 }}>Emoji Icon</label>
                  <input className="input" placeholder="🏪" value={addForm.icon} onChange={e => setAddForm(f => ({ ...f, icon: e.target.value }))} />
                </div>
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: "#555", display: "block", marginBottom: 6 }}>Full Address *</label>
                <input className="input" placeholder="e.g. Main Road, Siddipet" value={addForm.address} onChange={e => setAddForm(f => ({ ...f, address: e.target.value }))} />
              </div>

              {/* Phone with OTP */}
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: "#555", display: "block", marginBottom: 6 }}>
                  Phone Number * {otpStep === "verified" && <span style={{ color: "#4ADE80" }}>✅ Verified</span>}
                </label>
                <div style={{ display: "flex", gap: 8 }}>
                  <div style={{ position: "relative", flex: 1 }}>
                    <span style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: "#555", fontSize: 13, fontWeight: 600 }}>+91</span>
                    <input className="input" style={{ paddingLeft: 46, borderColor: otpStep === "verified" ? "#4ADE8044" : phoneError ? "#FF6B6B44" : "#2A2A38" }}
                      placeholder="10-digit number" maxLength={10}
                      value={addForm.phone}
                      onChange={e => {
                        const val = e.target.value.replace(/\D/g, "");
                        setAddForm(f => ({ ...f, phone: val }));
                        setPhoneError("");
                        if (otpStep !== "idle") { setOtpStep("idle"); setOtpCode(""); }
                      }} />
                  </div>
                  {otpStep === "idle" && <button className="btn btn-ghost" style={{ whiteSpace: "nowrap" }} onClick={handleSendOtp}>Send OTP</button>}
                  {otpStep === "sending" && <button className="btn btn-dark" disabled style={{ whiteSpace: "nowrap" }}>⏳</button>}
                  {otpStep === "verified" && <button className="btn btn-success" disabled style={{ whiteSpace: "nowrap" }}>✅ Done</button>}
                </div>

                {otpStep === "sent" && (
                  <div style={{ marginTop: 12, background: "#0D2D1A", borderRadius: 14, padding: 18, border: "1px solid #4ADE8022" }}>
                    <div style={{ fontSize: 13, color: "#4ADE8088", marginBottom: 12 }}>
                      📱 OTP sent to +91 {addForm.phone}
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <input className="input otp-input" placeholder="000000" value={otpCode} maxLength={6}
                        onChange={e => setOtpCode(e.target.value.replace(/\D/g, ""))} />
                      <button className="btn btn-success" style={{ whiteSpace: "nowrap" }} onClick={handleVerifyOtp}>Verify</button>
                    </div>
                    <div style={{ fontSize: 12, color: "#4ADE8044", marginTop: 10, cursor: "pointer" }}
                      onClick={() => { setOtpStep("idle"); setOtpCode(""); }}>
                      ↩ Change number
                    </div>
                  </div>
                )}

                {otpStep === "verifying" && <div style={{ marginTop: 8, color: "#555", fontSize: 13 }}>⏳ Verifying...</div>}
                {phoneError && <div style={{ marginTop: 8, color: "#FF6B6B", fontSize: 13 }}>⚠️ {phoneError}</div>}
                <div id="recaptcha-container"></div>
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: "#555", display: "block", marginBottom: 6 }}>Tags (comma separated)</label>
                <input className="input" placeholder="e.g. Home Delivery, Open 24hrs, Veg" value={addForm.tags} onChange={e => setAddForm(f => ({ ...f, tags: e.target.value }))} />
              </div>
              <button className="btn btn-gold" style={{ alignSelf: "flex-start", padding: "13px 28px" }} onClick={handleAddListing}>
                Submit for Review →
              </button>
            </div>
          </div>

          {/* My listings */}
          <h3 style={{ fontFamily: "'DM Serif Display', serif", fontSize: 20, marginBottom: 16 }}>My Listings</h3>
          {myListings.length === 0 ? (
            <div style={{ background: "#0E0E18", borderRadius: 16, padding: 32, textAlign: "center", color: "#444", border: "1px solid #1E1E2A" }}>
              No listings yet. Submit your first business above!
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {myListings.map(b => (
                <div key={b.id} style={{ background: "#0E0E18", borderRadius: 14, padding: "16px 20px", display: "flex", justifyContent: "space-between", alignItems: "center", border: "1px solid #1E1E2A" }}>
                  <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                    <span style={{ fontSize: 26 }}>{b.icon || "🏪"}</span>
                    <div>
                      <div style={{ fontWeight: 600, color: "#F0EDE8" }}>{b.name}</div>
                      <div style={{ color: "#444", fontSize: 13 }}>📍 {b.address}</div>
                    </div>
                  </div>
                  <span style={{
                    padding: "4px 14px", borderRadius: 50, fontSize: 12, fontWeight: 700,
                    background: b.status === "approved" ? "#0D2D1A" : b.status === "pending" ? "#1E1A0A" : "#2D0D0D",
                    color: b.status === "approved" ? "#4ADE80" : b.status === "pending" ? "#C9A84C" : "#FF6B6B",
                    border: `1px solid ${b.status === "approved" ? "#4ADE8033" : b.status === "pending" ? "#C9A84C33" : "#FF6B6B33"}`
                  }}>
                    {b.status === "approved" ? "✅ Live" : b.status === "pending" ? "⏳ Pending" : "❌ Rejected"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ==================== ADMIN ==================== */}
      {view === "admin" && isAdmin && (
        <div style={{ maxWidth: 780, margin: "0 auto", padding: "40px 20px" }}>
          <div style={{ background: "linear-gradient(135deg, #1E1A0A, #12100A)", borderRadius: 24, padding: 32, marginBottom: 28, border: "1px solid #C9A84C22" }}>
            <div style={{ fontSize: 12, color: "#C9A84C88", marginBottom: 6, letterSpacing: 1, textTransform: "uppercase" }}>⚙️ Admin Panel</div>
            <div style={{ fontFamily: "'DM Serif Display', serif", fontSize: 28 }}>Siddipet బజార్</div>
            <div style={{ display: "flex", gap: 32, marginTop: 20 }}>
              {[["⏳", pending.length, "Pending"], ["✅", businesses.filter(b => b.status === "approved").length, "Approved"], ["❌", businesses.filter(b => b.status === "rejected").length, "Rejected"]].map(([icon, val, label]) => (
                <div key={label}>
                  <div style={{ fontFamily: "'DM Serif Display', serif", fontSize: 28, color: "#C9A84C" }}>{icon} {val}</div>
                  <div style={{ color: "#444", fontSize: 12 }}>{label}</div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <h3 style={{ fontFamily: "'DM Serif Display', serif", fontSize: 20 }}>Pending Approvals</h3>
            <button className="btn btn-dark" style={{ fontSize: 12, padding: "8px 16px" }} onClick={loadBusinesses}>🔄 Refresh</button>
          </div>

          {pending.length === 0 ? (
            <div style={{ background: "#0E0E18", borderRadius: 16, padding: 32, textAlign: "center", color: "#444", marginBottom: 24, border: "1px solid #1E1E2A" }}>
              🎉 All caught up! No pending reviews.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 14, marginBottom: 32 }}>
              {pending.map(b => (
                <div key={b.id} style={{ background: "#0E0E18", borderRadius: 18, padding: 24, border: "1px solid #C9A84C22" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
                    <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
                      <span style={{ fontSize: 32 }}>{b.icon || "🏪"}</span>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 16, color: "#F0EDE8" }}>{b.name}</div>
                        {b.telugu && <div style={{ color: "#555", fontSize: 13 }}>{b.telugu}</div>}
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 6, flexDirection: "column", alignItems: "flex-end" }}>
                      <span style={{ background: "#1E1A0A", color: "#C9A84C", borderRadius: 50, padding: "3px 12px", fontSize: 11, fontWeight: 700, border: "1px solid #C9A84C33" }}>⏳ Pending</span>
                      {b.phoneVerified && <span style={{ fontSize: 11, color: "#4ADE8066" }}>✅ Phone Verified</span>}
                    </div>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, fontSize: 13, color: "#555", marginBottom: 16 }}>
                    <div>📍 {b.address}</div>
                    <div>📞 {b.phone}</div>
                    <div>🏷️ {b.category}</div>
                    <div>✉️ {b.ownerEmail}</div>
                  </div>
                  {b.tags?.length > 0 && (
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 16 }}>
                      {b.tags.map(t => <span key={t} className="tag">{t}</span>)}
                    </div>
                  )}
                  <div style={{ display: "flex", gap: 10 }}>
                    <button className="btn btn-success" style={{ flex: 1, padding: 12 }} onClick={() => handleApprove(b.id)}>✅ Approve — Go Live!</button>
                    <button className="btn btn-danger" style={{ flex: 1, padding: 12 }} onClick={() => handleReject(b.id)}>❌ Reject</button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <h3 style={{ fontFamily: "'DM Serif Display', serif", fontSize: 20, marginBottom: 16 }}>All Businesses ({businesses.length})</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {businesses.map(b => (
              <div key={b.id} style={{ background: "#0E0E18", borderRadius: 12, padding: "14px 18px", display: "flex", justifyContent: "space-between", alignItems: "center", border: "1px solid #1E1E2A" }}>
                <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                  <span style={{ fontSize: 22 }}>{b.icon || "🏪"}</span>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 14, color: "#F0EDE8" }}>{b.name}</div>
                    <div style={{ color: "#444", fontSize: 12 }}>{b.category} · {b.ownerEmail}</div>
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <span style={{
                    padding: "3px 12px", borderRadius: 50, fontSize: 11, fontWeight: 700,
                    background: b.status === "approved" ? "#0D2D1A" : b.status === "pending" ? "#1E1A0A" : "#2D0D0D",
                    color: b.status === "approved" ? "#4ADE80" : b.status === "pending" ? "#C9A84C" : "#FF6B6B",
                  }}>
                    {b.status}
                  </span>
                  {b.status !== "approved" && <button className="btn btn-success" style={{ fontSize: 11, padding: "5px 12px" }} onClick={() => handleApprove(b.id)}>Approve</button>}
                  {b.status !== "rejected" && <button className="btn btn-danger" style={{ fontSize: 11, padding: "5px 12px" }} onClick={() => handleReject(b.id)}>Reject</button>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* BUSINESS MODAL */}
      {selectedBusiness && (
        <div className="modal-overlay" onClick={() => setSelectedBusiness(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 24 }}>
              <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
                <div style={{ fontSize: 44, background: "#1A1A24", borderRadius: 16, width: 68, height: 68, display: "flex", alignItems: "center", justifyContent: "center", border: "1px solid #2A2A38" }}>
                  {selectedBusiness.icon || "🏪"}
                </div>
                <div>
                  <h2 style={{ fontFamily: "'DM Serif Display', serif", fontSize: 22, color: "#F0EDE8" }}>{selectedBusiness.name}</h2>
                  {selectedBusiness.telugu && <div style={{ color: "#555", fontSize: 14 }}>{selectedBusiness.telugu}</div>}
                </div>
              </div>
              <button onClick={() => setSelectedBusiness(null)} style={{ background: "#1A1A24", border: "1px solid #2A2A38", borderRadius: "50%", width: 36, height: 36, cursor: "pointer", color: "#888", fontSize: 16 }}>✕</button>
            </div>

            <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
              <span style={{ background: CAT_COLORS[selectedBusiness.category] + "22", color: CAT_COLORS[selectedBusiness.category] || "#C9A84C", borderRadius: 50, padding: "4px 14px", fontSize: 12, fontWeight: 700 }}>
                {selectedBusiness.category}
              </span>
              <span style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12 }}>
                <span className="status-dot" style={{ background: selectedBusiness.open ? "#4ADE80" : "#FF6B6B" }}></span>
                <span style={{ color: selectedBusiness.open ? "#4ADE80" : "#FF6B6B", fontWeight: 600 }}>{selectedBusiness.open ? "Open Now" : "Closed"}</span>
              </span>
              {selectedBusiness.phoneVerified && <span style={{ fontSize: 12, color: "#4ADE8088" }}>✅ Verified</span>}
            </div>

            <div style={{ background: "#12121A", borderRadius: 14, padding: 18, marginBottom: 20, border: "1px solid #1E1E2A" }}>
              <div style={{ fontSize: 14, color: "#888", marginBottom: 10 }}>📍 {selectedBusiness.address}</div>
              <div style={{ fontSize: 14, color: "#888" }}>📞 +91 {selectedBusiness.phone}</div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <a href={`tel:${selectedBusiness.phone}`} style={{ textDecoration: "none" }}>
                <button className="btn btn-gold" style={{ width: "100%", padding: 15, fontSize: 15 }}>📞 Call Now</button>
              </a>
              <a href={`https://wa.me/91${selectedBusiness.phone}`} target="_blank" rel="noreferrer" style={{ textDecoration: "none" }}>
                <button className="btn" style={{ width: "100%", padding: 15, fontSize: 15, background: "#0D2D1A", color: "#4ADE80", border: "1px solid #4ADE8033" }}>💬 WhatsApp</button>
              </a>
              <a href={`https://maps.google.com/?q=${encodeURIComponent(selectedBusiness.address + " Siddipet Telangana")}`} target="_blank" rel="noreferrer" style={{ textDecoration: "none" }}>
                <button className="btn btn-dark" style={{ width: "100%", padding: 15, fontSize: 15 }}>🗺️ Get Directions</button>
              </a>
            </div>
          </div>
        </div>
      )}

      <div style={{ borderTop: "1px solid #1A1A24", color: "#333", textAlign: "center", padding: "20px", fontSize: 12, marginTop: 60 }}>
        సిద్దిపేట్ బజార్ · Powered by Firebase 🔥 · Made for Siddipet, Telangana
      </div>
    </div>
  );
}
