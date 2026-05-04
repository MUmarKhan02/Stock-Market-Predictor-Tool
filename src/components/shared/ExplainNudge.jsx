'use client';

import { useState, useEffect } from "react";

function ExplainNudge({ storageKey, text, onDismiss }) {
  var [visible, setVisible] = useState(function() {
    try { return !localStorage.getItem(storageKey); } catch(e) { return true; }
  });

  var dismiss = function() {
    try { localStorage.setItem(storageKey, "1"); } catch(e) {}
    setVisible(false);
    if (onDismiss) onDismiss();
  };

  // Auto-dismiss after 6s
  useEffect(function() {
    if (!visible) return;
    var t = setTimeout(dismiss, 6000);
    return function() { clearTimeout(t); };
  }, [visible]);

  if (!visible) return null;

  return (
    <div style={{
      display:"inline-flex", alignItems:"center", gap:8,
      padding:"6px 12px 6px 10px",
      background:"rgba(6,182,212,0.12)",
      border:"1px solid rgba(6,182,212,0.45)",
      borderRadius:20,
      fontSize:10, fontFamily:"monospace", fontWeight:700, color:"#06b6d4",
      animation:"explainPulse 1.5s ease 3",
      position:"relative",
    }}>
      <span style={{ fontSize:13 }}>💡</span>
      <span>{text}</span>
      <button onClick={dismiss} style={{
        background:"none", border:"none", cursor:"pointer",
        color:"rgba(6,182,212,0.6)", fontSize:12, lineHeight:1,
        padding:"0 0 0 4px", fontFamily:"monospace",
      }}>✕</button>
    </div>
  );
}

export default ExplainNudge;
