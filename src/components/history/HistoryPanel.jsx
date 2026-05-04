'use client';

import { useState, useEffect } from "react";
import { formatPrice, loadAccuracy } from "../shared/utils";
import { AssetLogo } from "../shared/AssetLogo";
import { loadUserData, saveUserData, pruneOldHistory } from "../shared/utils";
import HistoryDetailPanel from "./HistoryDetailPanel";
import AccuracyPanel from "./AccuracyPanel";

function HistoryPanel({ user, theme, currency }) {
  const isDark = theme === "dark";
  const fp = (v) => formatPrice(v, currency, false);
  const [activeTab, setActiveTab]     = useState("stocks");
  const [search, setSearch]         = useState("");
  const [use24h, setUse24h]         = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);

  const fmtTime = (ts, epochTs) => {
    // Try epoch first (most accurate), fall back to parsing string
    const d = epochTs ? new Date(epochTs) : new Date(ts);
    if (isNaN(d.getTime())) return ts || "";
    const date = d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
    const time = d.toLocaleTimeString(undefined, {
      hour: "2-digit", minute: "2-digit",
      hour12: !use24h,
    });
    return `${date} · ${time}`;
  };

  const allHistory = user ? pruneOldHistory(loadUserData(user.email, "history")) : [];

  const stocks   = allHistory.filter(h => h.type === "stock");
  const crypto   = allHistory.filter(h => h.type === "crypto");
  const chartai  = allHistory.filter(h => h.type === "chartai");

  const filtered = (list) => !search ? list : list.filter(h =>
    (h.ticker && h.ticker.toLowerCase().includes(search.toLowerCase())) ||
    (h.name   && h.name.toLowerCase().includes(search.toLowerCase())) ||
    (h.asset  && h.asset.toLowerCase().includes(search.toLowerCase())) ||
    (h.verdict && h.verdict.toLowerCase().includes(search.toLowerCase()))
  );

  const clearHistory = () => {
    if (!user) return;
    saveUserData(user.email, "history", []);
    // force re-render by reloading — parent will re-render panel via key
  };

  const accuracyRecords = user ? loadAccuracy(user.email) : [];
  const pendingCount = accuracyRecords.filter(r => r.status === "pending").length;

  const tabs = [
    { id: "stocks",   label: "📈 Stocks",   count: stocks.length  },
    { id: "crypto",   label: "₿ Crypto",    count: crypto.length  },
    { id: "chartai",  label: "📸 Chart AI", count: chartai.length },
    { id: "accuracy", label: "🎯 Accuracy", count: accuracyRecords.length, badge: pendingCount > 0 ? pendingCount : null, badgeColor: "#fbbf24" },
  ];

  const VERDICT_COLORS = {
    "BUY NOW":"#00d4aa","CONSIDER BUYING":"#7dd4b0","WAIT & WATCH":"#fbbf24",
    "AVOID FOR NOW":"#fb923c","DO NOT BUY":"#ff6b6b",
    "STRONG BUY":"#00d4aa","BUY":"#7dd4b0","HOLD":"#fbbf24","SELL":"#fb923c","STRONG SELL":"#ff6b6b","WAIT":"#888",
  };

  const EmptyState = ({ label }) => (
    <div style={{ textAlign:"center", padding:"clamp(30px,5vw,50px) 20px", color:"var(--text9)" }}>
      <div style={{ fontSize:"clamp(28px,5vw,40px)", marginBottom:10 }}>🕐</div>
      <div style={{ fontSize:13, fontWeight:700, color:"var(--text6)", marginBottom:6 }}>No {label} history yet</div>
      <div style={{ fontSize:11, color:"var(--text9)", lineHeight:1.7 }}>Run a prediction or chart analysis<br/>and it'll appear here automatically.</div>
    </div>
  );

  const StockCryptoCard = ({ item, fmtTime }) => {
    const vc = VERDICT_COLORS[item.verdict] || "#888";
    const up = item.change >= 0;
    const isSelected = selectedItem?.ts === item.ts && selectedItem?.ticker === item.ticker;
    return (
      <div onClick={()=>setSelectedItem(item)} style={{ background:"var(--surface)", border:"1px solid "+(isSelected?vc:vc+"20"), borderRadius:14, padding:"clamp(10px,2vw,14px)", borderLeft:"3px solid "+vc, cursor:"pointer", transition:"border-color 0.15s", outline:isSelected?"2px solid "+vc+"40":"none" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", flexWrap:"wrap", gap:8, marginBottom:6 }}>
          <div style={{ display:"flex", alignItems:"center", gap:10, minWidth:0 }}>
            <AssetLogo ticker={item.ticker} isCrypto={item.type==="crypto"} accent={item.type==="crypto"?"#f7931a":"#00d4aa"} />
            <div style={{ minWidth:0 }}>
              <div style={{ fontSize:"clamp(13px,2.5vw,15px)", fontWeight:800, color:item.type==="crypto"?"#f7931a":"#00d4aa", fontFamily:"'Syne',sans-serif", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{item.ticker}</div>
              <div style={{ fontSize:10, color:"var(--text8)", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{item.name}</div>
            </div>
          </div>
          <div style={{ textAlign:"right", flexShrink:0 }}>
            <div style={{ fontSize:"clamp(12px,2.5vw,14px)", fontWeight:800, color:"var(--text2)", fontFamily:"monospace" }}>{fp(item.price)}</div>
            <div style={{ fontSize:10, color:up?"#00d4aa":"#ff6b6b", fontWeight:700 }}>{up?"▲":"▼"} {Math.abs(item.change).toFixed(2)}%</div>
          </div>
        </div>
        <div style={{ display:"flex", gap:6, flexWrap:"wrap", marginBottom:6 }}>
          <span style={{ padding:"3px 9px", borderRadius:20, background:`${vc}15`, border:`1px solid ${vc}30`, fontSize:10, fontWeight:800, color:vc, fontFamily:"monospace" }}>{item.verdict}</span>
          <span style={{ padding:"3px 9px", borderRadius:20, background:"var(--surface2)", fontSize:10, color:"var(--text7)", fontFamily:"monospace" }}>Score: {item.score}</span>
          <span style={{ padding:"3px 9px", borderRadius:20, background:"var(--surface2)", fontSize:10, color:"var(--text7)", fontFamily:"monospace" }}>{item.horizon}</span>
          <span style={{ padding:"3px 9px", borderRadius:20, background:"var(--surface2)", fontSize:10, color:"var(--text8)", fontFamily:"monospace" }}>R²: {item.r2}</span>
        </div>
        <div style={{ display:"flex", gap:10, flexWrap:"wrap" }}>
          {item.predPrice && <span style={{ fontSize:10, color:"var(--text8)" }}>Predicted: <strong style={{color:"var(--text4)",fontFamily:"monospace"}}>{fp(item.predPrice)}</strong></span>}
          {item.confidence && <span style={{ fontSize:10, color:"var(--text8)" }}>Confidence: <strong style={{color:"#a78bfa"}}>{item.confidence}%</strong></span>}
        </div>
        <div style={{ fontSize:9, color:"var(--text10)", marginTop:6 }}>{fmtTime(item.timestamp, item.ts)}</div>
      </div>
    );
  };

  const ChartAICard = ({ item, fmtTime }) => {
    const vc = VERDICT_COLORS[item.verdict] || "#888";
    const isSelected = selectedItem?.ts === item.ts && selectedItem?.asset === item.asset;
    return (
      <div onClick={()=>setSelectedItem(item)} style={{ background:"var(--surface)", border:"1px solid "+(isSelected?vc:vc+"20"), borderRadius:14, overflow:"hidden", borderLeft:`3px solid ${vc}`, cursor:"pointer", transition:"border-color 0.15s", outline:isSelected?`2px solid ${vc}40`:"none" }}>
        <div style={{ display:"flex", gap:12, padding:"clamp(10px,2vw,14px)" }}>
          {/* Thumbnail */}
          {item.thumb && (
            <div style={{ flexShrink:0, width:64, height:64, borderRadius:8, overflow:"hidden", border:"1px solid var(--border)", background:"var(--surface2)" }}>
              <img src={item.thumb} alt="chart" style={{ width:"100%", height:"100%", objectFit:"cover" }} />
            </div>
          )}
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", flexWrap:"wrap", gap:6, marginBottom:4 }}>
              <div>
                <div style={{ fontSize:"clamp(12px,2.5vw,14px)", fontWeight:800, color:"#a78bfa", fontFamily:"'Syne',sans-serif" }}>{item.asset || "Unknown Asset"}</div>
                <div style={{ fontSize:10, color:"var(--text8)" }}>{item.timeframe || ""}</div>
              </div>
              <span style={{ padding:"3px 9px", borderRadius:20, background:`${vc}15`, border:`1px solid ${vc}30`, fontSize:10, fontWeight:800, color:vc, fontFamily:"monospace", flexShrink:0 }}>{item.verdict}</span>
            </div>
            {item.patterns?.length > 0 && (
              <div style={{ display:"flex", gap:4, flexWrap:"wrap", marginBottom:4 }}>
                {item.patterns.slice(0,3).map((p,i) => (
                  <span key={i} style={{ padding:"2px 7px", borderRadius:6, background:"rgba(139,92,246,0.1)", border:"1px solid rgba(139,92,246,0.2)", fontSize:9, color:"#c4b5fd" }}>{p}</span>
                ))}
                {item.patterns.length > 3 && <span style={{ fontSize:9, color:"var(--text9)" }}>+{item.patterns.length-3} more</span>}
              </div>
            )}
            {item.summary && <div style={{ fontSize:10, color:"var(--text6)", lineHeight:1.5, overflow:"hidden", display:"-webkit-box", WebkitLineClamp:2, WebkitBoxOrient:"vertical" }}>{item.summary}</div>}
            <div style={{ fontSize:9, color:"var(--text10)", marginTop:4 }}>{fmtTime(item.timestamp, item.ts)}</div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div style={{ animation:"slideIn 0.3s ease" }}>
      {/* Detail panel slides in over history */}
      {selectedItem && (
        <HistoryDetailPanel
          item={selectedItem}
          theme={theme}
          currency={currency}
          fmtTime={fmtTime}
          onClose={()=>setSelectedItem(null)}
        />
      )}

      {/* Search + time format toggle — hide on accuracy tab */}
      {activeTab !== "accuracy" && <div style={{ display:"flex", gap:8, marginBottom:14, alignItems:"center" }}>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="🔍 Search history..."
          style={{ flex:1, minWidth:0, padding:"9px 12px", borderRadius:9, fontSize:12, fontFamily:"monospace", background:"var(--input-bg)", border:"1px solid var(--border3)", color:"var(--text)", outline:"none", boxSizing:"border-box" }}
        />
        {/* 12h / 24h toggle */}
        <div style={{ display:"flex", borderRadius:8, overflow:"hidden", border:"1px solid var(--border3)", flexShrink:0 }}>
          {[["12h", false], ["24h", true]].map(([label, val]) => (
            <button key={label} onClick={() => setUse24h(val)} style={{
              padding:"8px 11px", fontSize:10, fontFamily:"monospace", fontWeight:700, border:"none",
              background: use24h === val ? "rgba(56,189,248,0.18)" : "var(--input-bg)",
              color: use24h === val ? "#38bdf8" : "var(--text8)",
              cursor:"pointer", transition:"all 0.15s",
            }}>{label}</button>
          ))}
        </div>
      </div>}

      {/* Sub-tabs */}
      <div style={{ display:"flex", gap:4, marginBottom:14, flexWrap:"wrap" }}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)} style={{
            padding:"7px 14px", borderRadius:9, fontSize:"clamp(10px,2vw,11px)", fontFamily:"monospace", fontWeight:700,
            border:"1px solid "+(activeTab===t.id?HIST_ACCENT+"60":"var(--border)"),
            background:activeTab===t.id?`${HIST_ACCENT}15`:"var(--surface)",
            color:activeTab===t.id?HIST_ACCENT:"var(--text8)", transition:"all 0.15s", whiteSpace:"nowrap",
          }}>
            {t.label}
            {t.count > 0 && <span style={{ marginLeft:5, background:activeTab===t.id?HIST_ACCENT:"var(--border2)", color:activeTab===t.id?"#000":"var(--text7)", borderRadius:8, padding:"1px 6px", fontSize:9, fontWeight:800 }}>{t.count}</span>}
            {t.badge && <span style={{ marginLeft:3, background:t.badgeColor||"#fbbf24", color:"#000", borderRadius:8, padding:"1px 5px", fontSize:8, fontWeight:800 }}>{t.badge}</span>}
          </button>
        ))}
        {allHistory.length > 0 && (
          <button onClick={clearHistory} style={{ marginLeft:"auto", padding:"7px 12px", borderRadius:9, fontSize:9, fontFamily:"monospace", fontWeight:700, border:"1px solid rgba(255,107,107,0.25)", background:"rgba(255,107,107,0.06)", color:"#ff8080", cursor:"pointer", whiteSpace:"nowrap" }}>
            🗑 Clear All
          </button>
        )}
      </div>

      {/* Content */}
      {activeTab === "stocks" && (
        filtered(stocks).length > 0
          ? <div style={{ display:"flex", flexDirection:"column", gap:10 }}>{filtered(stocks).map((h,i) => <StockCryptoCard key={i} item={h} fmtTime={fmtTime}/>)}<div style={{textAlign:"center",fontSize:9,color:"var(--text10)",marginTop:4,letterSpacing:1}}>TAP ANY CARD TO EXPAND DETAILS</div></div>
          : <EmptyState label="stock" />
      )}
      {activeTab === "crypto" && (
        filtered(crypto).length > 0
          ? <div style={{ display:"flex", flexDirection:"column", gap:10 }}>{filtered(crypto).map((h,i) => <StockCryptoCard key={i} item={h} fmtTime={fmtTime}/>)}<div style={{textAlign:"center",fontSize:9,color:"var(--text10)",marginTop:4,letterSpacing:1}}>TAP ANY CARD TO EXPAND DETAILS</div></div>
          : <EmptyState label="crypto" />
      )}
      {activeTab === "chartai" && (
        filtered(chartai).length > 0
          ? <div style={{ display:"flex", flexDirection:"column", gap:10 }}>{filtered(chartai).map((h,i) => <ChartAICard key={i} item={h} fmtTime={fmtTime}/>)}<div style={{textAlign:"center",fontSize:9,color:"var(--text10)",marginTop:4,letterSpacing:1}}>TAP ANY CARD TO EXPAND DETAILS</div></div>
          : <EmptyState label="Chart AI" />
      )}
      {activeTab === "accuracy" && (
        <AccuracyPanel user={user} currency={currency} theme={theme}/>
      )}
    </div>
  );
}

export default HistoryPanel;
