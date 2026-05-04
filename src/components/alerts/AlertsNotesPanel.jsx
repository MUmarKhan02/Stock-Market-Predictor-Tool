'use client';

import { useState, useEffect } from "react";
import { fetchAssetInfo, formatPrice } from "../shared/utils";
import { loadUserData, saveUserData, pruneOldHistory } from "../shared/utils";

function AlertsNotesPanel({ user, currency, theme }) {
  const isDark = theme === "dark";
  const fp = (v) => formatPrice(v, currency, false);

  // ── Alerts state ──
  const [alerts, setAlerts] = useState(() => user ? loadUserData(user.email, "alerts") : []);
  const [newAlertTicker, setNewAlertTicker]   = useState("");
  const [newAlertPrice, setNewAlertPrice]     = useState("");
  const [newAlertDir, setNewAlertDir]         = useState("above"); // above | below
  const [newAlertNote, setNewAlertNote]       = useState("");
  const [alertFetching, setAlertFetching]     = useState(false);
  const [alertError, setAlertError]           = useState("");
  const [firedAlerts, setFiredAlerts]         = useState([]);

  // ── Notes state ──
  const [notes, setNotes] = useState(() => user ? loadUserData(user.email, "notes") : []);
  const [newNoteTicker, setNewNoteTicker]   = useState("");
  const [newNoteTitle, setNewNoteTitle]     = useState("");
  const [newNoteBody, setNewNoteBody]       = useState("");
  const [newNoteTag, setNewNoteTag]         = useState("analysis"); // analysis | trade | idea | watchlist | general
  const [editingNote, setEditingNote]       = useState(null); // note id being edited
  const [noteFilter, setNoteFilter]         = useState("all");
  const [noteSearch, setNoteSearch]         = useState("");

  // ── Active sub-tab ──
  const [tab, setTab] = useState("alerts");

  // Persist whenever data changes
  useEffect(() => { if (user) saveUserData(user.email, "alerts", alerts); }, [alerts, user]);
  useEffect(() => { if (user) saveUserData(user.email, "notes", notes); }, [notes, user]);

  // ── Real price checking every 60s ──────────────────────────────
  useEffect(() => {
    const activeAlertsList = alerts.filter(a => !a.triggered);
    if (!activeAlertsList.length) return;

    const checkPrices = async () => {
      // Deduplicate tickers to avoid redundant fetches
      const tickers = [...new Set(activeAlertsList.map(a => a.ticker))];
      const priceMap = {};
      for (const ticker of tickers) {
        try {
          const isCrypto = activeAlertsList.find(a => a.ticker === ticker)?.isCrypto || false;
          const info = await fetchAssetInfo(ticker, isCrypto);
          if (info.valid && info.currentPrice) priceMap[ticker] = info.currentPrice;
        } catch(e) { /* skip on error, try next interval */ }
      }
      if (!Object.keys(priceMap).length) return;

      setAlerts(prev => {
        const updated = prev.map(a => {
          if (a.triggered || !(a.ticker in priceMap)) return a;
          const livePrice = priceMap[a.ticker];
          const triggered = a.direction === "above" ? livePrice >= a.targetPrice : livePrice <= a.targetPrice;
          if (triggered) {
            setFiredAlerts(f => [...f, { ...a, firedAt: new Date().toLocaleTimeString(), firedPrice: livePrice.toFixed(2) }]);
          }
          return { ...a, lastSimPrice: livePrice, triggered, lastChecked: Date.now() };
        });
        return updated;
      });
    };

    // Check immediately on mount, then every 60s
    checkPrices();
    const interval = setInterval(checkPrices, 60000);
    return () => clearInterval(interval);
  }, [alerts.filter(a => !a.triggered).length]);

  // Auto-dismiss fired alert toasts after 6s
  useEffect(() => {
    if (!firedAlerts.length) return;
    const t = setTimeout(() => setFiredAlerts(f => f.slice(1)), 6000);
    return () => clearTimeout(t);
  }, [firedAlerts]);

  const addAlert = async () => {
    const ticker = newAlertTicker.trim().toUpperCase();
    const price = parseFloat(newAlertPrice);
    if (!ticker || isNaN(price) || price <= 0) { setAlertError("Enter a valid ticker and price."); return; }
    setAlertFetching(true); setAlertError("");
    try {
      const info = await fetchAssetInfo(ticker, ticker.length <= 4 && ["BTC","ETH","BNB","SOL","XRP","ADA","DOGE","AVAX"].includes(ticker));
      const currentPrice = info.valid ? info.currentPrice : price * 0.98;
      const alert = {
        id: Date.now(),
        ticker,
        name: info.valid ? info.name : ticker,
        targetPrice: price,
        direction: newAlertDir,
        note: newAlertNote.trim(),
        currentPrice,
        lastSimPrice: currentPrice,
        triggered: false,
        createdAt: new Date().toLocaleDateString(),
        isCrypto: info.valid ? (info.sector === "Cryptocurrency") : false,
      };
      setAlerts(prev => [alert, ...prev]);
      setNewAlertTicker(""); setNewAlertPrice(""); setNewAlertNote("");
    } catch(e) { setAlertError("Could not fetch asset info. Check the ticker and try again."); }
    setAlertFetching(false);
  };

  const deleteAlert = (id) => setAlerts(prev => prev.filter(a => a.id !== id));
  const resetAlert  = (id) => setAlerts(prev => prev.map(a => a.id === id ? { ...a, triggered: false, lastSimPrice: a.currentPrice } : a));

  const addNote = () => {
    const title = newNoteTitle.trim();
    const body = newNoteBody.trim();
    if (!title || !body) return;
    if (editingNote) {
      setNotes(prev => prev.map(n => n.id === editingNote ? { ...n, title, body, ticker: newNoteTicker.trim().toUpperCase(), tag: newNoteTag, updatedAt: new Date().toLocaleDateString() } : n));
      setEditingNote(null);
    } else {
      setNotes(prev => [{ id: Date.now(), title, body, ticker: newNoteTicker.trim().toUpperCase(), tag: newNoteTag, createdAt: new Date().toLocaleDateString(), updatedAt: null }, ...prev]);
    }
    setNewNoteTitle(""); setNewNoteBody(""); setNewNoteTicker(""); setNewNoteTag("analysis");
  };

  const startEdit = (note) => {
    setEditingNote(note.id);
    setNewNoteTitle(note.title);
    setNewNoteBody(note.body);
    setNewNoteTicker(note.ticker || "");
    setNewNoteTag(note.tag || "analysis");
    setTab("notes");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const deleteNote = (id) => setNotes(prev => prev.filter(n => n.id !== id));
  const cancelEdit = () => { setEditingNote(null); setNewNoteTitle(""); setNewNoteBody(""); setNewNoteTicker(""); setNewNoteTag("analysis"); };

  const TAG_COLORS  = { analysis:"#6366f1", trade:"#00d4aa", idea:"#f59e0b", watchlist:"#38bdf8", general:"var(--text8)" };
  const TAG_ICONS   = { analysis:"💡", trade:"💰", idea:"💡", watchlist:"👁", general:"📝" };
  const TAG_LABELS  = { analysis:"Analysis", trade:"Trade Log", idea:"Idea", watchlist:"Watchlist", general:"General" };

  const filteredNotes = notes.filter(n => {
    const matchTag = noteFilter === "all" || n.tag === noteFilter;
    const matchSearch = !noteSearch || n.title.toLowerCase().includes(noteSearch.toLowerCase()) || (n.ticker && n.ticker.toLowerCase().includes(noteSearch.toLowerCase())) || n.body.toLowerCase().includes(noteSearch.toLowerCase());
    return matchTag && matchSearch;
  });

  const activeAlerts   = alerts.filter(a => !a.triggered);
  const triggeredAlerts = alerts.filter(a => a.triggered);

  return (
    <div style={{ animation: "slideIn 0.3s ease" }}>

      {/* ── Fired alert toasts ── */}
      {firedAlerts.map((a, i) => (
        <div key={a.id + i} style={{
          position: "fixed", bottom: 24 + i * 76, right: 24, zIndex: 9998,
          background: isDark ? "#1a1f14" : "#fff", border: "2px solid #00d4aa",
          borderRadius: 14, padding: "12px 16px", maxWidth: 320,
          boxShadow: "0 8px 32px rgba(0,212,170,0.25)", animation: "dropIn 0.3s ease",
          fontFamily: "monospace", display: "flex", gap: 10, alignItems: "flex-start",
        }}>
          <span style={{ fontSize: 22, flexShrink: 0 }}>🔔</span>
          <div>
            <div style={{ fontWeight: 800, color: "#00d4aa", fontSize: 13, marginBottom: 3 }}>
              Price Alert Triggered!
            </div>
            <div style={{ fontSize: 11, color: isDark ? "#ccc" : "#333", lineHeight: 1.5 }}>
              <strong>{a.ticker}</strong> hit {fp(parseFloat(a.firedPrice))} — your {a.direction} alert of {fp(a.targetPrice)}
            </div>
            {a.note && <div style={{ fontSize: 10, color: isDark ? "#666" : "#aaa", marginTop: 4, fontStyle: "italic" }}>"{a.note}"</div>}
          </div>
        </div>
      ))}

      {/* ── Sub-tabs ── */}
      <div style={{ display: "flex", gap: 4, marginBottom: 16, background: "var(--surface2)", borderRadius: 12, padding: 4, border: "1px solid var(--border)", width: "fit-content" }}>
        {[["alerts", "🔔 Price Alerts"], ["notes", "📝 Notes"]].map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)} style={{ padding: "8px 20px", borderRadius: 9, fontSize: "clamp(10px,2vw,12px)", fontFamily: "'Syne',sans-serif", fontWeight: 800, border: "none", background: tab === id ? `${ALERT_ACCENT}22` : "transparent", color: tab === id ? ALERT_ACCENT : "var(--text8)", transition: "all 0.2s", whiteSpace: "nowrap", borderBottom: tab === id ? `2px solid ${ALERT_ACCENT}` : "2px solid transparent" }}>
            {label}
            {id === "alerts" && activeAlerts.length > 0 && <span style={{ marginLeft: 6, background: ALERT_ACCENT, color: "#000", borderRadius: 10, padding: "1px 6px", fontSize: 9, fontWeight: 800 }}>{activeAlerts.length}</span>}
            {id === "notes" && notes.length > 0 && <span style={{ marginLeft: 6, background: "rgba(99,102,241,0.3)", color: "#818cf8", borderRadius: 10, padding: "1px 6px", fontSize: 9, fontWeight: 800 }}>{notes.length}</span>}
          </button>
        ))}
      </div>

      {/* ════════════════ ALERTS TAB ════════════════ */}
      {tab === "alerts" && (
        <div style={{ animation: "slideIn 0.25s ease" }}>

          {/* Add alert form */}
          <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 16, padding: "clamp(14px,3vw,22px)", marginBottom: 16 }}>
            <div style={{ fontSize: 10, color: "var(--text9)", letterSpacing: 2, marginBottom: 12, textTransform: "uppercase" }}>
              New Price Alert
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
              <input value={newAlertTicker} onChange={e => { setNewAlertTicker(e.target.value.toUpperCase()); setAlertError(""); }}
                onKeyDown={e => e.key === "Enter" && addAlert()}
                placeholder="Ticker e.g. AAPL"
                style={{ flex: "2 1 110px", minWidth: 0, padding: "9px 12px", borderRadius: 8, fontSize: 12, fontFamily: "monospace", background: "var(--input-bg)", border: "1px solid var(--border3)", color: "var(--text)", outline: "none" }} />
              <input value={newAlertPrice} onChange={e => { setNewAlertPrice(e.target.value); setAlertError(""); }}
                onKeyDown={e => e.key === "Enter" && addAlert()}
                placeholder="Target price ($)"
                style={{ flex: "2 1 110px", minWidth: 0, padding: "9px 12px", borderRadius: 8, fontSize: 12, fontFamily: "monospace", background: "var(--input-bg)", border: "1px solid var(--border3)", color: "var(--text)", outline: "none" }} />
              {/* Direction toggle */}
              <div style={{ display: "flex", borderRadius: 8, overflow: "hidden", border: "1px solid var(--border3)", flexShrink: 0 }}>
                {[["above","▲ Above","#00d4aa"],["below","▼ Below","#ff6b6b"]].map(([val, label, col]) => (
                  <button key={val} onClick={() => setNewAlertDir(val)} style={{ padding: "9px 12px", fontSize: 11, fontFamily: "monospace", fontWeight: 700, border: "none", background: newAlertDir === val ? `${col}22` : "var(--input-bg)", color: newAlertDir === val ? col : "var(--text8)", cursor: "pointer", transition: "all 0.15s" }}>
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <input value={newAlertNote} onChange={e => setNewAlertNote(e.target.value)}
                onKeyDown={e => e.key === "Enter" && addAlert()}
                placeholder="Optional note e.g. 'Breakout target' or 'Stop loss level'"
                style={{ flex: 1, minWidth: 0, padding: "9px 12px", borderRadius: 8, fontSize: 12, fontFamily: "monospace", background: "var(--input-bg)", border: "1px solid var(--border3)", color: "var(--text)", outline: "none" }} />
              <button onClick={addAlert} disabled={alertFetching} style={{ padding: "9px 18px", borderRadius: 8, border: `1px solid ${ALERT_ACCENT}60`, background: `${ALERT_ACCENT}18`, color: ALERT_ACCENT, fontSize: 12, fontFamily: "monospace", fontWeight: 800, flexShrink: 0, opacity: alertFetching ? 0.5 : 1, whiteSpace: "nowrap" }}>
                {alertFetching ? "⟳" : "+ SET ALERT"}
              </button>
            </div>
            {alertError && <div style={{ marginTop: 8, fontSize: 11, color: "#ff8080" }}>⚠ {alertError}</div>}
          </div>

          {/* Active alerts */}
          {activeAlerts.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom: 10 }}>
                <div style={{ fontSize: 10, color: "var(--text9)", letterSpacing: 2 }}>ACTIVE ALERTS ({activeAlerts.length})</div>
                <div style={{ fontSize: 9, color: "var(--text10)", fontFamily:"monospace" }}>🔄 Checks every 60s · live prices</div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {activeAlerts.map(a => {
                  const dirColor = a.direction === "above" ? "#00d4aa" : "#ff6b6b";
                  const liveP = a.lastSimPrice || a.currentPrice;
                  const dist = Math.abs((liveP - a.targetPrice) / a.targetPrice * 100);
                  const progress = Math.max(0, Math.min(100, 100 - dist * 5));
                  const lastChecked = a.lastChecked ? new Date(a.lastChecked).toLocaleTimeString() : null;
                  return (
                    <div key={a.id} style={{ background: "var(--surface)", border: `1px solid ${dirColor}25`, borderRadius: 14, padding: "clamp(10px,2.5vw,16px)" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 8, marginBottom: 8 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                          <div style={{ width: 36, height: 36, borderRadius: 9, background: `${dirColor}15`, border: `1.5px solid ${dirColor}40`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, flexShrink: 0 }}>
                            {a.direction === "above" ? "📈" : "📉"}
                          </div>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontSize: "clamp(13px,2.5vw,15px)", fontWeight: 800, color: dirColor, fontFamily: "'Syne',sans-serif" }}>{a.ticker}</div>
                            <div style={{ fontSize: 10, color: "var(--text8)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.name}</div>
                          </div>
                        </div>
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                          <div style={{ textAlign: "center" }}>
                            <div style={{ fontSize: 9, color: "var(--text9)", marginBottom: 2 }}>TARGET</div>
                            <div style={{ fontSize: 13, fontWeight: 800, color: dirColor, fontFamily: "monospace" }}>{fp(a.targetPrice)}</div>
                          </div>
                          <div style={{ textAlign: "center" }}>
                            <div style={{ fontSize: 9, color: "var(--text9)", marginBottom: 2 }}>LIVE PRICE</div>
                            <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text3)", fontFamily: "monospace" }}>{fp(liveP)}</div>
                          </div>
                          <div style={{ textAlign: "center" }}>
                            <div style={{ fontSize: 9, color: "var(--text9)", marginBottom: 2 }}>AWAY</div>
                            <div style={{ fontSize: 13, fontWeight: 700, color: dist <= 2 ? "#fbbf24" : "var(--text5)", fontFamily: "monospace" }}>{dist.toFixed(1)}%</div>
                          </div>
                          <button onClick={() => deleteAlert(a.id)} style={{ padding: "4px 10px", borderRadius: 6, border: "1px solid rgba(255,107,107,0.25)", background: "rgba(255,107,107,0.06)", color: "#ff6b6b", fontSize: 10, fontFamily: "monospace", fontWeight: 700 }}>✕</button>
                        </div>
                      </div>
                      {/* Progress bar toward target */}
                      <div style={{ height: 3, background: "var(--border)", borderRadius: 2, overflow: "hidden", marginBottom: 6 }}>
                        <div style={{ height: "100%", width: `${progress}%`, background: `linear-gradient(90deg, var(--border) 0%, ${dirColor} 100%)`, borderRadius: 2, transition: "width 1s ease" }} />
                      </div>
                      <div style={{ display:"flex", justifyContent:"space-between", flexWrap:"wrap", gap:4 }}>
                        <div style={{ fontSize: 9, color: "var(--text10)" }}>
                          Set {a.createdAt} · {a.direction === "above" ? "Alert when above" : "Alert when below"} {fp(a.targetPrice)}
                        </div>
                        {lastChecked && <div style={{ fontSize: 9, color: "var(--text10)", fontFamily:"monospace" }}>⏱ {lastChecked}</div>}
                      </div>
                      {a.note && <div style={{ fontSize: 10, color: "var(--text8)", fontStyle: "italic", marginTop: 6 }}>📌 "{a.note}"</div>}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Triggered alerts */}
          {triggeredAlerts.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 10, color: "var(--text9)", letterSpacing: 2, marginBottom: 10 }}>TRIGGERED ({triggeredAlerts.length})</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {triggeredAlerts.map(a => (
                  <div key={a.id} style={{ background: "rgba(0,212,170,0.04)", border: "1px solid rgba(0,212,170,0.15)", borderRadius: 12, padding: "10px 14px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <span style={{ fontSize: 16 }}>✅</span>
                      <div>
                        <span style={{ fontWeight: 700, color: "#00d4aa", fontSize: 13, fontFamily: "monospace" }}>{a.ticker}</span>
                        <span style={{ fontSize: 11, color: "var(--text8)", marginLeft: 8 }}>{a.direction} {fp(a.targetPrice)} · {a.createdAt}</span>
                        {a.note && <div style={{ fontSize: 10, color: "var(--text9)", fontStyle: "italic" }}>"{a.note}"</div>}
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button onClick={() => resetAlert(a.id)} style={{ padding: "4px 10px", borderRadius: 6, border: "1px solid rgba(251,191,36,0.3)", background: "rgba(251,191,36,0.08)", color: "#fbbf24", fontSize: 10, fontFamily: "monospace", fontWeight: 700 }}>↺ Reset</button>
                      <button onClick={() => deleteAlert(a.id)} style={{ padding: "4px 10px", borderRadius: 6, border: "1px solid rgba(255,107,107,0.25)", background: "rgba(255,107,107,0.06)", color: "#ff6b6b", fontSize: 10, fontFamily: "monospace", fontWeight: 700 }}>✕</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {alerts.length === 0 && (
            <div style={{ textAlign: "center", padding: "clamp(30px,6vw,60px) 20px", color: "var(--text9)" }}>
              <div style={{ fontSize: "clamp(32px,6vw,48px)", marginBottom: 12 }}>🔔</div>
              <div style={{ fontSize: "clamp(13px,2.5vw,15px)", fontWeight: 700, color: "var(--text5)", marginBottom: 8 }}>No alerts set</div>
              <div style={{ fontSize: "clamp(10px,2vw,12px)", color: "var(--text9)", lineHeight: 1.7 }}>Set a price target above and get notified<br/>when any asset hits your level.</div>
            </div>
          )}
        </div>
      )}

      {/* ════════════════ NOTES TAB ════════════════ */}
      {tab === "notes" && (
        <div style={{ animation: "slideIn 0.25s ease" }}>

          {/* Add / edit note form */}
          <div style={{ background: "var(--surface)", border: `1px solid ${editingNote ? "rgba(99,102,241,0.4)" : "var(--border)"}`, borderRadius: 16, padding: "clamp(14px,3vw,22px)", marginBottom: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <div style={{ fontSize: 10, color: "var(--text9)", letterSpacing: 2, textTransform: "uppercase" }}>
                {editingNote ? "✏ Edit Note" : "New Note"}
              </div>
              {editingNote && <button onClick={cancelEdit} style={{ fontSize: 10, color: "var(--text8)", background: "none", border: "none", cursor: "pointer", fontFamily: "monospace" }}>✕ Cancel</button>}
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
              <input value={newNoteTitle} onChange={e => setNewNoteTitle(e.target.value)}
                placeholder="Note title e.g. 'AAPL breakout setup'"
                style={{ flex: "3 1 200px", minWidth: 0, padding: "9px 12px", borderRadius: 8, fontSize: 12, fontFamily: "monospace", background: "var(--input-bg)", border: "1px solid var(--border3)", color: "var(--text)", outline: "none" }} />
              <input value={newNoteTicker} onChange={e => setNewNoteTicker(e.target.value.toUpperCase())}
                placeholder="Ticker (optional)"
                style={{ flex: "1 1 90px", minWidth: 0, padding: "9px 12px", borderRadius: 8, fontSize: 12, fontFamily: "monospace", background: "var(--input-bg)", border: "1px solid var(--border3)", color: "var(--text)", outline: "none" }} />
            </div>
            {/* Tag selector */}
            <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginBottom: 10 }}>
              {Object.entries(TAG_LABELS).map(([val, label]) => (
                <button key={val} onClick={() => setNewNoteTag(val)} style={{ padding: "4px 12px", borderRadius: 20, fontSize: 10, fontFamily: "monospace", fontWeight: 700, border: `1px solid ${newNoteTag === val ? TAG_COLORS[val] : "var(--border3)"}`, background: newNoteTag === val ? `${TAG_COLORS[val]}18` : "transparent", color: newNoteTag === val ? TAG_COLORS[val] : "var(--text8)", cursor: "pointer", transition: "all 0.15s" }}>
                  {TAG_ICONS[val]} {label}
                </button>
              ))}
            </div>
            <textarea value={newNoteBody} onChange={e => setNewNoteBody(e.target.value)}
              placeholder="Write your note, analysis, trade idea, or anything you want to remember about this asset..."
              rows={4}
              style={{ width: "100%", padding: "10px 12px", borderRadius: 8, fontSize: 12, fontFamily: "monospace", background: "var(--input-bg)", border: "1px solid var(--border3)", color: "var(--text)", outline: "none", resize: "vertical", boxSizing: "border-box", lineHeight: 1.6 }} />
            <button onClick={addNote} disabled={!newNoteTitle.trim() || !newNoteBody.trim()} style={{ marginTop: 10, width: "100%", padding: "10px", borderRadius: 10, border: "1px solid rgba(99,102,241,0.5)", background: "rgba(99,102,241,0.15)", color: "#818cf8", fontSize: 12, fontFamily: "monospace", fontWeight: 800, cursor: (!newNoteTitle.trim() || !newNoteBody.trim()) ? "not-allowed" : "pointer", opacity: (!newNoteTitle.trim() || !newNoteBody.trim()) ? 0.5 : 1, transition: "all 0.2s" }}>
              {editingNote ? "💾 SAVE CHANGES" : "+ ADD NOTE"}
            </button>
          </div>

          {/* Filter + search */}
          {notes.length > 0 && (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14, alignItems: "center" }}>
              <input value={noteSearch} onChange={e => setNoteSearch(e.target.value)}
                placeholder="🔍 Search notes..."
                style={{ flex: "1 1 160px", minWidth: 0, padding: "7px 12px", borderRadius: 8, fontSize: 11, fontFamily: "monospace", background: "var(--input-bg)", border: "1px solid var(--border3)", color: "var(--text)", outline: "none" }} />
              <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                <button onClick={() => setNoteFilter("all")} style={{ padding: "5px 10px", borderRadius: 7, fontSize: 9, fontFamily: "monospace", fontWeight: 700, border: `1px solid ${noteFilter === "all" ? "rgba(99,102,241,0.5)" : "var(--border)"}`, background: noteFilter === "all" ? "rgba(99,102,241,0.15)" : "var(--surface)", color: noteFilter === "all" ? "#818cf8" : "var(--text8)", cursor: "pointer" }}>ALL</button>
                {Object.entries(TAG_LABELS).map(([val, label]) => (
                  <button key={val} onClick={() => setNoteFilter(val)} style={{ padding: "5px 10px", borderRadius: 7, fontSize: 9, fontFamily: "monospace", fontWeight: 700, border: `1px solid ${noteFilter === val ? TAG_COLORS[val] : "var(--border)"}`, background: noteFilter === val ? `${TAG_COLORS[val]}18` : "var(--surface)", color: noteFilter === val ? TAG_COLORS[val] : "var(--text8)", cursor: "pointer" }}>
                    {TAG_ICONS[val]} {label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Notes list */}
          {filteredNotes.length > 0 ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {filteredNotes.map(note => (
                <div key={note.id} style={{ background: "var(--surface)", border: `1px solid ${TAG_COLORS[note.tag] || "var(--border)"}22`, borderRadius: 14, padding: "clamp(12px,2.5vw,18px)", borderLeft: `3px solid ${TAG_COLORS[note.tag] || "var(--border)"}` }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 8, marginBottom: 8 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 4 }}>
                        {note.ticker && <span style={{ fontSize: 11, fontWeight: 800, color: "#00d4aa", fontFamily: "monospace", background: "rgba(0,212,170,0.1)", padding: "2px 8px", borderRadius: 5 }}>{note.ticker}</span>}
                        <span style={{ fontSize: 9, padding: "2px 8px", borderRadius: 10, background: `${TAG_COLORS[note.tag] || "var(--border)"}18`, color: TAG_COLORS[note.tag] || "var(--text8)", fontFamily: "monospace", fontWeight: 700 }}>{TAG_ICONS[note.tag]} {TAG_LABELS[note.tag]}</span>
                        <span style={{ fontSize: 9, color: "var(--text10)" }}>{note.updatedAt ? `Edited ${note.updatedAt}` : note.createdAt}</span>
                      </div>
                      <div style={{ fontSize: "clamp(12px,2.5vw,14px)", fontWeight: 700, color: "var(--text2)", marginBottom: 6, fontFamily: "'Syne',sans-serif" }}>{note.title}</div>
                      <div style={{ fontSize: "clamp(11px,2vw,12px)", color: "var(--text5)", lineHeight: 1.75, whiteSpace: "pre-wrap" }}>{note.body}</div>
                    </div>
                    <div style={{ display: "flex", gap: 5, flexShrink: 0 }}>
                      <button onClick={() => startEdit(note)} style={{ padding: "4px 10px", borderRadius: 6, border: "1px solid rgba(99,102,241,0.3)", background: "rgba(99,102,241,0.08)", color: "#818cf8", fontSize: 10, fontFamily: "monospace", fontWeight: 700 }}>✏</button>
                      <button onClick={() => deleteNote(note.id)} style={{ padding: "4px 10px", borderRadius: 6, border: "1px solid rgba(255,107,107,0.25)", background: "rgba(255,107,107,0.06)", color: "#ff6b6b", fontSize: 10, fontFamily: "monospace", fontWeight: 700 }}>✕</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ textAlign: "center", padding: "clamp(30px,6vw,60px) 20px", color: "var(--text9)" }}>
              <div style={{ fontSize: "clamp(32px,6vw,48px)", marginBottom: 12 }}>📝</div>
              <div style={{ fontSize: "clamp(13px,2.5vw,15px)", fontWeight: 700, color: "var(--text5)", marginBottom: 8 }}>{noteSearch || noteFilter !== "all" ? "No matching notes" : "No notes yet"}</div>
              <div style={{ fontSize: "clamp(10px,2vw,12px)", color: "var(--text9)", lineHeight: 1.7 }}>Write analysis notes, trade logs, ideas,<br/>and watchlist reminders for any asset.</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default AlertsNotesPanel;
