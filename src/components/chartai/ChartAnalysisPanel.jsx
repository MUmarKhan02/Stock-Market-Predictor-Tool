'use client';

import { useState, useRef } from "react";
import { Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { ExportPDFButton } from "../shared/ExportPDF";
import PredictorMiniTour from "../tours/PredictorMiniTour";

async function analyzeChartImage(base64Image, mediaType, extraContext) {
  const systemPrompt = `You are an expert technical analyst, chart reader, and OCR specialist with 20+ years of experience.

Your job has TWO parts:
1. OCR — Read EVERY number, label, and price visible anywhere in the image with pixel-level accuracy.
2. Technical Analysis — Full professional chart analysis.

Return ONLY a valid JSON object with EXACTLY these keys:
{
  "assetName": "ticker or name visible, or Unknown Asset",
  "timeframe": "timeframe visible e.g. 1D 4H 15m, or Unknown",
  "currentPrice": "most prominent current price as string e.g. 184.92, or null",
  "ocr": {
    "currentPrice": "exact price text read e.g. 184.92, null if not found",
    "openPrice": "open price if visible e.g. O: 183.10, null if not found",
    "highPrice": "high price if visible e.g. H: 186.44, null if not found",
    "lowPrice": "low price if visible e.g. L: 181.30, null if not found",
    "closePrice": "close price if labeled, null if not found",
    "volumeValue": "volume number if visible e.g. 2.4M or 847K, null if not found",
    "changePercent": "percentage change if shown e.g. +2.34% or -1.12%, null if not found",
    "changeValue": "dollar change if shown e.g. +4.21, null if not found",
    "indicatorValues": ["every indicator reading visible — e.g. RSI: 58.3, MACD: 0.42, MA20: 182.50 — list ALL"],
    "yAxisLabels": ["ALL price labels on y-axis top to bottom e.g. 190, 185, 180, 175"],
    "xAxisLabels": ["ALL time/date labels on x-axis e.g. Jan 15, Feb, 09:30"],
    "allTextFound": ["COMPLETE list of every piece of text found anywhere — tickers, dates, prices, watermarks, platform name, everything"],
    "priceRange": { "highest": "highest y-axis number as string", "lowest": "lowest y-axis number as string" },
    "currency": "currency symbol e.g. $ or EUR or BTC, or Unknown",
    "platform": "trading platform if visible e.g. TradingView or Binance, or null",
    "confidence": 85
  },
  "pattern": {
    "detected": ["chart patterns — e.g. Bull Flag, Head and Shoulders, Ascending Triangle"],
    "description": "detailed explanation",
    "implication": "bullish or bearish or neutral",
    "confidence": 75
  },
  "trend": {
    "primary": "uptrend or downtrend or sideways",
    "strength": "strong or moderate or weak",
    "description": "detailed trend analysis",
    "momentum": "accelerating or decelerating or stable"
  },
  "support": {
    "levels": ["key support levels as strings read from chart"],
    "resistance": ["key resistance levels as strings read from chart"],
    "description": "explanation of key levels"
  },
  "indicators": {
    "visible": ["indicators visible in chart"],
    "signals": ["signal from each indicator with value if readable"],
    "description": "detailed indicator analysis"
  },
  "volume": {
    "trend": "increasing or decreasing or stable or not visible",
    "description": "volume analysis"
  },
  "sentiment": {
    "overall": "bullish or bearish or neutral",
    "score": 0,
    "description": "sentiment reading"
  },
  "verdict": {
    "action": "STRONG BUY or BUY or HOLD or SELL or STRONG SELL or WAIT",
    "confidence": 75,
    "timeHorizon": "short-term or medium-term or long-term",
    "keyRisks": ["key risks"],
    "keyOpportunities": ["key opportunities"],
    "summary": "2-3 sentence assessment",
    "entryZone": "entry price range or null",
    "stopLoss": "stop loss level or null",
    "target": "price target or null"
  }
}

OCR RULES — follow these exactly:
- Scan entire image systematically top-left to bottom-right.
- Read every y-axis label (price grid lines) — list ALL in yAxisLabels.
- Read every x-axis label (time/dates) — list ALL in xAxisLabels.
- Look for OHLCV data in any corner or header area.
- Read all indicator panel values (RSI value, MACD lines, etc).
- Read any watermarks, platform logos, ticker symbols.
- Put EVERYTHING you can read into allTextFound.
- Return ONLY valid JSON. Absolutely no markdown or text outside the JSON.`;

  const userContent = [
    { type: "image", source: { type: "base64", media_type: mediaType, data: base64Image } },
    { type: "text", text: extraContext
      ? `Analyze this financial chart. User context: "${extraContext}". Extract all OCR data first, then provide full technical analysis.`
      : "Analyze this financial chart. Extract all text and prices via OCR first, then provide full technical analysis." }
  ];

  const res = await fetch("/api/claude", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 2500,
      system: systemPrompt,
      messages: [{ role: "user", content: userContent }],
    }),
  });
  const data = await res.json();
  const text = data.content?.filter(b => b.type === "text").map(b => b.text).join("") || "";
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("No JSON in response");
  return JSON.parse(match[0]);
}


// ── Chart AI contextual mini-tour step sets ───────────────────────
const CHARTAI_OVERVIEW_STEPS = [
  {
    id: "ca_result",
    title: "Analysis Result Header",
    body: "This card shows the asset name and timeframe detected from your image, the overall verdict (BUY/HOLD/SELL), and a confidence % — how sure the AI is about the call. The entry zone, stop loss, and target prices are extracted directly from the chart.",
    emoji: "📋",
    target: "export-chartai",
    position: "bottom",
  },
  {
    id: "ca_verdict",
    title: "Verdict Tab",
    body: "The ⚖ Verdict tab gives the full reasoning: a summary, time horizon for the trade, key opportunities the AI spotted, and key risks to watch. This is the AI's overall judgement of the chart.",
    emoji: "⚖",
    target: "export-chartai",
    position: "bottom",
  },
  {
    id: "ca_sections",
    title: "Seven Analysis Sections",
    body: "The tab bar below the header lets you drill into specific areas: OCR Prices, Patterns, Trend, Support & Resistance, Indicators, Volume, and Sentiment. Each one is a separate layer of analysis the AI ran on your image.",
    emoji: "🗂",
    target: "export-chartai",
    position: "bottom",
  },
];

const CHARTAI_PATTERNS_STEPS = [
  {
    id: "ca_pat_detected",
    title: "Detected Chart Patterns",
    body: "The 🔷 Patterns tab lists every chart formation the AI identified — Head & Shoulders, Flags, Wedges, Triangles, Channels, Double Tops/Bottoms, and more. These are classical technical patterns that often predict directional moves.",
    emoji: "🔷",
    target: "export-chartai",
    position: "bottom",
  },
  {
    id: "ca_pat_implication",
    title: "Pattern Implication",
    body: "Below the patterns list you'll see what the detected formations collectively imply — Bullish, Bearish, or Neutral — along with a pattern confidence % and a description of what the formation typically signals.",
    emoji: "📐",
    target: "export-chartai",
    position: "bottom",
  },
  {
    id: "ca_pat_trend",
    title: "Trend Analysis",
    body: "The Trend section reads the overall direction (Uptrend, Downtrend, Sideways), strength (Strong/Moderate/Weak), and momentum. This comes from the slope, volume behaviour, and moving average positioning visible in the chart.",
    emoji: "📈",
    target: "export-chartai",
    position: "bottom",
  },
];

const CHARTAI_LEVELS_STEPS = [
  {
    id: "ca_lev_sr",
    title: "Support & Resistance Levels",
    body: "The 🛡 Levels tab shows key price levels extracted from the chart — support floors where buyers have historically stepped in, and resistance ceilings where sellers have pushed back. These are the most actionable price points.",
    emoji: "🛡",
    target: "export-chartai",
    position: "bottom",
  },
  {
    id: "ca_lev_indicators",
    title: "Indicator Readings",
    body: "The 📊 Indicators tab lists every technical indicator visible in your chart — RSI value, MACD lines, Moving Averages, Bollinger Bands — and interprets each signal. The AI reads them directly from the image via OCR.",
    emoji: "📊",
    target: "export-chartai",
    position: "bottom",
  },
  {
    id: "ca_lev_ocr",
    title: "OCR Price Data",
    body: "The 🔢 OCR tab shows every number extracted from the image: current price, open, high, low, volume, change %, y-axis price labels, and the platform name. This is raw data the AI read from the screenshot — useful for verifying accuracy.",
    emoji: "🔢",
    target: "export-chartai",
    position: "bottom",
  },
];

function ChartAnalysisPanel({onRecordHistory}) {
  const [imgSrc, setImgSrc] = useState(null);
  const [imgBase64, setImgBase64] = useState(null);
  const [imgType, setImgType] = useState(null);
  const [context, setContext] = useState("");
  const [status, setStatus] = useState("idle"); // idle | analyzing | done | error
  const [result, setResult] = useState(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [activeSection, setActiveSection] = useState("verdict");
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useState(null);
  const inputRef = { current: null };
  const [chartMiniTour, setChartMiniTour] = useState(null); // null | "overview" | "patterns" | "levels"
  const [showChartExplainNudge, setShowChartExplainNudge] = useState(true);

  const handleFile = (file) => {
    if (!file || !file.type.startsWith("image/")) { setErrorMsg("Please upload an image file."); return; }
    if (file.size > 10 * 1024 * 1024) { setErrorMsg("Image too large. Please use an image under 10MB."); return; }
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target.result;
      const base64 = dataUrl.split(",")[1];
      const mimeType = file.type;
      setImgSrc(dataUrl);
      setImgBase64(base64);
      setImgType(mimeType);
      setResult(null);
      setStatus("idle");
      setErrorMsg("");
    };
    reader.readAsDataURL(file);
  };

  const handleDrop = (e) => {
    e.preventDefault(); setDragOver(false);
    const file = e.dataTransfer.files[0];
    handleFile(file);
  };

  const handleAnalyze = async () => {
    if (!imgBase64) return;
    setStatus("analyzing"); setResult(null); setErrorMsg("");
    try {
      const r = await analyzeChartImage(imgBase64, imgType, context);
      setResult(r);
      setStatus("done");
      setActiveSection("verdict");
      if(onRecordHistory){
        onRecordHistory({
          type:"chartai",
          asset:r.assetName||"Unknown",
          timeframe:r.timeframe||"",
          currentPrice:r.currentPrice||null,
          verdict:r.verdict?.action||"",
          verdictConfidence:r.verdict?.confidence||0,
          verdictTimeHorizon:r.verdict?.timeHorizon||"",
          entryZone:r.verdict?.entryZone||null,
          stopLoss:r.verdict?.stopLoss||null,
          target:r.verdict?.target||null,
          keyRisks:r.verdict?.keyRisks||[],
          keyOpportunities:r.verdict?.keyOpportunities||[],
          summary:r.verdict?.summary||"",
          patterns:r.pattern?.detected||[],
          patternDescription:r.pattern?.description||"",
          patternImplication:r.pattern?.implication||"",
          patternConfidence:r.pattern?.confidence||0,
          trend:r.trend||null,
          support:r.support||null,
          indicators:r.indicators||null,
          volume:r.volume||null,
          sentiment:r.sentiment||null,
          ocr:r.ocr||null,
          thumb:imgSrc,
          context:context||"",
          confidence:r.verdict?.confidence||0,
          timestamp:new Date().toLocaleString(),
        });
      }
    } catch (e) {
      setStatus("error");
      setErrorMsg("Analysis failed: " + (e.message || "Unknown error"));
    }
  };

  const verdictColor = (action) => {
    if (!action) return "#888";
    const a = action.toUpperCase();
    if (a.includes("STRONG BUY")) return "#00d4aa";
    if (a.includes("BUY")) return "#7dd4b0";
    if (a.includes("STRONG SELL")) return "#ff4444";
    if (a.includes("SELL")) return "#ff6b6b";
    if (a.includes("WAIT")) return "#fbbf24";
    return "#888";
  };

  const implColor = (s) => {
    if (!s) return "#888";
    const l = s.toLowerCase();
    if (l.includes("bull") || l.includes("positive")) return "#00d4aa";
    if (l.includes("bear") || l.includes("negative")) return "#ff6b6b";
    return "#fbbf24";
  };

  const sentimentColor = (score) => {
    if (score >= 30) return "#00d4aa";
    if (score <= -30) return "#ff6b6b";
    return "#fbbf24";
  };

  // Handle paste (Ctrl+V / Cmd+V clipboard images)
  const handlePaste = (e) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const item of items) {
      if (item.type.startsWith("image/")) {
        e.preventDefault();
        handleFile(item.getAsFile());
        return;
      }
    }
  };

  return (
    <div id="export-chartai" style={{ animation: "slideIn 0.3s ease" }}>
      {chartMiniTour && (
        <PredictorMiniTour
          steps={chartMiniTour === "patterns" ? CHARTAI_PATTERNS_STEPS : chartMiniTour === "levels" ? CHARTAI_LEVELS_STEPS : CHARTAI_OVERVIEW_STEPS}
          theme={theme}
          onClose={()=>setChartMiniTour(null)}
        />
      )}
      {/* Hidden file input — triggered only by Browse Files button */}
      <input id="chart-file-input" type="file" accept="image/*" style={{ display: "none" }}
        onChange={(e) => handleFile(e.target.files[0])} />

      {/* Upload Zone — drag/drop and paste only, no whole-zone click */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onPaste={handlePaste}
        tabIndex={0}
        style={{ background: dragOver ? "rgba(139,92,246,0.08)" : "var(--surface)", border: `2px dashed ${dragOver ? "#8b5cf6" : imgSrc ? "rgba(139,92,246,0.4)" : "var(--border3)"}`, borderRadius: 16, padding: "clamp(20px,4vw,36px)", marginBottom: 16, transition: "all 0.2s", textAlign: "center", outline: "none" }}
      >
        {imgSrc ? (
          <div>
            <img src={imgSrc} alt="Chart" style={{ maxWidth: "100%", maxHeight: "clamp(200px,40vh,380px)", borderRadius: 10, objectFit: "contain", display: "block", margin: "0 auto 12px" }} />
            <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap", marginTop: 8 }}>
              <button
                onClick={() => document.getElementById("chart-file-input").click()}
                style={{ padding: "6px 14px", borderRadius: 8, background: "rgba(139,92,246,0.12)", border: "1px solid rgba(139,92,246,0.3)", color: "#a78bfa", fontSize: 11, fontFamily: "monospace", fontWeight: 700, cursor: "pointer" }}>
                📂 Replace File
              </button>
              <button
                onClick={() => { setImgSrc(null); setImgBase64(null); setResult(null); setStatus("idle"); setErrorMsg(""); }}
                style={{ padding: "6px 14px", borderRadius: 8, background: "rgba(255,107,107,0.06)", border: "1px solid rgba(255,107,107,0.2)", color: "#ff8080", fontSize: 11, fontFamily: "monospace", fontWeight: 700, cursor: "pointer" }}>
                ✕ Remove
              </button>
            </div>
          </div>
        ) : (
          <div>
            <div style={{ fontSize: "clamp(32px,6vw,46px)", marginBottom: 12 }}>🖼</div>
            <div style={{ fontSize: "clamp(13px,2.5vw,15px)", fontWeight: 700, color: "var(--text3)", marginBottom: 8 }}>
              Add a Chart or Screenshot
            </div>
            <div style={{ fontSize: "clamp(10px,2vw,12px)", color: "var(--text8)", marginBottom: 18, lineHeight: 1.8 }}>
              Drag &amp; drop an image here · or paste a screenshot with <kbd style={{ padding: "1px 5px", borderRadius: 4, background: "var(--surface2)", border: "1px solid var(--border3)", fontSize: 11 }}>Ctrl+V</kbd>
            </div>
            <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap", marginBottom: 14 }}>
              <button
                onClick={() => document.getElementById("chart-file-input").click()}
                style={{ padding: "8px 18px", borderRadius: 9, background: "rgba(139,92,246,0.15)", border: "1px solid rgba(139,92,246,0.4)", color: "#a78bfa", fontSize: "clamp(11px,2vw,12px)", fontFamily: "monospace", fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
                📂 Browse Files
              </button>
            </div>
            <div style={{ fontSize: "clamp(9px,1.8vw,10px)", color: "var(--text10)", lineHeight: 1.6 }}>
              Works with any chart screenshot — TradingView, Binance, Robinhood, portfolio pages, anything.<br/>
              Supports JPG, PNG, WebP · Max 10MB
            </div>
          </div>
        )}
      </div>

      {/* Context input */}
      {imgSrc && (
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 10, color: "#555", letterSpacing: 2, marginBottom: 6, textTransform: "uppercase" }}>Additional Context (Optional)</div>
          <input
            value={context}
            onChange={e => setContext(e.target.value)}
            placeholder="e.g. 'AAPL daily chart', 'BTC 4h looking for entry', 'Is this a good time to add to my position?'"
            style={{ width: "100%", padding: "10px 14px", borderRadius: 9, fontSize: "clamp(11px,2.5vw,12px)", fontFamily: "monospace", background: "var(--input-bg)", border: "1px solid var(--border3)", color: "#e0e0e0", outline: "none" }}
          />
        </div>
      )}

      {/* Analyze button */}
      {imgSrc && (
        <button
          onClick={handleAnalyze}
          disabled={status === "analyzing"}
          style={{ width: "100%", padding: "clamp(12px,2.5vw,16px)", borderRadius: 12, border: "1px solid rgba(139,92,246,0.5)", background: status === "analyzing" ? "rgba(139,92,246,0.08)" : "rgba(139,92,246,0.15)", color: "#a78bfa", fontSize: "clamp(12px,2.5vw,14px)", fontWeight: 800, fontFamily: "monospace", marginBottom: 16, letterSpacing: 1, transition: "all 0.2s" }}
        >
          {status === "analyzing" ? "🔍 ANALYZING CHART..." : "🔍 ANALYZE CHART WITH AI"}
        </button>
      )}

      {/* Export PDF — shown when analysis is done */}
      {status === "done" && result && (
        <div style={{display:"flex",justifyContent:"flex-end",marginBottom:10}}>
          <ExportPDFButton
            elementId="export-chartai"
            filename={`chart_ai_analysis_${new Date().toISOString().slice(0,10)}.pdf`}
            title={`Chart AI Analysis — ${result?.assetName || "Unknown Asset"}`}
            subtitle={`Verdict: ${result?.verdict?.action || "—"} · ${new Date().toLocaleDateString()}`}
            theme={theme}
            label="⬇ Export PDF"
          />
        </div>
      )}

      {/* Loading state */}
      {status === "analyzing" && (
        <div style={{ background: "rgba(139,92,246,0.06)", border: "1px solid rgba(139,92,246,0.2)", borderRadius: 14, padding: "clamp(16px,3vw,24px)", marginBottom: 16, textAlign: "center" }}>
          <div style={{ fontSize: "clamp(24px,5vw,36px)", marginBottom: 10, animation: "pulse 1.5s infinite" }}>🔍</div>
          <div style={{ fontSize: "clamp(12px,2.5vw,14px)", color: "#a78bfa", fontWeight: 700, marginBottom: 6 }}>AI Chart Analysis in Progress</div>
          <div style={{ fontSize: "clamp(10px,2vw,12px)", color: "#555", lineHeight: 1.7 }}>
            Detecting patterns · Analyzing trends · Reading indicators<br />
            Identifying support &amp; resistance · Forming verdict...
          </div>
        </div>
      )}

      {/* Error */}
      {status === "error" && (
        <div style={{ background: "rgba(255,80,80,0.07)", border: "1px solid rgba(255,80,80,0.2)", borderRadius: 12, padding: "12px 16px", marginBottom: 16, color: "#ff8080", fontSize: 12 }}>
          ⚠ {errorMsg}
        </div>
      )}

      {/* Results */}
      {status === "done" && result && (
        <div style={{ animation: "slideIn 0.4s ease" }}>
          {/* Asset + Verdict header */}
          <div style={{ background: `${verdictColor(result.verdict?.action)}12`, border: `2px solid ${verdictColor(result.verdict?.action)}40`, borderRadius: 16, padding: "clamp(14px,3vw,22px)", marginBottom: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 10, color: "#555", letterSpacing: 3, marginBottom: 6, textTransform: "uppercase" }}>Chart Analysis Result</div>
                <div style={{ fontSize: "clamp(16px,3.5vw,22px)", fontWeight: 800, color: "#fff", fontFamily: "'Syne',sans-serif", marginBottom: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {result.assetName || "Unknown Asset"}
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
                  {result.timeframe && <span style={{ fontSize: 10, color: "#555", background: "var(--input-bg)", padding: "3px 8px", borderRadius: 5 }}>⏱ {result.timeframe}</span>}
                  {result.currentPrice && <span style={{ fontSize: 10, color: "#555", background: "var(--input-bg)", padding: "3px 8px", borderRadius: 5 }}>💲 {result.currentPrice}</span>}
                  {result.trend?.primary && <span style={{ fontSize: 10, color: implColor(result.trend.primary), background: `${implColor(result.trend.primary)}15`, padding: "3px 8px", borderRadius: 5, border: `1px solid ${implColor(result.trend.primary)}30` }}>{result.trend.primary?.toUpperCase()}</span>}
                </div>
                <div style={{ fontSize: "clamp(10px,2vw,12px)", color: "#999", lineHeight: 1.6 }}>{result.verdict?.summary}</div>
              </div>
              <div style={{ textAlign: "center", minWidth: 90, flexShrink: 0 }}>
                <div style={{ fontSize: 10, color: "#555", marginBottom: 4, letterSpacing: 2 }}>VERDICT</div>
                <div style={{ fontSize: "clamp(13px,2.5vw,16px)", fontWeight: 800, color: verdictColor(result.verdict?.action), fontFamily: "'Syne',sans-serif", lineHeight: 1.2 }}>{result.verdict?.action || "HOLD"}</div>
                {result.verdict?.confidence != null && (
                  <div style={{ marginTop: 6 }}>
                    <div style={{ fontSize: 9, color: "#444", marginBottom: 3 }}>CONFIDENCE</div>
                    <div style={{ fontSize: "clamp(18px,4vw,26px)", fontWeight: 800, color: verdictColor(result.verdict?.action), fontFamily: "monospace" }}>{result.verdict.confidence}%</div>
                    <div style={{ height: 4, background: "var(--border)", borderRadius: 2, marginTop: 4 }}><div style={{ height: "100%", width: `${result.verdict.confidence}%`, background: verdictColor(result.verdict?.action), borderRadius: 2 }} /></div>
                  </div>
                )}
              </div>
            </div>

            {/* Quick levels */}
            {(result.verdict?.entryZone || result.verdict?.stopLoss || result.verdict?.target) && (
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12, paddingTop: 12, borderTop: "1px solid var(--border)" }}>
                {result.verdict?.entryZone && <div style={{ flex: 1, minWidth: 80, background: "rgba(0,212,170,0.08)", border: "1px solid rgba(0,212,170,0.2)", borderRadius: 8, padding: "8px 12px", textAlign: "center" }}><div style={{ fontSize: 9, color: "#555", marginBottom: 3 }}>ENTRY ZONE</div><div style={{ fontSize: "clamp(11px,2.5vw,13px)", fontWeight: 700, color: "#00d4aa", fontFamily: "monospace" }}>{result.verdict.entryZone}</div></div>}
                {result.verdict?.stopLoss && <div style={{ flex: 1, minWidth: 80, background: "rgba(255,107,107,0.08)", border: "1px solid rgba(255,107,107,0.2)", borderRadius: 8, padding: "8px 12px", textAlign: "center" }}><div style={{ fontSize: 9, color: "#555", marginBottom: 3 }}>STOP LOSS</div><div style={{ fontSize: "clamp(11px,2.5vw,13px)", fontWeight: 700, color: "#ff6b6b", fontFamily: "monospace" }}>{result.verdict.stopLoss}</div></div>}
                {result.verdict?.target && <div style={{ flex: 1, minWidth: 80, background: "rgba(139,92,246,0.08)", border: "1px solid rgba(139,92,246,0.2)", borderRadius: 8, padding: "8px 12px", textAlign: "center" }}><div style={{ fontSize: 9, color: "#555", marginBottom: 3 }}>TARGET</div><div style={{ fontSize: "clamp(11px,2.5vw,13px)", fontWeight: 700, color: "#a78bfa", fontFamily: "monospace" }}>{result.verdict.target}</div></div>}
              </div>
            )}
          </div>

          {/* 💡 Explain buttons */}
          <div style={{ display:"flex", gap:6, flexWrap:"wrap", marginBottom:10, alignItems:"center" }}>
            {showChartExplainNudge
              ? <ExplainNudge storageKey="mp_explain_nudge_chart" text="Tap to get a guided walkthrough of the results" onDismiss={()=>setShowChartExplainNudge(false)}/>
              : <span style={{ fontSize:9, color:"var(--text10)", letterSpacing:1 }}>EXPLAIN:</span>
            }
            <button onClick={()=>setChartMiniTour("overview")}
              style={{ display:"flex", alignItems:"center", gap:5, padding:"4px 11px", borderRadius:20, fontSize:9, fontFamily:"monospace", fontWeight:700, border:"1px solid rgba(6,182,212,0.35)", background:"rgba(6,182,212,0.08)", color:"#06b6d4", cursor:"pointer", transition:"all 0.15s" }}>
              💡 This analysis
            </button>
            <button onClick={()=>setChartMiniTour("patterns")}
              style={{ display:"flex", alignItems:"center", gap:5, padding:"4px 11px", borderRadius:20, fontSize:9, fontFamily:"monospace", fontWeight:700, border:"1px solid rgba(6,182,212,0.35)", background:"rgba(6,182,212,0.08)", color:"#06b6d4", cursor:"pointer", transition:"all 0.15s" }}>
              💡 Patterns &amp; Trend
            </button>
            <button onClick={()=>setChartMiniTour("levels")}
              style={{ display:"flex", alignItems:"center", gap:5, padding:"4px 11px", borderRadius:20, fontSize:9, fontFamily:"monospace", fontWeight:700, border:"1px solid rgba(6,182,212,0.35)", background:"rgba(6,182,212,0.08)", color:"#06b6d4", cursor:"pointer", transition:"all 0.15s" }}>
              💡 Levels &amp; OCR
            </button>
          </div>

          {/* Section tabs */}
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 12 }}>
            {ANALYSIS_SECTIONS.map(s => (
              <button key={s.key} onClick={() => setActiveSection(s.key)}
                style={{ padding: "6px 12px", borderRadius: 8, fontSize: "clamp(9px,1.8vw,10px)", fontFamily: "monospace", fontWeight: 700, border: `1px solid ${activeSection === s.key ? "rgba(139,92,246,0.5)" : "var(--border)"}`, background: activeSection === s.key ? "rgba(139,92,246,0.15)" : "var(--surface)", color: activeSection === s.key ? "#a78bfa" : "#555", transition: "all 0.15s", whiteSpace: "nowrap" }}>
                {s.icon} {s.label}
              </button>
            ))}
          </div>

          {/* Section content */}
          <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, padding: "clamp(14px,3vw,22px)", animation: "slideIn 0.25s ease" }}>

            {activeSection === "ocr" && (
              <div>
                <div style={{ fontSize:"clamp(13px,2.5vw,15px)", fontWeight:700, color:"#fff", marginBottom:14, display:"flex", alignItems:"center", gap:10, flexWrap:"wrap" }}>
                  🔢 OCR Price Detection
                  {result.ocr?.confidence != null && (
                    <span style={{ fontSize:10, color:"#a78bfa", background:"rgba(139,92,246,0.12)", border:"1px solid rgba(139,92,246,0.25)", borderRadius:6, padding:"3px 9px" }}>
                      OCR Confidence: {result.ocr.confidence}%
                    </span>
                  )}
                  {result.ocr?.platform && (
                    <span style={{ fontSize:10, color:"#38bdf8", background:"rgba(56,189,248,0.1)", border:"1px solid rgba(56,189,248,0.2)", borderRadius:6, padding:"3px 9px" }}>
                      📱 {result.ocr.platform}
                    </span>
                  )}
                </div>

                {/* OHLCV Grid */}
                <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(clamp(90px,18vw,130px),1fr))", gap:8, marginBottom:16 }}>
                  {[
                    ["💲 Current", result.ocr?.currentPrice, "#00d4aa"],
                    ["📂 Open",    result.ocr?.openPrice,    "#38bdf8"],
                    ["⬆ High",    result.ocr?.highPrice,    "#a78bfa"],
                    ["⬇ Low",     result.ocr?.lowPrice,     "#ff6b6b"],
                    ["🔒 Close",   result.ocr?.closePrice,   "#fbbf24"],
                    ["📦 Volume",  result.ocr?.volumeValue,  "#fb923c"],
                    ["% Change",   result.ocr?.changePercent, result.ocr?.changePercent?.startsWith("-") ? "#ff6b6b" : "#00d4aa"],
                    ["± Change",   result.ocr?.changeValue,  result.ocr?.changeValue?.startsWith("-") ? "#ff6b6b" : "#00d4aa"],
                  ].map(([label, val, color]) => val && (
                    <div key={label} style={{ background:`${color}10`, border:`1px solid ${color}25`, borderRadius:10, padding:"10px 12px" }}>
                      <div style={{ fontSize:9, color:"var(--text8)", marginBottom:4, letterSpacing:1 }}>{label}</div>
                      <div style={{ fontSize:"clamp(12px,2.5vw,15px)", fontWeight:800, color, fontFamily:"monospace", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{val}</div>
                    </div>
                  ))}
                </div>

                {/* Indicator values */}
                {result.ocr?.indicatorValues?.length > 0 && (
                  <div style={{ marginBottom:14 }}>
                    <div style={{ fontSize:10, color:"var(--text8)", letterSpacing:2, marginBottom:8 }}>INDICATOR READINGS (OCR)</div>
                    <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
                      {result.ocr.indicatorValues.map((v,i) => (
                        <div key={i} style={{ padding:"5px 11px", borderRadius:7, background:"rgba(56,189,248,0.08)", border:"1px solid rgba(56,189,248,0.2)", fontSize:"clamp(10px,2vw,11px)", color:"#38bdf8", fontFamily:"monospace", fontWeight:700 }}>{v}</div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Price range + currency */}
                <div style={{ display:"flex", gap:8, flexWrap:"wrap", marginBottom:14 }}>
                  {result.ocr?.priceRange?.highest && (
                    <div style={{ flex:1, minWidth:100, background:"var(--surface2)", border:"1px solid var(--border)", borderRadius:9, padding:"9px 12px" }}>
                      <div style={{ fontSize:9, color:"var(--text8)", marginBottom:3, letterSpacing:1 }}>CHART PRICE RANGE</div>
                      <div style={{ fontSize:"clamp(11px,2.5vw,13px)", fontWeight:700, color:"var(--text2)", fontFamily:"monospace" }}>
                        <span style={{ color:"#ff6b6b" }}>{result.ocr.priceRange.lowest}</span>
                        <span style={{ color:"var(--text8)", margin:"0 6px" }}>—</span>
                        <span style={{ color:"#00d4aa" }}>{result.ocr.priceRange.highest}</span>
                      </div>
                    </div>
                  )}
                  {result.ocr?.currency && result.ocr.currency !== "Unknown" && (
                    <div style={{ background:"rgba(251,191,36,0.08)", border:"1px solid rgba(251,191,36,0.2)", borderRadius:9, padding:"9px 14px", display:"flex", alignItems:"center", gap:6 }}>
                      <span style={{ fontSize:9, color:"var(--text8)" }}>CURRENCY</span>
                      <span style={{ fontSize:"clamp(13px,3vw,16px)", fontWeight:800, color:"#fbbf24", fontFamily:"monospace" }}>{result.ocr.currency}</span>
                    </div>
                  )}
                </div>

                {/* Y-axis labels */}
                {result.ocr?.yAxisLabels?.length > 0 && (
                  <div style={{ marginBottom:14 }}>
                    <div style={{ fontSize:10, color:"var(--text8)", letterSpacing:2, marginBottom:8 }}>Y-AXIS PRICE LEVELS (OCR)</div>
                    <div style={{ display:"flex", flexWrap:"wrap", gap:5 }}>
                      {result.ocr.yAxisLabels.map((v,i) => (
                        <div key={i} style={{ padding:"4px 10px", borderRadius:6, background:"var(--surface3)", border:"1px solid var(--selected-bg)", fontSize:"clamp(10px,2vw,11px)", color:"var(--text5)", fontFamily:"monospace" }}>{v}</div>
                      ))}
                    </div>
                  </div>
                )}

                {/* X-axis labels */}
                {result.ocr?.xAxisLabels?.length > 0 && (
                  <div style={{ marginBottom:14 }}>
                    <div style={{ fontSize:10, color:"var(--text8)", letterSpacing:2, marginBottom:8 }}>X-AXIS TIME LABELS (OCR)</div>
                    <div style={{ display:"flex", flexWrap:"wrap", gap:5 }}>
                      {result.ocr.xAxisLabels.map((v,i) => (
                        <div key={i} style={{ padding:"4px 10px", borderRadius:6, background:"rgba(56,189,248,0.06)", border:"1px solid rgba(56,189,248,0.15)", fontSize:"clamp(10px,2vw,11px)", color:"#38bdf8", fontFamily:"monospace" }}>{v}</div>
                      ))}
                    </div>
                  </div>
                )}

                {/* All text found */}
                {result.ocr?.allTextFound?.length > 0 && (
                  <div>
                    <div style={{ fontSize:10, color:"var(--text8)", letterSpacing:2, marginBottom:8 }}>ALL TEXT FOUND IN IMAGE</div>
                    <div style={{ background:"var(--surface)", borderRadius:10, padding:"10px 12px", border:"1px solid var(--border)", display:"flex", flexWrap:"wrap", gap:5, maxHeight:160, overflowY:"auto" }}>
                      {result.ocr.allTextFound.map((t,i) => (
                        <span key={i} style={{ fontSize:"clamp(9px,1.8vw,10px)", color:"var(--text7)", fontFamily:"monospace", background:"var(--surface2)", padding:"2px 7px", borderRadius:4 }}>{t}</span>
                      ))}
                    </div>
                  </div>
                )}

                {!result.ocr && (
                  <div style={{ color:"var(--text8)", fontSize:12, textAlign:"center", padding:20 }}>No OCR data returned for this chart.</div>
                )}
              </div>
            )}

            {activeSection === "pattern" && result.pattern && (
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
                  <div style={{ fontSize: "clamp(13px,2.5vw,15px)", fontWeight: 700, color: "#fff" }}>🔷 Chart Patterns Detected</div>
                  <div style={{ padding: "4px 10px", borderRadius: 6, background: `${implColor(result.pattern.implication)}15`, border: `1px solid ${implColor(result.pattern.implication)}30`, fontSize: 10, color: implColor(result.pattern.implication), fontWeight: 700 }}>{result.pattern.implication?.toUpperCase()}</div>
                  <div style={{ fontSize: 10, color: "#555" }}>Confidence: <strong style={{ color: "#a78bfa" }}>{result.pattern.confidence}%</strong></div>
                </div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 14 }}>
                  {(result.pattern.detected || []).map((p, i) => (
                    <div key={i} style={{ padding: "6px 12px", borderRadius: 8, background: "rgba(139,92,246,0.12)", border: "1px solid rgba(139,92,246,0.25)", fontSize: "clamp(10px,2vw,11px)", color: "#c4b5fd", fontWeight: 700 }}>📐 {p}</div>
                  ))}
                  {(!result.pattern.detected || result.pattern.detected.length === 0) && <div style={{ fontSize: 12, color: "#555" }}>No distinct patterns detected</div>}
                </div>
                <div style={{ fontSize: "clamp(11px,2vw,13px)", color: "#999", lineHeight: 1.8 }}>{result.pattern.description}</div>
              </div>
            )}

            {activeSection === "trend" && result.trend && (
              <div>
                <div style={{ fontSize: "clamp(13px,2.5vw,15px)", fontWeight: 700, color: "#fff", marginBottom: 14 }}>📈 Trend Analysis</div>
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 16 }}>
                  {[["Primary Trend", result.trend.primary, implColor(result.trend.primary)], ["Strength", result.trend.strength, "#fbbf24"], ["Momentum", result.trend.momentum, "#a78bfa"]].map(([l, v, c]) => v && (
                    <div key={l} style={{ flex: 1, minWidth: 100, background: `${c}10`, border: `1px solid ${c}25`, borderRadius: 10, padding: "12px 14px" }}>
                      <div style={{ fontSize: 9, color: "#555", marginBottom: 4, letterSpacing: 1 }}>{l.toUpperCase()}</div>
                      <div style={{ fontSize: "clamp(12px,2.5vw,15px)", fontWeight: 800, color: c, fontFamily: "monospace", textTransform: "capitalize" }}>{v}</div>
                    </div>
                  ))}
                </div>
                <div style={{ fontSize: "clamp(11px,2vw,13px)", color: "#999", lineHeight: 1.8 }}>{result.trend.description}</div>
              </div>
            )}

            {activeSection === "support" && result.support && (
              <div>
                <div style={{ fontSize: "clamp(13px,2.5vw,15px)", fontWeight: 700, color: "#fff", marginBottom: 14 }}>🛡 Support &amp; Resistance</div>
                <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
                  <div style={{ flex: 1, minWidth: 140 }}>
                    <div style={{ fontSize: 10, color: "#00d4aa", letterSpacing: 2, marginBottom: 8, fontWeight: 700 }}>▲ SUPPORT LEVELS</div>
                    {(result.support.levels || []).map((l, i) => (
                      <div key={i} style={{ padding: "8px 12px", background: "rgba(0,212,170,0.08)", border: "1px solid rgba(0,212,170,0.2)", borderRadius: 7, marginBottom: 6, fontSize: "clamp(11px,2.5vw,13px)", fontFamily: "monospace", color: "#00d4aa" }}>{l}</div>
                    ))}
                    {(!result.support.levels || result.support.levels.length === 0) && <div style={{ fontSize: 11, color: "#555" }}>Not identified</div>}
                  </div>
                  <div style={{ flex: 1, minWidth: 140 }}>
                    <div style={{ fontSize: 10, color: "#ff6b6b", letterSpacing: 2, marginBottom: 8, fontWeight: 700 }}>▼ RESISTANCE LEVELS</div>
                    {(result.support.resistance || []).map((l, i) => (
                      <div key={i} style={{ padding: "8px 12px", background: "rgba(255,107,107,0.08)", border: "1px solid rgba(255,107,107,0.2)", borderRadius: 7, marginBottom: 6, fontSize: "clamp(11px,2.5vw,13px)", fontFamily: "monospace", color: "#ff6b6b" }}>{l}</div>
                    ))}
                    {(!result.support.resistance || result.support.resistance.length === 0) && <div style={{ fontSize: 11, color: "#555" }}>Not identified</div>}
                  </div>
                </div>
                <div style={{ fontSize: "clamp(11px,2vw,13px)", color: "#999", lineHeight: 1.8 }}>{result.support.description}</div>
              </div>
            )}

            {activeSection === "indicators" && result.indicators && (
              <div>
                <div style={{ fontSize: "clamp(13px,2.5vw,15px)", fontWeight: 700, color: "#fff", marginBottom: 14 }}>📊 Technical Indicators</div>
                {(result.indicators.visible || []).length > 0 && (
                  <div style={{ marginBottom: 14 }}>
                    <div style={{ fontSize: 10, color: "#555", letterSpacing: 2, marginBottom: 8 }}>DETECTED INDICATORS</div>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      {result.indicators.visible.map((ind, i) => <div key={i} style={{ padding: "5px 11px", borderRadius: 7, background: "rgba(56,189,248,0.1)", border: "1px solid rgba(56,189,248,0.25)", fontSize: 11, color: "#38bdf8", fontWeight: 700 }}>{ind}</div>)}
                    </div>
                  </div>
                )}
                {(result.indicators.signals || []).length > 0 && (
                  <div style={{ marginBottom: 14 }}>
                    <div style={{ fontSize: 10, color: "#555", letterSpacing: 2, marginBottom: 8 }}>SIGNALS</div>
                    {result.indicators.signals.map((sig, i) => (
                      <div key={i} style={{ padding: "8px 12px", background: "var(--surface2)", border: "1px solid var(--border)", borderRadius: 7, marginBottom: 6, fontSize: "clamp(10px,2vw,12px)", color: "#ccc", display: "flex", gap: 8, alignItems: "flex-start" }}>
                        <span style={{ color: "#555", flexShrink: 0 }}>›</span>{sig}
                      </div>
                    ))}
                  </div>
                )}
                <div style={{ fontSize: "clamp(11px,2vw,13px)", color: "#999", lineHeight: 1.8 }}>{result.indicators.description}</div>
              </div>
            )}

            {activeSection === "volume" && result.volume && (
              <div>
                <div style={{ fontSize: "clamp(13px,2.5vw,15px)", fontWeight: 700, color: "#fff", marginBottom: 14 }}>📦 Volume Analysis</div>
                {result.volume.trend && result.volume.trend !== "not visible" && (
                  <div style={{ display: "inline-flex", padding: "8px 16px", borderRadius: 8, background: "rgba(251,191,36,0.1)", border: "1px solid rgba(251,191,36,0.25)", marginBottom: 14 }}>
                    <span style={{ fontSize: 12, color: "#fbbf24", fontWeight: 700 }}>📊 Volume Trend: {result.volume.trend?.toUpperCase()}</span>
                  </div>
                )}
                <div style={{ fontSize: "clamp(11px,2vw,13px)", color: "#999", lineHeight: 1.8 }}>{result.volume.description}</div>
              </div>
            )}

            {activeSection === "sentiment" && result.sentiment && (
              <div>
                <div style={{ fontSize: "clamp(13px,2.5vw,15px)", fontWeight: 700, color: "#fff", marginBottom: 14 }}>🧠 Market Sentiment</div>
                <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap", marginBottom: 16 }}>
                  <div style={{ textAlign: "center", minWidth: 100 }}>
                    <div style={{ fontSize: 9, color: "#555", marginBottom: 4, letterSpacing: 2 }}>SENTIMENT SCORE</div>
                    <div style={{ fontSize: "clamp(28px,6vw,40px)", fontWeight: 800, color: sentimentColor(result.sentiment.score || 0), fontFamily: "monospace" }}>{result.sentiment.score > 0 ? "+" : ""}{result.sentiment.score}</div>
                    <div style={{ height: 6, background: "var(--border)", borderRadius: 3, marginTop: 6, overflow: "hidden" }}><div style={{ height: "100%", width: `${Math.min(100, Math.max(0, (result.sentiment.score + 100) / 2))}%`, background: sentimentColor(result.sentiment.score || 0), borderRadius: 3, transition: "width 1s ease" }} /></div>
                  </div>
                  {result.sentiment.overall && (
                    <div style={{ padding: "10px 20px", borderRadius: 10, background: `${implColor(result.sentiment.overall)}15`, border: `1px solid ${implColor(result.sentiment.overall)}30`, fontSize: "clamp(14px,3vw,18px)", fontWeight: 800, color: implColor(result.sentiment.overall), fontFamily: "'Syne',sans-serif" }}>
                      {result.sentiment.overall.toUpperCase()}
                    </div>
                  )}
                </div>
                <div style={{ fontSize: "clamp(11px,2vw,13px)", color: "#999", lineHeight: 1.8 }}>{result.sentiment.description}</div>
              </div>
            )}

            {activeSection === "verdict" && result.verdict && (
              <div>
                <div style={{ fontSize: "clamp(13px,2.5vw,15px)", fontWeight: 700, color: "#fff", marginBottom: 14 }}>⚖ Overall Verdict</div>
                <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
                  <div style={{ flex: 1, minWidth: 140, background: `${verdictColor(result.verdict.action)}12`, border: `1px solid ${verdictColor(result.verdict.action)}30`, borderRadius: 12, padding: "14px 16px", textAlign: "center" }}>
                    <div style={{ fontSize: 9, color: "#555", marginBottom: 4, letterSpacing: 2 }}>RECOMMENDATION</div>
                    <div style={{ fontSize: "clamp(16px,3.5vw,22px)", fontWeight: 800, color: verdictColor(result.verdict.action), fontFamily: "'Syne',sans-serif" }}>{result.verdict.action}</div>
                    <div style={{ fontSize: 10, color: "#555", marginTop: 4 }}>Confidence: {result.verdict.confidence}%</div>
                  </div>
                  {result.verdict.timeHorizon && (
                    <div style={{ flex: 1, minWidth: 120, background: "rgba(139,92,246,0.1)", border: "1px solid rgba(139,92,246,0.25)", borderRadius: 12, padding: "14px 16px", textAlign: "center" }}>
                      <div style={{ fontSize: 9, color: "#555", marginBottom: 4, letterSpacing: 2 }}>TIME HORIZON</div>
                      <div style={{ fontSize: "clamp(12px,2.5vw,15px)", fontWeight: 700, color: "#a78bfa", textTransform: "capitalize" }}>{result.verdict.timeHorizon}</div>
                    </div>
                  )}
                </div>
                <div style={{ fontSize: "clamp(11px,2vw,13px)", color: "#bbb", lineHeight: 1.8, marginBottom: 14, padding: "12px 14px", background: "var(--surface2)", borderRadius: 10, borderLeft: "3px solid rgba(139,92,246,0.4)" }}>{result.verdict.summary}</div>
                <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                  {(result.verdict.keyOpportunities || []).length > 0 && (
                    <div style={{ flex: 1, minWidth: 160 }}>
                      <div style={{ fontSize: 10, color: "#00d4aa", letterSpacing: 2, marginBottom: 8, fontWeight: 700 }}>✅ OPPORTUNITIES</div>
                      {result.verdict.keyOpportunities.map((o, i) => <div key={i} style={{ padding: "7px 10px", background: "rgba(0,212,170,0.06)", border: "1px solid rgba(0,212,170,0.15)", borderRadius: 7, marginBottom: 5, fontSize: "clamp(10px,2vw,11px)", color: "#ccc" }}>• {o}</div>)}
                    </div>
                  )}
                  {(result.verdict.keyRisks || []).length > 0 && (
                    <div style={{ flex: 1, minWidth: 160 }}>
                      <div style={{ fontSize: 10, color: "#ff6b6b", letterSpacing: 2, marginBottom: 8, fontWeight: 700 }}>⚠ RISKS</div>
                      {result.verdict.keyRisks.map((r, i) => <div key={i} style={{ padding: "7px 10px", background: "rgba(255,107,107,0.06)", border: "1px solid rgba(255,107,107,0.15)", borderRadius: 7, marginBottom: 5, fontSize: "clamp(10px,2vw,11px)", color: "#ccc" }}>• {r}</div>)}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Re-analyze */}
          <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
            <button onClick={() => { setImgSrc(null); setImgBase64(null); setResult(null); setStatus("idle"); setContext(""); }}
              style={{ flex: 1, padding: "10px 16px", borderRadius: 9, border: "1px solid var(--selected-bg)", background: "var(--surface2)", color: "#555", fontSize: 11, fontFamily: "monospace", fontWeight: 700 }}>
              🗑 Clear &amp; Upload New
            </button>
            <button onClick={handleAnalyze}
              style={{ flex: 2, padding: "10px 16px", borderRadius: 9, border: "1px solid rgba(139,92,246,0.35)", background: "rgba(139,92,246,0.1)", color: "#a78bfa", fontSize: 11, fontFamily: "monospace", fontWeight: 700 }}>
              🔄 Re-Analyze
            </button>
          </div>
        </div>
      )}

      {/* Tips when idle */}
      {status === "idle" && !imgSrc && (
        <div style={{ background: "var(--surface)", border: "1px solid var(--input-bg)", borderRadius: 14, padding: "clamp(14px,3vw,20px)" }}>
          <div style={{ fontSize: 10, color: "#444", letterSpacing: 2, marginBottom: 12, textTransform: "uppercase" }}>What This Analyzes</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(clamp(130px,25vw,180px), 1fr))", gap: 8 }}>
            {[["🔷","Chart Patterns","Head & Shoulders, Flags, Wedges, Triangles, Channels..."],["📈","Trend Analysis","Direction, strength, momentum, and trend confirmation"],["🛡","Support & Resistance","Key price levels, zones, and potential breakout points"],["📊","Indicators","RSI, MACD, Bollinger Bands, Moving Averages, Volume"],["🧠","Market Sentiment","Overall market mood and potential next move"],["⚖","Trading Verdict","Clear action: Buy, Sell, Hold with entry/stop/target"]].map(([icon, title, desc]) => (
              <div key={title} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, padding: "12px 14px" }}>
                <div style={{ fontSize: "clamp(16px,3vw,20px)", marginBottom: 6 }}>{icon}</div>
                <div style={{ fontSize: "clamp(10px,2vw,12px)", fontWeight: 700, color: "#ccc", marginBottom: 4 }}>{title}</div>
                <div style={{ fontSize: "clamp(9px,1.8vw,10px)", color: "#555", lineHeight: 1.5 }}>{desc}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default ChartAnalysisPanel;
