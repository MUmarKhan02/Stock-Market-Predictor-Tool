'use client';

import { useState, useEffect } from "react";
import { Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, ReferenceLine } from "recharts";
import { cnnLstmPredict, fetchAssetInfo, fmtAmt, formatPrice, generatePriceData } from "../shared/utils";
import { AssetLogo } from "../shared/AssetLogo";
import { ExportPDFButton } from "../shared/ExportPDF";

function calcVolatility(prices) {
  if (prices.length < 2) return 0;
  const returns = [];
  for (let i = 1; i < prices.length; i++) returns.push(Math.log(prices[i] / prices[i - 1]));
  const mean = returns.reduce((s, r) => s + r, 0) / returns.length;
  const variance = returns.reduce((s, r) => s + (r - mean) ** 2, 0) / returns.length;
  return Math.sqrt(variance * 252) * 100;
}

// Max drawdown (%)
function calcMaxDrawdown(prices) {
  let peak = prices[0], maxDD = 0;
  for (const p of prices) {
    if (p > peak) peak = p;
    const dd = (peak - p) / peak;
    if (dd > maxDD) maxDD = dd;
  }
  return maxDD * 100;
}

// Sharpe ratio (assume 4.5% risk-free rate, annualised)
function calcSharpe(prices) {
  if (prices.length < 2) return 0;
  const returns = [];
  for (let i = 1; i < prices.length; i++) returns.push((prices[i] - prices[i - 1]) / prices[i - 1]);
  const mean = returns.reduce((s, r) => s + r, 0) / returns.length;
  const std = Math.sqrt(returns.reduce((s, r) => s + (r - mean) ** 2, 0) / returns.length);
  if (std === 0) return 0;
  const annReturn = mean * 252;
  const annStd = std * Math.sqrt(252);
  return ((annReturn - 0.045) / annStd).toFixed(2);
}

// Build a simulated portfolio value history from holdings
function buildPortfolioHistory(holdings, days = 90) {
  if (!holdings.length) return [];
  const allPrices = holdings.map(h => {
    const seed = h.ticker.split("").reduce((s, c) => s + c.charCodeAt(0), 0);
    const raw = generatePriceData(days + 1, seed, h.currentPrice, h.isCrypto ? 0.05 : 0.02);
    const scale = h.currentPrice / raw[raw.length - 1];
    return raw.map(p => p * scale);
  });
  return Array.from({ length: days }, (_, i) => {
    const totalVal = holdings.reduce((sum, h, hi) => sum + (allPrices[hi][i] * h.qty), 0);
    return { day: i + 1, value: parseFloat(totalVal.toFixed(2)) };
  });
}

// Predict future portfolio total value
function predictPortfolioFuture(holdings, days = 10) {
  if (!holdings.length) return [];
  const allPreds = holdings.map(h => {
    const seed = h.ticker.split("").reduce((s, c) => s + c.charCodeAt(0), 0);
    const history = generatePriceData(200, seed, h.currentPrice, h.isCrypto ? 0.05 : 0.02);
    const scale = h.currentPrice / history[history.length - 1];
    const scaled = history.map(p => p * scale);
    return cnnLstmPredict(scaled, days);
  });
  return Array.from({ length: days }, (_, i) => {
    const total = holdings.reduce((sum, h, hi) => sum + (allPreds[hi][i].price * h.qty), 0);
    const totalUpper = holdings.reduce((sum, h, hi) => sum + (allPreds[hi][i].upper * h.qty), 0);
    const totalLower = holdings.reduce((sum, h, hi) => sum + (allPreds[hi][i].lower * h.qty), 0);
    return {
      day: `+${i + 1}d`,
      predicted: parseFloat(total.toFixed(2)),
      upper: parseFloat(totalUpper.toFixed(2)),
      lower: parseFloat(totalLower.toFixed(2)),
    };
  });
}

// Generate per-holding rebalance suggestion via Claude API
async function fetchRebalanceSuggestions(holdings) {
  const summaries = holdings.map(h =>
    `${h.ticker} (${h.isCrypto ? "crypto" : "stock"}): qty=${h.qty}, avgCost=${h.avgCost.toFixed(2)}, currentPrice=${h.currentPrice.toFixed(2)}, P&L=${((h.currentPrice - h.avgCost) / h.avgCost * 100).toFixed(1)}%, weight=${h.weight.toFixed(1)}%`
  ).join("\n");

  const prompt = `You are a portfolio analyst. Here are the current holdings:\n${summaries}\n
Return ONLY a JSON array (no markdown) with one object per holding:
[{"ticker":"X","signal":"BUY_MORE|HOLD|TRIM|SELL","reason":"one sentence","suggestedWeight":15,"urgency":"high|medium|low","riskFlag":true|false}]
Base signals on: concentration risk, diversification, P&L momentum, asset type balance. Keep reasons concise.`;

  const res = await fetch("/api/claude", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514", max_tokens: 800,
      messages: [{ role: "user", content: prompt }],
    }),
  });
  const data = await res.json();
  const text = data.content?.filter(b => b.type === "text").map(b => b.text).join("") || "";
  const match = text.match(/\[[\s\S]*\]/);
  if (!match) throw new Error("No JSON");
  return JSON.parse(match[0]);
}

const SIGNAL_COLORS = { BUY_MORE: "#00d4aa", HOLD: "#fbbf24", TRIM: "#fb923c", SELL: "#ff6b6b" };
const SIGNAL_ICONS  = { BUY_MORE: "⬆", HOLD: "⏸", TRIM: "✂", SELL: "⬇" };

function PortfolioPanel({ currency, theme }) {
  const isDark = theme === "dark";
  const fp = (v) => formatPrice(v, currency, false);
  const fa = (v) => fmtAmt(v, currency);

  // holdings: [{ticker, qty, avgCost, currentPrice, isCrypto}]
  const [holdings, setHoldings] = useState([]);
  const [newTicker, setNewTicker] = useState("");
  const [newQty, setNewQty] = useState("");
  const [newAvg, setNewAvg] = useState("");
  const [newIsCrypto, setNewIsCrypto] = useState(false);
  const [fetchingTicker, setFetchingTicker] = useState(false);
  const [addError, setAddError] = useState("");

  const [activeSection, setActiveSection] = useState("overview");
  const [histData, setHistData] = useState([]);
  const [futureData, setFutureData] = useState([]);
  const [rebalance, setRebalance] = useState(null);
  const [rebalanceLoading, setRebalanceLoading] = useState(false);
  const [horizon, setHorizon] = useState(10);

  // Derived metrics
  const totalCost  = holdings.reduce((s, h) => s + h.avgCost * h.qty, 0);
  const totalValue = holdings.reduce((s, h) => s + h.currentPrice * h.qty, 0);
  const totalPnL   = totalValue - totalCost;
  const totalPnLPct = totalCost > 0 ? (totalPnL / totalCost * 100) : 0;

  // Weights
  const withWeights = holdings.map(h => ({
    ...h,
    value: h.currentPrice * h.qty,
    cost:  h.avgCost * h.qty,
    pnl:   (h.currentPrice - h.avgCost) * h.qty,
    pnlPct: totalValue > 0 ? ((h.currentPrice * h.qty) / totalValue * 100) : 0,
    weight: totalValue > 0 ? (h.currentPrice * h.qty / totalValue * 100) : 0,
  }));

  // Risk metrics from simulated price history
  const riskMetrics = (() => {
    if (!holdings.length) return null;
    const hist = buildPortfolioHistory(holdings, 90);
    if (hist.length < 10) return null;
    const prices = hist.map(d => d.value);
    return {
      vol: calcVolatility(prices).toFixed(1),
      maxDD: calcMaxDrawdown(prices).toFixed(1),
      sharpe: calcSharpe(prices),
    };
  })();

  // Rebuild charts when holdings or horizon changes
  useEffect(() => {
    if (!holdings.length) { setHistData([]); setFutureData([]); return; }
    setHistData(buildPortfolioHistory(holdings, 90));
    setFutureData(predictPortfolioFuture(holdings, horizon));
  }, [holdings, horizon]);

  const addHolding = async () => {
    const ticker = newTicker.trim().toUpperCase();
    const qty = parseFloat(newQty);
    const avg = parseFloat(newAvg);
    if (!ticker || isNaN(qty) || qty <= 0 || isNaN(avg) || avg <= 0) {
      setAddError("Please fill in all fields with valid values."); return;
    }
    if (holdings.find(h => h.ticker === ticker)) {
      setAddError(`${ticker} is already in your portfolio.`); return;
    }
    setFetchingTicker(true); setAddError("");
    try {
      const info = await fetchAssetInfo(ticker, newIsCrypto);
      if (!info.valid) { setAddError(`"${ticker}" not found.`); setFetchingTicker(false); return; }
      setHoldings(prev => [...prev, {
        ticker: info.ticker || ticker,
        name: info.name || ticker,
        qty,
        avgCost: avg,
        currentPrice: info.currentPrice || avg,
        isCrypto: newIsCrypto,
        sector: info.sector || (newIsCrypto ? "Crypto" : "Stock"),
        volatility: info.volatility || (newIsCrypto ? 0.05 : 0.02),
      }]);
      setNewTicker(""); setNewQty(""); setNewAvg(""); setRebalance(null);
    } catch (e) { setAddError("Failed to fetch price. Try again."); }
    setFetchingTicker(false);
  };

  const removeHolding = (ticker) => {
    setHoldings(prev => prev.filter(h => h.ticker !== ticker));
    setRebalance(null);
  };

  const runRebalance = async () => {
    if (!withWeights.length) return;
    setRebalanceLoading(true); setRebalance(null);
    try { setRebalance(await fetchRebalanceSuggestions(withWeights)); }
    catch(e) { setRebalance([]); }
    setRebalanceLoading(false);
  };

  const sections = [
    { id: "overview",    icon: "📊", label: "Overview"   },
    { id: "holdings",    icon: "📋", label: "Holdings"   },
    { id: "performance", icon: "📈", label: "Performance"},
    { id: "risk",        icon: "⚠",  label: "Risk"       },
    { id: "rebalance",   icon: "⚖",  label: "Rebalance"  },
  ];

  const emptyState = (
    <div style={{ textAlign: "center", padding: "clamp(30px,6vw,60px) 20px", color: "var(--text9)" }}>
      <div style={{ fontSize: "clamp(36px,7vw,52px)", marginBottom: 14 }}>💼</div>
      <div style={{ fontSize: "clamp(13px,2.5vw,16px)", fontWeight: 700, color: "var(--text5)", marginBottom: 8 }}>Your portfolio is empty</div>
      <div style={{ fontSize: "clamp(10px,2vw,12px)", color: "var(--text9)", lineHeight: 1.7 }}>Add your first holding above to get started.<br/>Live prices are fetched automatically.</div>
    </div>
  );

  return (
    <div id="export-portfolio" style={{ animation: "slideIn 0.3s ease" }}>

      {/* ── Export PDF button ── */}
      {holdings.length > 0 && (
        <div style={{display:"flex",justifyContent:"flex-end",marginBottom:10}}>
          <ExportPDFButton
            elementId="export-portfolio"
            filename={`portfolio_analysis_${new Date().toISOString().slice(0,10)}.pdf`}
            title="Portfolio Analysis"
            subtitle={`${holdings.length} Holdings · Total Value ${holdings.length ? "tracked" : ""} · ${new Date().toLocaleDateString()}`}
            theme={theme}
            label="⬇ Export PDF"
          />
        </div>
      )}

      {/* ── Add holding form ── */}
      <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 16, padding: "clamp(14px,3vw,22px)", marginBottom: 16 }}>
        <div style={{ fontSize: 10, color: "var(--text9)", letterSpacing: 2, marginBottom: 12, textTransform: "uppercase" }}>Add Holding</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
          {/* Ticker */}
          <input value={newTicker} onChange={e => setNewTicker(e.target.value.toUpperCase())}
            onKeyDown={e => e.key === "Enter" && addHolding()}
            placeholder="Ticker e.g. AAPL"
            style={{ flex: "2 1 120px", minWidth: 0, padding: "9px 12px", borderRadius: 8, fontSize: 12, fontFamily: "monospace", background: "var(--input-bg)", border: "1px solid var(--border3)", color: "var(--text)", outline: "none" }} />
          {/* Quantity */}
          <input value={newQty} onChange={e => setNewQty(e.target.value)}
            placeholder="Qty / Units"
            style={{ flex: "1 1 90px", minWidth: 0, padding: "9px 12px", borderRadius: 8, fontSize: 12, fontFamily: "monospace", background: "var(--input-bg)", border: "1px solid var(--border3)", color: "var(--text)", outline: "none" }} />
          {/* Avg cost */}
          <input value={newAvg} onChange={e => setNewAvg(e.target.value)}
            placeholder="Avg buy price ($)"
            style={{ flex: "1 1 110px", minWidth: 0, padding: "9px 12px", borderRadius: 8, fontSize: 12, fontFamily: "monospace", background: "var(--input-bg)", border: "1px solid var(--border3)", color: "var(--text)", outline: "none" }} />
          {/* Type toggle */}
          <button onClick={() => setNewIsCrypto(v => !v)}
            style={{ padding: "9px 14px", borderRadius: 8, border: `1px solid ${newIsCrypto ? "#f7931a60" : "#00d4aa60"}`, background: newIsCrypto ? "rgba(247,147,26,0.12)" : "rgba(0,212,170,0.1)", color: newIsCrypto ? "#f7931a" : "#00d4aa", fontSize: 11, fontFamily: "monospace", fontWeight: 700, flexShrink: 0 }}>
            {newIsCrypto ? "₿ Crypto" : "📈 Stock"}
          </button>
          {/* Add */}
          <button onClick={addHolding} disabled={fetchingTicker}
            style={{ padding: "9px 18px", borderRadius: 8, border: `1px solid ${PORT_ACCENT}60`, background: `${PORT_ACCENT}18`, color: PORT_ACCENT, fontSize: 12, fontFamily: "monospace", fontWeight: 800, flexShrink: 0, opacity: fetchingTicker ? 0.5 : 1 }}>
            {fetchingTicker ? "⟳" : "+ ADD"}
          </button>
        </div>
        {addError && <div style={{ fontSize: 11, color: "#ff8080", marginTop: 4 }}>⚠ {addError}</div>}

        {/* Quick-add popular */}
        {holdings.length === 0 && (
          <div style={{ marginTop: 10 }}>
            <div style={{ fontSize: 10, color: "var(--text9)", marginBottom: 6 }}>QUICK ADD DEMO PORTFOLIO:</div>
            <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
              {[["AAPL",10,150,false],["MSFT",5,380,false],["NVDA",3,800,false],["BTC",0.05,60000,true],["ETH",0.5,3200,true]].map(([t,q,a,c])=>(
                <button key={t} onClick={async()=>{
                  setFetchingTicker(true); setAddError("");
                  try{const info=await fetchAssetInfo(t,c);if(info.valid)setHoldings(prev=>[...prev,{ticker:info.ticker||t,name:info.name||t,qty:q,avgCost:a,currentPrice:info.currentPrice||a,isCrypto:c,sector:info.sector||(c?"Crypto":"Stock"),volatility:info.volatility||(c?0.05:0.02)}]);}
                  catch(e){}setFetchingTicker(false);
                }}
                  style={{ padding: "4px 10px", borderRadius: 6, fontSize: 10, fontFamily: "monospace", fontWeight: 700, border: "1px solid var(--border3)", background: "var(--surface2)", color: "var(--text6)", cursor: "pointer" }}>
                  {t}
                </button>
              ))}
              <button onClick={async()=>{
                const demo=[["AAPL",10,150,false],["MSFT",5,380,false],["NVDA",3,800,false],["BTC",0.05,60000,true],["ETH",0.5,3200,true]];
                setFetchingTicker(true);
                for(const[t,q,a,c] of demo){try{const info=await fetchAssetInfo(t,c);if(info.valid)setHoldings(prev=>[...prev,{ticker:info.ticker||t,name:info.name||t,qty:q,avgCost:a,currentPrice:info.currentPrice||a,isCrypto:c,sector:info.sector||(c?"Crypto":"Stock"),volatility:info.volatility||(c?0.05:0.02)}]);}catch(e){}}
                setFetchingTicker(false);
              }} style={{ padding: "4px 12px", borderRadius: 6, fontSize: 10, fontFamily: "monospace", fontWeight: 700, border: `1px solid ${PORT_ACCENT}50`, background: `${PORT_ACCENT}12`, color: PORT_ACCENT, cursor: "pointer" }}>
                + Load All Demo
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Section tabs ── */}
      {holdings.length > 0 && (
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 14 }}>
          {sections.map(s => (
            <button key={s.id} onClick={() => setActiveSection(s.id)}
              style={{ padding: "7px 14px", borderRadius: 9, fontSize: "clamp(9px,2vw,11px)", fontFamily: "monospace", fontWeight: 700, border: "1px solid "+(activeSection === s.id ? PORT_ACCENT+"60" : "var(--border)"), background: activeSection === s.id ? `${PORT_ACCENT}18` : "var(--surface)", color: activeSection === s.id ? PORT_ACCENT : "var(--text8)", transition: "all 0.15s", whiteSpace: "nowrap" }}>
              {s.icon} {s.label}
            </button>
          ))}
        </div>
      )}

      {/* ── OVERVIEW ── */}
      {(activeSection === "overview" || !holdings.length) && (
        holdings.length === 0 ? emptyState : (
          <div style={{ animation: "slideIn 0.25s ease" }}>
            {/* Summary cards */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(clamp(130px,22vw,180px),1fr))", gap: 10, marginBottom: 16 }}>
              {[
                { label: "Total Value",    val: fa(totalValue),  sub: `${holdings.length} holdings`, color: PORT_ACCENT },
                { label: "Total Cost",     val: fa(totalCost),   sub: "amount invested",              color: "var(--text4)" },
                { label: "Unrealized P&L", val: `${totalPnL >= 0 ? "+" : ""}${fa(totalPnL)}`, sub: `${totalPnLPct >= 0 ? "+" : ""}${totalPnLPct.toFixed(2)}%`, color: totalPnL >= 0 ? "#00d4aa" : "#ff6b6b" },
                { label: "Best Performer", val: withWeights.length ? withWeights.sort((a,b)=>b.pnlPct-a.pnlPct)[0]?.ticker : "—", sub: withWeights.length ? `+${Math.max(...withWeights.map(h=>h.pnlPct)).toFixed(1)}%` : "", color: "#00d4aa" },
                { label: "Worst Performer",val: withWeights.length ? withWeights.sort((a,b)=>a.pnlPct-b.pnlPct)[0]?.ticker : "—", sub: withWeights.length ? `${Math.min(...withWeights.map(h=>h.pnlPct)).toFixed(1)}%` : "", color: "#ff6b6b" },
                { label: "Crypto / Stock", val: `${withWeights.filter(h=>h.isCrypto).reduce((s,h)=>s+h.weight,0).toFixed(0)}% / ${withWeights.filter(h=>!h.isCrypto).reduce((s,h)=>s+h.weight,0).toFixed(0)}%`, sub: "allocation split", color: "#fbbf24" },
              ].map(({ label, val, sub, color }) => (
                <div key={label} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: "12px 14px" }}>
                  <div style={{ fontSize: 9, color: "var(--text9)", marginBottom: 4, letterSpacing: 1, textTransform: "uppercase" }}>{label}</div>
                  <div style={{ fontSize: "clamp(13px,2.5vw,17px)", fontWeight: 800, color, fontFamily: "monospace", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{val}</div>
                  {sub && <div style={{ fontSize: 10, color: "var(--text8)", marginTop: 3 }}>{sub}</div>}
                </div>
              ))}
            </div>

            {/* Allocation bar */}
            <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, padding: "clamp(12px,3vw,18px)", marginBottom: 14 }}>
              <div style={{ fontSize: 10, color: "var(--text9)", letterSpacing: 2, marginBottom: 12 }}>ALLOCATION</div>
              <div style={{ display: "flex", height: 28, borderRadius: 8, overflow: "hidden", gap: 2, marginBottom: 12 }}>
                {withWeights.map((h, i) => {
                  const colors = ["#6366f1","#00d4aa","#f7931a","#a78bfa","#38bdf8","#fbbf24","#fb923c","#ff6b6b"];
                  const c = colors[i % colors.length];
                  return (
                    <div key={h.ticker} title={`${h.ticker}: ${h.weight.toFixed(1)}%`}
                      style={{ width: `${h.weight}%`, background: c, display: "flex", alignItems: "center", justifyContent: "center", minWidth: h.weight > 5 ? 0 : 0, transition: "width 0.5s ease", overflow: "hidden" }}>
                      {h.weight > 8 && <span style={{ fontSize: 9, fontWeight: 700, color: "#fff", whiteSpace: "nowrap" }}>{h.ticker}</span>}
                    </div>
                  );
                })}
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {withWeights.map((h, i) => {
                  const colors = ["#6366f1","#00d4aa","#f7931a","#a78bfa","#38bdf8","#fbbf24","#fb923c","#ff6b6b"];
                  const c = colors[i % colors.length];
                  return (
                    <div key={h.ticker} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11 }}>
                      <div style={{ width: 8, height: 8, borderRadius: 2, background: c, flexShrink: 0 }} />
                      <span style={{ color: "var(--text4)", fontFamily: "monospace", fontWeight: 700 }}>{h.ticker}</span>
                      <span style={{ color: "var(--text8)" }}>{h.weight.toFixed(1)}%</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )
      )}

      {/* ── HOLDINGS ── */}
      {activeSection === "holdings" && holdings.length > 0 && (
        <div style={{ animation: "slideIn 0.25s ease" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {withWeights.map(h => {
              const pnlPos = h.pnl >= 0;
              return (
                <div key={h.ticker} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, padding: "clamp(12px,2.5vw,18px)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 10 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
                      <AssetLogo ticker={h.ticker} isCrypto={h.isCrypto} accent={h.isCrypto ? "#f7931a" : "#00d4aa"} />
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: "clamp(14px,3vw,17px)", fontWeight: 800, color: h.isCrypto ? "#f7931a" : "#00d4aa", fontFamily: "'Syne',sans-serif" }}>{h.ticker}</div>
                        <div style={{ fontSize: 11, color: "var(--text8)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{h.name}</div>
                        <div style={{ fontSize: 10, color: "var(--text9)" }}>{h.sector}</div>
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-start" }}>
                      {[
                        { label: "Qty",      val: h.qty.toLocaleString(),   color: "var(--text3)" },
                        { label: "Avg Cost", val: fp(h.avgCost),            color: "var(--text4)" },
                        { label: "Current",  val: fp(h.currentPrice),       color: "var(--text)" },
                        { label: "Value",    val: fa(h.value),              color: PORT_ACCENT },
                        { label: "P&L",      val: `${pnlPos?"+":""}${fa(h.pnl)}`, color: pnlPos?"#00d4aa":"#ff6b6b" },
                        { label: "Return",   val: `${pnlPos?"+":""}${h.pnlPct.toFixed(1)}%`, color: pnlPos?"#00d4aa":"#ff6b6b" },
                        { label: "Weight",   val: `${h.weight.toFixed(1)}%`, color: "#fbbf24" },
                      ].map(({ label, val, color }) => (
                        <div key={label} style={{ textAlign: "center", minWidth: 55 }}>
                          <div style={{ fontSize: 9, color: "var(--text9)", letterSpacing: 1, marginBottom: 2 }}>{label}</div>
                          <div style={{ fontSize: "clamp(10px,2vw,12px)", fontWeight: 700, color, fontFamily: "monospace" }}>{val}</div>
                        </div>
                      ))}
                      <button onClick={() => removeHolding(h.ticker)}
                        style={{ padding: "4px 10px", borderRadius: 6, border: "1px solid rgba(255,107,107,0.3)", background: "rgba(255,107,107,0.06)", color: "#ff6b6b", fontSize: 10, fontFamily: "monospace", fontWeight: 700, alignSelf: "center" }}>
                        ✕
                      </button>
                    </div>
                  </div>
                  {/* P&L bar */}
                  <div style={{ marginTop: 10, height: 4, background: "var(--border)", borderRadius: 2, overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${Math.min(100, Math.max(0, 50 + h.pnlPct))}%`, background: pnlPos ? "#00d4aa" : "#ff6b6b", borderRadius: 2, transition: "width 0.8s ease" }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── PERFORMANCE ── */}
      {activeSection === "performance" && holdings.length > 0 && (
        <div style={{ animation: "slideIn 0.25s ease" }}>
          {/* Horizon selector */}
          <div style={{ display: "flex", gap: 6, marginBottom: 14, alignItems: "center", flexWrap: "wrap" }}>
            <span style={{ fontSize: 10, color: "var(--text9)" }}>PREDICT:</span>
            {[5,10,21].map(d => (
              <button key={d} onClick={() => setHorizon(d)}
                style={{ padding: "5px 12px", borderRadius: 7, fontSize: 10, fontFamily: "monospace", fontWeight: 700, border: "1px solid "+(horizon===d?PORT_ACCENT+"60":"var(--border)"), background: horizon===d?`${PORT_ACCENT}18`:"var(--surface)", color: horizon===d?PORT_ACCENT:"var(--text8)" }}>
                {d===5?"1W":d===10?"2W":"1M"}
              </button>
            ))}
          </div>

          {/* History chart */}
          <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 16, padding: "clamp(12px,3vw,20px)", marginBottom: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10, flexWrap: "wrap", gap: 6 }}>
              <div style={{ fontSize: 10, color: "var(--text9)", letterSpacing: 2 }}>90-DAY PORTFOLIO HISTORY</div>
              <div style={{ display: "flex", gap: 10, fontSize: 10, color: "var(--text8)" }}>
                <span><span style={{ color: PORT_ACCENT }}>━</span> History</span>
                {futureData.length > 0 && <span><span style={{ color: "#fbbf24" }}>╌</span> Predicted</span>}
              </div>
            </div>
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={histData} margin={{ top: 8, right: 4, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="portGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor={PORT_ACCENT} stopOpacity={0.2} />
                    <stop offset="95%" stopColor={PORT_ACCENT} stopOpacity={0}   />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--grid)" />
                <XAxis dataKey="day" stroke="var(--text12)" tick={{ fill: "var(--text9)", fontSize: 9 }} />
                <YAxis stroke="var(--text12)" tick={{ fill: "var(--text9)", fontSize: 9 }} tickFormatter={v => fa(v)} width={70} />
                <Tooltip contentStyle={{ background: "var(--tooltip-bg)", border: "1px solid var(--border)", fontSize: 10, fontFamily: "monospace" }} formatter={v => [fa(v), "Value"]} />
                <Area type="monotone" dataKey="value" stroke={PORT_ACCENT} strokeWidth={2} fill="url(#portGrad)" dot={false} name="Portfolio Value" />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Prediction chart */}
          {futureData.length > 0 && (
            <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 16, padding: "clamp(12px,3vw,20px)", marginBottom: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10, flexWrap: "wrap", gap: 6 }}>
                <div style={{ fontSize: 10, color: "var(--text9)", letterSpacing: 2 }}>CNN+LSTM PORTFOLIO FORECAST</div>
                <div style={{ background: `${PORT_ACCENT}18`, border: `1px solid ${PORT_ACCENT}40`, borderRadius: 6, padding: "3px 10px", fontSize: 9, color: PORT_ACCENT }}>
                  {horizon === 5 ? "1W" : horizon === 10 ? "2W" : "1M"} AHEAD
                </div>
              </div>
              {/* Predicted total vs current */}
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 14 }}>
                {[
                  { label: "Current Value",   val: fa(totalValue),                        color: "var(--text)" },
                  { label: "Predicted Value",  val: fa(futureData[futureData.length-1]?.predicted || 0), color: PORT_ACCENT },
                  { label: "Predicted Change", val: `${((futureData[futureData.length-1]?.predicted - totalValue)/totalValue*100)>=0?"+":""}${((futureData[futureData.length-1]?.predicted - totalValue)/totalValue*100).toFixed(2)}%`,
                    color: futureData[futureData.length-1]?.predicted >= totalValue ? "#00d4aa" : "#ff6b6b" },
                  { label: "Predicted P&L",   val: `${(futureData[futureData.length-1]?.predicted - totalValue)>=0?"+":""}${fa(futureData[futureData.length-1]?.predicted - totalValue)}`,
                    color: futureData[futureData.length-1]?.predicted >= totalValue ? "#00d4aa" : "#ff6b6b" },
                ].map(({ label, val, color }) => (
                  <div key={label} style={{ flex: 1, minWidth: "clamp(100px,20vw,140px)", background: "var(--surface2)", border: "1px solid var(--border)", borderRadius: 10, padding: "10px 12px" }}>
                    <div style={{ fontSize: 9, color: "var(--text9)", marginBottom: 3, letterSpacing: 1 }}>{label.toUpperCase()}</div>
                    <div style={{ fontSize: "clamp(12px,2.5vw,15px)", fontWeight: 800, color, fontFamily: "monospace" }}>{val}</div>
                  </div>
                ))}
              </div>
              <ResponsiveContainer width="100%" height={180}>
                <AreaChart data={futureData} margin={{ top: 8, right: 4, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="predGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#fbbf24" stopOpacity={0.15} />
                      <stop offset="95%" stopColor="#fbbf24" stopOpacity={0}    />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--grid)" />
                  <XAxis dataKey="day" stroke="var(--text12)" tick={{ fill: "var(--text9)", fontSize: 9 }} />
                  <YAxis stroke="var(--text12)" tick={{ fill: "var(--text9)", fontSize: 9 }} tickFormatter={v => fa(v)} width={70} />
                  <Tooltip contentStyle={{ background: "var(--tooltip-bg)", border: "1px solid var(--border)", fontSize: 10, fontFamily: "monospace" }} formatter={v => [fa(v)]} />
                  <Area type="monotone" dataKey="upper"     stroke="rgba(251,191,36,0.2)" strokeWidth={1} fill="url(#predGrad)" dot={false} name="Upper" />
                  <Area type="monotone" dataKey="lower"     stroke="rgba(251,191,36,0.2)" strokeWidth={1} fill="rgba(251,191,36,0.04)" dot={false} name="Lower" />
                  <Line type="monotone" dataKey="predicted" stroke="#fbbf24" strokeWidth={2} dot={{ fill: "#fbbf24", r: 3 }} name="Predicted" strokeDasharray="6 3" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Per-holding predicted P&L table */}
          <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, padding: "clamp(12px,3vw,18px)" }}>
            <div style={{ fontSize: 10, color: "var(--text9)", letterSpacing: 2, marginBottom: 12 }}>PER-HOLDING PREDICTED P&amp;L</div>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "clamp(10px,2vw,12px)", minWidth: 400 }}>
                <thead>
                  <tr style={{ color: "var(--text9)", borderBottom: "1px solid var(--border)" }}>
                    {["Asset","Current","Predicted","Chg %","Predicted P&L","Confidence"].map(h => (
                      <td key={h} style={{ padding: "6px 8px 8px 0", whiteSpace: "nowrap", fontSize: 9, letterSpacing: 1 }}>{h}</td>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {withWeights.map(h => {
                    const seed = h.ticker.split("").reduce((s, c) => s + c.charCodeAt(0), 0);
                    const hist = generatePriceData(200, seed, h.currentPrice, h.isCrypto ? 0.05 : 0.02);
                    const scale = h.currentPrice / hist[hist.length - 1];
                    const preds = cnnLstmPredict(hist.map(p => p * scale), horizon);
                    const lastPred = preds[preds.length - 1];
                    const predPrice = lastPred.price;
                    const chg = (predPrice - h.currentPrice) / h.currentPrice * 100;
                    const predPnL = (predPrice - h.avgCost) * h.qty;
                    const avgConf = preds.reduce((s, p) => s + p.confidence, 0) / preds.length;
                    const up = predPrice >= h.currentPrice;
                    return (
                      <tr key={h.ticker} style={{ borderTop: "1px solid var(--border)", color: "var(--text4)" }}>
                        <td style={{ padding: "7px 8px 7px 0", fontWeight: 700, color: h.isCrypto ? "#f7931a" : "#00d4aa", fontFamily: "monospace" }}>{h.ticker}</td>
                        <td style={{ padding: "7px 8px 7px 0", fontFamily: "monospace" }}>{fp(h.currentPrice)}</td>
                        <td style={{ padding: "7px 8px 7px 0", fontWeight: 700, color: up ? "#00d4aa" : "#ff6b6b", fontFamily: "monospace" }}>{fp(predPrice)}</td>
                        <td style={{ padding: "7px 8px 7px 0", color: up ? "#00d4aa" : "#ff6b6b", fontWeight: 700 }}>{up ? "+" : ""}{chg.toFixed(2)}%</td>
                        <td style={{ padding: "7px 8px 7px 0", color: predPnL >= 0 ? "#00d4aa" : "#ff6b6b", fontWeight: 700, fontFamily: "monospace" }}>{predPnL >= 0 ? "+" : ""}{fa(predPnL)}</td>
                        <td style={{ padding: "7px 0" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                            <div style={{ height: 4, width: 44, background: "var(--border)", borderRadius: 2 }}>
                              <div style={{ height: "100%", width: `${avgConf * 100}%`, background: "#a78bfa", borderRadius: 2 }} />
                            </div>
                            <span style={{ color: "#a78bfa", fontSize: 9 }}>{(avgConf * 100).toFixed(0)}%</span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── RISK ── */}
      {activeSection === "risk" && holdings.length > 0 && (
        <div style={{ animation: "slideIn 0.25s ease" }}>
          {riskMetrics && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(clamp(130px,25vw,200px),1fr))", gap: 12, marginBottom: 16 }}>
              {[
                { label: "Annualised Volatility", val: `${riskMetrics.vol}%`, sub: riskMetrics.vol > 30 ? "⚠ High risk" : riskMetrics.vol > 15 ? "Moderate risk" : "Low risk", color: riskMetrics.vol > 30 ? "#ff6b6b" : riskMetrics.vol > 15 ? "#fbbf24" : "#00d4aa" },
                { label: "Max Drawdown",          val: `-${riskMetrics.maxDD}%`, sub: riskMetrics.maxDD > 20 ? "⚠ Significant drawdown" : "Manageable drawdown", color: riskMetrics.maxDD > 20 ? "#ff6b6b" : "#fbbf24" },
                { label: "Sharpe Ratio",          val: riskMetrics.sharpe, sub: riskMetrics.sharpe > 1 ? "Good risk-adjusted return" : riskMetrics.sharpe > 0 ? "Positive but low" : "Negative — poor risk/reward", color: riskMetrics.sharpe > 1 ? "#00d4aa" : riskMetrics.sharpe > 0 ? "#fbbf24" : "#ff6b6b" },
                { label: "Concentration Risk",    val: withWeights.length > 0 ? `${Math.max(...withWeights.map(h=>h.weight)).toFixed(0)}%` : "—", sub: `Largest single position`, color: Math.max(...withWeights.map(h=>h.weight)) > 40 ? "#ff6b6b" : "#fbbf24" },
                { label: "Crypto Exposure",       val: `${withWeights.filter(h=>h.isCrypto).reduce((s,h)=>s+h.weight,0).toFixed(0)}%`, sub: "Higher vol asset class", color: withWeights.filter(h=>h.isCrypto).reduce((s,h)=>s+h.weight,0) > 50 ? "#fb923c" : "#fbbf24" },
                { label: "# of Holdings",         val: holdings.length, sub: holdings.length <= 2 ? "⚠ Low diversification" : holdings.length >= 5 ? "Well diversified" : "Moderate diversification", color: holdings.length <= 2 ? "#ff6b6b" : holdings.length >= 5 ? "#00d4aa" : "#fbbf24" },
              ].map(({ label, val, sub, color }) => (
                <div key={label} style={{ background: "var(--surface)", border: `1px solid ${color}25`, borderRadius: 14, padding: "14px 16px" }}>
                  <div style={{ fontSize: 9, color: "var(--text9)", letterSpacing: 1, marginBottom: 6, textTransform: "uppercase" }}>{label}</div>
                  <div style={{ fontSize: "clamp(18px,4vw,26px)", fontWeight: 800, color, fontFamily: "monospace", marginBottom: 4 }}>{val}</div>
                  <div style={{ fontSize: 10, color: "var(--text8)", lineHeight: 1.5 }}>{sub}</div>
                </div>
              ))}
            </div>
          )}

          {/* Risk breakdown per holding */}
          <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, padding: "clamp(12px,3vw,18px)" }}>
            <div style={{ fontSize: 10, color: "var(--text9)", letterSpacing: 2, marginBottom: 12 }}>RISK PER HOLDING</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {withWeights.map(h => {
                const annVol = h.volatility * Math.sqrt(252) * 100;
                const riskScore = Math.min(100, (annVol / 80 * 40) + (h.weight > 30 ? 30 : h.weight / 30 * 30) + (h.isCrypto ? 20 : 0));
                const riskColor = riskScore > 60 ? "#ff6b6b" : riskScore > 35 ? "#fbbf24" : "#00d4aa";
                return (
                  <div key={h.ticker} style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                    <div style={{ minWidth: "clamp(50px,10vw,70px)", fontSize: 12, fontWeight: 700, color: h.isCrypto ? "#f7931a" : "#00d4aa", fontFamily: "monospace" }}>{h.ticker}</div>
                    <div style={{ flex: 1, minWidth: 120 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3, flexWrap: "wrap", gap: 4 }}>
                        <span style={{ fontSize: 10, color: riskColor, fontWeight: 700 }}>Risk Score: {riskScore.toFixed(0)}/100</span>
                        <span style={{ fontSize: 10, color: "var(--text8)" }}>Vol: {annVol.toFixed(0)}% · Weight: {h.weight.toFixed(1)}%</span>
                      </div>
                      <div style={{ height: 5, background: "var(--border)", borderRadius: 3, overflow: "hidden" }}>
                        <div style={{ height: "100%", width: `${riskScore}%`, background: riskColor, borderRadius: 3, transition: "width 0.8s ease" }} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── REBALANCE ── */}
      {activeSection === "rebalance" && holdings.length > 0 && (
        <div style={{ animation: "slideIn 0.25s ease" }}>
          <div style={{ marginBottom: 14 }}>
            <button onClick={runRebalance} disabled={rebalanceLoading}
              style={{ width: "100%", padding: "clamp(12px,2.5vw,16px)", borderRadius: 12, border: `1px solid ${PORT_ACCENT}50`, background: `${PORT_ACCENT}15`, color: PORT_ACCENT, fontSize: "clamp(11px,2.5vw,13px)", fontWeight: 800, fontFamily: "monospace", marginBottom: 12, opacity: rebalanceLoading ? 0.6 : 1 }}>
              {rebalanceLoading ? "⟳ ANALYSING YOUR PORTFOLIO..." : "🧠 GET AI REBALANCING SUGGESTIONS"}
            </button>
            {!rebalance && !rebalanceLoading && (
              <div style={{ fontSize: 11, color: "var(--text9)", textAlign: "center", lineHeight: 1.7 }}>
                Our AI will analyse your holdings for concentration risk, diversification, P&amp;L momentum, and asset balance — then suggest specific actions for each position.
              </div>
            )}
          </div>

          {rebalance && rebalance.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {rebalance.map((r, i) => {
                const sigColor = SIGNAL_COLORS[r.signal] || "#888";
                const holding = withWeights.find(h => h.ticker === r.ticker);
                return (
                  <div key={i} style={{ background: `${sigColor}08`, border: `1px solid ${sigColor}30`, borderRadius: 14, padding: "clamp(12px,2.5vw,18px)" }}>
                    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 10, marginBottom: 10 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <div style={{ width: 38, height: 38, borderRadius: 10, background: `${sigColor}20`, border: `2px solid ${sigColor}50`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, flexShrink: 0 }}>
                          {SIGNAL_ICONS[r.signal]}
                        </div>
                        <div>
                          <div style={{ fontSize: "clamp(14px,3vw,17px)", fontWeight: 800, color: sigColor, fontFamily: "'Syne',sans-serif" }}>{r.ticker}</div>
                          <div style={{ fontSize: 10, color: "var(--text8)" }}>{holding?.name}</div>
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                        <div style={{ padding: "5px 14px", borderRadius: 20, background: `${sigColor}18`, border: `1px solid ${sigColor}40`, fontSize: 11, fontWeight: 800, color: sigColor, fontFamily: "monospace" }}>
                          {r.signal?.replace("_", " ")}
                        </div>
                        {r.riskFlag && <div style={{ padding: "5px 10px", borderRadius: 20, background: "rgba(255,107,107,0.1)", border: "1px solid rgba(255,107,107,0.3)", fontSize: 10, color: "#ff6b6b", fontWeight: 700 }}>⚠ RISK FLAG</div>}
                        <div style={{ fontSize: 10, color: "var(--text8)", padding: "5px 10px", borderRadius: 20, background: "var(--surface2)", border: "1px solid var(--border)" }}>
                          Urgency: <strong style={{ color: r.urgency === "high" ? "#ff6b6b" : r.urgency === "medium" ? "#fbbf24" : "#00d4aa" }}>{r.urgency}</strong>
                        </div>
                      </div>
                    </div>
                    <div style={{ fontSize: "clamp(11px,2vw,13px)", color: "var(--text4)", lineHeight: 1.7, marginBottom: 10 }}>{r.reason}</div>
                    {holding && r.suggestedWeight != null && (
                      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                        <div style={{ fontSize: 10, color: "var(--text9)" }}>Current weight:</div>
                        <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text4)", fontFamily: "monospace" }}>{holding.weight.toFixed(1)}%</div>
                        <div style={{ fontSize: 12, color: "var(--text9)" }}>→</div>
                        <div style={{ fontSize: 12, fontWeight: 700, color: sigColor, fontFamily: "monospace" }}>Suggested: {r.suggestedWeight}%</div>
                        {/* Weight comparison bar */}
                        <div style={{ flex: 1, minWidth: 100, height: 6, background: "var(--border)", borderRadius: 3, overflow: "hidden", position: "relative" }}>
                          <div style={{ position: "absolute", height: "100%", width: `${Math.min(100, holding.weight)}%`, background: "var(--text9)", borderRadius: 3 }} />
                          <div style={{ position: "absolute", height: "100%", left: 0, width: `${Math.min(100, r.suggestedWeight)}%`, background: sigColor, borderRadius: 3, opacity: 0.7 }} />
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {rebalance && rebalance.length === 0 && (
            <div style={{ textAlign: "center", padding: 30, color: "var(--text8)", fontSize: 12 }}>Could not generate suggestions. Try again.</div>
          )}
        </div>
      )}
    </div>
  );
}

export default PortfolioPanel;
