'use client';

import { useState, useEffect, useRef } from "react";

// Steps shown when an asset is loaded but no prediction yet
const ASSET_LOADED_STEPS = [
  {
    id: "al_header",
    title: "Asset Overview",
    body: "This bar shows live data pulled by the AI: current price, sector, market cap, and the 52-week high/low. Everything is fetched in real time — not cached.",
    emoji: "📋",
    target: "pt-asset-bar",
    position: "bottom",
  },
  {
    id: "al_price",
    title: "Current Price & Daily Change",
    body: "The large number is the live price. The percentage below it shows the change vs the previous close — green means up, red means down.",
    emoji: "💲",
    target: "pt-asset-header",
    position: "bottom",
  },
  {
    id: "al_arch",
    title: "The Neural Network Architecture",
    body: "This shows the model you're about to run: Input → two CNN layers that extract price features → LSTM that learns sequence patterns → a Dense layer → Output (the prediction). It lights up when training.",
    emoji: "🧠",
    target: "pt-model-arch",
    position: "bottom",
  },
  {
    id: "al_chart",
    title: "Price Chart with Indicators",
    body: "The white/green line is the 60-day price history. The blue dashed line is the 20-day moving average (MA20). Bollinger Band edges show the upper and lower volatility bands. Once trained, the prediction overlays here in orange.",
    emoji: "📈",
    target: "tour-chart",
    position: "top",
  },
  {
    id: "al_config",
    title: "Configuration Panel",
    body: "This is where you set up the model before training. You can change the prediction horizon (1W, 2W, 1M) and see the model parameters: 20-bar window, 4 CNN filters, 64 LSTM units, 0.20 dropout.",
    emoji: "⚙",
    target: "pt-config",
    position: "right",
  },
  {
    id: "al_horizon",
    title: "Prediction Horizon",
    body: "1W = predict the next 5 trading days. 2W = next 10 days. 1M = next 21 trading days. Shorter horizons are more accurate. Longer horizons have wider confidence bands.",
    emoji: "⏱",
    target: "pt-horizon",
    position: "right",
  },
  {
    id: "al_train",
    title: "Train & Predict",
    body: "Click this to start the CNN+LSTM training run. It simulates 30 epochs — each one refines the model's weights. Watch the live progress bar and training loss drop in real time.",
    emoji: "▶",
    target: "tour-train",
    position: "right",
  },
];

// Steps shown AFTER a prediction has been run
const PREDICTION_STEPS = [
  {
    id: "pr_metrics",
    title: "Model Output Metrics",
    body: "These four cards summarise the result: Signal (BULLISH or BEARISH), Δ Change (predicted % move over your horizon), Avg Confidence (how sure the model is across all predicted days), and R² Score (how well the model fit the training data — 0.847 is strong).",
    emoji: "📊",
    target: "pt-metrics",
    position: "bottom",
  },
  {
    id: "pr_chart",
    title: "Forecast Overlaid on Chart",
    body: "The orange dashed line is the model's price prediction. The shaded orange area is the confidence interval — wider bands = more uncertainty further out. The vertical line marks where historical data ends and the forecast begins.",
    emoji: "📉",
    target: "tour-chart",
    position: "top",
  },
  {
    id: "pr_table",
    title: "Day-by-Day Forecast Table",
    body: "Every predicted day is listed with its price (green = above current, red = below), the low/high confidence range, and the confidence % for that specific day. Confidence naturally drops on later days.",
    emoji: "📋",
    target: "pt-forecast-table",
    position: "top",
  },
  {
    id: "pr_loss",
    title: "Training Loss Curve",
    body: "The solid line is training loss. The dashed purple line is validation loss. Both should decrease and converge — a good sign the model is learning and not overfitting. If they diverge, the model may be memorising rather than generalising.",
    emoji: "📉",
    target: "pt-loss-curve",
    position: "top",
  },
  {
    id: "pr_rsi",
    title: "RSI (Relative Strength Index)",
    body: "RSI measures momentum on a 0–100 scale. Above 70 = overbought (price may pull back). Below 30 = oversold (potential bounce). Between 30–70 = neutral. The yellow dashed lines mark those thresholds.",
    emoji: "📡",
    target: "pt-rsi",
    position: "top",
  },
  {
    id: "pr_confidence",
    title: "Confidence & Prediction Range",
    body: "Below the forecast table is the Confidence panel. It rates the model HIGH, MODERATE, or LOW with a circular gauge, then shows Bear / Base / Bull case prices. The area chart below shows how confidence decays day by day — always trust day 1 more than day 21.",
    emoji: "🎯",
    target: "pt-forecast-table",
    position: "top",
  },
  {
    id: "pr_analysis",
    title: "Investment Analysis Tab + AI Insight",
    body: "Switch to the 💡 Analysis tab for the full verdict — BUY, HOLD, or SELL — scored across 7 signals including MA trend, RSI, Bollinger Bands, MACD, and the CNN+LSTM result. It also shows position sizing with stop-loss and take-profit. Hit the 🤖 AI Insight sub-tab and Claude writes a personalised 3-paragraph analysis of everything.",
    emoji: "💡",
    target: "tour-invest",
    position: "top",
  },
];

// Steps shown specifically about horizon change
const HORIZON_STEPS = [
  {
    id: "hor_what",
    title: "What Changing the Horizon Does",
    body: "The horizon controls how many trading days the model predicts. 1W = 5 days, 2W = 10 days, 1M = 21 days. Changing it and re-training gives you a different forecast window.",
    emoji: "⏱",
    target: "pt-horizon",
    position: "right",
  },
  {
    id: "hor_accuracy",
    title: "Accuracy vs Horizon Length",
    body: "Shorter horizons (1W) are more reliable — the model has less time to drift. Longer horizons (1M) are more speculative. Notice confidence % drops on each successive day in the forecast table.",
    emoji: "🎯",
    target: "pt-config",
    position: "right",
  },
  {
    id: "hor_retrain",
    title: "Re-train After Changing",
    body: "After selecting a new horizon, click TRAIN & PREDICT again. The model will re-run with the new number of output steps. The chart, table, and all metrics update automatically.",
    emoji: "🔄",
    target: "tour-train",
    position: "right",
  },
];

function PredictorMiniTour({ steps, theme, onClose }) {
  const [step, setStep] = useState(0);
  const [targetRect, setTargetRect] = useState(null);
  const [visible, setVisible] = useState(true);
  const isDark = theme === "dark";

  const current = steps[step];
  const isLast = step === steps.length - 1;
  const isFirst = step === 0;

  useEffect(() => {
    if (!current?.target) { setTargetRect(null); return; }
    const el = document.getElementById(current.target);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "nearest" });
      setTimeout(() => setTargetRect(el.getBoundingClientRect()), 300);
    } else {
      setTargetRect(null);
    }
  }, [step, current?.target]);

  const advance = () => {
    if (isLast) { onClose(); return; }
    setVisible(false);
    setTimeout(() => { setStep(s => s + 1); setVisible(true); }, 160);
  };

  const back = () => {
    setVisible(false);
    setTimeout(() => { setStep(s => s - 1); setVisible(true); }, 160);
  };

  // Spotlight clip-path
  const getClip = () => {
    if (!targetRect) return "none";
    const P = 10, r = targetRect;
    const x1 = Math.max(0, r.left - P), y1 = Math.max(0, r.top - P);
    const x2 = r.right + P, y2 = r.bottom + P;
    const vw = window.innerWidth, vh = window.innerHeight;
    return `polygon(0 0,${vw}px 0,${vw}px ${vh}px,0 ${vh}px,0 0,${x1}px ${y1}px,${x1}px ${y2}px,${x2}px ${y2}px,${x2}px ${y1}px,${x1}px ${y1}px)`;
  };

  // Tooltip positioning
  const getStyle = () => {
    const base = {
      position: "fixed", zIndex: 10001,
      width: "clamp(260px,75vw,360px)",
      background: isDark ? "#13151a" : "#fff",
      border: `1px solid ${isDark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.1)"}`,
      borderRadius: 16, padding: "18px 20px",
      boxShadow: isDark ? "0 20px 56px rgba(0,0,0,0.8)" : "0 20px 56px rgba(0,0,0,0.15)",
      fontFamily: "'Space Mono','Courier New',monospace",
      color: isDark ? "#e0e0e0" : "#1a1a1a",
      opacity: visible ? 1 : 0,
      transform: visible ? "translateY(0)" : "translateY(5px)",
      transition: "opacity 0.16s, transform 0.16s",
    };
    if (!targetRect) return { ...base, bottom: 24, right: 24 };
    const P = 16, W = 360, vw = window.innerWidth, vh = window.innerHeight;
    const pos = current.position;
    if (pos === "bottom") {
      const left = Math.max(P, Math.min(vw - W - P, targetRect.left + targetRect.width / 2 - W / 2));
      const top = Math.min(targetRect.bottom + 12, vh - 280);
      return { ...base, top, left };
    }
    if (pos === "top") {
      const left = Math.max(P, Math.min(vw - W - P, targetRect.left + targetRect.width / 2 - W / 2));
      return { ...base, top: "auto", bottom: vh - targetRect.top + 12, left };
    }
    if (pos === "right") {
      const top = Math.max(P, Math.min(vh - 280, targetRect.top));
      const left = Math.min(targetRect.right + 12, vw - W - P);
      return { ...base, top, left };
    }
    if (pos === "left") {
      const top = Math.max(P, Math.min(vh - 280, targetRect.top));
      return { ...base, top, right: vw - targetRect.left + 12, left: "auto" };
    }
    return { ...base, bottom: 24, right: 24 };
  };

  const accent = "#06b6d4"; // cyan — distinct from both tour purples and app accents

  return (
    <>
      {/* Dimmed overlay with spotlight */}
      <div onClick={advance} style={{
        position: "fixed", inset: 0, zIndex: 10000,
        background: "rgba(0,0,0,0.6)", backdropFilter: "blur(1px)",
        clipPath: getClip(), transition: "clip-path 0.3s ease", cursor: "pointer",
      }}/>
      {/* Spotlight ring */}
      {targetRect && (
        <div style={{
          position: "fixed", zIndex: 10000,
          top: targetRect.top - 8, left: targetRect.left - 8,
          width: targetRect.width + 16, height: targetRect.height + 16,
          borderRadius: 12, pointerEvents: "none",
          border: `2px solid ${accent}`,
          boxShadow: `0 0 0 4px ${accent}20, 0 0 20px ${accent}50`,
          animation: "pulse 2s infinite",
        }}/>
      )}
      {/* Tooltip */}
      <div style={getStyle()}>
        {/* Header row */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 22 }}>{current.emoji}</span>
            <div style={{
              fontSize: 8, fontWeight: 700, letterSpacing: 2, color: accent,
              background: `${accent}18`, border: `1px solid ${accent}30`,
              borderRadius: 5, padding: "2px 7px", textTransform: "uppercase",
            }}>
              EXPLAIN
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 10, color: isDark ? "#444" : "#bbb", fontFamily: "monospace" }}>{step + 1}/{steps.length}</span>
            <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 14, color: isDark ? "#555" : "#bbb", padding: 2, lineHeight: 1 }}>✕</button>
          </div>
        </div>

        {/* Title */}
        <div style={{ fontFamily: "'Syne',sans-serif", fontSize: "clamp(13px,2.5vw,16px)", fontWeight: 800, color: isDark ? "#fff" : "#111", marginBottom: 8, lineHeight: 1.3 }}>
          {current.title}
        </div>

        {/* Body */}
        <div style={{ fontSize: "clamp(11px,2vw,12px)", color: isDark ? "#999" : "#555", lineHeight: 1.75, marginBottom: 14 }}>
          {current.body}
        </div>

        {/* Progress bar */}
        <div style={{ height: 3, background: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)", borderRadius: 2, overflow: "hidden", marginBottom: 12 }}>
          <div style={{ height: "100%", width: `${((step + 1) / steps.length) * 100}%`, background: accent, borderRadius: 2, transition: "width 0.3s ease" }}/>
        </div>

        {/* Buttons */}
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          {!isFirst && (
            <button onClick={back} style={{ padding: "7px 12px", borderRadius: 8, border: `1px solid ${isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.1)"}`, background: "transparent", color: isDark ? "#666" : "#aaa", fontSize: 11, fontFamily: "monospace", fontWeight: 700, cursor: "pointer" }}>
              ← Back
            </button>
          )}
          <button onClick={advance} style={{ flex: 1, padding: "8px 14px", borderRadius: 8, border: `1px solid ${accent}50`, background: `${accent}18`, color: accent, fontSize: 12, fontFamily: "monospace", fontWeight: 800, cursor: "pointer" }}>
            {isLast ? "✓ Got it!" : "Next →"}
          </button>
        </div>

        <div style={{ textAlign: "center", marginTop: 8, fontSize: 8, color: isDark ? "#2a2a2a" : "#ccc", letterSpacing: 1 }}>
          CLICK ANYWHERE TO ADVANCE
        </div>
      </div>
    </>
  );
}

export { ASSET_LOADED_STEPS, PREDICTION_STEPS, HORIZON_STEPS };
export default PredictorMiniTour;
