'use client';

import { useState } from "react";
import { formatPrice } from "../shared/utils";
import { AssetLogo } from "../shared/AssetLogo";

function HistoryDetailPanel({ item, theme, currency, onClose, fmtTime }) {
  const isDark = theme === "dark";
  const fp = (v) => v != null ? formatPrice(v, currency, item.isCrypto || false) : "—";
  const isChart = item.type === "chartai";

  const VERDICT_COLORS = {
    "BUY NOW":"#00d4aa","CONSIDER BUYING":"#7dd4b0","WAIT & WATCH":"#fbbf24",
    "AVOID FOR NOW":"#fb923c","DO NOT BUY":"#ff6b6b",
    "STRONG BUY":"#00d4aa","BUY":"#7dd4b0","HOLD":"#fbbf24",
    "SELL":"#fb923c","STRONG SELL":"#ff6b6b","WAIT":"#888",
  };
  const vc = VERDICT_COLORS[item.verdict] || item.verdictColor || "#888";

  const [detailTab, setDetailTab] = useState(isChart ? "verdict" : "overview");

  const SectionLabel = ({ children }) => (
    <div style={{ fontSize:9, color:"var(--text9)", letterSpacing:2, textTransform:"uppercase", marginBottom:8, marginTop:16 }}>{children}</div>
  );

  const InfoRow = ({ label, value, color }) => (
    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"6px 0", borderBottom:"1px solid var(--border)" }}>
      <span style={{ fontSize:11, color:"var(--text8)" }}>{label}</span>
      <span style={{ fontSize:11, fontWeight:700, color:color||"var(--text3)", fontFamily:"monospace" }}>{value}</span>
    </div>
  );

  // ── Stock/Crypto detail ─────────────────────────────────────
  const StockDetail = () => (
    <div>
      {/* Header */}
      <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:16 }}>
        <AssetLogo ticker={item.ticker} isCrypto={item.type==="crypto"} accent={item.type==="crypto"?"#f7931a":"#00d4aa"} />
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ fontSize:"clamp(16px,3vw,20px)", fontWeight:800, color:item.type==="crypto"?"#f7931a":"#00d4aa", fontFamily:"'Syne',sans-serif" }}>{item.ticker}</div>
          <div style={{ fontSize:11, color:"var(--text6)" }}>{item.name}</div>
          <div style={{ fontSize:10, color:"var(--text9)" }}>{item.sector}</div>
        </div>
        <div style={{ textAlign:"right" }}>
          <div style={{ fontSize:"clamp(14px,2.5vw,17px)", fontWeight:800, color:"var(--text2)", fontFamily:"monospace" }}>{fp(item.price)}</div>
          <div style={{ fontSize:10, color:item.change>=0?"#00d4aa":"#ff6b6b", fontWeight:700 }}>
            {item.change>=0?"▲":"▼"} {Math.abs(item.change).toFixed(2)}%
          </div>
        </div>
      </div>

      {/* Sub-tabs */}
      <div style={{ display:"flex", gap:3, marginBottom:14, background:"var(--surface2)", borderRadius:10, padding:3, border:"1px solid var(--border)" }}>
        {[["overview","📊 Overview"],["signals","🔬 Signals"],["forecast","📈 Forecast"],["sizing","💰 Sizing"]].map(([id,label])=>(
          <button key={id} onClick={()=>setDetailTab(id)} style={{
            flex:1, padding:"6px 4px", borderRadius:7, fontSize:"clamp(8px,1.6vw,10px)",
            fontFamily:"monospace", fontWeight:700, border:"none", cursor:"pointer",
            background:detailTab===id?`${vc}20`:"transparent",
            color:detailTab===id?vc:"var(--text9)", transition:"all 0.15s", whiteSpace:"nowrap",
          }}>{label}</button>
        ))}
      </div>

      {/* Overview */}
      {detailTab==="overview" && (
        <div>
          {/* Verdict card */}
          <div style={{ background:`${vc}10`, border:`2px solid ${vc}35`, borderRadius:14, padding:"14px 16px", marginBottom:14 }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", flexWrap:"wrap", gap:8 }}>
              <div>
                <div style={{ fontSize:9, color:"var(--text9)", letterSpacing:2, marginBottom:4 }}>VERDICT</div>
                <div style={{ fontSize:"clamp(15px,3vw,20px)", fontWeight:800, color:vc, fontFamily:"'Syne',sans-serif" }}>
                  {item.verdictIcon} {item.verdict}
                </div>
                {item.verdictDesc && <div style={{ fontSize:11, color:"var(--text7)", marginTop:4, lineHeight:1.5 }}>{item.verdictDesc}</div>}
              </div>
              <div style={{ textAlign:"center" }}>
                <div style={{ fontSize:9, color:"var(--text9)", marginBottom:2 }}>SCORE</div>
                <div style={{ fontSize:"clamp(22px,4vw,30px)", fontWeight:800, color:vc, fontFamily:"monospace" }}>{item.score}</div>
                <div style={{ height:4, width:70, background:"var(--border)", borderRadius:2, marginTop:4, overflow:"hidden" }}>
                  <div style={{ height:"100%", width:`${Math.min(100,Math.max(0,(item.score+100)/2))}%`, background:vc, borderRadius:2 }}/>
                </div>
              </div>
            </div>
          </div>

          <SectionLabel>Key Metrics</SectionLabel>
          <InfoRow label="Horizon" value={item.horizon} />
          <InfoRow label="Price at Prediction" value={fp(item.price)} />
          <InfoRow label="Predicted Price" value={fp(item.predPrice)} color={item.change>=0?"#00d4aa":"#ff6b6b"} />
          <InfoRow label="Predicted Change" value={`${item.change>=0?"+":""}${parseFloat(item.change).toFixed(2)}%`} color={item.change>=0?"#00d4aa":"#ff6b6b"} />
          <InfoRow label="Confidence" value={`${item.confidence}%`} color="#a78bfa" />
          <InfoRow label="R² Score" value={item.r2} color="#38bdf8" />
          {item.marketCap && <InfoRow label="Market Cap" value={item.marketCap} />}
          {item.weekHigh52 != null && <InfoRow label="52W High" value={fp(item.weekHigh52)} />}
          {item.weekLow52  != null && <InfoRow label="52W Low"  value={fp(item.weekLow52)} />}

          {item.bestTiming && (
            <>
              <SectionLabel>Best Entry Timing</SectionLabel>
              <div style={{ background:`${item.bestTiming.color}10`, border:`1px solid ${item.bestTiming.color}30`, borderRadius:10, padding:"10px 12px" }}>
                <div style={{ fontSize:13, fontWeight:800, color:item.bestTiming.color, fontFamily:"monospace", marginBottom:4 }}>{item.bestTiming.label}</div>
                <div style={{ fontSize:11, color:"var(--text6)", lineHeight:1.6 }}>{item.bestTiming.advice}</div>
              </div>
            </>
          )}
        </div>
      )}

      {/* Signals */}
      {detailTab==="signals" && item.signals && (
        <div>
          <SectionLabel>Signal Breakdown ({item.signals.length} signals)</SectionLabel>
          <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
            {item.signals.map((sig,i)=>{
              const bw = Math.min(100,Math.max(0,(sig.score+100)/2));
              return (
                <div key={i} style={{ background:"var(--surface)", border:`1px solid ${sig.color}20`, borderRadius:10, padding:"10px 12px" }}>
                  <div style={{ display:"flex", justifyContent:"space-between", marginBottom:4, flexWrap:"wrap", gap:4 }}>
                    <span style={{ fontSize:12, fontWeight:800, color:sig.color }}>{sig.name}</span>
                    <div style={{ display:"flex", gap:6, alignItems:"center" }}>
                      <span style={{ fontSize:10, color:sig.color, fontWeight:700, background:`${sig.color}15`, padding:"2px 8px", borderRadius:10 }}>{sig.label}</span>
                      <span style={{ fontSize:10, color:"var(--text8)", fontFamily:"monospace" }}>{sig.score>0?"+":""}{sig.score}</span>
                    </div>
                  </div>
                  <div style={{ height:4, background:"var(--border)", borderRadius:2, overflow:"hidden", marginBottom:6 }}>
                    <div style={{ height:"100%", width:`${bw}%`, background:sig.color, borderRadius:2 }}/>
                  </div>
                  <div style={{ fontSize:10, color:"var(--text7)", lineHeight:1.5 }}>{sig.detail}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Forecast */}
      {detailTab==="forecast" && item.predPrices && (
        <div>
          <SectionLabel>Day-by-Day Forecast</SectionLabel>
          <div style={{ overflowX:"auto" }}>
            <table style={{ width:"100%", borderCollapse:"collapse", fontSize:"clamp(10px,2vw,12px)", minWidth:300 }}>
              <thead>
                <tr style={{ color:"var(--text9)", borderBottom:"1px solid var(--border)" }}>
                  {["Day","Price","Low","High","Conf."].map(h=>(
                    <td key={h} style={{ padding:"5px 8px 7px 0", fontSize:9, letterSpacing:1 }}>{h}</td>
                  ))}
                </tr>
              </thead>
              <tbody>
                {item.predPrices.map((p,i)=>{
                  const up = p.price > item.price;
                  return (
                    <tr key={i} style={{ borderTop:"1px solid var(--border)" }}>
                      <td style={{ padding:"6px 8px 6px 0", color:"var(--text8)", fontFamily:"monospace" }}>+{i+1}d</td>
                      <td style={{ padding:"6px 8px 6px 0", fontWeight:800, color:up?"#00d4aa":"#ff6b6b", fontFamily:"monospace" }}>{fp(p.price)}</td>
                      <td style={{ padding:"6px 8px 6px 0", color:"var(--text6)", fontFamily:"monospace" }}>{fp(p.lower)}</td>
                      <td style={{ padding:"6px 8px 6px 0", color:"var(--text6)", fontFamily:"monospace" }}>{fp(p.upper)}</td>
                      <td style={{ padding:"6px 0" }}>
                        <div style={{ display:"flex", alignItems:"center", gap:4 }}>
                          <div style={{ height:3, width:36, background:"var(--border)", borderRadius:2 }}>
                            <div style={{ height:"100%", width:`${p.confidence*100}%`, background:"#a78bfa", borderRadius:2 }}/>
                          </div>
                          <span style={{ fontSize:9, color:"#a78bfa" }}>{(p.confidence*100).toFixed(0)}%</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Timeline bars */}
          <div style={{ marginTop:14 }}>
            <div style={{ fontSize:9, color:"var(--text9)", letterSpacing:2, marginBottom:8 }}>PRICE MOVEMENT</div>
            <div style={{ display:"flex", gap:4, alignItems:"flex-end", overflowX:"auto", paddingBottom:4 }}>
              <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:3, flexShrink:0 }}>
                <div style={{ fontSize:9, color:"var(--text8)", fontFamily:"monospace" }}>{fp(item.price)}</div>
                <div style={{ width:36, height:36, background:"rgba(56,189,248,0.15)", border:"2px solid #38bdf8", borderRadius:6, display:"flex", alignItems:"center", justifyContent:"center", fontSize:8, color:"#38bdf8", fontWeight:700 }}>NOW</div>
              </div>
              <div style={{ color:"var(--text10)", fontSize:11, paddingBottom:18 }}>→</div>
              {item.predPrices.map((p,i)=>{
                const up = p.price >= item.price;
                const accent = item.type==="crypto"?"#f7931a":"#00d4aa";
                const bH = Math.max(20,Math.min(52,36+(p.price-item.price)/item.price*300));
                return (
                  <div key={i} style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:3, flexShrink:0 }}>
                    <div style={{ fontSize:8, color:up?accent:"#ff6b6b", fontFamily:"monospace" }}>{fp(p.price)}</div>
                    <div style={{ width:36, height:bH, background:up?`${accent}15`:"rgba(255,107,107,0.12)", border:"1px solid "+(up?accent+"50":"rgba(255,107,107,0.3)"), borderRadius:5, display:"flex", alignItems:"center", justifyContent:"center", fontSize:7, color:up?accent:"#ff6b6b" }}>+{i+1}d</div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Position sizing */}
      {detailTab==="sizing" && item.sizing && (
        <div>
          <SectionLabel>Position Sizing</SectionLabel>
          <div style={{ background:`${item.sizing.riskColor||"#fbbf24"}10`, border:`1px solid ${item.sizing.riskColor||"#fbbf24"}30`, borderRadius:12, padding:"12px 14px", marginBottom:12 }}>
            <div style={{ fontSize:14, fontWeight:800, color:item.sizing.riskColor||"#fbbf24", fontFamily:"monospace", marginBottom:2 }}>{item.sizing.positionTier}</div>
            <div style={{ fontSize:10, color:"var(--text7)" }}>Risk Level: {item.sizing.riskLevel}</div>
          </div>
          <InfoRow label="Suggested Allocation" value={`${item.sizing.portfolioPct}% of portfolio`} color="#00d4aa" />
          <InfoRow label="Stop Loss" value={fp(item.sizing.stopLossPrice)} color="#ff6b6b" />
          <InfoRow label="Take Profit" value={fp(item.sizing.takeProfitPrice)} color="#00d4aa" />
          <InfoRow label="Stop Loss %" value={`-${item.sizing.stopLossPct}%`} color="#ff6b6b" />
          <InfoRow label="Take Profit %" value={`+${item.sizing.takeProfitPct}%`} color="#00d4aa" />
          <InfoRow label="Risk/Reward" value={`1 : ${(item.sizing.takeProfitPct/item.sizing.stopLossPct).toFixed(1)}`} color="#fbbf24" />
          <InfoRow label="Annual Volatility" value={`${item.sizing.annualVol}%`} />
          <InfoRow label="Win Probability" value={`${item.sizing.winProb}%`} color="#a78bfa" />

          {/* Price target bar */}
          <div style={{ marginTop:14 }}>
            <div style={{ fontSize:9, color:"var(--text9)", letterSpacing:2, marginBottom:6 }}>PRICE TARGETS</div>
            <div style={{ height:32, background:"var(--surface2)", borderRadius:8, overflow:"hidden", position:"relative", border:"1px solid var(--border)" }}>
              <div style={{ position:"absolute", left:0, top:0, bottom:0, width:`${item.sizing.stopLossPct/(item.sizing.stopLossPct+item.sizing.takeProfitPct)*100}%`, background:"rgba(255,107,107,0.15)", borderRight:"2px dashed rgba(255,107,107,0.5)" }}/>
              <div style={{ position:"absolute", right:0, top:0, bottom:0, width:`${item.sizing.takeProfitPct/(item.sizing.stopLossPct+item.sizing.takeProfitPct)*100}%`, background:"rgba(0,212,170,0.12)", borderLeft:"2px dashed rgba(0,212,170,0.5)" }}/>
              <div style={{ position:"absolute", inset:0, display:"flex", alignItems:"center", justifyContent:"space-between", padding:"0 10px", fontSize:9, fontFamily:"monospace" }}>
                <span style={{ color:"#ff6b6b" }}>▼ {fp(item.sizing.stopLossPrice)}</span>
                <span style={{ color:"var(--text7)" }}>{fp(item.price)}</span>
                <span style={{ color:"#00d4aa" }}>▲ {fp(item.sizing.takeProfitPrice)}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  // ── Chart AI detail ─────────────────────────────────────────
  const ChartDetail = () => (
    <div>
      {/* Full image */}
      {item.thumb && (
        <div style={{ marginBottom:14, borderRadius:12, overflow:"hidden", border:"1px solid var(--border)", background:"var(--surface2)" }}>
          <img src={item.thumb} alt="chart" style={{ width:"100%", maxHeight:280, objectFit:"contain", display:"block" }} />
        </div>
      )}

      {/* Asset + timeframe */}
      <div style={{ marginBottom:12 }}>
        <div style={{ fontSize:"clamp(14px,3vw,18px)", fontWeight:800, color:"#a78bfa", fontFamily:"'Syne',sans-serif", marginBottom:2 }}>{item.asset}</div>
        <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
          {item.timeframe && <span style={{ fontSize:10, color:"var(--text8)", background:"var(--surface2)", padding:"2px 8px", borderRadius:5 }}>⏱ {item.timeframe}</span>}
          {item.currentPrice && <span style={{ fontSize:10, color:"var(--text8)", background:"var(--surface2)", padding:"2px 8px", borderRadius:5 }}>💲 {item.currentPrice}</span>}
          {item.context && <span style={{ fontSize:10, color:"var(--text8)", fontStyle:"italic" }}>"{item.context}"</span>}
        </div>
      </div>

      {/* Sub-tabs */}
      <div style={{ display:"flex", gap:3, marginBottom:14, background:"var(--surface2)", borderRadius:10, padding:3, border:"1px solid var(--border)", flexWrap:"wrap" }}>
        {[["verdict","⚖ Verdict"],["pattern","🔷 Patterns"],["indicators","📊 Indicators"],["levels","🛡 Levels"],["ocr","🔢 OCR"]].map(([id,label])=>(
          <button key={id} onClick={()=>setDetailTab(id)} style={{
            flex:1, padding:"5px 4px", borderRadius:7, fontSize:"clamp(7px,1.5vw,9px)",
            fontFamily:"monospace", fontWeight:700, border:"none", cursor:"pointer",
            background:detailTab===id?"rgba(139,92,246,0.2)":"transparent",
            color:detailTab===id?"#a78bfa":"var(--text9)", transition:"all 0.15s", whiteSpace:"nowrap", minWidth:0,
          }}>{label}</button>
        ))}
      </div>

      {/* Verdict tab */}
      {detailTab==="verdict" && (
        <div>
          <div style={{ background:`${vc}10`, border:`2px solid ${vc}35`, borderRadius:14, padding:"14px 16px", marginBottom:12 }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", gap:10 }}>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:"clamp(15px,3vw,19px)", fontWeight:800, color:vc, fontFamily:"'Syne',sans-serif", marginBottom:4 }}>{item.verdict}</div>
                <div style={{ fontSize:10, color:"var(--text7)", lineHeight:1.6 }}>{item.summary}</div>
              </div>
              <div style={{ textAlign:"center", flexShrink:0 }}>
                <div style={{ fontSize:9, color:"var(--text9)", marginBottom:2 }}>CONFIDENCE</div>
                <div style={{ fontSize:"clamp(20px,4vw,26px)", fontWeight:800, color:vc, fontFamily:"monospace" }}>{item.verdictConfidence}%</div>
              </div>
            </div>
          </div>
          {(item.entryZone||item.stopLoss||item.target) && (
            <div style={{ display:"flex", gap:8, flexWrap:"wrap", marginBottom:12 }}>
              {item.entryZone && <div style={{ flex:1, minWidth:80, background:"rgba(0,212,170,0.08)", border:"1px solid rgba(0,212,170,0.2)", borderRadius:9, padding:"8px 10px", textAlign:"center" }}><div style={{ fontSize:9, color:"var(--text9)", marginBottom:2 }}>ENTRY ZONE</div><div style={{ fontSize:12, fontWeight:800, color:"#00d4aa", fontFamily:"monospace" }}>{item.entryZone}</div></div>}
              {item.stopLoss  && <div style={{ flex:1, minWidth:80, background:"rgba(255,107,107,0.08)", border:"1px solid rgba(255,107,107,0.2)", borderRadius:9, padding:"8px 10px", textAlign:"center" }}><div style={{ fontSize:9, color:"var(--text9)", marginBottom:2 }}>STOP LOSS</div><div style={{ fontSize:12, fontWeight:800, color:"#ff6b6b", fontFamily:"monospace" }}>{item.stopLoss}</div></div>}
              {item.target    && <div style={{ flex:1, minWidth:80, background:"rgba(139,92,246,0.08)", border:"1px solid rgba(139,92,246,0.2)", borderRadius:9, padding:"8px 10px", textAlign:"center" }}><div style={{ fontSize:9, color:"var(--text9)", marginBottom:2 }}>TARGET</div><div style={{ fontSize:12, fontWeight:800, color:"#a78bfa", fontFamily:"monospace" }}>{item.target}</div></div>}
            </div>
          )}
          {item.verdictTimeHorizon && <InfoRow label="Time Horizon" value={item.verdictTimeHorizon} />}
          {item.keyOpportunities?.length>0 && (<><SectionLabel>Opportunities</SectionLabel>{item.keyOpportunities.map((o,i)=><div key={i} style={{ fontSize:11, color:"var(--text5)", padding:"5px 0", borderBottom:"1px solid var(--border)", lineHeight:1.5 }}>✅ {o}</div>)}</>)}
          {item.keyRisks?.length>0 && (<><SectionLabel>Risks</SectionLabel>{item.keyRisks.map((r,i)=><div key={i} style={{ fontSize:11, color:"var(--text5)", padding:"5px 0", borderBottom:"1px solid var(--border)", lineHeight:1.5 }}>⚠ {r}</div>)}</>)}
        </div>
      )}

      {/* Patterns tab */}
      {detailTab==="pattern" && (
        <div>
          <SectionLabel>Detected Patterns</SectionLabel>
          <div style={{ display:"flex", gap:6, flexWrap:"wrap", marginBottom:12 }}>
            {(item.patterns||[]).map((p,i)=><span key={i} style={{ padding:"5px 12px", borderRadius:8, background:"rgba(139,92,246,0.12)", border:"1px solid rgba(139,92,246,0.25)", fontSize:11, color:"#c4b5fd", fontWeight:700 }}>📐 {p}</span>)}
          </div>
          {item.patternDescription && <div style={{ fontSize:12, color:"var(--text5)", lineHeight:1.8, marginBottom:10 }}>{item.patternDescription}</div>}
          {item.patternImplication && <InfoRow label="Implication" value={item.patternImplication?.toUpperCase()} color={item.patternImplication?.includes("bull")?"#00d4aa":item.patternImplication?.includes("bear")?"#ff6b6b":"#fbbf24"} />}
          {item.patternConfidence != null && <InfoRow label="Pattern Confidence" value={`${item.patternConfidence}%`} color="#a78bfa" />}
          {item.trend && (<><SectionLabel>Trend</SectionLabel><InfoRow label="Direction" value={item.trend.primary?.toUpperCase()||"—"} /><InfoRow label="Strength" value={item.trend.strength||"—"} /><InfoRow label="Momentum" value={item.trend.momentum||"—"} />{item.trend.description&&<div style={{ fontSize:11, color:"var(--text6)", lineHeight:1.7, marginTop:8 }}>{item.trend.description}</div>}</>)}
        </div>
      )}

      {/* Indicators tab */}
      {detailTab==="indicators" && item.indicators && (
        <div>
          <SectionLabel>Visible Indicators</SectionLabel>
          <div style={{ display:"flex", gap:6, flexWrap:"wrap", marginBottom:12 }}>
            {(item.indicators.visible||[]).map((ind,i)=><div key={i} style={{ padding:"5px 11px", borderRadius:7, background:"rgba(56,189,248,0.1)", border:"1px solid rgba(56,189,248,0.25)", fontSize:11, color:"#38bdf8", fontWeight:700 }}>{ind}</div>)}
          </div>
          <SectionLabel>Signals</SectionLabel>
          {(item.indicators.signals||[]).map((s,i)=><div key={i} style={{ fontSize:11, color:"var(--text5)", padding:"5px 0", borderBottom:"1px solid var(--border)", lineHeight:1.5 }}>› {s}</div>)}
          {item.indicators.description && <div style={{ fontSize:11, color:"var(--text6)", lineHeight:1.8, marginTop:10 }}>{item.indicators.description}</div>}
          {item.sentiment && (<><SectionLabel>Market Sentiment</SectionLabel><InfoRow label="Overall" value={item.sentiment.overall?.toUpperCase()||"—"} color={item.sentiment.overall?.includes("bull")?"#00d4aa":item.sentiment.overall?.includes("bear")?"#ff6b6b":"#fbbf24"} /><InfoRow label="Score" value={item.sentiment.score != null ? (item.sentiment.score > 0 ? `+${item.sentiment.score}` : String(item.sentiment.score)) : "—"} />{item.sentiment.description&&<div style={{ fontSize:11, color:"var(--text6)", lineHeight:1.7, marginTop:8 }}>{item.sentiment.description}</div>}</>)}
        </div>
      )}

      {/* Levels tab */}
      {detailTab==="levels" && item.support && (
        <div>
          <div style={{ display:"flex", gap:12, flexWrap:"wrap", marginBottom:12 }}>
            <div style={{ flex:1, minWidth:120 }}>
              <SectionLabel>Support Levels</SectionLabel>
              {(item.support.levels||[]).map((l,i)=><div key={i} style={{ padding:"7px 10px", background:"rgba(0,212,170,0.08)", border:"1px solid rgba(0,212,170,0.2)", borderRadius:7, marginBottom:5, fontSize:12, fontFamily:"monospace", color:"#00d4aa", fontWeight:700 }}>{l}</div>)}
            </div>
            <div style={{ flex:1, minWidth:120 }}>
              <SectionLabel>Resistance Levels</SectionLabel>
              {(item.support.resistance||[]).map((l,i)=><div key={i} style={{ padding:"7px 10px", background:"rgba(255,107,107,0.08)", border:"1px solid rgba(255,107,107,0.2)", borderRadius:7, marginBottom:5, fontSize:12, fontFamily:"monospace", color:"#ff6b6b", fontWeight:700 }}>{l}</div>)}
            </div>
          </div>
          {item.support.description && <div style={{ fontSize:11, color:"var(--text6)", lineHeight:1.8 }}>{item.support.description}</div>}
          {item.volume?.description && (<><SectionLabel>Volume</SectionLabel><div style={{ fontSize:11, color:"var(--text6)", lineHeight:1.8 }}>{item.volume.description}</div></>)}
        </div>
      )}

      {/* OCR tab */}
      {detailTab==="ocr" && (
        <div>
          {item.ocr ? (
            <>
              <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(clamp(90px,18vw,130px),1fr))", gap:8, marginBottom:12 }}>
                {[["💲 Current",item.ocr.currentPrice,"#00d4aa"],["📂 Open",item.ocr.openPrice,"#38bdf8"],["⬆ High",item.ocr.highPrice,"#a78bfa"],["⬇ Low",item.ocr.lowPrice,"#ff6b6b"],["📦 Volume",item.ocr.volumeValue,"#fb923c"],["% Change",item.ocr.changePercent,item.ocr.changePercent?.startsWith("-")?"#ff6b6b":"#00d4aa"]].map(([label,val,color])=>val&&(
                  <div key={label} style={{ background:`${color}10`, border:`1px solid ${color}25`, borderRadius:9, padding:"9px 10px" }}>
                    <div style={{ fontSize:9, color:"var(--text9)", marginBottom:2 }}>{label}</div>
                    <div style={{ fontSize:12, fontWeight:800, color, fontFamily:"monospace" }}>{val}</div>
                  </div>
                ))}
              </div>
              {item.ocr.platform && <InfoRow label="Platform" value={item.ocr.platform} />}
              {item.ocr.currency && <InfoRow label="Currency" value={item.ocr.currency} />}
              {item.ocr.confidence != null && <InfoRow label="OCR Confidence" value={`${item.ocr.confidence}%`} color="#a78bfa" />}
              {item.ocr.indicatorValues?.length>0 && (<><SectionLabel>Indicator Readings</SectionLabel><div style={{ display:"flex", flexWrap:"wrap", gap:5 }}>{item.ocr.indicatorValues.map((v,i)=><div key={i} style={{ padding:"4px 9px", borderRadius:6, background:"rgba(56,189,248,0.08)", border:"1px solid rgba(56,189,248,0.2)", fontSize:10, color:"#38bdf8", fontFamily:"monospace" }}>{v}</div>)}</div></>)}
              {item.ocr.yAxisLabels?.length>0 && (<><SectionLabel>Y-Axis Prices</SectionLabel><div style={{ display:"flex", flexWrap:"wrap", gap:4 }}>{item.ocr.yAxisLabels.map((v,i)=><span key={i} style={{ padding:"3px 8px", borderRadius:5, background:"var(--surface2)", border:"1px solid var(--border)", fontSize:10, fontFamily:"monospace", color:"var(--text6)" }}>{v}</span>)}</div></>)}
            </>
          ) : (
            <div style={{ textAlign:"center", padding:"30px 20px", color:"var(--text9)", fontSize:12 }}>No OCR data was stored for this entry.</div>
          )}
        </div>
      )}
    </div>
  );

  return (
    <div style={{
      position:"fixed", top:0, right:0, bottom:0, zIndex:8002,
      width:"clamp(300px,88vw,500px)",
      background:"var(--bg3)",
      borderLeft:"1px solid var(--border3)",
      boxShadow:"-8px 0 40px rgba(0,0,0,0.6)",
      display:"flex", flexDirection:"column",
      animation:"slideInRight 0.25s cubic-bezier(0.22,1,0.36,1)",
      overflow:"hidden",
    }}>
      {/* Header */}
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"14px 18px", borderBottom:"1px solid var(--border)", flexShrink:0, background:"var(--surface)" }}>
        <div style={{ display:"flex", alignItems:"center", gap:8 }}>
          <button onClick={onClose} style={{ background:"none", border:"none", cursor:"pointer", color:"var(--text7)", fontSize:14, padding:"4px 6px", fontFamily:"monospace", fontWeight:700, display:"flex", alignItems:"center", gap:4 }}>
            ← Back
          </button>
          <div style={{ width:1, height:16, background:"var(--border)" }}/>
          <span style={{ fontSize:11, color:"var(--text8)", fontFamily:"monospace" }}>
            {isChart ? `📸 ${item.asset}` : `${item.type==="crypto"?"₿":"📈"} ${item.ticker}`}
          </span>
        </div>
        <div style={{ fontSize:9, color:"var(--text10)", fontFamily:"monospace" }}>{fmtTime(item.timestamp, item.ts)}</div>
      </div>
      {/* Scrollable body */}
      <div style={{ flex:1, overflowY:"auto", padding:"16px 18px" }}>
        {isChart ? <ChartDetail/> : <StockDetail/>}
      </div>
    </div>
  );
}

export default HistoryDetailPanel;
