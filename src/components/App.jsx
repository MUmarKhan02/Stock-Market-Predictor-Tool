'use client';

import { useState, useEffect, useCallback } from "react";
import { createClient } from "../lib/supabase";

import PredictorPanel from "./predictor/PredictorPanel";
import ChartAnalysisPanel from "./chartai/ChartAnalysisPanel";
import PortfolioPanel from "./portfolio/PortfolioPanel";
import WatchlistPanel from "./watchlist/WatchlistPanel";
import AlertsNotesPanel from "./alerts/AlertsNotesPanel";
import HistoryPanel from "./history/HistoryPanel";
import AuthModal from "./auth/AuthModal";
import WelcomePrompt from "./auth/WelcomePrompt";
import OnboardingTour, { TOUR_STEPS, USER_TOUR_STEPS } from "./tours/OnboardingTour";
import { CURRENCIES, STATIC_RATES, fetchAssetInfo, loadPrefs, loadUserData, loadWatchlist, pruneOldHistory, recordPendingPrediction, savePrefs, saveUserData, saveWatchlist } from "./shared/utils";


export default function App(){
  const[mainTab,setMainTab]=useState("stocks");
  const[showCurr,setShowCurr]=useState(false);
  const[showTour,setShowTour]=useState(false); // only shown via WelcomePrompt or TOUR button
  const[user,setUser]=useState(null);
  const[showWelcome,setShowWelcome]=useState(false);
  const[guestUsage,setGuestUsage]=useState({stocks:0,crypto:0});
  const[showAuth,setShowAuth]=useState(false);
  const[authReason,setAuthReason]=useState("");
  const[authDismissable,setAuthDismissable]=useState(false);

  // ── Preferences — initialise from localStorage if user exists ──
  const[theme,setThemeState]=useState(()=>{
    try{
      const lastEmail=localStorage.getItem("mp_last_user");
      if(lastEmail){
        const prefs=loadPrefs(lastEmail);
        if(prefs.theme)return prefs.theme;
      }
    }catch(e){}
    return "dark";
  });
  const[currency,setCurrencyState]=useState(()=>{
    try{
      const lastEmail=localStorage.getItem("mp_last_user");
      if(lastEmail){
        const prefs=loadPrefs(lastEmail);
        if(prefs.currencyCode){
          const found=CURRENCIES.find(c=>c.code===prefs.currencyCode);
          if(found)return found;
        }
      }
    }catch(e){}
    return CURRENCIES[0];
  });
  const isDark=theme==="dark";

  // Wrap setters so they auto-save when user is logged in
  const setTheme=(val)=>{
    setThemeState(val);
    if(user){savePrefs(user.email,{...loadPrefs(user.email),theme:val});showPrefToast();}
  };
  const setCurrency=(val)=>{
    setCurrencyState(val);
    if(user){savePrefs(user.email,{...loadPrefs(user.email),currencyCode:val.code});showPrefToast();}
  };

  // Restore Supabase session on page load
  useEffect(()=>{
    const supabase = createClient();
    supabase.auth.getSession().then(({data:{session}})=>{
      if(session?.user){
        const u = session.user;
        const displayName = u.user_metadata?.full_name || u.email.split("@")[0];
        handleLogin({email:u.email, name:displayName, id:u.id});
      }
    });
    const {data:{subscription}} = supabase.auth.onAuthStateChange((_event, session)=>{
      if(session?.user){
        const u = session.user;
        const displayName = u.user_metadata?.full_name || u.email.split("@")[0];
        handleLogin({email:u.email, name:displayName, id:u.id});
      }
    });
    return ()=>subscription.unsubscribe();
  },[]);

  const handleLogin=(u)=>{
    // Load this user's saved preferences
    const prefs=loadPrefs(u.email);
    if(prefs.theme)setThemeState(prefs.theme);
    if(prefs.currencyCode){
      const found=CURRENCIES.find(c=>c.code===prefs.currencyCode);
      if(found)setCurrencyState(found);
    }
    // Remember last logged-in user for next visit
    try{ localStorage.setItem("mp_last_user",u.email); }catch(e){}
    // Check if this is the first time this user has logged in
    const isNewUser = !loadPrefs(u.email).hasLoggedIn;
    if (isNewUser) savePrefs(u.email, { ...loadPrefs(u.email), hasLoggedIn: true });
    setUser({ ...u, isNew: isNewUser });
    setShowAuth(false);
    setAuthReason("");
    setShowWelcome(true);
  };

  const handleLogout=async()=>{
    try{ localStorage.removeItem("mp_last_user"); }catch(e){}
    try{ const supabase=createClient(); await supabase.auth.signOut(); }catch(e){}
    setUser(null);
    setShowWelcome(false);
    setGuestUsage({stocks:0,crypto:0});
    // Reset to defaults on logout
    setThemeState("dark");
    setCurrencyState(CURRENCIES[0]);
  };

  // Called when a guest completes 1 training run — show soft gate
  // Toast for "preferences saved"
  const[prefToast,setPrefToast]=useState(false);
  const[showAlertsPanel,setShowAlertsPanel]=useState(false);
  const[showHistoryPanel,setShowHistoryPanel]=useState(false);
  const[historyKey,setHistoryKey]=useState(0); // bump to force re-render of panel

  const recordHistory=(entry)=>{
    if(!user)return;
    const existing=loadUserData(user.email,"history");
    const withTs={...entry, ts:Date.now()};
    const pruned=pruneOldHistory(existing);
    const updated=[withTs,...pruned].slice(0,200);
    saveUserData(user.email,"history",updated);
    // Also record in accuracy tracker for stock/crypto predictions
    if(entry.type==="stock"||entry.type==="crypto"){
      recordPendingPrediction(user.email,{...entry,ts:withTs.ts});
    }
    setHistoryKey(k=>k+1);
  };
  const showPrefToast=()=>{
    setPrefToast(true);
    setTimeout(()=>setPrefToast(false),2000);
  };

  const handleGuestLimit=(tab)=>{
    setGuestUsage(prev=>({...prev,[tab==="crypto"?"crypto":"stocks"]:1}));
    setAuthReason("Sign in free to run unlimited predictions, access Chart AI, Portfolio, and more.");
    setAuthDismissable(true);
    setShowAuth(true);
  };

  // Called when guest tries to open a locked tab
  const handleLockedTab=(tabLabel)=>{
    setAuthReason(`${tabLabel} is available to registered users only. Sign in for free to unlock it.`);
    setAuthDismissable(false);
    setShowAuth(true);
  };

  // Tab click handler — checks locks
  const handleTabClick=(id)=>{
    if(!user&&(id==="chartai"||id==="portfolio"||id==="watchlist")){
      handleLockedTab(id==="chartai"?"📸 Chart AI":id==="portfolio"?"💼 Portfolio":"⭐ Watchlist");
      return;
    }
    // If guest has used their free prediction and clicks the same tab, re-prompt sign in
    if(!user&&(id==="stocks"||id==="crypto")&&mainTab===id){
      setAuthReason("Sign in free to run unlimited predictions, access Chart AI, Portfolio, Watchlist, and more.");
      setAuthDismissable(true);
      setShowAuth(true);
      return;
    }
    setMainTab(id);
  };

  return(
    <div data-theme={theme} style={{background:"var(--bg)",minHeight:"100vh",fontFamily:"'Space Mono','Courier New',monospace",color:"var(--text)",overflowX:"hidden",transition:"background 0.3s,color 0.3s"}}>
      {showAuth && <AuthModal theme={theme} onLogin={handleLogin} reason={authReason} onClose={()=>setShowAuth(false)}/>}
      {showWelcome && user && (
        <WelcomePrompt
          user={user}
          theme={theme}
          onTour={()=>{ setShowWelcome(false); setShowTour(true); }}
          onSkip={()=>setShowWelcome(false)}
        />
      )}
      {showTour && <OnboardingTour
        theme={theme}
        steps={user ? USER_TOUR_STEPS : TOUR_STEPS}
        onDone={()=>setShowTour(false)}
        onStepSideEffect={user ? (effect)=>{
          if(effect==="open_alerts"){setShowHistoryPanel(false);setTimeout(()=>setShowAlertsPanel(true),100);}
          else if(effect==="open_history"){setShowAlertsPanel(false);setTimeout(()=>setShowHistoryPanel(true),100);}
          else if(effect==="close_panels"){setShowAlertsPanel(false);setShowHistoryPanel(false);}
        } : null}
      />}
      {/* ── Alerts & Notes slide-over panel ── */}
      {showAlertsPanel && (
        <>
          {/* Backdrop */}
          <div
            onClick={()=>setShowAlertsPanel(false)}
            style={{position:"fixed",inset:0,zIndex:8000,background:"rgba(0,0,0,0.45)",backdropFilter:"blur(2px)",animation:"slideIn 0.2s ease"}}
          />
          {/* Drawer */}
          <div id="tour-alerts-panel" style={{
            position:"fixed",top:0,right:0,bottom:0,zIndex:8001,
            width:"clamp(320px,90vw,480px)",
            background:"var(--bg3)",
            borderLeft:"1px solid var(--border3)",
            boxShadow:"-8px 0 40px rgba(0,0,0,0.5)",
            display:"flex",flexDirection:"column",
            animation:"slideInRight 0.28s cubic-bezier(0.22,1,0.36,1)",
            overflow:"hidden",
          }}>
            {/* Drawer header */}
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"16px 20px",borderBottom:"1px solid var(--border)",flexShrink:0}}>
              <div style={{display:"flex",alignItems:"center",gap:10}}>
                <span style={{fontSize:18}}>🔔</span>
                <div>
                  <div style={{fontFamily:"'Syne',sans-serif",fontSize:15,fontWeight:800,color:"var(--text)"}}>Alerts &amp; Notes</div>
                  <div style={{fontSize:9,color:"var(--text9)",letterSpacing:2,marginTop:1}}>ACCOUNT FEATURE</div>
                </div>
              </div>
              <button
                onClick={()=>setShowAlertsPanel(false)}
                style={{width:30,height:30,borderRadius:"50%",border:"1px solid var(--border3)",background:"var(--surface2)",color:"var(--text7)",fontSize:14,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",flexShrink:0}}>
                ✕
              </button>
            </div>
            {/* Drawer body — scrollable */}
            <div id="tour-alerts-body" style={{flex:1,overflowY:"auto",padding:"16px 20px"}}>
              <AlertsNotesPanel user={user} currency={currency} theme={theme}/>
            </div>
          </div>
        </>
      )}

      {/* ── History slide-over panel ── */}
      {showHistoryPanel && (
        <>
          <div onClick={()=>setShowHistoryPanel(false)}
            style={{position:"fixed",inset:0,zIndex:8000,background:"rgba(0,0,0,0.45)",backdropFilter:"blur(2px)",animation:"slideIn 0.2s ease"}}/>
          <div id="tour-history-panel" style={{
            position:"fixed",top:0,right:0,bottom:0,zIndex:8001,
            width:"clamp(320px,90vw,520px)",
            background:"var(--bg3)",
            borderLeft:"1px solid var(--border3)",
            boxShadow:"-8px 0 40px rgba(0,0,0,0.5)",
            display:"flex",flexDirection:"column",
            animation:"slideInRight 0.28s cubic-bezier(0.22,1,0.36,1)",
            overflow:"hidden",
          }}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"16px 20px",borderBottom:"1px solid var(--border)",flexShrink:0}}>
              <div style={{display:"flex",alignItems:"center",gap:10}}>
                <span style={{fontSize:18}}>🕐</span>
                <div>
                  <div style={{fontFamily:"'Syne',sans-serif",fontSize:15,fontWeight:800,color:"var(--text)"}}>Activity History</div>
                  <div style={{fontSize:9,color:"var(--text9)",letterSpacing:2,marginTop:1}}>PREDICTIONS · CHART ANALYSES</div>
                </div>
              </div>
              <button onClick={()=>setShowHistoryPanel(false)}
                style={{width:30,height:30,borderRadius:"50%",border:"1px solid var(--border3)",background:"var(--surface2)",color:"var(--text7)",fontSize:14,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",flexShrink:0}}>
                ✕
              </button>
            </div>
            <div id="tour-history-body" style={{flex:1,overflowY:"auto",padding:"16px 20px"}}>
              <HistoryPanel key={historyKey} user={user} currency={currency} theme={theme}/>
            </div>
          </div>
        </>
      )}

      {/* Preferences saved toast */}
      {prefToast && (
        <div style={{
          position:"fixed", bottom:24, right:24, zIndex:9999,
          background: isDark?"#1a1f2e":"#fff",
          border:"1px solid rgba(99,102,241,0.4)",
          borderRadius:12, padding:"10px 16px",
          display:"flex", alignItems:"center", gap:8,
          boxShadow:"0 8px 24px rgba(0,0,0,0.3)",
          animation:"dropIn 0.25s ease",
          fontFamily:"monospace", fontSize:12,
        }}>
          <span style={{fontSize:14}}>✅</span>
          <div>
            <div style={{fontWeight:700,color:"#818cf8",fontSize:11}}>Preferences saved</div>
            <div style={{fontSize:10,color:isDark?"#555":"#aaa",marginTop:1}}>Synced to your account</div>
          </div>
        </div>
      )}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Mono:wght@400;700&family=Syne:wght@700;800&display=swap');
        *,*::before,*::after{box-sizing:border-box;}
        html{-webkit-text-size-adjust:100%;}
        body{margin:0;padding:0;overflow-x:hidden;}
        ::-webkit-scrollbar{width:4px;height:4px;}
        ::-webkit-scrollbar-thumb{background:var(--border2);border-radius:2px;}
        input,button{-webkit-appearance:none;font-family:inherit;}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}
        @keyframes slideIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
        @keyframes dropIn{from{opacity:0;transform:translateY(-6px)}to{opacity:1;transform:translateY(0)}}
        @keyframes slideUp{from{opacity:0;transform:translate(-50%,20px)}to{opacity:1;transform:translate(-50%,0)}}
        @keyframes explainPulse{0%{box-shadow:0 0 0 0 rgba(6,182,212,0.6)}70%{box-shadow:0 0 0 8px rgba(6,182,212,0)}100%{box-shadow:0 0 0 0 rgba(6,182,212,0)}}
        /* Mobile bottom nav */
        @media(max-width:640px){
          .desktop-tabs{display:none!important;}
          .mobile-bottom-nav{display:flex!important;}
          .main-content-pad{padding-bottom:74px!important;}
        }
        @media(min-width:641px){
          .mobile-bottom-nav{display:none!important;}
          .desktop-tabs{display:flex!important;}
        }
        @keyframes slideInRight{from{transform:translateX(100%);opacity:0}to{transform:translateX(0);opacity:1}}
        @keyframes slideOutRight{from{transform:translateX(0);opacity:1}to{transform:translateX(100%);opacity:0}}
        @keyframes authShake{0%,100%{transform:translateX(0)}15%{transform:translateX(-8px)}30%{transform:translateX(8px)}45%{transform:translateX(-6px)}60%{transform:translateX(6px)}75%{transform:translateX(-3px)}90%{transform:translateX(3px)}}
        .ci:hover{background:var(--hover)!important;}
        button{cursor:pointer;}
        [data-theme="light"] input{color:var(--text);}
        [data-theme="light"] input::placeholder{color:var(--text9);}
        [data-theme="dark"] input::placeholder{color:var(--text8);}
        [data-theme="light"] .recharts-cartesian-grid-horizontal line,
        [data-theme="light"] .recharts-cartesian-grid-vertical line{stroke:rgba(0,0,0,0.06)!important;}
        [data-theme="light"] .recharts-text{fill:var(--text7)!important;}
        [data-theme="light"] .recharts-tooltip-wrapper .recharts-default-tooltip{background:var(--bg3)!important;border-color:var(--border3)!important;color:var(--text)!important;}

        [data-theme="dark"]{
          --bg:#080808; --bg2:#0d0d0d; --bg3:#111; --bg4:#161616;
          --surface:var(--surface); --surface2:var(--surface2); --surface3:var(--input-bg);
          --border:var(--border); --border2:#333; --border3:var(--border3); --border4:var(--border4);
          --text:#e0e0e0; --text2:#ccc; --text3:#bbb; --text4:#999; --text5:#888; --text6:#777; --text7:#666; --text8:#555; --text9:#444; --text10:#3a3a3a; --text11:#2a2a2a; --text12:#222;
          --hover:var(--border); --tooltip-bg:#111;
          --input-bg:var(--input-bg); --selected-bg:var(--selected-bg);
          --grid:var(--surface3); --refdim:rgba(255,107,107,0.35);
        }
        [data-theme="light"]{
          --bg:#f0f2f5; --bg2:#e8eaed; --bg3:#fff; --bg4:#f8f9fa;
          --surface:rgba(0,0,0,0.02); --surface2:rgba(0,0,0,0.03); --surface3:rgba(0,0,0,0.05);
          --border:rgba(0,0,0,0.08); --border2:#ccc; --border3:rgba(0,0,0,0.12); --border4:rgba(0,0,0,0.15);
          --text:#1a1a1a; --text2:#2a2a2a; --text3:#3a3a3a; --text4:#4a4a4a; --text5:#555; --text6:#666; --text7:#777; --text8:#888; --text9:#999; --text10:#aaa; --text11:#bbb; --text12:#ccc;
          --hover:rgba(0,0,0,0.05); --tooltip-bg:#fff;
          --input-bg:rgba(0,0,0,0.04); --selected-bg:rgba(0,0,0,0.07);
          --grid:rgba(0,0,0,0.05); --refdim:rgba(220,50,50,0.3);
        }
      `}</style>

      <div className="main-content-pad" style={{maxWidth:1100,margin:"0 auto",padding:"clamp(10px,3vw,24px)"}}>

        {/* Header row */}
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:"clamp(16px,3vw,24px)",flexWrap:"wrap",gap:12}}>
          <div>
            <div style={{display:"flex",alignItems:"center",gap:7,marginBottom:5}}>
              <div style={{width:7,height:7,borderRadius:"50%",background:mainTab==="stocks"?"#00d4aa":"#f7931a",animation:"pulse 2s infinite",transition:"background 0.3s",flexShrink:0}}/>
              <span style={{fontSize:"clamp(8px,1.8vw,10px)",color:mainTab==="stocks"?"#00d4aa":"#f7931a",letterSpacing:3,textTransform:"uppercase",transition:"color 0.3s"}}>CNN + LSTM Prediction Engine</span>
            </div>
            <h1 style={{fontFamily:"'Syne',sans-serif",fontSize:"clamp(22px,5vw,32px)",fontWeight:800,margin:0,letterSpacing:-1,lineHeight:1.1}}>
              Market <span style={{color:mainTab==="stocks"?"#00d4aa":"#f7931a",transition:"color 0.3s"}}>Predictor</span>
            </h1>
            <div style={{fontSize:"clamp(9px,2vw,11px)",color:"var(--text9)",marginTop:4}}>Stocks &amp; Crypto · Predict · Analyze · Invest</div>
          </div>

          {/* ── Right controls ── Order: Tour · History · Alerts | Theme | Currency | Account */}
          <div style={{display:"flex",alignItems:"flex-start",gap:6,flexShrink:0,flexWrap:"wrap"}}>

            {/* ── Group 1: Tour · History · Alerts ── */}
            <div style={{display:"flex",alignItems:"flex-start",gap:6,flexShrink:0}}>

              {/* Tour — always visible */}
              <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:5,flexShrink:0}}>
                <div style={{fontSize:9,color:"var(--text9)",letterSpacing:2}}>TOUR</div>
                <button onClick={()=>setShowTour(true)} title="App Tour"
                  style={{width:38,height:38,borderRadius:10,border:"1px solid rgba(167,139,250,0.35)",background:"rgba(167,139,250,0.08)",color:"#a78bfa",fontSize:16,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",transition:"all 0.2s",flexShrink:0}}>
                  ❓
                </button>
              </div>

              {/* History — logged-in only */}
              {user && (
                <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:5,flexShrink:0}}>
                  <div style={{fontSize:9,color:"var(--text9)",letterSpacing:2}}>HISTORY</div>
                  <button id="tour-history-btn" onClick={()=>setShowHistoryPanel(v=>!v)} title="Activity History"
                    style={{position:"relative",width:38,height:38,borderRadius:10,border:`1px solid ${showHistoryPanel?"rgba(56,189,248,0.6)":"var(--border3)"}`,background:showHistoryPanel?"rgba(56,189,248,0.15)":"var(--surface2)",color:showHistoryPanel?"#38bdf8":"var(--text6)",fontSize:17,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",transition:"all 0.2s",flexShrink:0}}>
                    🕐
                    {pruneOldHistory(loadUserData(user.email,"history")).length > 0 && (
                      <span style={{position:"absolute",top:-4,right:-4,minWidth:16,height:16,borderRadius:8,background:"#38bdf8",color:"#000",fontSize:8,fontWeight:800,fontFamily:"monospace",display:"flex",alignItems:"center",justifyContent:"center",padding:"0 3px",border:`2px solid ${isDark?"#0f1117":"#fff"}`}}>
                        {Math.min(99, pruneOldHistory(loadUserData(user.email,"history")).length)}
                      </span>
                    )}
                  </button>
                </div>
              )}

              {/* Alerts — logged-in only */}
              {user && (
                <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:5,flexShrink:0}}>
                  <div style={{fontSize:9,color:"var(--text9)",letterSpacing:2}}>ALERTS</div>
                  <button id="tour-alerts-btn" onClick={()=>setShowAlertsPanel(v=>!v)} title="Alerts & Notes"
                    style={{position:"relative",width:38,height:38,borderRadius:10,border:`1px solid ${showAlertsPanel?"rgba(245,158,11,0.6)":"var(--border3)"}`,background:showAlertsPanel?"rgba(245,158,11,0.15)":"var(--surface2)",color:showAlertsPanel?"#f59e0b":"var(--text6)",fontSize:17,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",transition:"all 0.2s",flexShrink:0}}>
                    🔔
                    {loadUserData(user.email,"alerts").filter(a=>!a.triggered).length > 0 && (
                      <span style={{position:"absolute",top:-4,right:-4,minWidth:16,height:16,borderRadius:8,background:"#f59e0b",color:"#000",fontSize:8,fontWeight:800,fontFamily:"monospace",display:"flex",alignItems:"center",justifyContent:"center",padding:"0 3px",border:`2px solid ${isDark?"#0f1117":"#fff"}`}}>
                        {loadUserData(user.email,"alerts").filter(a=>!a.triggered).length}
                      </span>
                    )}
                  </button>
                </div>
              )}
            </div>

            {/* ── Separator ── */}
            <div style={{width:1,alignSelf:"stretch",background:"var(--border)",margin:"0 4px",flexShrink:0}}/>

            {/* ── Group 2: Theme ── */}
            <div id="tour-theme" style={{display:"flex",flexDirection:"column",alignItems:"center",gap:5,flexShrink:0}}>
              <div style={{fontSize:9,color:"var(--text9)",letterSpacing:2}}>THEME</div>
              <button onClick={()=>setTheme(isDark?"light":"dark")}
                style={{position:"relative",width:52,height:28,borderRadius:14,border:`1px solid ${isDark?"rgba(255,255,255,0.15)":"rgba(0,0,0,0.15)"}`,background:isDark?"#1a1a1a":"#e0e0e0",cursor:"pointer",transition:"all 0.3s",padding:0,flexShrink:0}}>
                <div style={{position:"absolute",top:3,left:isDark?3:"calc(100% - 25px)",width:20,height:20,borderRadius:"50%",background:isDark?"#444":"#fff",boxShadow:isDark?"0 0 8px rgba(255,255,255,0.2)":"0 1px 4px rgba(0,0,0,0.25)",transition:"left 0.3s",display:"flex",alignItems:"center",justifyContent:"center",fontSize:11}}>
                  {isDark?"🌙":"☀"}
                </div>
              </button>
            </div>

            {/* ── Separator ── */}
            <div style={{width:1,alignSelf:"stretch",background:"var(--border)",margin:"0 4px",flexShrink:0}}/>

            {/* ── Group 3: Display Currency ── */}
            <div id="tour-currency" style={{position:"relative",flexShrink:0}}>
              <div style={{fontSize:9,color:"var(--text9)",letterSpacing:2,marginBottom:5,textAlign:"right"}}>DISPLAY CURRENCY</div>
              <button onClick={()=>setShowCurr(v=>!v)} style={{display:"flex",alignItems:"center",gap:7,padding:"clamp(8px,2vw,10px) clamp(10px,2vw,14px)",borderRadius:10,border:"1px solid var(--border4)",background:"var(--surface3)",color:"var(--text)",fontSize:"clamp(11px,2.5vw,13px)",fontWeight:700,whiteSpace:"nowrap"}}>
                <span style={{fontSize:"clamp(14px,3vw,18px)"}}>{currency.flag}</span>
                <span>{currency.symbol}</span>
                <span style={{color:"var(--text7)",fontWeight:400,fontSize:"clamp(10px,2vw,12px)"}}>{currency.code}</span>
                <span style={{color:"var(--text8)",fontSize:10}}>{showCurr?"▲":"▼"}</span>
              </button>
              {showCurr&&(
                <div style={{position:"absolute",right:0,top:"calc(100% + 6px)",background:"var(--bg3)",border:"1px solid var(--border3)",borderRadius:12,padding:6,zIndex:200,width:"clamp(180px,50vw,220px)",maxHeight:"min(320px,50vh)",overflowY:"auto",animation:"dropIn 0.2s ease",boxShadow:"0 8px 32px rgba(0,0,0,0.35)"}}>
                  {CURRENCIES.map(c=>(<div key={c.code} className="ci" onClick={()=>{setCurrency(c);setShowCurr(false);}} style={{display:"flex",alignItems:"center",gap:9,padding:"7px 11px",borderRadius:8,cursor:"pointer",background:currency.code===c.code?"var(--selected-bg)":"transparent",transition:"background 0.15s"}}>
                    <span style={{fontSize:"clamp(14px,3vw,18px)",flexShrink:0}}>{c.flag}</span>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontSize:"clamp(10px,2vw,12px)",fontWeight:700,color:currency.code===c.code?"var(--text)":"var(--text3)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{c.code} <span style={{color:"var(--text8)",fontWeight:400}}>{c.symbol}</span></div>
                      <div style={{fontSize:9,color:"var(--text8)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{c.name}</div>
                    </div>
                    {currency.code===c.code&&<span style={{color:"#00d4aa",fontSize:12,flexShrink:0}}>✓</span>}
                  </div>))}
                </div>
              )}
            </div>

            {/* ── Separator ── */}
            <div style={{width:1,alignSelf:"stretch",background:"var(--border)",margin:"0 4px",flexShrink:0}}/>

            {/* ── Group 4: Account ── */}
            {!user ? (
              <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:5,flexShrink:0}}>
                <div style={{fontSize:9,color:"var(--text9)",letterSpacing:2}}>ACCOUNT</div>
                <button onClick={()=>{setAuthReason("Sign in for unlimited predictions, Chart AI, and Portfolio tracking.");setAuthDismissable(true);setShowAuth(true);}}
                  style={{padding:"7px 14px",borderRadius:9,border:"1px solid rgba(99,102,241,0.4)",background:"rgba(99,102,241,0.12)",color:"#818cf8",fontSize:11,fontFamily:"monospace",fontWeight:700,cursor:"pointer",whiteSpace:"nowrap"}}>
                  🔑 Sign In
                </button>
              </div>
            ) : (
              <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:5,flexShrink:0}}>
                <div style={{fontSize:9,color:"var(--text9)",letterSpacing:2}}>ACCOUNT</div>
                <div style={{display:"flex",alignItems:"center",gap:6}}>
                  <div style={{position:"relative",flexShrink:0}}>
                    <div style={{width:28,height:28,borderRadius:"50%",background:"rgba(99,102,241,0.2)",border:"1.5px solid rgba(99,102,241,0.5)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:700,color:"#818cf8"}}>
                      {user.name?.charAt(0)?.toUpperCase()}
                    </div>
                    <div style={{position:"absolute",bottom:-1,right:-1,width:9,height:9,borderRadius:"50%",background:"#00d4aa",border:`2px solid ${isDark?"#0f1117":"#fff"}`}} title="Preferences synced"/>
                  </div>
                  <div style={{display:"flex",flexDirection:"column",gap:2,minWidth:0}}>
                    <div style={{fontSize:10,fontWeight:700,color:"var(--text4)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",maxWidth:90}}>{user.name}</div>
                    <button onClick={handleLogout} style={{padding:"3px 8px",borderRadius:6,border:"1px solid rgba(255,107,107,0.25)",background:"rgba(255,107,107,0.06)",color:"#ff8080",fontSize:9,fontFamily:"monospace",fontWeight:700,cursor:"pointer",whiteSpace:"nowrap",textAlign:"left"}}>
                      Sign out
                    </button>
                  </div>
                </div>
              </div>
            )}

          </div>{/* end right controls */}
        </div>

        {/* Main tabs */}
        <div id="tour-tabs" className="desktop-tabs" style={{display:"flex",gap:0,marginBottom:"clamp(16px,3vw,24px)",background:"var(--surface2)",borderRadius:14,padding:5,border:"1px solid var(--border)",width:"fit-content",maxWidth:"100%",flexWrap:"wrap"}}>
          {[["stocks","📈 Stocks","#00d4aa",false],["crypto","₿ Crypto","#f7931a",false],["chartai","📸 Chart AI","#a78bfa",true],["portfolio","💼 Portfolio","#6366f1",true],["watchlist","⭐ Watchlist","#f59e0b",true]].map(([id,label,color,requiresAuth])=>{
            const locked=requiresAuth&&!user;
            const active=mainTab===id;
            return(
              <button key={id} onClick={()=>handleTabClick(id)}
                style={{padding:"clamp(9px,2vw,12px) clamp(14px,3vw,28px)",borderRadius:10,fontSize:"clamp(10px,2.2vw,13px)",fontFamily:"'Syne',sans-serif",fontWeight:800,border:"none",background:active?`${color}20`:"transparent",color:active?color:locked?"var(--text10)":"var(--text9)",transition:"all 0.25s",letterSpacing:0.5,borderBottom:active?`2px solid ${color}`:"2px solid transparent",whiteSpace:"nowrap",position:"relative",opacity:locked?0.6:1}}>
                {label}{locked&&<span style={{fontSize:9,marginLeft:5,verticalAlign:"middle",opacity:0.7}}>🔒</span>}
              </button>
            );
          })}
        </div>

        {/* Guest usage banner */}
        {!user&&(mainTab==="stocks"||mainTab==="crypto")&&(
          <div style={{marginBottom:12,padding:"8px 14px",background:"rgba(99,102,241,0.07)",border:"1px solid rgba(99,102,241,0.18)",borderRadius:10,display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:8}}>
            <div style={{fontSize:11,color:"#818cf8"}}>
              {guestUsage[mainTab]===0
                ? `👋 You have 1 free ${mainTab==="crypto"?"crypto":"stock"} prediction as a guest.`
                : `⚡ Free prediction used. Sign in for unlimited access.`}
            </div>
            <button onClick={()=>{setAuthReason("Sign in for unlimited predictions, Chart AI, and Portfolio tracking — it's free.");setAuthDismissable(true);setShowAuth(true);}}
              style={{padding:"5px 14px",borderRadius:7,border:"1px solid rgba(99,102,241,0.35)",background:"rgba(99,102,241,0.12)",color:"#818cf8",fontSize:10,fontFamily:"monospace",fontWeight:700,cursor:"pointer",flexShrink:0}}>
              Sign In Free →
            </button>
          </div>
        )}

        {/* Panel */}
        <div key={mainTab} style={{animation:"slideIn 0.3s ease"}}>
          {mainTab==="chartai" ? <ChartAnalysisPanel theme={theme} onRecordHistory={user?recordHistory:null}/>
            : mainTab==="portfolio" ? <PortfolioPanel currency={currency} theme={theme}/>
            : mainTab==="watchlist" ? <WatchlistPanel user={user} currency={currency} theme={theme} onNavigateToPredictor={function(ticker, isCrypto){setMainTab(isCrypto?"crypto":"stocks");}}/>
            : <PredictorPanel isCrypto={mainTab==="crypto"} currency={currency} theme={theme} isGuest={!user} onGuestLimit={()=>handleGuestLimit(mainTab)} onRecordHistory={user?recordHistory:null} onAddToWatchlist={user ? function(ticker, isCrypto){ var wl=loadWatchlist(user.email); if(!wl.find(function(i){return i.ticker===ticker;})) { fetchAssetInfo(ticker,isCrypto).then(function(info){ if(info.valid){ saveWatchlist(user.email,[Object.assign({ticker:info.ticker||ticker,name:info.name||ticker,isCrypto:isCrypto,sector:info.sector||"",currentPrice:info.currentPrice||0,weekHigh52:info.weekHigh52||0,weekLow52:info.weekLow52||0,change:0,addedAt:Date.now(),lastRefreshed:Date.now()}),...wl]); }}); } } : null}/>}
        </div>

        <div style={{textAlign:"center",fontSize:"clamp(9px,1.8vw,10px)",color:"var(--text10)",marginBottom:10,lineHeight:1.7,padding:"0 10px"}}>
          ⚠ EDUCATIONAL PURPOSES ONLY · Not financial advice · Always do your own research before investing
        </div>
      </div>

      {/* ── Mobile bottom navigation ── */}
      <nav className="mobile-bottom-nav" style={{
        position:"fixed", bottom:0, left:0, right:0, zIndex:1000,
        background:"var(--bg3)",
        borderTop:"1px solid var(--border3)",
        boxShadow:"0 -4px 20px rgba(0,0,0,0.25)",
        display:"none",
        alignItems:"stretch",
        height:62,
        paddingBottom:"env(safe-area-inset-bottom)",
      }}>
        {[
          ["stocks",  "📈", "Stocks",   "#00d4aa", false],
          ["crypto",  "₿",  "Crypto",   "#f7931a", false],
          ["chartai", "📸", "Chart AI", "#a78bfa", true ],
          ["portfolio","💼","Portfolio","#6366f1", true ],
          ["watchlist","⭐","Watchlist","#f59e0b", true ],
        ].map(function(item) {
          var id = item[0], icon = item[1], label = item[2], color = item[3], requiresAuth = item[4];
          var active = mainTab === id;
          var locked = requiresAuth && !user;
          return (
            <button key={id} onClick={function(){ handleTabClick(id); }}
              style={{
                flex:1, display:"flex", flexDirection:"column", alignItems:"center",
                justifyContent:"center", gap:3, border:"none", background:"transparent",
                cursor:"pointer", padding:"6px 2px",
                color: active ? color : locked ? "var(--text11)" : "var(--text8)",
                transition:"color 0.2s",
                position:"relative",
              }}>
              {active && (
                <div style={{ position:"absolute", top:0, left:"20%", right:"20%", height:2, background:color, borderRadius:"0 0 2px 2px" }}/>
              )}
              <span style={{ fontSize:18, lineHeight:1, filter: locked ? "grayscale(1) opacity(0.4)" : "none" }}>{icon}</span>
              <span style={{ fontSize:"clamp(8px,2.5vw,9px)", fontFamily:"monospace", fontWeight:active?800:600, letterSpacing:0.5, whiteSpace:"nowrap" }}>
                {label}{locked ? " 🔒" : ""}
              </span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
