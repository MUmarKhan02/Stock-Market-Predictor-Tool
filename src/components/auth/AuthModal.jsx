'use client';

import { useState } from "react";
import { createClient } from "../../lib/supabase";

function validateEmail(e) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
}

// Auth input field — defined at top level so it never remounts on parent re-render
function AuthField({ label, icon, type, value, onChange, onEnter, placeholder, autoComplete, hasError, showToggle, toggleState, onToggle, isDark, inputBg, inputBorder, labelColor, textColor }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontSize: 10, color: labelColor, letterSpacing: 2, marginBottom: 6, textTransform: "uppercase" }}>{label}</div>
      <div style={{ position: "relative" }}>
        <span style={{ position: "absolute", left: 13, top: "50%", transform: "translateY(-50%)", fontSize: 13, opacity: 0.4, pointerEvents: "none" }}>{icon}</span>
        <input
          type={showToggle ? (toggleState ? "text" : "password") : type}
          value={value}
          onChange={onChange}
          onKeyDown={e => e.key === "Enter" && onEnter && onEnter()}
          placeholder={placeholder}
          autoComplete={autoComplete}
          style={{
            width: "100%", padding: `12px ${showToggle ? "42px" : "14px"} 12px 38px`,
            borderRadius: 10, fontSize: 13, fontFamily: "monospace",
            background: inputBg,
            border: `1.5px solid ${hasError ? "#ff6b6b" : inputBorder}`,
            color: textColor, outline: "none", transition: "border-color 0.2s", boxSizing: "border-box",
          }}
        />
        {showToggle && (
          <button onClick={onToggle} style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", fontSize: 13, opacity: 0.45, padding: 2 }}>
            {toggleState ? "🙈" : "👁"}
          </button>
        )}
      </div>
    </div>
  );
}

function AuthModal({ theme, onLogin, reason, onClose }) {
  const isDark = theme === "dark";
  const [panel, setPanel]         = useState("login"); // "login" | "signup"
  const [panelAnim, setPanelAnim] = useState(true);

  // Shared fields
  const [email, setEmail]         = useState("");
  const [password, setPassword]   = useState("");
  const [showPw, setShowPw]       = useState(false);
  const [error, setError]         = useState("");
  const [success, setSuccess]     = useState("");
  const [loading, setLoading]     = useState(false);
  const [shake, setShake]         = useState(false);
  const [fieldErr, setFieldErr]   = useState({ email: false, password: false, name: false });

  // Signup-only fields
  const [name, setName]           = useState("");
  const [showConfirm, setShowConfirm] = useState(false);
  const [confirm, setConfirm]     = useState("");
  const [fieldErrConfirm, setFieldErrConfirm] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const switchPanel = (to) => {
    setPanelAnim(false);
    setError(""); setSuccess("");
    setFieldErr({ email: false, password: false, name: false });
    setFieldErrConfirm(false);
    setTimeout(() => { setPanel(to); setPanelAnim(true); }, 160);
  };

  const triggerShake = () => {
    setShake(true);
    setTimeout(() => setShake(false), 500);
  };

  const handleGoogleAuth = async () => {
    setGoogleLoading(true);
    setError("");
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: window.location.origin + "/auth/callback" },
      });
      if (error) { setError(error.message); setGoogleLoading(false); }
      // On success the page redirects — no need to setGoogleLoading(false)
    } catch(e) {
      setError("Google sign in failed. Please try again.");
      setGoogleLoading(false);
    }
  };

  const handleLogin = async () => {
    const errs = { email: !validateEmail(email), password: password.length < 6 };
    setFieldErr(f => ({ ...f, ...errs }));
    if (errs.email || errs.password) {
      setError(errs.email ? "Please enter a valid email address." : "Password must be at least 6 characters.");
      triggerShake(); return;
    }
    setLoading(true); setError("");
    try {
      const supabase = createClient();
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setError(error.message || "Incorrect email or password.");
        triggerShake();
      } else if (data.user) {
        const displayName = data.user.user_metadata?.full_name || data.user.email.split("@")[0];
        onLogin({ email: data.user.email, name: displayName, id: data.user.id });
      }
    } catch(e) {
      setError("Sign in failed. Please try again.");
      triggerShake();
    }
    setLoading(false);
  };

  const handleSignup = async () => {
    const errs = { name: name.trim().length < 2, email: !validateEmail(email), password: password.length < 8 };
    setFieldErr(errs);
    setFieldErrConfirm(confirm !== password);
    if (errs.name || errs.email || errs.password || confirm !== password) {
      setError(
        errs.name ? "Please enter your full name." :
        errs.email ? "Please enter a valid email address." :
        errs.password ? "Password must be at least 8 characters." :
        "Passwords do not match."
      );
      triggerShake(); return;
    }
    setLoading(true); setError("");
    try {
      const supabase = createClient();
      const { data, error } = await supabase.auth.signUp({
        email: email.toLowerCase(),
        password,
        options: { data: { full_name: name.trim() } },
      });
      if (error) {
        setError(error.message || "Sign up failed. Please try again.");
        triggerShake();
      } else if (data.user) {
        if (data.user.identities?.length === 0) {
          setError("An account with this email already exists. Please sign in.");
          triggerShake();
        } else {
          onLogin({ email: data.user.email, name: name.trim(), id: data.user.id, isNew: true });
        }
      }
    } catch(e) {
      setError("Sign up failed. Please try again.");
      triggerShake();
    }
    setLoading(false);
  };

  const card = isDark
    ? { bg: "#0f1117", border: "rgba(255,255,255,0.1)", inputBg: "rgba(255,255,255,0.05)", inputBorder: "rgba(255,255,255,0.12)", label: "#555", text: "#e0e0e0", subtext: "#444", divider: "rgba(255,255,255,0.07)", errBg: "rgba(255,80,80,0.08)", errBorder: "rgba(255,80,80,0.3)" }
    : { bg: "#ffffff", border: "rgba(0,0,0,0.1)", inputBg: "rgba(0,0,0,0.04)", inputBorder: "rgba(0,0,0,0.15)", label: "#aaa", text: "#1a1a1a", subtext: "#bbb", divider: "rgba(0,0,0,0.08)", errBg: "rgba(255,80,80,0.06)", errBorder: "rgba(255,80,80,0.25)" };

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 9000,
      background: isDark ? "rgba(0,0,0,0.85)" : "rgba(0,0,0,0.5)",
      backdropFilter: "blur(6px)",
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: "clamp(12px,4vw,24px)",
    }}>
      <div style={{
        width: "100%", maxWidth: 420,
        background: card.bg,
        border: `1px solid ${card.border}`,
        borderRadius: 22,
        padding: "clamp(24px,5vw,40px) clamp(22px,5vw,38px)",
        boxShadow: isDark ? "0 32px 80px rgba(0,0,0,0.9), 0 0 0 1px rgba(255,255,255,0.04)" : "0 32px 80px rgba(0,0,0,0.2)",
        fontFamily: "'Space Mono','Courier New',monospace",
        animation: shake ? "authShake 0.45s ease" : "dropIn 0.3s ease",
        position: "relative", overflow: "hidden",
        maxHeight: "95vh", overflowY: "auto",
      }}>
        {/* Decorative glows */}
        <div style={{ position: "absolute", top: -60, right: -60, width: 180, height: 180, borderRadius: "50%", background: "radial-gradient(circle, rgba(99,102,241,0.15) 0%, transparent 70%)", pointerEvents: "none" }} />
        <div style={{ position: "absolute", bottom: -40, left: -40, width: 140, height: 140, borderRadius: "50%", background: "radial-gradient(circle, rgba(0,212,170,0.08) 0%, transparent 70%)", pointerEvents: "none" }} />

        {/* ✕ Close */}
        {onClose && (
          <button onClick={onClose} style={{ position: "absolute", top: 14, right: 16, background: "none", border: "none", cursor: "pointer", fontSize: 18, color: card.label, lineHeight: 1, padding: 4, zIndex: 1 }}>✕</button>
        )}

        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: 20, position: "relative" }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>📈</div>
          <div style={{ fontFamily: "'Syne',sans-serif", fontSize: "clamp(18px,4vw,24px)", fontWeight: 800, color: card.text, letterSpacing: -0.5, marginBottom: 4 }}>
            Market <span style={{ color: "#6366f1" }}>Predictor</span>
          </div>
        </div>

        {/* Login / Signup tab switcher */}
        <div style={{ display: "flex", background: isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.04)", borderRadius: 12, padding: 4, marginBottom: 20, gap: 4 }}>
          {[["login","Sign In"],["signup","Create Account"]].map(([id, label]) => (
            <button key={id} onClick={() => switchPanel(id)} style={{
              flex: 1, padding: "9px 8px", borderRadius: 9, fontSize: "clamp(10px,2vw,11px)",
              fontFamily: "monospace", fontWeight: 800, border: "none", cursor: "pointer",
              background: panel === id ? (isDark ? "rgba(99,102,241,0.25)" : "rgba(99,102,241,0.15)") : "transparent",
              color: panel === id ? "#818cf8" : card.label,
              transition: "all 0.2s",
            }}>{label}</button>
          ))}
        </div>

        {/* Reason banner */}
        {reason && (
          <div style={{ marginBottom: 16, padding: "8px 14px", background: "rgba(99,102,241,0.08)", border: "1px solid rgba(99,102,241,0.2)", borderRadius: 8, fontSize: 11, color: "#818cf8", lineHeight: 1.6 }}>
            {reason}
          </div>
        )}

        {/* ── Panel content (animated) ── */}
        <div style={{ opacity: panelAnim ? 1 : 0, transform: panelAnim ? "translateY(0)" : "translateY(6px)", transition: "opacity 0.16s, transform 0.16s" }}>

          {/* ── LOGIN PANEL ── */}
          {panel === "login" && (<>
            {/* Google OAuth button */}
            <button
              onClick={handleGoogleAuth}
              disabled={googleLoading || loading}
              style={{
                width: "100%", padding: "12px 16px", borderRadius: 12, marginBottom: 16,
                border: `1px solid ${isDark ? "rgba(255,255,255,0.14)" : "rgba(0,0,0,0.14)"}`,
                background: isDark ? "rgba(255,255,255,0.05)" : "#ffffff",
                color: isDark ? "#e0e0e0" : "#3c4043",
                fontSize: 13, fontFamily: "'Space Mono','Courier New',monospace", fontWeight: 700,
                cursor: (googleLoading || loading) ? "not-allowed" : "pointer",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
                transition: "all 0.2s",
                boxShadow: isDark ? "none" : "0 1px 3px rgba(0,0,0,0.12)",
                opacity: (googleLoading || loading) ? 0.65 : 1,
              }}>
              {googleLoading ? (
                <span style={{ fontSize: 14, animation: "pulse 1s infinite" }}>⟳</span>
              ) : (
                <svg width="18" height="18" viewBox="0 0 48 48" style={{ flexShrink: 0 }}>
                  <path fill="#4285F4" d="M44.5 20H24v8.5h11.8C34.7 33.9 30.1 37 24 37c-7.2 0-13-5.8-13-13s5.8-13 13-13c3.1 0 5.9 1.1 8.1 2.9l6.4-6.4C34.6 4.1 29.6 2 24 2 11.8 2 2 11.8 2 24s9.8 22 22 22c11 0 21-8 21-21 0-1.3-.2-2.7-.5-4z"/>
                  <path fill="#34A853" d="M6.3 14.7l7 5.1C15 16.1 19.1 13 24 13c3.1 0 5.9 1.1 8.1 2.9l6.4-6.4C34.6 4.1 29.6 2 24 2c-7.7 0-14.3 4.5-17.7 11.2-.1 0 0-.1 0 0v1.5z"/>
                  <path fill="#FBBC05" d="M24 46c5.7 0 10.5-1.9 14-5.1l-6.5-5.3C29.9 37 27.1 38 24 38c-6 0-11.1-4-12.9-9.5l-7 5.4C7.6 41.4 15.2 46 24 46z"/>
                  <path fill="#EA4335" d="M44.5 20H24v8.5h11.8c-.8 2.5-2.4 4.6-4.5 6.1l6.5 5.3c3.8-3.5 6.2-8.7 6.2-14.9 0-1.3-.2-2.7-.5-4z"/>
                </svg>
              )}
              {googleLoading ? "Connecting to Google..." : "Continue with Google"}
            </button>

            {/* Divider */}
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
              <div style={{ flex: 1, height: 1, background: card.divider }} />
              <span style={{ fontSize: 10, color: card.label, letterSpacing: 2, flexShrink: 0 }}>OR</span>
              <div style={{ flex: 1, height: 1, background: card.divider }} />
            </div>

            <AuthField label="Email" icon="✉" type="email" value={email}
              onChange={e => { setEmail(e.target.value); setFieldErr(f=>({...f,email:false})); setError(""); }}
              onEnter={handleLogin} placeholder="you@example.com" autoComplete="email" hasError={fieldErr.email}  isDark={isDark} inputBg={card.inputBg} inputBorder={card.inputBorder} labelColor={card.label} textColor={card.text} />
            <AuthField label="Password" icon="🔒" type="password" value={password}
              onChange={e => { setPassword(e.target.value); setFieldErr(f=>({...f,password:false})); setError(""); }}
              onEnter={handleLogin} placeholder="••••••••" autoComplete="current-password"
              hasError={fieldErr.password} showToggle toggleState={showPw} onToggle={() => setShowPw(v=>!v)}  isDark={isDark} inputBg={card.inputBg} inputBorder={card.inputBorder} labelColor={card.label} textColor={card.text} />

            {error && <div style={{ background: card.errBg, border: `1px solid ${card.errBorder}`, borderRadius: 9, padding: "9px 13px", marginBottom: 14, fontSize: 11, color: "#ff8080", lineHeight: 1.6, animation: "slideIn 0.2s ease" }}>⚠ {error}</div>}

            <button onClick={handleLogin} disabled={loading} style={{ width: "100%", padding: "13px", borderRadius: 12, border: "1px solid rgba(99,102,241,0.5)", background: loading ? "rgba(99,102,241,0.1)" : "rgba(99,102,241,0.2)", color: "#818cf8", fontSize: 13, fontFamily: "monospace", fontWeight: 800, letterSpacing: 1, cursor: loading ? "not-allowed" : "pointer", transition: "all 0.2s", marginBottom: 16 }}>
              {loading ? "⟳  SIGNING IN..." : "→  SIGN IN"}
            </button>

            {/* Demo hint */}
            <div style={{ background: isDark ? "rgba(99,102,241,0.06)" : "rgba(99,102,241,0.04)", border: "1px solid rgba(99,102,241,0.15)", borderRadius: 9, padding: "9px 13px", fontSize: 10, color: card.label, lineHeight: 1.8, textAlign: "center", marginBottom: 16 }}>
              <span style={{ color: "#818cf8", fontWeight: 700 }}>Demo account: </span>
              demo@marketpredictor.ai&nbsp;/&nbsp;Demo1234!
            </div>

            {/* Switch to signup */}
            <div style={{ textAlign: "center", paddingTop: 12, borderTop: `1px solid ${card.divider}`, fontSize: 12, color: card.label }}>
              Don't have an account?{" "}
              <button onClick={() => switchPanel("signup")} style={{ background: "none", border: "none", cursor: "pointer", color: "#818cf8", fontWeight: 700, fontSize: 12, fontFamily: "monospace", padding: 0, textDecoration: "underline", textUnderlineOffset: 3 }}>
                Create one free →
              </button>
            </div>
          </>)}

          {/* ── SIGNUP PANEL ── */}
          {panel === "signup" && (<>
            {/* Google OAuth button */}
            <button
              onClick={handleGoogleAuth}
              disabled={googleLoading || loading}
              style={{
                width: "100%", padding: "12px 16px", borderRadius: 12, marginBottom: 16,
                border: `1px solid ${isDark ? "rgba(255,255,255,0.14)" : "rgba(0,0,0,0.14)"}`,
                background: isDark ? "rgba(255,255,255,0.05)" : "#ffffff",
                color: isDark ? "#e0e0e0" : "#3c4043",
                fontSize: 13, fontFamily: "'Space Mono','Courier New',monospace", fontWeight: 700,
                cursor: (googleLoading || loading) ? "not-allowed" : "pointer",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
                transition: "all 0.2s",
                boxShadow: isDark ? "none" : "0 1px 3px rgba(0,0,0,0.12)",
                opacity: (googleLoading || loading) ? 0.65 : 1,
              }}>
              {googleLoading ? (
                <span style={{ fontSize: 14, animation: "pulse 1s infinite" }}>⟳</span>
              ) : (
                <svg width="18" height="18" viewBox="0 0 48 48" style={{ flexShrink: 0 }}>
                  <path fill="#4285F4" d="M44.5 20H24v8.5h11.8C34.7 33.9 30.1 37 24 37c-7.2 0-13-5.8-13-13s5.8-13 13-13c3.1 0 5.9 1.1 8.1 2.9l6.4-6.4C34.6 4.1 29.6 2 24 2 11.8 2 2 11.8 2 24s9.8 22 22 22c11 0 21-8 21-21 0-1.3-.2-2.7-.5-4z"/>
                  <path fill="#34A853" d="M6.3 14.7l7 5.1C15 16.1 19.1 13 24 13c3.1 0 5.9 1.1 8.1 2.9l6.4-6.4C34.6 4.1 29.6 2 24 2c-7.7 0-14.3 4.5-17.7 11.2-.1 0 0-.1 0 0v1.5z"/>
                  <path fill="#FBBC05" d="M24 46c5.7 0 10.5-1.9 14-5.1l-6.5-5.3C29.9 37 27.1 38 24 38c-6 0-11.1-4-12.9-9.5l-7 5.4C7.6 41.4 15.2 46 24 46z"/>
                  <path fill="#EA4335" d="M44.5 20H24v8.5h11.8c-.8 2.5-2.4 4.6-4.5 6.1l6.5 5.3c3.8-3.5 6.2-8.7 6.2-14.9 0-1.3-.2-2.7-.5-4z"/>
                </svg>
              )}
              {googleLoading ? "Connecting to Google..." : "Continue with Google"}
            </button>

            {/* Divider */}
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
              <div style={{ flex: 1, height: 1, background: card.divider }} />
              <span style={{ fontSize: 10, color: card.label, letterSpacing: 2, flexShrink: 0 }}>OR</span>
              <div style={{ flex: 1, height: 1, background: card.divider }} />
            </div>

            <AuthField label="Full Name" icon="👤" type="text" value={name}
              onChange={e => { setName(e.target.value); setFieldErr(f=>({...f,name:false})); setError(""); }}
              onEnter={handleSignup} placeholder="Jane Smith" autoComplete="name" hasError={fieldErr.name}  isDark={isDark} inputBg={card.inputBg} inputBorder={card.inputBorder} labelColor={card.label} textColor={card.text} />
            <AuthField label="Email" icon="✉" type="email" value={email}
              onChange={e => { setEmail(e.target.value); setFieldErr(f=>({...f,email:false})); setError(""); }}
              onEnter={handleSignup} placeholder="you@example.com" autoComplete="email" hasError={fieldErr.email}  isDark={isDark} inputBg={card.inputBg} inputBorder={card.inputBorder} labelColor={card.label} textColor={card.text} />
            <AuthField label="Password" icon="🔒" type="password" value={password}
              onChange={e => { setPassword(e.target.value); setFieldErr(f=>({...f,password:false})); setError(""); }}
              onEnter={handleSignup} placeholder="min. 8 characters" autoComplete="new-password"
              hasError={fieldErr.password} showToggle toggleState={showPw} onToggle={() => setShowPw(v=>!v)}  isDark={isDark} inputBg={card.inputBg} inputBorder={card.inputBorder} labelColor={card.label} textColor={card.text} />
            <AuthField label="Confirm Password" icon="✅" type="password" value={confirm}
              onChange={e => { setConfirm(e.target.value); setFieldErrConfirm(false); setError(""); }}
              onEnter={handleSignup} placeholder="••••••••" autoComplete="new-password"
              hasError={fieldErrConfirm} showToggle toggleState={showConfirm} onToggle={() => setShowConfirm(v=>!v)}  isDark={isDark} inputBg={card.inputBg} inputBorder={card.inputBorder} labelColor={card.label} textColor={card.text} />

            {/* Password strength */}
            {password.length > 0 && (function() {
              var pwStrength = password.length >= 12 && /[A-Z]/.test(password) && /[0-9]/.test(password) && /[^A-Za-z0-9]/.test(password) ? 4
                : password.length >= 10 && /[A-Z]/.test(password) && /[0-9]/.test(password) ? 3
                : password.length >= 8 ? 2 : 1;
              var pwLabels = ["", "Weak", "Fair", "Good", "Strong"];
              var pwColors = ["", "#ff6b6b", "#fbbf24", "#00d4aa", "#00d4aa"];
              return (
                <div style={{ marginBottom: 14 }}>
                  <div style={{ display: "flex", gap: 4, marginBottom: 4 }}>
                    {[1,2,3,4].map(function(idx) { return <div key={idx} style={{ flex: 1, height: 3, borderRadius: 2, background: idx <= pwStrength ? pwColors[pwStrength] : (isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)"), transition: "background 0.3s" }} />; })}
                  </div>
                  <div style={{ fontSize: 10, color: pwColors[pwStrength] }}>{pwLabels[pwStrength]} password</div>
                </div>
              );
            })()}

            {error && <div style={{ background: card.errBg, border: `1px solid ${card.errBorder}`, borderRadius: 9, padding: "9px 13px", marginBottom: 14, fontSize: 11, color: "#ff8080", lineHeight: 1.6, animation: "slideIn 0.2s ease" }}>⚠ {error}</div>}

            <button onClick={handleSignup} disabled={loading} style={{ width: "100%", padding: "13px", borderRadius: 12, border: "1px solid rgba(0,212,170,0.4)", background: loading ? "rgba(0,212,170,0.06)" : "rgba(0,212,170,0.12)", color: "#00d4aa", fontSize: 13, fontFamily: "monospace", fontWeight: 800, letterSpacing: 1, cursor: loading ? "not-allowed" : "pointer", transition: "all 0.2s", marginBottom: 16 }}>
              {loading ? "⟳  CREATING ACCOUNT..." : "✦  CREATE FREE ACCOUNT"}
            </button>

            {/* Switch to login */}
            <div style={{ textAlign: "center", paddingTop: 12, borderTop: `1px solid ${card.divider}`, fontSize: 12, color: card.label }}>
              Already have an account?{" "}
              <button onClick={() => switchPanel("login")} style={{ background: "none", border: "none", cursor: "pointer", color: "#818cf8", fontWeight: 700, fontSize: 12, fontFamily: "monospace", padding: 0, textDecoration: "underline", textUnderlineOffset: 3 }}>
                Sign in →
              </button>
            </div>
          </>)}

        </div>

        <div style={{ textAlign: "center", marginTop: 14, fontSize: 9, color: card.subtext, letterSpacing: 1 }}>
          FOR DEMO / EDUCATIONAL PURPOSES ONLY
        </div>
      </div>
    </div>
  );
}

export default AuthModal;
