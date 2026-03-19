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

const CATEGORIES = ["All","Food","Medical","Shopping","Services","Automobile","Transport","Education"];
const CAT_EMOJI = { All:"✦", Food:"🍛", Medical:"💊", Shopping:"🛍", Services:"⚙", Automobile:"🔧", Transport:"🚌", Education:"📚" };

const TERMS = `Siddipet Bazaar — Terms & Conditions
Last updated: ${new Date().toLocaleDateString('en-IN')}

1. ACCEPTANCE
By creating an account, you agree to these terms.

2. BUSINESS LISTINGS
• All listings are reviewed by admin before going live.
• You must provide accurate business information.
• Fake or misleading listings will be removed.
• Phone number verification via OTP is mandatory.

3. PROHIBITED CONTENT
• No fake business names or addresses.
• No listings for illegal products or services.

4. PHONE VERIFICATION
• A valid Indian mobile number is required.
• We do not share your number with third parties.

5. ADMIN RIGHTS
• Admin reserves the right to approve, reject, or remove any listing without prior notice.

6. PRIVACY
• Your data is stored securely in Firebase.
• We do not sell your personal data.

7. CONTACT
For support, contact us through the app.`;

const MOCK = [
  { id:"m1", name:"Sri Lakshmi Medical", telugu:"శ్రీ లక్ష్మి మెడికల్", category:"Medical", address:"Main Road, Siddipet", phone:"9876543210", open:true, icon:"💊", tags:["24hrs","Medicines"], status:"approved", phoneVerified:true },
  { id:"m2", name:"Annapurna Tiffin Center", telugu:"అన్నపూర్ణ టిఫిన్", category:"Food", address:"Collectorate Road", phone:"9988776655", open:true, icon:"🍛", tags:["Breakfast","Veg","Lunch"], status:"approved", phoneVerified:true },
  { id:"m3", name:"Ravi Auto Works", telugu:"రవి ఆటో వర్క్స్", category:"Automobile", address:"Bus Stand Road", phone:"9123456789", open:true, icon:"🔧", tags:["Two-Wheeler","Four-Wheeler"], status:"approved", phoneVerified:true },
];

export default function App() {
  const [view, setView] = useState("home");
  const [user, setUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [businesses, setBusinesses] = useState(MOCK);
  const [search, setSearch] = useState("");
  const [activeCat, setActiveCat] = useState("All");
  const [selected, setSelected] = useState(null);
  const [lang, setLang] = useState("en");
  const [notif, setNotif] = useState(null);
  const [loading, setLoading] = useState(false);
  const [dbLoading, setDbLoading] = useState(true);
  const [showTerms, setShowTerms] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [termsError, setTermsError] = useState(false);

  const [authForm, setAuthForm] = useState({ email:"", password:"", name:"" });
  const [authErr, setAuthErr] = useState("");
  const [addForm, setAddForm] = useState({ name:"", telugu:"", category:"Food", address:"", phone:"", tags:"", icon:"🏪" });
  const [otpStep, setOtpStep] = useState("idle");
  const [otp, setOtp] = useState("");
  const [confirm, setConfirm] = useState(null);
  const [phoneErr, setPhoneErr] = useState("");

  const toast = (msg, type="ok") => { setNotif({msg,type}); setTimeout(()=>setNotif(null),3000); };

  useEffect(()=>{
    const unsub = onAuthStateChanged(auth, async (fu)=>{
      if(fu){
        const adm = await getDoc(doc(db,"admins",fu.email));
        setUser({ email:fu.email, uid:fu.uid, name:fu.displayName||fu.email.split("@")[0] });
        setIsAdmin(adm.exists());
        if(view==="login"||view==="signup") setView(adm.exists()?"admin":"dashboard");
      } else { setUser(null); setIsAdmin(false); }
    });
    return ()=>unsub();
  },[]);

  const loadBiz = async()=>{
    setDbLoading(true);
    try{
      const snap = await getDocs(collection(db,"businesses"));
      const list = snap.docs.map(d=>({id:d.id,...d.data()}));
      setBusinesses(list.length>0 ? list : MOCK);
    }catch(e){ setBusinesses(MOCK); }
    setDbLoading(false);
  };
  useEffect(()=>{ loadBiz(); },[]);

  const googleLogin = async()=>{
    if(view==="signup" && !agreed){ setTermsError(true); return; }
    setLoading(true); setAuthErr("");
    try{
      const r = await signInWithPopup(auth, new GoogleAuthProvider());
      try{ await addDoc(collection(db,"users"),{uid:r.user.uid,email:r.user.email,name:r.user.displayName||"",createdAt:new Date().toISOString()}); }catch(e){}
      toast("Welcome! 👋");
    }catch(e){ setAuthErr("Google sign-in failed. Try again."); }
    setLoading(false);
  };

  const login = async()=>{
    setLoading(true); setAuthErr("");
    try{ await signInWithEmailAndPassword(auth,authForm.email,authForm.password); toast("Welcome back!"); }
    catch(e){ setAuthErr(e.code==="auth/invalid-credential"?"Wrong email or password":"Login failed."); }
    setLoading(false);
  };

  const signup = async()=>{
    if(!agreed){ setTermsError(true); return; }
    setLoading(true); setAuthErr("");
    if(!authForm.name){ setAuthErr("Enter your business name"); setLoading(false); return; }
    try{
      const c = await createUserWithEmailAndPassword(auth,authForm.email,authForm.password);
      await addDoc(collection(db,"users"),{uid:c.user.uid,email:authForm.email,name:authForm.name,createdAt:new Date().toISOString()});
      toast("Account created! 🎉");
    }catch(e){
      setAuthErr(e.code==="auth/email-already-in-use"?"Email already registered. Login instead.":
        e.code==="auth/weak-password"?"Password needs 6+ characters":"Signup failed.");
    }
    setLoading(false);
  };

  const logout = async()=>{ await signOut(auth); setView("home"); toast("Logged out"); };

  const validatePhone = p=>{
    if(!/^\d{10}$/.test(p)) return "Enter a valid 10-digit number";
    if(!/^[6-9]/.test(p)) return "Must start with 6, 7, 8 or 9";
    return null;
  };

  const sendOtp = async()=>{
    setPhoneErr("");
    const e = validatePhone(addForm.phone);
    if(e){ setPhoneErr(e); return; }
    setOtpStep("sending");
    try{
      if(!window.rcv) window.rcv = new RecaptchaVerifier(auth,"rcv-box",{size:"invisible",callback:()=>{}});
      const r = await signInWithPhoneNumber(auth,"+91"+addForm.phone,window.rcv);
      setConfirm(r); setOtpStep("sent"); toast("OTP sent! Check your SMS 📱");
    }catch(e){
      setPhoneErr("Failed to send OTP. Try again.");
      setOtpStep("idle");
      if(window.rcv){ window.rcv.clear(); window.rcv=null; }
    }
  };

  const verifyOtp = async()=>{
    if(!otp||otp.length!==6){ setPhoneErr("Enter the 6-digit OTP"); return; }
    setOtpStep("verifying");
    try{ await confirm.confirm(otp); setOtpStep("verified"); toast("Phone verified ✓"); }
    catch(e){ setPhoneErr("Incorrect OTP. Try again."); setOtpStep("sent"); }
  };

  const submitListing = async()=>{
    if(!addForm.name||!addForm.phone||!addForm.address){ toast("Fill all required fields","err"); return; }
    if(validatePhone(addForm.phone)){ toast(validatePhone(addForm.phone),"err"); return; }
    if(otpStep!=="verified"){ toast("Verify your phone number first","err"); return; }
    try{
      await addDoc(collection(db,"businesses"),{
        ...addForm,
        tags:addForm.tags.split(",").map(t=>t.trim()).filter(Boolean),
        rating:0,open:true,status:"pending",
        ownerEmail:user.email,ownerUid:user.uid,
        submittedAt:new Date().toISOString(),phoneVerified:true
      });
      setAddForm({name:"",telugu:"",category:"Food",address:"",phone:"",tags:"",icon:"🏪"});
      setOtpStep("idle"); setOtp(""); setPhoneErr("");
      await loadBiz(); toast("Submitted for review ✓");
    }catch(e){ toast("Submission failed. Try again.","err"); }
  };

  const approve = async(id)=>{ await updateDoc(doc(db,"businesses",id),{status:"approved"}); await loadBiz(); toast("Approved ✓"); };
  const reject  = async(id)=>{ await updateDoc(doc(db,"businesses",id),{status:"rejected"}); await loadBiz(); toast("Rejected","err"); };

  const approved = businesses.filter(b=>b.status==="approved");
  const pending  = businesses.filter(b=>b.status==="pending");
  const myList   = user ? businesses.filter(b=>b.ownerEmail===user.email) : [];
  const filtered = approved.filter(b=>{
    const ms = b.name?.toLowerCase().includes(search.toLowerCase())||b.telugu?.includes(search);
    return ms&&(activeCat==="All"||b.category===activeCat);
  });

  return (
    <div style={{fontFamily:"'SF Pro Display',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif",minHeight:"100vh",background:"#FAFAFA",color:"#111"}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800&family=Noto+Sans+Telugu:wght@400;600&display=swap');
        *{box-sizing:border-box;margin:0;padding:0;}
        body{font-family:'Outfit','Noto Sans Telugu',sans-serif;}
        ::-webkit-scrollbar{width:4px;} ::-webkit-scrollbar-thumb{background:#E0E0E0;border-radius:4px;}

        .inp{width:100%;padding:13px 16px;border-radius:12px;border:1.5px solid #E8E8E8;font-family:inherit;font-size:14px;outline:none;transition:all 0.2s;background:white;color:#111;}
        .inp:focus{border-color:#111;background:white;}
        .inp::placeholder{color:#BBB;}
        .sel{width:100%;padding:13px 16px;border-radius:12px;border:1.5px solid #E8E8E8;font-family:inherit;font-size:14px;outline:none;background:white;color:#111;cursor:pointer;}

        .card{background:white;border-radius:20px;padding:22px;cursor:pointer;transition:all 0.2s ease;border:1.5px solid #F0F0F0;}
        .card:hover{border-color:#DDD;box-shadow:0 8px 32px rgba(0,0,0,0.08);transform:translateY(-2px);}

        .pill{padding:8px 16px;border-radius:50px;border:1.5px solid #E8E8E8;background:white;cursor:pointer;font-size:13px;font-weight:500;transition:all 0.2s;white-space:nowrap;font-family:inherit;color:#555;}
        .pill.on{background:#111;border-color:#111;color:white;}
        .pill:hover:not(.on){border-color:#BBB;color:#111;}

        .btn{padding:13px 22px;border-radius:12px;border:none;cursor:pointer;font-family:inherit;font-weight:600;font-size:14px;transition:all 0.2s;letter-spacing:0.1px;}
        .btn-b{background:#111;color:white;}
        .btn-b:hover{background:#222;transform:translateY(-1px);}
        .btn-b:disabled{background:#CCC;cursor:not-allowed;transform:none;}
        .btn-w{background:white;color:#111;border:1.5px solid #E0E0E0;}
        .btn-w:hover{border-color:#BBB;background:#FAFAFA;}
        .btn-g{background:#F0FDF4;color:#16A34A;border:1.5px solid #BBF7D0;}
        .btn-g:hover{background:#DCFCE7;}
        .btn-r{background:#FEF2F2;color:#DC2626;border:1.5px solid #FECACA;}
        .btn-r:hover{background:#FEE2E2;}

        .notif{position:fixed;top:20px;left:50%;transform:translateX(-50%);z-index:9999;padding:12px 22px;border-radius:50px;font-weight:600;font-size:13px;animation:popIn 0.3s cubic-bezier(0.34,1.6,0.64,1);white-space:nowrap;backdrop-filter:blur(20px);}
        @keyframes popIn{from{transform:translateX(-50%) scale(0.8) translateY(-10px);opacity:0;}to{transform:translateX(-50%) scale(1) translateY(0);opacity:1;}}

        .overlay{position:fixed;inset:0;background:rgba(0,0,0,0.4);backdrop-filter:blur(8px);z-index:1000;display:flex;align-items:flex-end;justify-content:center;}
        .sheet{background:white;border-radius:28px 28px 0 0;padding:32px;width:100%;max-width:560px;animation:sheetUp 0.35s cubic-bezier(0.34,1.3,0.64,1);max-height:90vh;overflow-y:auto;}
        @keyframes sheetUp{from{transform:translateY(100%);}to{transform:translateY(0);}}

        .center-overlay{position:fixed;inset:0;background:rgba(0,0,0,0.4);backdrop-filter:blur(8px);z-index:2000;display:flex;align-items:center;justify-content:center;padding:20px;}
        .center-card{background:white;border-radius:24px;padding:32px;width:100%;max-width:480px;max-height:80vh;overflow-y:auto;animation:popIn2 0.3s ease;}
        @keyframes popIn2{from{transform:scale(0.95);opacity:0;}to{transform:scale(1);opacity:1;}}

        .nav{background:rgba(250,250,250,0.85);backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);border-bottom:1px solid #F0F0F0;padding:0 28px;height:60px;display:flex;justify-content:space-between;align-items:center;position:sticky;top:0;z-index:100;}

        .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(290px,1fr));gap:16px;}
        .tag{display:inline-block;background:#F5F5F5;color:#777;border-radius:50px;padding:3px 10px;font-size:11px;font-weight:500;}
        .dot{width:6px;height:6px;border-radius:50%;display:inline-block;margin-right:5px;}
        .divider{display:flex;align-items:center;gap:12px;color:#CCC;font-size:12px;}
        .divider::before,.divider::after{content:'';flex:1;height:1px;background:#F0F0F0;}
        .spin{width:28px;height:28px;border:2.5px solid #F0F0F0;border-top:2.5px solid #111;border-radius:50%;animation:spin 0.7s linear infinite;margin:0 auto;}
        @keyframes spin{to{transform:rotate(360deg);}}

        .check-box{width:20px;height:20px;min-width:20px;border-radius:6px;border:2px solid #DDD;background:white;display:flex;align-items:center;justify-content:center;transition:all 0.15s;cursor:pointer;}
        .check-box.on{background:#111;border-color:#111;}

        .otp-inp{letter-spacing:12px;font-size:24px;font-weight:700;text-align:center;font-family:'Outfit',monospace;}

        @media(max-width:600px){
          .grid{grid-template-columns:1fr;}
          .nav{padding:0 16px;}
          h1{font-size:36px !important;}
        }
      `}</style>

      {/* TOAST */}
      {notif && (
        <div className="notif" style={{background:notif.type==="err"?"#FEF2F2":"white",color:notif.type==="err"?"#DC2626":"#111",border:`1px solid ${notif.type==="err"?"#FECACA":"#E8E8E8"}`,boxShadow:"0 4px 24px rgba(0,0,0,0.1)"}}>
          {notif.msg}
        </div>
      )}

      {/* TERMS MODAL */}
      {showTerms && (
        <div className="center-overlay" onClick={()=>setShowTerms(false)}>
          <div className="center-card" onClick={e=>e.stopPropagation()}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
              <div style={{fontWeight:700,fontSize:18}}>Terms & Conditions</div>
              <button onClick={()=>setShowTerms(false)} style={{background:"#F5F5F5",border:"none",borderRadius:"50%",width:32,height:32,cursor:"pointer",fontSize:16,color:"#555"}}>✕</button>
            </div>
            <pre style={{whiteSpace:"pre-wrap",fontSize:13,lineHeight:1.8,color:"#555",fontFamily:"inherit"}}>{TERMS}</pre>
            <button className="btn btn-b" style={{width:"100%",marginTop:24,padding:14}}
              onClick={()=>{ setAgreed(true); setShowTerms(false); setTermsError(false); toast("Terms accepted ✓"); }}>
              I Accept These Terms
            </button>
          </div>
        </div>
      )}

      {/* NAVBAR */}
      <nav className="nav">
        <div onClick={()=>setView("home")} style={{cursor:"pointer",display:"flex",alignItems:"center",gap:8}}>
          <div style={{width:28,height:28,background:"#111",borderRadius:8,display:"flex",alignItems:"center",justifyContent:"center",fontSize:14}}>🏪</div>
          <span style={{fontWeight:700,fontSize:16,letterSpacing:"-0.3px"}}>Siddipet Bazaar</span>
        </div>
        <div style={{display:"flex",gap:8,alignItems:"center"}}>
          <button className="btn btn-w" style={{fontSize:12,padding:"7px 14px",borderRadius:50}} onClick={()=>setLang(l=>l==="en"?"te":"en")}>
            {lang==="en"?"తె":"EN"}
          </button>
          {user ? (
            <>
              <button className="btn btn-w" style={{fontSize:12,padding:"7px 14px",borderRadius:50}} onClick={()=>setView(isAdmin?"admin":"dashboard")}>
                {isAdmin?"Admin":"My Listings"}
              </button>
              <button className="btn btn-b" style={{fontSize:12,padding:"7px 16px",borderRadius:50}} onClick={logout}>Sign out</button>
            </>
          ):(
            <>
              <button className="btn btn-w" style={{fontSize:12,padding:"7px 16px",borderRadius:50}} onClick={()=>{setView("login");setAuthErr("");}}>Sign in</button>
              <button className="btn btn-b" style={{fontSize:12,padding:"7px 16px",borderRadius:50}} onClick={()=>{setView("signup");setAuthErr("");setAgreed(false);setTermsError(false);}}>List Business</button>
            </>
          )}
        </div>
      </nav>

      {/* ── HOME ── */}
      {view==="home" && (
        <>
          {/* HERO */}
          <div style={{maxWidth:760,margin:"0 auto",padding:"72px 24px 56px",textAlign:"center"}}>
            <div style={{display:"inline-flex",alignItems:"center",gap:6,background:"#F5F5F5",borderRadius:50,padding:"6px 16px",fontSize:12,color:"#777",fontWeight:500,marginBottom:28,border:"1px solid #EBEBEB"}}>
              <span style={{width:6,height:6,borderRadius:"50%",background:"#22C55E",display:"inline-block"}}></span>
              Siddipet District · Telangana
            </div>
            <h1 style={{fontSize:52,fontWeight:800,letterSpacing:"-1.5px",lineHeight:1.08,marginBottom:18,color:"#111"}}>
              Find every local<br/>
              <span style={{color:"#555",fontWeight:300,fontStyle:"italic"}}>business near you.</span>
            </h1>
            <p style={{color:"#999",fontSize:16,marginBottom:40,lineHeight:1.6,maxWidth:480,margin:"0 auto 40px"}}>
              {lang==="en"
                ?"The most trusted directory for Siddipet — shops, doctors, food & more."
                :"సిద్దిపేటలో నమ్మకమైన వ్యాపార డైరెక్టరీ"}
            </p>

            {/* Search */}
            <div style={{position:"relative",maxWidth:480,margin:"0 auto 16px"}}>
              <span style={{position:"absolute",left:18,top:"50%",transform:"translateY(-50%)",fontSize:16,color:"#CCC"}}>⌕</span>
              <input className="inp" style={{paddingLeft:46,borderRadius:50,fontSize:15,padding:"15px 20px 15px 46px",border:"1.5px solid #E8E8E8",boxShadow:"0 2px 16px rgba(0,0,0,0.06)"}}
                placeholder={lang==="en"?"Search shops, doctors, food...":"వ్యాపారాలు వెతకండి..."}
                value={search} onChange={e=>setSearch(e.target.value)} />
            </div>

            {/* Stats row */}
            <div style={{display:"flex",justifyContent:"center",gap:40,marginTop:36}}>
              {[[""+approved.length,"Businesses"],["Verified","Listings"],["Free","To Browse"]].map(([v,l])=>(
                <div key={l} style={{textAlign:"center"}}>
                  <div style={{fontWeight:800,fontSize:20,letterSpacing:"-0.5px",color:"#111"}}>{v}</div>
                  <div style={{fontSize:12,color:"#BBB",marginTop:2}}>{l}</div>
                </div>
              ))}
            </div>
          </div>

          {/* BODY */}
          <div style={{maxWidth:760,margin:"0 auto",padding:"0 24px 60px"}}>

            {/* Category pills */}
            <div style={{display:"flex",gap:8,overflowX:"auto",paddingBottom:4,marginBottom:32}}>
              {CATEGORIES.map(c=>(
                <button key={c} className={`pill ${activeCat===c?"on":""}`} onClick={()=>setActiveCat(c)}>
                  {CAT_EMOJI[c]} {c}
                </button>
              ))}
            </div>

            {/* Section header */}
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-end",marginBottom:20}}>
              <div>
                <div style={{fontWeight:700,fontSize:18,letterSpacing:"-0.3px"}}>{activeCat==="All"?"All Businesses":activeCat}</div>
                <div style={{color:"#BBB",fontSize:13,marginTop:3}}>{filtered.length} listings</div>
              </div>
              {!user && (
                <button className="btn btn-b" style={{fontSize:12,padding:"8px 18px",borderRadius:50}} onClick={()=>setView("signup")}>
                  + List yours
                </button>
              )}
            </div>

            {dbLoading ? (
              <div style={{padding:"80px 0",textAlign:"center"}}>
                <div className="spin" style={{marginBottom:16}}></div>
                <div style={{color:"#CCC",fontSize:13}}>Loading...</div>
              </div>
            ) : filtered.length===0 ? (
              <div style={{textAlign:"center",padding:"80px 0",color:"#CCC"}}>
                <div style={{fontSize:40,marginBottom:12}}>○</div>
                <div style={{fontWeight:600,color:"#999",fontSize:16}}>Nothing here yet</div>
                <div style={{fontSize:13,marginTop:6,color:"#CCC"}}>Be the first to add a business!</div>
                {!user && <button className="btn btn-b" style={{marginTop:24}} onClick={()=>setView("signup")}>List Your Business</button>}
              </div>
            ) : (
              <div className="grid">
                {filtered.map(b=>(
                  <div key={b.id} className="card" onClick={()=>setSelected(b)}>
                    {/* Card top */}
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:16}}>
                      <div style={{fontSize:32,width:52,height:52,background:"#F7F7F7",borderRadius:14,display:"flex",alignItems:"center",justifyContent:"center",border:"1px solid #F0F0F0"}}>
                        {b.icon||"🏪"}
                      </div>
                      <div style={{display:"flex",alignItems:"center",fontSize:11,fontWeight:600}}>
                        <span className="dot" style={{background:b.open?"#22C55E":"#EF4444"}}></span>
                        <span style={{color:b.open?"#16A34A":"#DC2626"}}>{b.open?"Open":"Closed"}</span>
                      </div>
                    </div>

                    {/* Name */}
                    <div style={{fontWeight:700,fontSize:15,marginBottom:4,letterSpacing:"-0.2px"}}>
                      {lang==="te"&&b.telugu ? b.telugu : b.name}
                    </div>
                    <div style={{color:"#AAA",fontSize:12,marginBottom:14,display:"flex",alignItems:"center",gap:4}}>
                      <span style={{fontSize:10}}>📍</span> {b.address}
                    </div>

                    {/* Footer */}
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                      <span style={{background:"#F5F5F5",color:"#555",borderRadius:50,padding:"4px 12px",fontSize:11,fontWeight:600}}>{b.category}</span>
                      <div style={{display:"flex",alignItems:"center",gap:6}}>
                        {b.phoneVerified && <span style={{fontSize:10,color:"#22C55E",fontWeight:600}}>✓ Verified</span>}
                        {b.rating>0 && <span style={{fontWeight:700,fontSize:12,color:"#F59E0B"}}>★ {b.rating}</span>}
                      </div>
                    </div>

                    {b.tags?.length>0 && (
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

      {/* ── LOGIN ── */}
      {view==="login" && (
        <div style={{minHeight:"85vh",display:"flex",alignItems:"center",justifyContent:"center",padding:24}}>
          <div style={{background:"white",borderRadius:24,padding:40,width:"100%",maxWidth:400,border:"1.5px solid #F0F0F0",boxShadow:"0 20px 60px rgba(0,0,0,0.07)"}}>
            <div style={{marginBottom:32}}>
              <div style={{fontWeight:800,fontSize:24,letterSpacing:"-0.5px",marginBottom:6}}>Sign in</div>
              <div style={{color:"#AAA",fontSize:14}}>Welcome back to Siddipet Bazaar</div>
            </div>
            <div style={{display:"flex",flexDirection:"column",gap:12}}>
              <button className="btn btn-w" onClick={googleLogin} disabled={loading}
                style={{width:"100%",padding:13,display:"flex",alignItems:"center",justifyContent:"center",gap:10,fontSize:14,borderRadius:12}}>
                <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" width="17"/>
                Continue with Google
              </button>
              <div className="divider">or</div>
              <input className="inp" type="email" placeholder="Email address" value={authForm.email} onChange={e=>setAuthForm(f=>({...f,email:e.target.value}))}/>
              <input className="inp" type="password" placeholder="Password" value={authForm.password}
                onChange={e=>setAuthForm(f=>({...f,password:e.target.value}))}
                onKeyDown={e=>e.key==="Enter"&&login()}/>
              {authErr && <div style={{background:"#FEF2F2",color:"#DC2626",borderRadius:10,padding:"10px 14px",fontSize:13}}>⚠ {authErr}</div>}
              <button className="btn btn-b" style={{width:"100%",padding:14,marginTop:4}} onClick={login} disabled={loading}>
                {loading?"Signing in...":"Sign In"}
              </button>
              <div style={{textAlign:"center",color:"#AAA",fontSize:13}}>
                No account? <span style={{color:"#111",cursor:"pointer",fontWeight:600}} onClick={()=>{setView("signup");setAgreed(false);setTermsError(false);}}>Sign up</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── SIGNUP ── */}
      {view==="signup" && (
        <div style={{minHeight:"85vh",display:"flex",alignItems:"center",justifyContent:"center",padding:24}}>
          <div style={{background:"white",borderRadius:24,padding:40,width:"100%",maxWidth:420,border:"1.5px solid #F0F0F0",boxShadow:"0 20px 60px rgba(0,0,0,0.07)"}}>
            <div style={{marginBottom:32}}>
              <div style={{fontWeight:800,fontSize:24,letterSpacing:"-0.5px",marginBottom:6}}>List your business</div>
              <div style={{color:"#AAA",fontSize:14}}>Submit · Admin reviews · Goes live</div>
            </div>
            <div style={{display:"flex",flexDirection:"column",gap:12}}>

              {/* Terms checkbox — must be FIRST */}
              <div style={{background:termsError?"#FEF2F2":"#F7F7F7",borderRadius:14,padding:14,border:`1.5px solid ${termsError?"#FECACA":"#F0F0F0"}`}}>
                <div style={{display:"flex",alignItems:"flex-start",gap:12,cursor:"pointer"}} onClick={()=>{ if(agreed){setAgreed(false);}else{setShowTerms(true);} }}>
                  <div className={`check-box ${agreed?"on":""}`}>
                    {agreed && <span style={{color:"white",fontSize:12,fontWeight:700}}>✓</span>}
                  </div>
                  <div style={{fontSize:13,color:"#555",lineHeight:1.5}}>
                    I agree to the{" "}
                    <span style={{color:"#111",fontWeight:600,textDecoration:"underline",cursor:"pointer"}}
                      onClick={e=>{e.stopPropagation();setShowTerms(true);}}>
                      Terms & Conditions
                    </span>
                    {" "}of Siddipet Bazaar
                  </div>
                </div>
                {termsError && <div style={{color:"#DC2626",fontSize:12,marginTop:8,marginLeft:32}}>Please accept the terms to continue</div>}
              </div>

              {/* Google */}
              <button className="btn btn-w" onClick={googleLogin} disabled={loading}
                style={{width:"100%",padding:13,display:"flex",alignItems:"center",justifyContent:"center",gap:10,fontSize:14,borderRadius:12,opacity:agreed?1:0.45}}>
                <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" width="17"/>
                Continue with Google
              </button>

              <div className="divider">or sign up with email</div>

              <input className="inp" placeholder="Business name" value={authForm.name} onChange={e=>setAuthForm(f=>({...f,name:e.target.value}))}/>
              <input className="inp" type="email" placeholder="Email address" value={authForm.email} onChange={e=>setAuthForm(f=>({...f,email:e.target.value}))}/>
              <input className="inp" type="password" placeholder="Password (min 6 chars)" value={authForm.password} onChange={e=>setAuthForm(f=>({...f,password:e.target.value}))}/>

              {authErr && <div style={{background:"#FEF2F2",color:"#DC2626",borderRadius:10,padding:"10px 14px",fontSize:13}}>⚠ {authErr}</div>}

              <button className="btn btn-b" style={{width:"100%",padding:14,opacity:agreed?1:0.45}} onClick={signup} disabled={loading||!agreed}>
                {loading?"Creating account...":"Create Account"}
              </button>
              <div style={{textAlign:"center",color:"#AAA",fontSize:13}}>
                Have an account? <span style={{color:"#111",cursor:"pointer",fontWeight:600}} onClick={()=>setView("login")}>Sign in</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── DASHBOARD ── */}
      {view==="dashboard" && user && (
        <div style={{maxWidth:700,margin:"0 auto",padding:"40px 24px"}}>

          {/* Profile */}
          <div style={{background:"#111",borderRadius:20,padding:28,marginBottom:24,color:"white"}}>
            <div style={{fontSize:11,color:"#777",letterSpacing:1,textTransform:"uppercase",marginBottom:8}}>Business Owner</div>
            <div style={{fontWeight:800,fontSize:22,letterSpacing:"-0.5px",marginBottom:4}}>{user.name}</div>
            <div style={{color:"#555",fontSize:13}}>{user.email}</div>
            <div style={{display:"flex",gap:28,marginTop:20,paddingTop:20,borderTop:"1px solid #222"}}>
              {[["Listings",myList.length],["Live",myList.filter(b=>b.status==="approved").length],["Pending",myList.filter(b=>b.status==="pending").length]].map(([l,v])=>(
                <div key={l}>
                  <div style={{fontWeight:800,fontSize:22}}>{v}</div>
                  <div style={{fontSize:12,color:"#555",marginTop:2}}>{l}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Submit form */}
          <div style={{background:"white",borderRadius:20,padding:28,marginBottom:20,border:"1.5px solid #F0F0F0"}}>
            <div style={{fontWeight:700,fontSize:17,letterSpacing:"-0.3px",marginBottom:22}}>Submit New Listing</div>
            <div style={{display:"flex",flexDirection:"column",gap:14}}>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
                <div><label style={{fontSize:11,fontWeight:600,color:"#AAA",display:"block",marginBottom:5,textTransform:"uppercase",letterSpacing:0.5}}>Name *</label>
                  <input className="inp" placeholder="Business name" value={addForm.name} onChange={e=>setAddForm(f=>({...f,name:e.target.value}))}/>
                </div>
                <div><label style={{fontSize:11,fontWeight:600,color:"#AAA",display:"block",marginBottom:5,textTransform:"uppercase",letterSpacing:0.5}}>Telugu</label>
                  <input className="inp" placeholder="తెలుగు పేరు" value={addForm.telugu} onChange={e=>setAddForm(f=>({...f,telugu:e.target.value}))}/>
                </div>
              </div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
                <div><label style={{fontSize:11,fontWeight:600,color:"#AAA",display:"block",marginBottom:5,textTransform:"uppercase",letterSpacing:0.5}}>Category *</label>
                  <select className="sel" value={addForm.category} onChange={e=>setAddForm(f=>({...f,category:e.target.value}))}>
                    {CATEGORIES.filter(c=>c!=="All").map(c=><option key={c}>{c}</option>)}
                  </select>
                </div>
                <div><label style={{fontSize:11,fontWeight:600,color:"#AAA",display:"block",marginBottom:5,textTransform:"uppercase",letterSpacing:0.5}}>Icon</label>
                  <input className="inp" placeholder="🏪" value={addForm.icon} onChange={e=>setAddForm(f=>({...f,icon:e.target.value}))}/>
                </div>
              </div>
              <div><label style={{fontSize:11,fontWeight:600,color:"#AAA",display:"block",marginBottom:5,textTransform:"uppercase",letterSpacing:0.5}}>Address *</label>
                <input className="inp" placeholder="e.g. Main Road, Siddipet" value={addForm.address} onChange={e=>setAddForm(f=>({...f,address:e.target.value}))}/>
              </div>

              {/* OTP phone */}
              <div>
                <label style={{fontSize:11,fontWeight:600,color:"#AAA",display:"block",marginBottom:5,textTransform:"uppercase",letterSpacing:0.5}}>
                  Phone * {otpStep==="verified"&&<span style={{color:"#16A34A",textTransform:"none",letterSpacing:0}}>✓ Verified</span>}
                </label>
                <div style={{display:"flex",gap:8}}>
                  <div style={{position:"relative",flex:1}}>
                    <span style={{position:"absolute",left:14,top:"50%",transform:"translateY(-50%)",fontSize:13,color:"#AAA",fontWeight:600}}>+91</span>
                    <input className="inp" style={{paddingLeft:46,borderColor:otpStep==="verified"?"#BBF7D0":phoneErr?"#FECACA":"#E8E8E8"}}
                      placeholder="10-digit number" maxLength={10}
                      value={addForm.phone}
                      onChange={e=>{
                        const v=e.target.value.replace(/\D/g,"");
                        setAddForm(f=>({...f,phone:v}));
                        setPhoneErr("");
                        if(otpStep!=="idle"){setOtpStep("idle");setOtp("");}
                      }}/>
                  </div>
                  {otpStep==="idle" && <button className="btn btn-w" style={{whiteSpace:"nowrap"}} onClick={sendOtp}>Send OTP</button>}
                  {otpStep==="sending" && <button className="btn btn-w" disabled style={{whiteSpace:"nowrap",color:"#CCC"}}>⏳</button>}
                  {otpStep==="verified" && <button className="btn btn-g" disabled style={{whiteSpace:"nowrap"}}>✓ Done</button>}
                </div>

                {otpStep==="sent" && (
                  <div style={{marginTop:12,background:"#F0FDF4",borderRadius:14,padding:16,border:"1.5px solid #BBF7D0"}}>
                    <div style={{fontSize:12,color:"#16A34A",marginBottom:12,fontWeight:500}}>
                      OTP sent to +91 {addForm.phone}
                    </div>
                    <div style={{display:"flex",gap:8}}>
                      <input className="inp otp-inp" placeholder="——————" value={otp} maxLength={6}
                        onChange={e=>setOtp(e.target.value.replace(/\D/g,""))}
                        style={{background:"white",borderColor:"#BBF7D0"}}/>
                      <button className="btn btn-g" style={{whiteSpace:"nowrap"}} onClick={verifyOtp}>Verify</button>
                    </div>
                    <div style={{fontSize:12,color:"#AAA",marginTop:10,cursor:"pointer"}} onClick={()=>{setOtpStep("idle");setOtp("");}}>
                      ← Change number
                    </div>
                  </div>
                )}
                {otpStep==="verifying" && <div style={{marginTop:8,color:"#AAA",fontSize:12}}>Verifying...</div>}
                {phoneErr && <div style={{marginTop:8,color:"#DC2626",fontSize:12}}>⚠ {phoneErr}</div>}
                <div id="rcv-box"></div>
              </div>

              <div><label style={{fontSize:11,fontWeight:600,color:"#AAA",display:"block",marginBottom:5,textTransform:"uppercase",letterSpacing:0.5}}>Tags</label>
                <input className="inp" placeholder="Home Delivery, Open 24hrs, Veg (comma separated)" value={addForm.tags} onChange={e=>setAddForm(f=>({...f,tags:e.target.value}))}/>
              </div>

              <button className="btn btn-b" style={{alignSelf:"flex-start",padding:"12px 28px"}} onClick={submitListing}>
                Submit for Review →
              </button>
            </div>
          </div>

          {/* My listings */}
          <div style={{fontWeight:700,fontSize:17,letterSpacing:"-0.3px",marginBottom:16}}>My Listings</div>
          {myList.length===0 ? (
            <div style={{background:"white",borderRadius:16,padding:32,textAlign:"center",color:"#CCC",border:"1.5px solid #F0F0F0",fontSize:14}}>
              No listings yet
            </div>
          ):(
            <div style={{display:"flex",flexDirection:"column",gap:8}}>
              {myList.map(b=>(
                <div key={b.id} style={{background:"white",borderRadius:14,padding:"16px 20px",display:"flex",justifyContent:"space-between",alignItems:"center",border:"1.5px solid #F0F0F0"}}>
                  <div style={{display:"flex",gap:12,alignItems:"center"}}>
                    <span style={{fontSize:24}}>{b.icon||"🏪"}</span>
                    <div>
                      <div style={{fontWeight:600,fontSize:14}}>{b.name}</div>
                      <div style={{color:"#AAA",fontSize:12}}>📍 {b.address}</div>
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

      {/* ── ADMIN ── */}
      {view==="admin" && isAdmin && (
        <div style={{maxWidth:740,margin:"0 auto",padding:"40px 24px"}}>
          <div style={{background:"#111",borderRadius:20,padding:28,marginBottom:28,color:"white"}}>
            <div style={{fontSize:11,color:"#555",letterSpacing:1,textTransform:"uppercase",marginBottom:8}}>Admin Panel</div>
            <div style={{fontWeight:800,fontSize:22,letterSpacing:"-0.5px"}}>Siddipet Bazaar</div>
            <div style={{display:"flex",gap:32,marginTop:20,paddingTop:20,borderTop:"1px solid #222"}}>
              {[["Pending",pending.length],["Approved",businesses.filter(b=>b.status==="approved").length],["Rejected",businesses.filter(b=>b.status==="rejected").length]].map(([l,v])=>(
                <div key={l}><div style={{fontWeight:800,fontSize:22}}>{v}</div><div style={{fontSize:12,color:"#555",marginTop:2}}>{l}</div></div>
              ))}
            </div>
          </div>

          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
            <div style={{fontWeight:700,fontSize:17,letterSpacing:"-0.3px"}}>Pending Approvals</div>
            <button className="btn btn-w" style={{fontSize:12,padding:"7px 16px",borderRadius:50}} onClick={loadBiz}>↺ Refresh</button>
          </div>

          {pending.length===0 ? (
            <div style={{background:"white",borderRadius:16,padding:32,textAlign:"center",color:"#CCC",border:"1.5px solid #F0F0F0",fontSize:14,marginBottom:24}}>
              All caught up — no pending reviews
            </div>
          ):(
            <div style={{display:"flex",flexDirection:"column",gap:12,marginBottom:32}}>
              {pending.map(b=>(
                <div key={b.id} style={{background:"white",borderRadius:18,padding:24,border:"1.5px solid #F0F0F0"}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:16}}>
                    <div style={{display:"flex",gap:14,alignItems:"center"}}>
                      <span style={{fontSize:30,width:52,height:52,background:"#F7F7F7",borderRadius:14,display:"flex",alignItems:"center",justifyContent:"center",border:"1px solid #F0F0F0"}}>{b.icon||"🏪"}</span>
                      <div>
                        <div style={{fontWeight:700,fontSize:16,letterSpacing:"-0.2px"}}>{b.name}</div>
                        {b.telugu&&<div style={{color:"#AAA",fontSize:13}}>{b.telugu}</div>}
                      </div>
                    </div>
                    <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:4}}>
                      <span style={{background:"#FFFBEB",color:"#D97706",borderRadius:50,padding:"3px 12px",fontSize:11,fontWeight:700}}>Pending</span>
                      {b.phoneVerified&&<span style={{fontSize:10,color:"#16A34A",fontWeight:600}}>✓ Phone Verified</span>}
                    </div>
                  </div>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,fontSize:13,color:"#999",marginBottom:16}}>
                    <div>📍 {b.address}</div><div>📞 {b.phone}</div>
                    <div>🏷 {b.category}</div><div>✉ {b.ownerEmail}</div>
                  </div>
                  {b.tags?.length>0&&<div style={{display:"flex",gap:5,flexWrap:"wrap",marginBottom:16}}>{b.tags.map(t=><span key={t} className="tag">{t}</span>)}</div>}
                  <div style={{display:"flex",gap:10}}>
                    <button className="btn btn-g" style={{flex:1,padding:12}} onClick={()=>approve(b.id)}>✓ Approve</button>
                    <button className="btn btn-r" style={{flex:1,padding:12}} onClick={()=>reject(b.id)}>✕ Reject</button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div style={{fontWeight:700,fontSize:17,letterSpacing:"-0.3px",marginBottom:14}}>All Businesses ({businesses.length})</div>
          <div style={{display:"flex",flexDirection:"column",gap:8}}>
            {businesses.map(b=>(
              <div key={b.id} style={{background:"white",borderRadius:12,padding:"14px 18px",display:"flex",justifyContent:"space-between",alignItems:"center",border:"1.5px solid #F0F0F0"}}>
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

      {/* BUSINESS DETAIL SHEET */}
      {selected && (
        <div className="overlay" onClick={()=>setSelected(null)}>
          <div className="sheet" onClick={e=>e.stopPropagation()}>

            {/* Handle bar */}
            <div style={{width:36,height:4,background:"#F0F0F0",borderRadius:2,margin:"0 auto 28px"}}></div>

            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:24}}>
              <div style={{display:"flex",gap:16,alignItems:"center"}}>
                <div style={{fontSize:40,width:64,height:64,background:"#F7F7F7",borderRadius:18,display:"flex",alignItems:"center",justifyContent:"center",border:"1px solid #F0F0F0"}}>
                  {selected.icon||"🏪"}
                </div>
                <div>
                  <div style={{fontWeight:800,fontSize:19,letterSpacing:"-0.4px"}}>{selected.name}</div>
                  {selected.telugu&&<div style={{color:"#AAA",fontSize:13,marginTop:2}}>{selected.telugu}</div>}
                </div>
              </div>
              <button onClick={()=>setSelected(null)} style={{background:"#F5F5F5",border:"none",borderRadius:"50%",width:34,height:34,cursor:"pointer",fontSize:16,color:"#555",display:"flex",alignItems:"center",justifyContent:"center"}}>✕</button>
            </div>

            {/* Meta row */}
            <div style={{display:"flex",gap:8,marginBottom:20,flexWrap:"wrap",alignItems:"center"}}>
              <span style={{background:"#F5F5F5",color:"#555",borderRadius:50,padding:"5px 14px",fontSize:12,fontWeight:600}}>{selected.category}</span>
              <span style={{display:"flex",alignItems:"center",fontSize:12,fontWeight:600}}>
                <span className="dot" style={{background:selected.open?"#22C55E":"#EF4444"}}></span>
                <span style={{color:selected.open?"#16A34A":"#DC2626"}}>{selected.open?"Open Now":"Closed"}</span>
              </span>
              {selected.phoneVerified&&<span style={{fontSize:11,color:"#16A34A",fontWeight:600,background:"#F0FDF4",padding:"4px 10px",borderRadius:50}}>✓ Verified</span>}
            </div>

            {/* Info box */}
            <div style={{background:"#F9F9F9",borderRadius:16,padding:18,marginBottom:24,border:"1px solid #F0F0F0"}}>
              <div style={{fontSize:14,color:"#555",marginBottom:10,display:"flex",alignItems:"center",gap:8}}>
                <span>📍</span><span>{selected.address}</span>
              </div>
              <div style={{fontSize:14,color:"#555",display:"flex",alignItems:"center",gap:8}}>
                <span>📞</span><span>+91 {selected.phone}</span>
              </div>
            </div>

            {selected.tags?.length>0&&(
              <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:24}}>
                {selected.tags.map(t=><span key={t} className="tag">{t}</span>)}
              </div>
            )}

            {/* Action buttons */}
            <div style={{display:"flex",flexDirection:"column",gap:10}}>
              <a href={`tel:${selected.phone}`} style={{textDecoration:"none"}}>
                <button className="btn btn-b" style={{width:"100%",padding:15,fontSize:15}}>Call Now</button>
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
          </div>
        </div>
      )}

      {/* FOOTER */}
      <div style={{borderTop:"1px solid #F0F0F0",color:"#DDD",textAlign:"center",padding:"20px",fontSize:12,marginTop:40}}>
        Siddipet Bazaar · సిద్దిపేట్ · Telangana
      </div>
    </div>
  );
}
