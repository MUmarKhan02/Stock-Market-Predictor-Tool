'use client';

import { useState, useEffect } from "react";

function WelcomePrompt({ user, theme, onTour, onSkip }) {
  const isDark = theme === "dark";
  const isNew = user?.isNew;
  const firstName = user?.name?.split(" ")[0] || "there";

  // Auto-dismiss toast for returning users after 3s
  useEffect(function() {
    if (!isNew) {
      var t = setTimeout(onSkip, 3000);
      return function() { clearTimeout(t); };
    }
  }, [isNew]);

  // ── Returning user: small auto-dismissing toast ──────────────
  if (!isNew) {
    return (
      <div onClick={onSkip} style={{
        position:"fixed", bottom:24, left:"50%", transform:"translateX(-50%)",
        zIndex:9101, display:"flex", alignItems:"center", gap:10,
        background:isDark?"rgba(15,17,23,0.95)":"rgba(255,255,255,0.97)",
        border:isDark?"1px solid rgba(255,255,255,0.1)":"1px solid rgba(0,0,0,0.1)",
        borderRadius:14, padding:"12px 18px",
        boxShadow:isDark?"0 8px 32px rgba(0,0,0,0.7)":"0 8px 32px rgba(0,0,0,0.12)",
        fontFamily:"'Space Mono','Courier New',monospace",
        animation:"slideUp 0.35s cubic-bezier(0.22,1,0.36,1)",
        cursor:"pointer", maxWidth:"clamp(260px,90vw,380px)",
        whiteSpace:"nowrap",
      }}>
        <div style={{ width:32, height:32, borderRadius:"50%", background:"rgba(99,102,241,0.15)", border:"1.5px solid rgba(99,102,241,0.4)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:14, fontWeight:800, color:"#818cf8", flexShrink:0 }}>
          {user?.name?.charAt(0)?.toUpperCase() || "👋"}
        </div>
        <div style={{ minWidth:0 }}>
          <div style={{ fontSize:"clamp(11px,2vw,13px)", fontWeight:700, color:isDark?"#e0e0e0":"#1a1a1a" }}>
            Welcome back, {firstName}! 👋
          </div>
          <div style={{ fontSize:9, color:isDark?"#555":"#aaa", marginTop:2 }}>
            Tap to dismiss
          </div>
        </div>
      </div>
    );
  }

  // ── New user: full modal with tour offer ─────────────────────
  const card = isDark
    ? { bg:"#0f1117", border:"rgba(255,255,255,0.1)", text:"#e0e0e0", sub:"#666" }
    : { bg:"#ffffff", border:"rgba(0,0,0,0.1)",       text:"#1a1a1a", sub:"#aaa" };

  return (
    <>
      <div style={{ position:"fixed", inset:0, zIndex:9100, background:"rgba(0,0,0,0.5)", backdropFilter:"blur(4px)", animation:"slideIn 0.2s ease" }} />
      <div style={{
        position:"fixed", top:"50%", left:"50%", transform:"translate(-50%,-50%)",
        zIndex:9101, width:"clamp(300px,88vw,420px)",
        background:card.bg, border:"1px solid "+card.border,
        borderRadius:22, padding:"clamp(28px,5vw,40px) clamp(24px,5vw,36px)",
        boxShadow:isDark?"0 32px 80px rgba(0,0,0,0.9)":"0 32px 80px rgba(0,0,0,0.18)",
        fontFamily:"'Space Mono','Courier New',monospace",
        animation:"dropIn 0.3s cubic-bezier(0.22,1,0.36,1)",
        textAlign:"center",
      }}>
        <div style={{ position:"absolute", top:-50, right:-50, width:160, height:160, borderRadius:"50%", background:"radial-gradient(circle, rgba(99,102,241,0.12) 0%, transparent 70%)", pointerEvents:"none" }} />
        <div style={{ width:60, height:60, borderRadius:"50%", background:"rgba(99,102,241,0.18)", border:"2px solid rgba(99,102,241,0.45)", display:"flex", alignItems:"center", justifyContent:"center", margin:"0 auto 16px", fontSize:24, fontWeight:800, color:"#818cf8", fontFamily:"'Syne',sans-serif" }}>
          {user?.name?.charAt(0)?.toUpperCase() || "👋"}
        </div>
        <div style={{ fontFamily:"'Syne',sans-serif", fontSize:"clamp(17px,3.5vw,22px)", fontWeight:800, color:card.text, marginBottom:8, lineHeight:1.2 }}>
          Welcome, {firstName}! &#127881;
        </div>
        <div style={{ fontSize:"clamp(11px,2vw,13px)", color:card.sub, lineHeight:1.75, marginBottom:24 }}>
          Your account is all set. Market Predictor gives you AI-powered stock &amp; crypto predictions, chart analysis, portfolio tracking, and more.
        </div>
        <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
          <button onClick={onTour} style={{
            width:"100%", padding:"13px", borderRadius:12,
            border:"1px solid rgba(99,102,241,0.5)", background:"rgba(99,102,241,0.2)",
            color:"#818cf8", fontSize:13, fontFamily:"monospace", fontWeight:800,
            letterSpacing:0.5, cursor:"pointer", transition:"all 0.2s",
          }}>
            &#128506;&#65039; Show me around
          </button>
          <button onClick={onSkip} style={{
            width:"100%", padding:"11px", borderRadius:12,
            border:"1px solid rgba(255,255,255,0.08)", background:"transparent",
            color:card.sub, fontSize:12, fontFamily:"monospace", fontWeight:700,
            cursor:"pointer", transition:"all 0.2s",
          }}>
            Skip for now
          </button>
        </div>
        <div style={{ marginTop:14, fontSize:9, color:isDark?"#333":"#ccc", letterSpacing:1 }}>
          You can replay the tour any time via the &#10067; button
        </div>
      </div>
    </>
  );
}

export default WelcomePrompt;
