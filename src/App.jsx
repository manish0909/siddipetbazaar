import { useState, useEffect } from "react";

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged, GoogleAuthProvider, signInWithPopup, RecaptchaVerifier, signInWithPhoneNumber }
  from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, collection, addDoc, getDocs, doc, updateDoc, getDoc, setDoc, arrayUnion, arrayRemove, query, where }
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

const CATEGORIES = ["All","Food","Medical","Shopping","Services","Automobile","Transport","Education"];
const CAT_EMOJI = { All:"🏪", Food:"🍛", Medical:"💊", Shopping:"🛍️", Services:"⚙️", Automobile:"🔧", Transport:"🚌", Education:"📚" };
const CAT_COLOR = { Food:"#FF6B35", Medical:"#E63946", Shopping:"#7B2D8B", Services:"#1D7874", Automobile:"#2B4162", Transport:"#0D6EFD", Education:"#F4A261" };

const TERMS = `Siddipet Bazaar — Terms & Conditions
Last updated: ${new Date().toLocaleDateString("en-IN")}

1. ACCEPTANCE
By creating an account you agree to these terms.

2. FOR CONSUMERS
• You must have genuinely visited a business to leave a review.
• Fake or malicious reviews will be removed.
• Saved favourites are private to your account.

3. FOR BUSINESS OWNERS
• All listings require admin approval before going live.
• You must provide accurate business information.
• Phone number OTP verification is mandatory.
• Fake listings will be removed without notice.

4. SUBSCRIPTION (Coming Soon)
• After 1 year, premium plans will be introduced.
• Free tier will always remain available.
• Paid plans unlock featured placement & analytics.

5. PRIVACY
• Your data is stored securely in Firebase.
• We never sell your personal data.
• Phone numbers are only used for verification.

6. ADMIN RIGHTS
• Admin may approve, reject, or remove any listing or review at any time.

Thank you for being part of Siddipet Bazaar! 🙏`;

export default function App() {
  const [view, setView] = useState("home");
  const [user, setUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [businesses, setBusinesses] = useState([]);
  const [search, setSearch] = useState("");
  const [activeCat, setActiveCat] = useState("All");
  const [selected, setSelected] = useState(null);
  const [lang, setLang] = useState("en");
  const [notif, setNotif] = useState(null);
  const [dbLoading, setDbLoading] = useState(true);
  const [authLoading, setAuthLoading] = useState(false);
  const [showTerms, setShowTerms] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [termsError, setTermsError] = useState(false);
  const [role, setRole] = useState(null); // "consumer" | "owner"
  const [authForm, setAuthForm] = useState({ email:"", password:"", name:"" });
  const [authErr, setAuthErr] = useState("");
  const [addForm, setAddForm] = useState({ name:"", telugu:"", category:"Food", address:"", phone:"", tags:"", icon:"🏪" });
  const [otpStep, setOtpStep] = useState("idle");
  const [otp, setOtp] = useState("");
  const [confirmResult, setConfirmResult] = useState(null);
  const [phoneErr, setPhoneErr] = useState("");
  const [favourites, setFavourites] = useState([]);
  const [reviews, setReviews] = useState({});
  const [reviewForm, setReviewForm] = useState({ rating:5, text:"", visited:false });
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [reviewErr, setReviewErr] = useState("");

  const toast = (msg, type="ok") => { setNotif({msg,type}); setTimeout(()=>setNotif(null),3000); };

  // ── Auth listener ──────────────────────────────────────────
  useEffect(()=>{
    const unsub = onAuthStateChanged(auth, async(fu)=>{
      if(fu){
        const adm = await getDoc(doc(db,"admins",fu.email));
        const prof = await getDoc(doc(db,"users",fu.uid));
        const profile = prof.exists() ? prof.data() : null;
        setUser({ email:fu.email, uid:fu.uid, name:fu.displayName||fu.email.split("@")[0] });
        setUserProfile(profile);
        setIsAdmin(adm.exists());
        setFavourites(profile?.favourites||[]);
        if(view==="login"||view==="signup"){
          setView(adm.exists()?"admin": profile?.role==="consumer"?"consumer-home":"dashboard");
        }
      } else {
        setUser(null); setUserProfile(null); setIsAdmin(false); setFavourites([]);
      }
    });
    return ()=>unsub();
  },[]);

  // ── Load businesses ────────────────────────────────────────
  const loadBiz = async()=>{
    setDbLoading(true);
    try{
      const snap = await getDocs(collection(db,"businesses"));
      setBusinesses(snap.docs.map(d=>({id:d.id,...d.data()})));
    }catch(e){}
    setDbLoading(false);
  };
  useEffect(()=>{ loadBiz(); },[]);

  // ── Load reviews for a business ───────────────────────────
  const loadReviews = async(bizId)=>{
    try{
      const snap = await getDocs(query(collection(db,"reviews"),where("bizId","==",bizId)));
      setReviews(r=>({...r,[bizId]:snap.docs.map(d=>({id:d.id,...d.data()}))}));
    }catch(e){}
  };

  // ── Google Login ───────────────────────────────────────────
  const googleLogin = async()=>{
    if(view==="signup"&&!agreed){ setTermsError(true); return; }
    setAuthLoading(true); setAuthErr("");
    try{
      const r = await signInWithPopup(auth, new GoogleAuthProvider());
      const fu = r.user;
      const prof = await getDoc(doc(db,"users",fu.uid));
      if(!prof.exists()){
        await setDoc(doc(db,"users",fu.uid),{
          uid:fu.uid, email:fu.email, name:fu.displayName||"",
          role: role||"consumer", joinedAt:new Date().toISOString(), favourites:[]
        });
      }
      toast("Welcome! 👋");
    }catch(e){ setAuthErr("Google sign-in failed. Try again."); }
    setAuthLoading(false);
  };

  // ── Email login ────────────────────────────────────────────
  const login = async()=>{
    setAuthLoading(true); setAuthErr("");
    try{ await signInWithEmailAndPassword(auth,authForm.email,authForm.password); toast("Welcome back!"); }
    catch(e){ setAuthErr(e.code==="auth/invalid-credential"?"Wrong email or password":"Login failed."); }
    setAuthLoading(false);
  };

  // ── Email signup ───────────────────────────────────────────
  const signup = async()=>{
    if(!agreed){ setTermsError(true); return; }
    if(!role){ setAuthErr("Please select your role above"); return; }
    setAuthLoading(true); setAuthErr("");
    if(!authForm.name){ setAuthErr("Enter your name"); setAuthLoading(false); return; }
    try{
      const c = await createUserWithEmailAndPassword(auth,authForm.email,authForm.password);
      await setDoc(doc(db,"users",c.user.uid),{
        uid:c.user.uid, email:authForm.email, name:authForm.name,
        role, joinedAt:new Date().toISOString(), favourites:[]
      });
      toast("Account created! 🎉");
    }catch(e){
      setAuthErr(e.code==="auth/email-already-in-use"?"Email already registered.":
        e.code==="auth/weak-password"?"Password needs 6+ characters":"Signup failed.");
    }
    setAuthLoading(false);
  };

  const logout = async()=>{ await signOut(auth); setView("home"); toast("Logged out"); };

  // ── Favourites ─────────────────────────────────────────────
  const toggleFav = async(bizId)=>{
    if(!user){ toast("Sign in to save favourites","err"); return; }
    if(userProfile?.role!=="consumer"){ toast("Only consumers can save favourites","err"); return; }
    const isFav = favourites.includes(bizId);
    const newFavs = isFav ? favourites.filter(f=>f!==bizId) : [...favourites,bizId];
    setFavourites(newFavs);
    await updateDoc(doc(db,"users",user.uid),{ favourites: isFav ? arrayRemove(bizId) : arrayUnion(bizId) });
    toast(isFav?"Removed from favourites":"Saved to favourites ♥");
  };

  // ── Phone OTP ──────────────────────────────────────────────
  const validatePhone = p=>{
    if(!/^\d{10}$/.test(p)) return "Enter a valid 10-digit number";
    if(!/^[6-9]/.test(p)) return "Must start with 6, 7, 8 or 9";
    return null;
  };
  const sendOtp = async()=>{
    setPhoneErr("");
    const e=validatePhone(addForm.phone);
    if(e){ setPhoneErr(e); return; }
    setOtpStep("sending");
    try{
      if(!window.rcv) window.rcv = new RecaptchaVerifier(auth,"rcv-box",{size:"invisible",callback:()=>{}});
      const r = await signInWithPhoneNumber(auth,"+91"+addForm.phone,window.rcv);
      setConfirmResult(r); setOtpStep("sent"); toast("OTP sent! Check your SMS 📱");
    }catch(e){
      setPhoneErr("Failed to send OTP. Try again."); setOtpStep("idle");
      if(window.rcv){ window.rcv.clear(); window.rcv=null; }
    }
  };
  const verifyOtp = async()=>{
    if(!otp||otp.length!==6){ setPhoneErr("Enter the 6-digit OTP"); return; }
    setOtpStep("verifying");
    try{ await confirmResult.confirm(otp); setOtpStep("verified"); toast("Phone verified ✓"); }
    catch(e){ setPhoneErr("Incorrect OTP. Try again."); setOtpStep("sent"); }
  };

  // ── Submit listing ─────────────────────────────────────────
  const submitListing = async()=>{
    if(!addForm.name||!addForm.phone||!addForm.address){ toast("Fill all required fields","err"); return; }
    if(validatePhone(addForm.phone)){ toast(validatePhone(addForm.phone),"err"); return; }
    if(otpStep!=="verified"){ toast("Verify your phone number first","err"); return; }
    try{
      await addDoc(collection(db,"businesses"),{
        ...addForm,
        tags:addForm.tags.split(",").map(t=>t.trim()).filter(Boolean),
        rating:0, ratingCount:0, open:true, status:"pending",
        ownerEmail:user.email, ownerUid:user.uid,
        submittedAt:new Date().toISOString(), phoneVerified:true
      });
      setAddForm({name:"",telugu:"",category:"Food",address:"",phone:"",tags:"",icon:"🏪"});
      setOtpStep("idle"); setOtp(""); setPhoneErr("");
      await loadBiz(); toast("Submitted for review ✓");
    }catch(e){ toast("Submission failed. Try again.","err"); }
  };

  // ── Submit review ──────────────────────────────────────────
  const submitReview = async()=>{
    if(!user){ toast("Sign in to review","err"); return; }
    if(userProfile?.role!=="consumer"){ toast("Only consumers can write reviews","err"); return; }
    if(!reviewForm.visited){ setReviewErr("Please confirm you have visited this business"); return; }
    if(!reviewForm.text.trim()){ setReviewErr("Please write a review"); return; }
    try{
      await addDoc(collection(db,"reviews"),{
        bizId: selected.id,
        userId: user.uid,
        userName: user.name,
        rating: reviewForm.rating,
        text: reviewForm.text,
        createdAt: new Date().toISOString()
      });
      // update avg rating
      const bizReviews = [...(reviews[selected.id]||[]),{rating:reviewForm.rating}];
      const avg = bizReviews.reduce((a,r)=>a+r.rating,0)/bizReviews.length;
      await updateDoc(doc(db,"businesses",selected.id),{ rating:Math.round(avg*10)/10, ratingCount:bizReviews.length });
      await loadReviews(selected.id);
      await loadBiz();
      setReviewForm({rating:5,text:"",visited:false});
      setShowReviewForm(false);
      setReviewErr("");
      toast("Review submitted! ✓");
    }catch(e){ toast("Failed to submit review","err"); }
  };

  // ── Admin actions ──────────────────────────────────────────
  const approve = async(id)=>{ await updateDoc(doc(db,"businesses",id),{status:"approved"}); await loadBiz(); toast("Approved ✓"); };
  const reject  = async(id)=>{ await updateDoc(doc(db,"businesses",id),{status:"rejected"}); await loadBiz(); toast("Rejected","err"); };

  const approved  = businesses.filter(b=>b.status==="approved");
  const pending   = businesses.filter(b=>b.status==="pending");
  const myList    = user ? businesses.filter(b=>b.ownerEmail===user.email) : [];
  const favList   = approved.filter(b=>favourites.includes(b.id));
  const filtered  = approved.filter(b=>{
    const ms = b.name?.toLowerCase().includes(search.toLowerCase())||b.telugu?.includes(search);
    return ms&&(activeCat==="All"||b.category===activeCat);
  });

  const isConsumer = userProfile?.role==="consumer";
  const isOwner    = userProfile?.role==="owner";

  // ── Joined date display ────────────────────────────────────
  const joinedDate = userProfile?.joinedAt
    ? new Date(userProfile.joinedAt).toLocaleDateString("en-IN",{month:"long",year:"numeric"})
    : null;

  return (
    <div style={{fontFamily:"'Outfit','Noto Sans Telugu',sans-serif",minHeight:"100vh",background:"#FFF8F2",color:"#111"}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800;900&family=Noto+Sans+Telugu:wght@400;600&display=swap');
        *{box-sizing:border-box;margin:0;padding:0;}
        ::-webkit-scrollbar{width:4px;} ::-webkit-scrollbar-thumb{background:#DDD;border-radius:4px;}

        .inp{width:100%;padding:13px 16px;border-radius:12px;border:1.5px solid #EEE;font-family:inherit;font-size:14px;outline:none;transition:all 0.2s;background:white;color:#111;}
        .inp:focus{border-color:#E8450A;}
        .inp::placeholder{color:#CCC;}
        .sel{width:100%;padding:13px 16px;border-radius:12px;border:1.5px solid #EEE;font-family:inherit;font-size:14px;outline:none;background:white;color:#111;cursor:pointer;}

        .card{background:white;border-radius:20px;padding:22px;cursor:pointer;transition:all 0.25s cubic-bezier(0.34,1.3,0.64,1);border:1.5px solid #F5EDE8;}
        .card:hover{transform:translateY(-4px);box-shadow:0 12px 40px rgba(232,69,10,0.1);border-color:#E8450A33;}

        .pill{padding:9px 18px;border-radius:50px;border:1.5px solid #EEE;background:white;cursor:pointer;font-size:13px;font-weight:500;transition:all 0.2s;white-space:nowrap;font-family:inherit;color:#777;}
        .pill.on{background:#E8450A;border-color:#E8450A;color:white;box-shadow:0 4px 16px rgba(232,69,10,0.25);}
        .pill:hover:not(.on){border-color:#E8450A55;color:#E8450A;}

        .btn{padding:13px 22px;border-radius:12px;border:none;cursor:pointer;font-family:inherit;font-weight:600;font-size:14px;transition:all 0.2s;letter-spacing:0.1px;}
        .btn-o{background:#E8450A;color:white;}
        .btn-o:hover{background:#D03D09;transform:translateY(-1px);box-shadow:0 6px 20px rgba(232,69,10,0.3);}
        .btn-o:disabled{background:#EEE;color:#BBB;cursor:not-allowed;transform:none;box-shadow:none;}
        .btn-w{background:white;color:#111;border:1.5px solid #EEE;}
        .btn-w:hover{border-color:#CCC;}
        .btn-g{background:#F0FDF4;color:#16A34A;border:1.5px solid #BBF7D0;}
        .btn-r{background:#FEF2F2;color:#DC2626;border:1.5px solid #FECACA;}
        .btn-dark{background:#1a1208;color:white;}
        .btn-dark:hover{background:#2d1f0e;}

        .role-btn{padding:20px;border-radius:16px;border:2px solid #EEE;background:white;cursor:pointer;font-family:inherit;transition:all 0.2s;text-align:center;flex:1;}
        .role-btn.on{border-color:#E8450A;background:#FFF8F2;}
        .role-btn:hover:not(.on){border-color:#EEE;background:#FAFAFA;}

        .notif{position:fixed;top:20px;left:50%;transform:translateX(-50%);z-index:9999;padding:12px 24px;border-radius:50px;font-weight:600;font-size:13px;animation:popUp 0.3s cubic-bezier(0.34,1.6,0.64,1);white-space:nowrap;box-shadow:0 4px 24px rgba(0,0,0,0.12);}
        @keyframes popUp{from{transform:translateX(-50%) translateY(-16px) scale(0.9);opacity:0;}to{transform:translateX(-50%) translateY(0) scale(1);opacity:1;}}

        .overlay{position:fixed;inset:0;background:rgba(26,18,8,0.6);backdrop-filter:blur(8px);z-index:1000;display:flex;align-items:flex-end;justify-content:center;}
        .sheet{background:white;border-radius:28px 28px 0 0;padding:28px 28px 40px;width:100%;max-width:580px;animation:sheetUp 0.35s cubic-bezier(0.34,1.3,0.64,1);max-height:92vh;overflow-y:auto;}
        @keyframes sheetUp{from{transform:translateY(100%);}to{transform:translateY(0);}}

        .center-overlay{position:fixed;inset:0;background:rgba(26,18,8,0.6);backdrop-filter:blur(8px);z-index:2000;display:flex;align-items:center;justify-content:center;padding:20px;}
        .center-card{background:white;border-radius:24px;padding:32px;width:100%;max-width:480px;max-height:80vh;overflow-y:auto;animation:fadeUp 0.3s ease;}
        @keyframes fadeUp{from{transform:scale(0.96) translateY(8px);opacity:0;}to{transform:scale(1) translateY(0);opacity:1;}}

        .nav{background:rgba(255,248,242,0.9);backdrop-filter:blur(20px);border-bottom:1px solid #F5EDE8;padding:0 28px;height:62px;display:flex;justify-content:space-between;align-items:center;position:sticky;top:0;z-index:100;}

        .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(290px,1fr));gap:16px;}
        .tag{display:inline-block;background:#FFF0EA;color:#E8450A;border-radius:50px;padding:3px 10px;font-size:11px;font-weight:500;}
        .dot{width:7px;height:7px;border-radius:50%;display:inline-block;margin-right:5px;}
        .divider{display:flex;align-items:center;gap:12px;color:#CCC;font-size:12px;}
        .divider::before,.divider::after{content:'';flex:1;height:1px;background:#F0F0F0;}
        .spin{width:32px;height:32px;border:3px solid #FFF0EA;border-top:3px solid #E8450A;border-radius:50%;animation:spin 0.7s linear infinite;margin:0 auto;}
        @keyframes spin{to{transform:rotate(360deg);}}
        .check{width:20px;height:20px;min-width:20px;border-radius:6px;border:2px solid #DDD;background:white;display:flex;align-items:center;justify-content:center;transition:all 0.15s;cursor:pointer;}
        .check.on{background:#E8450A;border-color:#E8450A;}
        .star{font-size:22px;cursor:pointer;transition:transform 0.1s;}
        .star:hover{transform:scale(1.2);}
        .otp-inp{letter-spacing:12px;font-size:22px;font-weight:700;text-align:center;}
        .fav-btn{background:none;border:none;cursor:pointer;font-size:20px;transition:transform 0.2s;padding:4px;}
        .fav-btn:hover{transform:scale(1.2);}
        @media(max-width:600px){.grid{grid-template-columns:1fr;}.nav{padding:0 16px;}}
      `}</style>

      {/* TOAST */}
      {notif&&(
        <div className="notif" style={{background:notif.type==="err"?"#FEF2F2":"white",color:notif.type==="err"?"#DC2626":"#111",border:`1px solid ${notif.type==="err"?"#FECACA":"#EEE"}`}}>
          {notif.msg}
        </div>
      )}

      {/* TERMS MODAL */}
      {showTerms&&(
        <div className="center-overlay" onClick={()=>setShowTerms(false)}>
          <div className="center-card" onClick={e=>e.stopPropagation()}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
              <div style={{fontWeight:700,fontSize:18}}>Terms & Conditions</div>
              <button onClick={()=>setShowTerms(false)} style={{background:"#F5F5F5",border:"none",borderRadius:"50%",width:32,height:32,cursor:"pointer",fontSize:16,color:"#777"}}>✕</button>
            </div>
            <pre style={{whiteSpace:"pre-wrap",fontSize:13,lineHeight:1.8,color:"#666",fontFamily:"inherit"}}>{TERMS}</pre>
            <button className="btn btn-o" style={{width:"100%",marginTop:24,padding:14}}
              onClick={()=>{ setAgreed(true); setShowTerms(false); setTermsError(false); toast("Terms accepted ✓"); }}>
              I Accept These Terms
            </button>
          </div>
        </div>
      )}

      {/* NAVBAR */}
      <nav className="nav">
        <div onClick={()=>setView("home")} style={{cursor:"pointer",display:"flex",alignItems:"center",gap:8}}>
          <div style={{width:30,height:30,background:"#E8450A",borderRadius:9,display:"flex",alignItems:"center",justifyContent:"center",fontSize:15}}>🏪</div>
          <span style={{fontWeight:800,fontSize:17,letterSpacing:"-0.3px"}}>Siddipet Bazaar</span>
        </div>
        <div style={{display:"flex",gap:8,alignItems:"center"}}>
          <button className="btn btn-w" style={{fontSize:12,padding:"7px 14px",borderRadius:50}} onClick={()=>setLang(l=>l==="en"?"te":"en")}>
            {lang==="en"?"తె":"EN"}
          </button>
          {user?(
            <>
              {isConsumer&&(
                <button className="btn btn-w" style={{fontSize:12,padding:"7px 14px",borderRadius:50}} onClick={()=>setView("consumer-home")}>
                  My Account
                </button>
              )}
              {isOwner&&(
                <button className="btn btn-w" style={{fontSize:12,padding:"7px 14px",borderRadius:50}} onClick={()=>setView("dashboard")}>
                  My Listings
                </button>
              )}
              {isAdmin&&(
                <button className="btn btn-w" style={{fontSize:12,padding:"7px 14px",borderRadius:50}} onClick={()=>setView("admin")}>
                  Admin
                </button>
              )}
              <button className="btn btn-dark" style={{fontSize:12,padding:"7px 16px",borderRadius:50}} onClick={logout}>Sign out</button>
            </>
          ):(
            <>
              <button className="btn btn-w" style={{fontSize:12,padding:"7px 16px",borderRadius:50}} onClick={()=>{setView("login");setAuthErr("");}}>Sign in</button>
              <button className="btn btn-o" style={{fontSize:12,padding:"7px 16px",borderRadius:50}} onClick={()=>{setView("signup");setAuthErr("");setAgreed(false);setRole(null);setTermsError(false);}}>Join Free</button>
            </>
          )}
        </div>
      </nav>

      {/* ═══════════════════ HOME ═══════════════════ */}
      {view==="home"&&(
        <>
          {/* HERO */}
          <div style={{background:"linear-gradient(135deg,#1a1208 0%,#2d1f0e 60%,#3d2910 100%)",padding:"70px 24px 80px",position:"relative",overflow:"hidden"}}>
            <div style={{position:"absolute",top:-80,right:-80,width:320,height:320,borderRadius:"50%",border:"1px solid rgba(232,69,10,0.15)",pointerEvents:"none"}}></div>
            <div style={{position:"absolute",top:-30,right:-30,width:180,height:180,borderRadius:"50%",border:"1px solid rgba(232,69,10,0.25)",pointerEvents:"none"}}></div>
            <div style={{position:"absolute",bottom:-2,left:0,right:0,height:48,background:"#FFF8F2",clipPath:"ellipse(55% 100% at 50% 100%)"}}></div>

            <div style={{maxWidth:680,margin:"0 auto",textAlign:"center",position:"relative"}}>
              <div style={{display:"inline-flex",alignItems:"center",gap:6,background:"rgba(232,69,10,0.15)",border:"1px solid rgba(232,69,10,0.3)",borderRadius:50,padding:"6px 16px",fontSize:12,color:"#FF8A5C",fontWeight:600,letterSpacing:1,marginBottom:28}}>
                🏙️ SIDDIPET DISTRICT · TELANGANA
              </div>
              <h1 style={{fontSize:50,fontWeight:900,letterSpacing:"-1.5px",lineHeight:1.1,color:"white",marginBottom:16}}>
                Find Every Local<br/>
                <span style={{color:"#E8450A"}}>Business</span> Near You
              </h1>
              <p style={{color:"rgba(255,255,255,0.45)",fontSize:15,marginBottom:36,lineHeight:1.7,maxWidth:460,margin:"0 auto 36px"}}>
                {lang==="en"
                  ?"Trusted directory of shops, doctors, services & more in Siddipet"
                  :"సిద్దిపేటలో నమ్మకమైన వ్యాపార డైరెక్టరీ"}
              </p>
              <div style={{position:"relative",maxWidth:480,margin:"0 auto 36px"}}>
                <span style={{position:"absolute",left:18,top:"50%",transform:"translateY(-50%)",fontSize:18,color:"rgba(255,255,255,0.3)"}}>🔍</span>
                <input className="inp" style={{paddingLeft:50,borderRadius:50,fontSize:15,padding:"16px 20px 16px 50px",background:"rgba(255,255,255,0.1)",border:"1px solid rgba(255,255,255,0.15)",color:"white"}}
                  placeholder={lang==="en"?"Search businesses, doctors, food...":"వ్యాపారాలు వెతకండి..."}
                  value={search} onChange={e=>setSearch(e.target.value)} />
              </div>
              <div style={{display:"flex",justifyContent:"center",gap:44}}>
                {[["🏪",approved.length+"+","Businesses"],["⭐","Verified","Listings"],["💛","Free","To Browse"]].map(([ic,v,l])=>(
                  <div key={l} style={{textAlign:"center"}}>
                    <div style={{fontWeight:900,fontSize:22,color:"#E8450A"}}>{v}</div>
                    <div style={{fontSize:11,color:"rgba(255,255,255,0.3)",marginTop:3}}>{ic} {l}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* BODY */}
          <div style={{maxWidth:780,margin:"0 auto",padding:"36px 20px 60px"}}>
            {/* Category pills */}
            <div style={{display:"flex",gap:8,overflowX:"auto",paddingBottom:4,marginBottom:32}}>
              {CATEGORIES.map(c=>(
                <button key={c} className={`pill ${activeCat===c?"on":""}`} onClick={()=>setActiveCat(c)}>
                  {CAT_EMOJI[c]} {c}
                </button>
              ))}
            </div>

            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-end",marginBottom:20}}>
              <div>
                <div style={{fontWeight:800,fontSize:19,letterSpacing:"-0.3px"}}>{activeCat==="All"?"All Businesses":activeCat}</div>
                <div style={{color:"#BBB",fontSize:13,marginTop:3}}>{filtered.length} listings</div>
              </div>
              {!user&&(
                <button className="btn btn-o" style={{fontSize:12,padding:"8px 18px",borderRadius:50}} onClick={()=>setView("signup")}>
                  + List Business
                </button>
              )}
            </div>

            {dbLoading?(
              <div style={{padding:"80px 0",textAlign:"center"}}>
                <div className="spin" style={{marginBottom:16}}></div>
                <div style={{color:"#CCC",fontSize:13}}>Loading from Firebase...</div>
              </div>
            ):filtered.length===0?(
              <div style={{textAlign:"center",padding:"80px 0",color:"#CCC"}}>
                <div style={{fontSize:48,marginBottom:12}}>🔍</div>
                <div style={{fontWeight:700,color:"#999",fontSize:16}}>No businesses found</div>
                <div style={{fontSize:13,marginTop:6}}>Be the first to add one!</div>
                {!user&&<button className="btn btn-o" style={{marginTop:24}} onClick={()=>setView("signup")}>List Your Business</button>}
              </div>
            ):(
              <div className="grid">
                {filtered.map(b=>(
                  <div key={b.id} className="card" onClick={()=>{ setSelected(b); loadReviews(b.id); setShowReviewForm(false); }}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:14}}>
                      <div style={{fontSize:34,width:54,height:54,background:"#FFF0EA",borderRadius:14,display:"flex",alignItems:"center",justifyContent:"center",border:"1px solid #FFE0D0"}}>
                        {b.icon||"🏪"}
                      </div>
                      <button className="fav-btn" onClick={e=>{ e.stopPropagation(); toggleFav(b.id); }}>
                        {favourites.includes(b.id)?"❤️":"🤍"}
                      </button>
                    </div>
                    <div style={{fontWeight:700,fontSize:15,marginBottom:4,letterSpacing:"-0.2px"}}>
                      {lang==="te"&&b.telugu?b.telugu:b.name}
                    </div>
                    <div style={{color:"#BBB",fontSize:12,marginBottom:14}}>📍 {b.address}</div>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                      <span style={{background:CAT_COLOR[b.category]+"18",color:CAT_COLOR[b.category]||"#E8450A",borderRadius:50,padding:"4px 12px",fontSize:11,fontWeight:600,border:`1px solid ${CAT_COLOR[b.category]||"#E8450A"}22`}}>
                        {b.category}
                      </span>
                      <div style={{display:"flex",alignItems:"center",gap:8}}>
                        {b.phoneVerified&&<span style={{fontSize:10,color:"#16A34A",fontWeight:600}}>✓</span>}
                        {b.rating>0&&<span style={{fontWeight:700,fontSize:12,color:"#F59E0B"}}>★ {b.rating} ({b.ratingCount||0})</span>}
                      </div>
                    </div>
                    {b.tags?.length>0&&(
                      <div style={{display:"flex",flexWrap:"wrap",gap:4,marginTop:12}}>
                        {b.tags.slice(0,3).map(t=><span key={t} className="tag">{t}</span>)}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {/* ═══════════════════ LOGIN ═══════════════════ */}
      {view==="login"&&(
        <div style={{minHeight:"85vh",display:"flex",alignItems:"center",justifyContent:"center",padding:24}}>
          <div style={{background:"white",borderRadius:24,padding:40,width:"100%",maxWidth:400,border:"1.5px solid #F5EDE8",boxShadow:"0 20px 60px rgba(232,69,10,0.07)"}}>
            <div style={{marginBottom:32}}>
              <div style={{fontWeight:800,fontSize:24,letterSpacing:"-0.5px",marginBottom:6}}>Welcome back</div>
              <div style={{color:"#AAA",fontSize:14}}>Sign in to your Siddipet Bazaar account</div>
            </div>
            <div style={{display:"flex",flexDirection:"column",gap:12}}>
              <button className="btn btn-w" onClick={googleLogin} disabled={authLoading}
                style={{width:"100%",padding:13,display:"flex",alignItems:"center",justifyContent:"center",gap:10,fontSize:14,borderRadius:12}}>
                <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" width="17"/>
                Continue with Google
              </button>
              <div className="divider">or</div>
              <input className="inp" type="email" placeholder="Email address" value={authForm.email} onChange={e=>setAuthForm(f=>({...f,email:e.target.value}))}/>
              <input className="inp" type="password" placeholder="Password" value={authForm.password}
                onChange={e=>setAuthForm(f=>({...f,password:e.target.value}))}
                onKeyDown={e=>e.key==="Enter"&&login()}/>
              {authErr&&<div style={{background:"#FEF2F2",color:"#DC2626",borderRadius:10,padding:"10px 14px",fontSize:13}}>⚠ {authErr}</div>}
              <button className="btn btn-o" style={{width:"100%",padding:14,marginTop:4}} onClick={login} disabled={authLoading}>
                {authLoading?"Signing in...":"Sign In →"}
              </button>
              <div style={{textAlign:"center",color:"#AAA",fontSize:13}}>
                No account?{" "}
                <span style={{color:"#E8450A",cursor:"pointer",fontWeight:600}} onClick={()=>{setView("signup");setAgreed(false);setRole(null);}}>Sign up free</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════ SIGNUP ═══════════════════ */}
      {view==="signup"&&(
        <div style={{minHeight:"85vh",display:"flex",alignItems:"center",justifyContent:"center",padding:24}}>
          <div style={{background:"white",borderRadius:24,padding:40,width:"100%",maxWidth:440,border:"1.5px solid #F5EDE8",boxShadow:"0 20px 60px rgba(232,69,10,0.07)"}}>
            <div style={{marginBottom:28}}>
              <div style={{fontWeight:800,fontSize:24,letterSpacing:"-0.5px",marginBottom:6}}>Join Siddipet Bazaar</div>
              <div style={{color:"#AAA",fontSize:14}}>Free forever — upgrade when you're ready</div>
            </div>
            <div style={{display:"flex",flexDirection:"column",gap:14}}>

              {/* Role selection */}
              <div>
                <div style={{fontSize:12,fontWeight:700,color:"#AAA",textTransform:"uppercase",letterSpacing:0.5,marginBottom:10}}>I am a...</div>
                <div style={{display:"flex",gap:10}}>
                  <button className={`role-btn ${role==="consumer"?"on":""}`} onClick={()=>setRole("consumer")}>
                    <div style={{fontSize:28,marginBottom:8}}>🛍️</div>
                    <div style={{fontWeight:700,fontSize:14,marginBottom:4}}>Consumer</div>
                    <div style={{fontSize:11,color:"#AAA",lineHeight:1.4}}>Browse, save favourites & write reviews</div>
                    {role==="consumer"&&<div style={{color:"#E8450A",fontWeight:700,fontSize:12,marginTop:8}}>✓ Selected</div>}
                  </button>
                  <button className={`role-btn ${role==="owner"?"on":""}`} onClick={()=>setRole("owner")}>
                    <div style={{fontSize:28,marginBottom:8}}>🏪</div>
                    <div style={{fontWeight:700,fontSize:14,marginBottom:4}}>Business Owner</div>
                    <div style={{fontSize:11,color:"#AAA",lineHeight:1.4}}>List & manage your business</div>
                    {role==="owner"&&<div style={{color:"#E8450A",fontWeight:700,fontSize:12,marginTop:8}}>✓ Selected</div>}
                  </button>
                </div>
              </div>

              {/* T&C checkbox */}
              <div style={{background:termsError?"#FEF2F2":"#FFF8F2",borderRadius:14,padding:14,border:`1.5px solid ${termsError?"#FECACA":"#F5EDE8"}`}}>
                <div style={{display:"flex",alignItems:"flex-start",gap:12,cursor:"pointer"}} onClick={()=>agreed?setAgreed(false):setShowTerms(true)}>
                  <div className={`check ${agreed?"on":""}`}>
                    {agreed&&<span style={{color:"white",fontSize:11,fontWeight:700}}>✓</span>}
                  </div>
                  <div style={{fontSize:13,color:"#666",lineHeight:1.5}}>
                    I agree to the{" "}
                    <span style={{color:"#E8450A",fontWeight:600,textDecoration:"underline",cursor:"pointer"}}
                      onClick={e=>{e.stopPropagation();setShowTerms(true);}}>
                      Terms & Conditions
                    </span>
                  </div>
                </div>
                {termsError&&<div style={{color:"#DC2626",fontSize:12,marginTop:8,marginLeft:32}}>Please accept terms to continue</div>}
              </div>

              {/* Google button — disabled until role + terms */}
              <button className="btn btn-w" onClick={googleLogin} disabled={authLoading||!agreed||!role}
                style={{width:"100%",padding:13,display:"flex",alignItems:"center",justifyContent:"center",gap:10,fontSize:14,borderRadius:12,opacity:agreed&&role?1:0.4,cursor:agreed&&role?"pointer":"not-allowed"}}>
                <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" width="17" style={{opacity:agreed&&role?1:0.4}}/>
                Continue with Google
              </button>

              <div className="divider">or sign up with email</div>

              <input className="inp" placeholder={role==="owner"?"Business name":"Your name"} value={authForm.name} onChange={e=>setAuthForm(f=>({...f,name:e.target.value}))}/>
              <input className="inp" type="email" placeholder="Email address" value={authForm.email} onChange={e=>setAuthForm(f=>({...f,email:e.target.value}))}/>
              <input className="inp" type="password" placeholder="Password (min 6 chars)" value={authForm.password} onChange={e=>setAuthForm(f=>({...f,password:e.target.value}))}/>

              {authErr&&<div style={{background:"#FEF2F2",color:"#DC2626",borderRadius:10,padding:"10px 14px",fontSize:13}}>⚠ {authErr}</div>}

              <button className="btn btn-o" style={{width:"100%",padding:14,opacity:agreed&&role?1:0.4}} onClick={signup} disabled={authLoading||!agreed||!role}>
                {authLoading?"Creating account...":"Create Free Account →"}
              </button>
              <div style={{textAlign:"center",color:"#AAA",fontSize:13}}>
                Have an account?{" "}
                <span style={{color:"#E8450A",cursor:"pointer",fontWeight:600}} onClick={()=>setView("login")}>Sign in</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════ CONSUMER HOME ═══════════════════ */}
      {view==="consumer-home"&&user&&isConsumer&&(
        <div style={{maxWidth:700,margin:"0 auto",padding:"40px 24px"}}>
          {/* Profile card */}
          <div style={{background:"linear-gradient(135deg,#1a1208,#3d2910)",borderRadius:20,padding:28,marginBottom:24,color:"white"}}>
            <div style={{fontSize:11,color:"rgba(232,69,10,0.8)",letterSpacing:1,textTransform:"uppercase",marginBottom:8}}>Consumer Account</div>
            <div style={{fontWeight:800,fontSize:22,letterSpacing:"-0.5px",marginBottom:4}}>👋 {user.name}</div>
            <div style={{color:"rgba(255,255,255,0.4)",fontSize:13}}>{user.email}</div>
            {joinedDate&&<div style={{color:"rgba(255,255,255,0.3)",fontSize:12,marginTop:6}}>📅 Member since {joinedDate}</div>}
            <div style={{display:"flex",gap:28,marginTop:20,paddingTop:20,borderTop:"1px solid rgba(255,255,255,0.1)"}}>
              {[["❤️",favourites.length,"Saved"],["⭐",reviews[user.uid]?.length||"0","Reviews"]].map(([ic,v,l])=>(
                <div key={l}><div style={{fontWeight:800,fontSize:22}}>{v}</div><div style={{fontSize:12,color:"rgba(255,255,255,0.3)",marginTop:2}}>{ic} {l}</div></div>
              ))}
            </div>
          </div>

          {/* Saved favourites */}
          <div style={{fontWeight:700,fontSize:17,letterSpacing:"-0.3px",marginBottom:16}}>❤️ Saved Businesses</div>
          {favList.length===0?(
            <div style={{background:"white",borderRadius:16,padding:32,textAlign:"center",color:"#CCC",border:"1.5px solid #F5EDE8",marginBottom:24,fontSize:14}}>
              No saved businesses yet — tap 🤍 on any listing to save!
            </div>
          ):(
            <div className="grid" style={{marginBottom:28}}>
              {favList.map(b=>(
                <div key={b.id} className="card" onClick={()=>{ setSelected(b); loadReviews(b.id); setView("home"); }}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:12}}>
                    <div style={{fontSize:30,width:48,height:48,background:"#FFF0EA",borderRadius:12,display:"flex",alignItems:"center",justifyContent:"center"}}>
                      {b.icon||"🏪"}
                    </div>
                    <button className="fav-btn" onClick={e=>{e.stopPropagation();toggleFav(b.id);}}>❤️</button>
                  </div>
                  <div style={{fontWeight:700,fontSize:14,marginBottom:3}}>{b.name}</div>
                  <div style={{color:"#CCC",fontSize:12,marginBottom:10}}>📍 {b.address}</div>
                  <span style={{background:"#FFF0EA",color:"#E8450A",borderRadius:50,padding:"3px 10px",fontSize:11,fontWeight:600}}>{b.category}</span>
                </div>
              ))}
            </div>
          )}

          <button className="btn btn-o" style={{width:"100%",padding:14}} onClick={()=>setView("home")}>
            Browse All Businesses →
          </button>
        </div>
      )}

      {/* ═══════════════════ OWNER DASHBOARD ═══════════════════ */}
      {view==="dashboard"&&user&&isOwner&&(
        <div style={{maxWidth:700,margin:"0 auto",padding:"40px 24px"}}>
          <div style={{background:"linear-gradient(135deg,#1a1208,#3d2910)",borderRadius:20,padding:28,marginBottom:24,color:"white"}}>
            <div style={{fontSize:11,color:"rgba(232,69,10,0.8)",letterSpacing:1,textTransform:"uppercase",marginBottom:8}}>Business Owner</div>
            <div style={{fontWeight:800,fontSize:22,marginBottom:4}}>🏪 {user.name}</div>
            <div style={{color:"rgba(255,255,255,0.4)",fontSize:13}}>{user.email}</div>
            {joinedDate&&<div style={{color:"rgba(255,255,255,0.3)",fontSize:12,marginTop:6}}>📅 Member since {joinedDate}</div>}
            <div style={{display:"flex",gap:28,marginTop:20,paddingTop:20,borderTop:"1px solid rgba(255,255,255,0.1)"}}>
              {[["Total",myList.length],["Live",myList.filter(b=>b.status==="approved").length],["Pending",myList.filter(b=>b.status==="pending").length]].map(([l,v])=>(
                <div key={l}><div style={{fontWeight:800,fontSize:22}}>{v}</div><div style={{fontSize:12,color:"rgba(255,255,255,0.3)",marginTop:2}}>{l}</div></div>
              ))}
            </div>
          </div>

          {/* Add listing form */}
          <div style={{background:"white",borderRadius:20,padding:28,marginBottom:20,border:"1.5px solid #F5EDE8"}}>
            <div style={{fontWeight:700,fontSize:17,letterSpacing:"-0.3px",marginBottom:22}}>Submit New Listing</div>
            <div style={{display:"flex",flexDirection:"column",gap:14}}>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
                <div><label style={{fontSize:11,fontWeight:700,color:"#BBB",display:"block",marginBottom:5,textTransform:"uppercase",letterSpacing:0.5}}>Name *</label>
                  <input className="inp" placeholder="Business name" value={addForm.name} onChange={e=>setAddForm(f=>({...f,name:e.target.value}))}/>
                </div>
                <div><label style={{fontSize:11,fontWeight:700,color:"#BBB",display:"block",marginBottom:5,textTransform:"uppercase",letterSpacing:0.5}}>Telugu</label>
                  <input className="inp" placeholder="తెలుగు పేరు" value={addForm.telugu} onChange={e=>setAddForm(f=>({...f,telugu:e.target.value}))}/>
                </div>
              </div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
                <div><label style={{fontSize:11,fontWeight:700,color:"#BBB",display:"block",marginBottom:5,textTransform:"uppercase",letterSpacing:0.5}}>Category *</label>
                  <select className="sel" value={addForm.category} onChange={e=>setAddForm(f=>({...f,category:e.target.value}))}>
                    {CATEGORIES.filter(c=>c!=="All").map(c=><option key={c}>{c}</option>)}
                  </select>
                </div>
                <div><label style={{fontSize:11,fontWeight:700,color:"#BBB",display:"block",marginBottom:5,textTransform:"uppercase",letterSpacing:0.5}}>Icon</label>
                  <input className="inp" placeholder="🏪" value={addForm.icon} onChange={e=>setAddForm(f=>({...f,icon:e.target.value}))}/>
                </div>
              </div>
              <div><label style={{fontSize:11,fontWeight:700,color:"#BBB",display:"block",marginBottom:5,textTransform:"uppercase",letterSpacing:0.5}}>Address *</label>
                <input className="inp" placeholder="e.g. Main Road, Siddipet" value={addForm.address} onChange={e=>setAddForm(f=>({...f,address:e.target.value}))}/>
              </div>

              {/* Phone OTP */}
              <div>
                <label style={{fontSize:11,fontWeight:700,color:"#BBB",display:"block",marginBottom:5,textTransform:"uppercase",letterSpacing:0.5}}>
                  Phone * {otpStep==="verified"&&<span style={{color:"#16A34A",textTransform:"none"}}>✓ Verified</span>}
                </label>
                <div style={{display:"flex",gap:8}}>
                  <div style={{position:"relative",flex:1}}>
                    <span style={{position:"absolute",left:14,top:"50%",transform:"translateY(-50%)",fontSize:13,color:"#AAA",fontWeight:600}}>+91</span>
                    <input className="inp" style={{paddingLeft:46,borderColor:otpStep==="verified"?"#BBF7D0":phoneErr?"#FECACA":"#EEE"}}
                      placeholder="10-digit number" maxLength={10} value={addForm.phone}
                      onChange={e=>{
                        const v=e.target.value.replace(/\D/g,"");
                        setAddForm(f=>({...f,phone:v}));
                        setPhoneErr("");
                        if(otpStep!=="idle"){setOtpStep("idle");setOtp("");}
                      }}/>
                  </div>
                  {otpStep==="idle"&&<button className="btn btn-w" style={{whiteSpace:"nowrap"}} onClick={sendOtp}>Send OTP</button>}
                  {otpStep==="sending"&&<button className="btn btn-w" disabled style={{whiteSpace:"nowrap",color:"#CCC"}}>...</button>}
                  {otpStep==="verified"&&<button className="btn btn-g" disabled style={{whiteSpace:"nowrap"}}>✓ Done</button>}
                </div>
                {otpStep==="sent"&&(
                  <div style={{marginTop:12,background:"#F0FDF4",borderRadius:14,padding:16,border:"1.5px solid #BBF7D0"}}>
                    <div style={{fontSize:12,color:"#16A34A",marginBottom:12}}>OTP sent to +91 {addForm.phone}</div>
                    <div style={{display:"flex",gap:8}}>
                      <input className="inp otp-inp" placeholder="——————" value={otp} maxLength={6}
                        onChange={e=>setOtp(e.target.value.replace(/\D/g,""))} style={{borderColor:"#BBF7D0"}}/>
                      <button className="btn btn-g" style={{whiteSpace:"nowrap"}} onClick={verifyOtp}>Verify</button>
                    </div>
                    <div style={{fontSize:12,color:"#AAA",marginTop:10,cursor:"pointer"}} onClick={()=>{setOtpStep("idle");setOtp("");}}>← Change number</div>
                  </div>
                )}
                {otpStep==="verifying"&&<div style={{marginTop:8,color:"#AAA",fontSize:12}}>Verifying...</div>}
                {phoneErr&&<div style={{marginTop:8,color:"#DC2626",fontSize:12}}>⚠ {phoneErr}</div>}
                <div id="rcv-box"></div>
              </div>

              <div><label style={{fontSize:11,fontWeight:700,color:"#BBB",display:"block",marginBottom:5,textTransform:"uppercase",letterSpacing:0.5}}>Tags</label>
                <input className="inp" placeholder="Home Delivery, Open 24hrs, Veg (comma separated)" value={addForm.tags} onChange={e=>setAddForm(f=>({...f,tags:e.target.value}))}/>
              </div>
              <button className="btn btn-o" style={{alignSelf:"flex-start",padding:"12px 28px"}} onClick={submitListing}>Submit for Review →</button>
            </div>
          </div>

          {/* My listings */}
          <div style={{fontWeight:700,fontSize:17,letterSpacing:"-0.3px",marginBottom:14}}>My Listings</div>
          {myList.length===0?(
            <div style={{background:"white",borderRadius:16,padding:28,textAlign:"center",color:"#CCC",border:"1.5px solid #F5EDE8",fontSize:14}}>No listings yet</div>
          ):(
            <div style={{display:"flex",flexDirection:"column",gap:8}}>
              {myList.map(b=>(
                <div key={b.id} style={{background:"white",borderRadius:14,padding:"16px 20px",display:"flex",justifyContent:"space-between",alignItems:"center",border:"1.5px solid #F5EDE8"}}>
                  <div style={{display:"flex",gap:12,alignItems:"center"}}>
                    <span style={{fontSize:24}}>{b.icon||"🏪"}</span>
                    <div>
                      <div style={{fontWeight:600,fontSize:14}}>{b.name}</div>
                      <div style={{color:"#CCC",fontSize:12}}>📍 {b.address}</div>
                    </div>
                  </div>
                  <span style={{padding:"4px 14px",borderRadius:50,fontSize:11,fontWeight:700,
                    background:b.status==="approved"?"#F0FDF4":b.status==="pending"?"#FFFBEB":"#FEF2F2",
                    color:b.status==="approved"?"#16A34A":b.status==="pending"?"#D97706":"#DC2626"}}>
                    {b.status==="approved"?"✓ Live":b.status==="pending"?"Pending Review":"Rejected"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ═══════════════════ ADMIN ═══════════════════ */}
      {view==="admin"&&isAdmin&&(
        <div style={{maxWidth:740,margin:"0 auto",padding:"40px 24px"}}>
          <div style={{background:"linear-gradient(135deg,#1a1208,#3d2910)",borderRadius:20,padding:28,marginBottom:28,color:"white"}}>
            <div style={{fontSize:11,color:"rgba(232,69,10,0.8)",letterSpacing:1,textTransform:"uppercase",marginBottom:8}}>⚙️ Admin Panel</div>
            <div style={{fontWeight:800,fontSize:22}}>Siddipet Bazaar</div>
            <div style={{display:"flex",gap:32,marginTop:20,paddingTop:20,borderTop:"1px solid rgba(255,255,255,0.1)"}}>
              {[["Pending",pending.length],["Approved",businesses.filter(b=>b.status==="approved").length],["Rejected",businesses.filter(b=>b.status==="rejected").length]].map(([l,v])=>(
                <div key={l}><div style={{fontWeight:800,fontSize:22}}>{v}</div><div style={{fontSize:12,color:"rgba(255,255,255,0.3)",marginTop:2}}>{l}</div></div>
              ))}
            </div>
          </div>

          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
            <div style={{fontWeight:700,fontSize:17,letterSpacing:"-0.3px"}}>Pending Approvals</div>
            <button className="btn btn-w" style={{fontSize:12,padding:"7px 16px",borderRadius:50}} onClick={loadBiz}>↺ Refresh</button>
          </div>

          {pending.length===0?(
            <div style={{background:"white",borderRadius:16,padding:28,textAlign:"center",color:"#CCC",border:"1.5px solid #F5EDE8",marginBottom:24,fontSize:14}}>
              All caught up — no pending reviews 🎉
            </div>
          ):(
            <div style={{display:"flex",flexDirection:"column",gap:12,marginBottom:32}}>
              {pending.map(b=>(
                <div key={b.id} style={{background:"white",borderRadius:18,padding:24,border:"1.5px solid #F5EDE8"}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:14}}>
                    <div style={{display:"flex",gap:14,alignItems:"center"}}>
                      <span style={{fontSize:28,width:52,height:52,background:"#FFF0EA",borderRadius:14,display:"flex",alignItems:"center",justifyContent:"center"}}>{b.icon||"🏪"}</span>
                      <div>
                        <div style={{fontWeight:700,fontSize:16}}>{b.name}</div>
                        {b.telugu&&<div style={{color:"#AAA",fontSize:13}}>{b.telugu}</div>}
                      </div>
                    </div>
                    <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:4}}>
                      <span style={{background:"#FFFBEB",color:"#D97706",borderRadius:50,padding:"3px 12px",fontSize:11,fontWeight:700}}>Pending</span>
                      {b.phoneVerified&&<span style={{fontSize:10,color:"#16A34A",fontWeight:600}}>✓ Phone Verified</span>}
                    </div>
                  </div>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,fontSize:13,color:"#AAA",marginBottom:14}}>
                    <div>📍 {b.address}</div><div>📞 {b.phone}</div>
                    <div>🏷 {b.category}</div><div>✉ {b.ownerEmail}</div>
                  </div>
                  {b.tags?.length>0&&<div style={{display:"flex",gap:5,flexWrap:"wrap",marginBottom:14}}>{b.tags.map(t=><span key={t} className="tag">{t}</span>)}</div>}
                  <div style={{display:"flex",gap:10}}>
                    <button className="btn btn-g" style={{flex:1,padding:12}} onClick={()=>approve(b.id)}>✓ Approve — Go Live</button>
                    <button className="btn btn-r" style={{flex:1,padding:12}} onClick={()=>reject(b.id)}>✕ Reject</button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div style={{fontWeight:700,fontSize:17,marginBottom:14}}>All Businesses ({businesses.length})</div>
          <div style={{display:"flex",flexDirection:"column",gap:8}}>
            {businesses.map(b=>(
              <div key={b.id} style={{background:"white",borderRadius:12,padding:"14px 18px",display:"flex",justifyContent:"space-between",alignItems:"center",border:"1.5px solid #F5EDE8"}}>
                <div style={{display:"flex",gap:10,alignItems:"center"}}>
                  <span style={{fontSize:20}}>{b.icon||"🏪"}</span>
                  <div>
                    <div style={{fontWeight:600,fontSize:13}}>{b.name}</div>
                    <div style={{color:"#CCC",fontSize:11}}>{b.category} · {b.ownerEmail}</div>
                  </div>
                </div>
                <div style={{display:"flex",gap:8,alignItems:"center"}}>
                  <span style={{padding:"3px 12px",borderRadius:50,fontSize:11,fontWeight:700,
                    background:b.status==="approved"?"#F0FDF4":b.status==="pending"?"#FFFBEB":"#FEF2F2",
                    color:b.status==="approved"?"#16A34A":b.status==="pending"?"#D97706":"#DC2626"}}>
                    {b.status}
                  </span>
                  {b.status!=="approved"&&<button className="btn btn-g" style={{fontSize:11,padding:"5px 12px"}} onClick={()=>approve(b.id)}>Approve</button>}
                  {b.status!=="rejected"&&<button className="btn btn-r" style={{fontSize:11,padding:"5px 12px"}} onClick={()=>reject(b.id)}>Reject</button>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ═══════════════════ BUSINESS DETAIL SHEET ═══════════════════ */}
      {selected&&(
        <div className="overlay" onClick={()=>{ setSelected(null); setShowReviewForm(false); }}>
          <div className="sheet" onClick={e=>e.stopPropagation()}>
            <div style={{width:36,height:4,background:"#F0F0F0",borderRadius:2,margin:"0 auto 24px"}}></div>

            {/* Header */}
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:20}}>
              <div style={{display:"flex",gap:14,alignItems:"center"}}>
                <div style={{fontSize:38,width:62,height:62,background:"#FFF0EA",borderRadius:18,display:"flex",alignItems:"center",justifyContent:"center",border:"1px solid #FFE0D0"}}>
                  {selected.icon||"🏪"}
                </div>
                <div>
                  <div style={{fontWeight:800,fontSize:18,letterSpacing:"-0.3px"}}>{selected.name}</div>
                  {selected.telugu&&<div style={{color:"#AAA",fontSize:13,marginTop:2}}>{selected.telugu}</div>}
                </div>
              </div>
              <div style={{display:"flex",gap:8,alignItems:"center"}}>
                <button className="fav-btn" onClick={()=>toggleFav(selected.id)} style={{fontSize:22}}>
                  {favourites.includes(selected.id)?"❤️":"🤍"}
                </button>
                <button onClick={()=>{ setSelected(null); setShowReviewForm(false); }} style={{background:"#F5F5F5",border:"none",borderRadius:"50%",width:34,height:34,cursor:"pointer",fontSize:15,color:"#777"}}>✕</button>
              </div>
            </div>

            {/* Meta */}
            <div style={{display:"flex",gap:8,marginBottom:18,flexWrap:"wrap",alignItems:"center"}}>
              <span style={{background:CAT_COLOR[selected.category]+"18",color:CAT_COLOR[selected.category]||"#E8450A",borderRadius:50,padding:"5px 14px",fontSize:12,fontWeight:700}}>
                {selected.category}
              </span>
              {selected.phoneVerified&&<span style={{fontSize:11,color:"#16A34A",fontWeight:700,background:"#F0FDF4",padding:"4px 12px",borderRadius:50,border:"1px solid #BBF7D0"}}>✓ Verified</span>}
              {selected.rating>0&&<span style={{fontWeight:700,fontSize:13,color:"#F59E0B"}}>★ {selected.rating} ({selected.ratingCount||0} reviews)</span>}
            </div>

            {/* Info */}
            <div style={{background:"#FFF8F2",borderRadius:16,padding:18,marginBottom:20,border:"1px solid #F5EDE8"}}>
              <div style={{fontSize:14,color:"#666",marginBottom:10,display:"flex",gap:8}}><span>📍</span><span>{selected.address}</span></div>
              <div style={{fontSize:14,color:"#666",display:"flex",gap:8}}><span>📞</span><span>+91 {selected.phone}</span></div>
            </div>

            {selected.tags?.length>0&&(
              <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:20}}>
                {selected.tags.map(t=><span key={t} className="tag">{t}</span>)}
              </div>
            )}

            {/* Action buttons */}
            <div style={{display:"flex",flexDirection:"column",gap:10,marginBottom:24}}>
              <a href={`tel:${selected.phone}`} style={{textDecoration:"none"}}>
                <button className="btn btn-o" style={{width:"100%",padding:15,fontSize:15}}>📞 Call Now</button>
              </a>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
                <a href={`https://wa.me/91${selected.phone}`} target="_blank" rel="noreferrer" style={{textDecoration:"none"}}>
                  <button className="btn btn-g" style={{width:"100%",padding:13,fontSize:14}}>💬 WhatsApp</button>
                </a>
                <a href={`https://maps.google.com/?q=${encodeURIComponent(selected.address+" Siddipet Telangana")}`} target="_blank" rel="noreferrer" style={{textDecoration:"none"}}>
                  <button className="btn btn-w" style={{width:"100%",padding:13,fontSize:14}}>🗺 Directions</button>
                </a>
              </div>
            </div>

            {/* Reviews section */}
            <div style={{borderTop:"1px solid #F5EDE8",paddingTop:20}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
                <div style={{fontWeight:700,fontSize:16}}>Reviews</div>
                {isConsumer&&!showReviewForm&&(
                  <button className="btn btn-o" style={{fontSize:12,padding:"7px 16px",borderRadius:50}} onClick={()=>setShowReviewForm(true)}>
                    + Write Review
                  </button>
                )}
                {!user&&(
                  <button className="btn btn-w" style={{fontSize:12,padding:"7px 16px",borderRadius:50}} onClick={()=>{ setSelected(null); setView("signup"); }}>
                    Sign in to review
                  </button>
                )}
              </div>

              {/* Review form */}
              {showReviewForm&&isConsumer&&(
                <div style={{background:"#FFF8F2",borderRadius:16,padding:20,marginBottom:16,border:"1.5px solid #F5EDE8"}}>
                  <div style={{fontWeight:600,fontSize:14,marginBottom:14}}>Your Review</div>

                  {/* Stars */}
                  <div style={{display:"flex",gap:4,marginBottom:14}}>
                    {[1,2,3,4,5].map(s=>(
                      <span key={s} className="star" onClick={()=>setReviewForm(f=>({...f,rating:s}))}
                        style={{color:s<=reviewForm.rating?"#F59E0B":"#DDD"}}>★</span>
                    ))}
                    <span style={{fontSize:13,color:"#AAA",marginLeft:8}}>{reviewForm.rating}/5</span>
                  </div>

                  {/* Visited checkbox */}
                  <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:14,cursor:"pointer"}}
                    onClick={()=>setReviewForm(f=>({...f,visited:!f.visited}))}>
                    <div className={`check ${reviewForm.visited?"on":""}`}>
                      {reviewForm.visited&&<span style={{color:"white",fontSize:11,fontWeight:700}}>✓</span>}
                    </div>
                    <span style={{fontSize:13,color:"#666"}}>I have personally visited this business</span>
                  </div>

                  <textarea className="inp" placeholder="Share your experience..." rows={3}
                    style={{resize:"none",lineHeight:1.6}} value={reviewForm.text}
                    onChange={e=>setReviewForm(f=>({...f,text:e.target.value}))}/>

                  {reviewErr&&<div style={{color:"#DC2626",fontSize:12,marginTop:8}}>⚠ {reviewErr}</div>}

                  <div style={{display:"flex",gap:8,marginTop:12}}>
                    <button className="btn btn-o" style={{flex:1,padding:11}} onClick={submitReview}>Submit Review</button>
                    <button className="btn btn-w" style={{padding:"11px 18px"}} onClick={()=>{ setShowReviewForm(false); setReviewErr(""); }}>Cancel</button>
                  </div>
                </div>
              )}

              {/* Reviews list */}
              {(reviews[selected.id]||[]).length===0?(
                <div style={{textAlign:"center",color:"#CCC",padding:"20px 0",fontSize:13}}>
                  No reviews yet — be the first!
                </div>
              ):(
                <div style={{display:"flex",flexDirection:"column",gap:12}}>
                  {(reviews[selected.id]||[]).map(r=>(
                    <div key={r.id} style={{background:"#FFF8F2",borderRadius:14,padding:16,border:"1px solid #F5EDE8"}}>
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
                        <div style={{fontWeight:600,fontSize:14}}>{r.userName}</div>
                        <div style={{color:"#F59E0B",fontWeight:700,fontSize:13}}>{"★".repeat(r.rating)}</div>
                      </div>
                      <div style={{fontSize:13,color:"#666",lineHeight:1.6}}>{r.text}</div>
                      <div style={{fontSize:11,color:"#CCC",marginTop:8}}>{new Date(r.createdAt).toLocaleDateString("en-IN")}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <div style={{borderTop:"1px solid #F5EDE8",color:"#DDD",textAlign:"center",padding:"20px",fontSize:12,marginTop:40}}>
        Siddipet Bazaar · సిద్దిపేట్ · Telangana · © {new Date().getFullYear()}
      </div>
    </div>
  );
}
