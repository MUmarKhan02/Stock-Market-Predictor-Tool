'use client';

import { useState, useEffect, useRef } from "react";

const TOUR_STEPS = [
  {
    id: "welcome",
    title: "Welcome to Market Predictor",
    body: "An AI-powered platform for predicting stock and crypto prices, analyzing charts, and managing your portfolio. This quick tour covers everything you can do as a guest — no account needed to get started.",
    emoji: "🚀",
    target: null,
    position: "center",
  },
  {
    id: "tabs",
    title: "What's Available to You",
    body: "📈 Stocks and ₿ Crypto are free to try — you get 1 free prediction on each. 📸 Chart AI, 💼 Portfolio, and ⭐ Watchlist unlock the moment you create a free account.",
    emoji: "🗂",
    target: "tour-tabs",
    position: "bottom",
  },
  {
    id: "search",
    title: "Search Any Stock or Crypto",
    body: "Type any ticker — AAPL, TSLA, NVDA, BTC, ETH — and hit Enter or LOAD. The AI fetches the live price, sector, market cap, and 52-week range in real time. Once you load an asset, search locks until you sign in.",
    emoji: "🔍",
    target: "tour-search",
    position: "bottom",
  },
  {
    id: "quickpicks",
    title: "Quick-Pick Buttons",
    body: "Tap any popular ticker for instant one-click loading. No typing needed — great for a fast market scan.",
    emoji: "⚡",
    target: "tour-quickpicks",
    position: "bottom",
  },
  {
    id: "train",
    title: "Run the CNN+LSTM Prediction",
    body: "Click TRAIN & PREDICT to fire up the neural network. It runs 30 training epochs live — watch the loss curve drop in real time as the model learns the price sequence. Select 1W, 2W, or 1M before training.",
    emoji: "🧠",
    target: "tour-train",
    position: "right",
  },
  {
    id: "forecast",
    title: "Price Forecast on the Chart",
    body: "After training, the predicted price overlays the chart in orange with confidence bands. The shaded area shows the uncertainty range — wider bands mean less certainty further into the future.",
    emoji: "📊",
    target: "tour-chart",
    position: "top",
  },
  {
    id: "confidence",
    title: "Confidence & Prediction Range",
    body: "Below the forecast table you'll see a Confidence panel — HIGH, MODERATE, or LOW rating with a circular gauge, Bear/Base/Bull case price cards, a full price range bar, and a day-by-day confidence decay chart.",
    emoji: "🎯",
    target: "pt-forecast-table",
    position: "top",
  },
  {
    id: "invest",
    title: "Investment Verdict",
    body: "The 💡 Analysis tab gives a full BUY / HOLD / SELL verdict scored across 7 signals: MA Trend, RSI, Bollinger Bands, MACD, CNN+LSTM, 52W Position, and Volatility. Includes stop-loss and take-profit levels.",
    emoji: "💡",
    target: "tour-invest",
    position: "top",
  },
  {
    id: "controls",
    title: "Toolbar",
    body: "The toolbar holds your theme toggle (dark/light) and currency selector. All prices update instantly across every panel when you switch currency.",
    emoji: "🎛",
    target: "tour-theme",
    position: "left",
  },
  {
    id: "guest_limit",
    title: "Your Free Prediction",
    body: "After running a prediction, the tab locks and a sign-in prompt appears at the bottom. A free account unlocks unlimited predictions, Chart AI, Portfolio, Watchlist, Price Alerts, Notes, History, and the Accuracy Tracker.",
    emoji: "🎁",
    target: "tour-tabs",
    position: "bottom",
  },
  {
    id: "done",
    title: "Ready to Explore",
    body: "Load a stock or crypto, hit TRAIN & PREDICT, and check the Analysis tab for a verdict. The 💡 explain buttons that appear after loading will walk you through every panel in detail.",
    emoji: "✅",
    target: null,
    position: "center",
  },
];



// ─────────────────────────────────────────────────────────────────
//  USER TOUR STEPS  (shown after login via WelcomePrompt)
// ─────────────────────────────────────────────────────────────────
const USER_TOUR_STEPS = [
  {
    id: "u_welcome",
    title: "Everything is Unlocked",
    body: "Welcome to the full Market Predictor. This tour walks through every feature — predictions, AI insights, Chart AI, Portfolio, Watchlist, Alerts, History, and the Accuracy Tracker. Takes about 2 minutes.",
    emoji: "🎉",
    target: null,
    position: "center",
    sideEffect: null,
  },
  {
    id: "u_tabs",
    title: "Five Tabs, All Yours",
    body: "📈 Stocks · ₿ Crypto · 📸 Chart AI · 💼 Portfolio · ⭐ Watchlist — every tab is fully unlocked. Your predictions and analyses save to your account history automatically.",
    emoji: "🗂",
    target: "tour-tabs",
    position: "bottom",
    sideEffect: "close_panels",
  },
  {
    id: "u_search",
    title: "Search & Load Any Asset",
    body: "Type any ticker and hit LOAD. The AI fetches live price, sector, market cap, and 52-week range. Once loaded, use the 💡 explain buttons that appear to get a guided walkthrough of every panel.",
    emoji: "🔍",
    target: "tour-search",
    position: "bottom",
    sideEffect: null,
  },
  {
    id: "u_train",
    title: "Unlimited AI Predictions",
    body: "No limits — run predictions on as many tickers as you want, as often as you want. The CNN+LSTM model trains 30 epochs live. Select 1W, 2W, or 1M horizon before training.",
    emoji: "🧠",
    target: "tour-train",
    position: "right",
    sideEffect: null,
  },
  {
    id: "u_confidence",
    title: "Confidence & Prediction Range",
    body: "After training, below the forecast table you get a full confidence breakdown — HIGH/MODERATE/LOW tier, Bear/Base/Bull case cards, a price range bar, and a day-by-day confidence decay chart showing how certainty drops further out.",
    emoji: "🎯",
    target: "pt-forecast-table",
    position: "top",
    sideEffect: null,
  },
  {
    id: "u_invest",
    title: "Investment Verdict + AI Insight",
    body: "The 💡 Analysis tab gives a BUY/HOLD/SELL verdict across 7 signals with position sizing. Switch to the 🤖 AI Insight sub-tab and Claude writes a personalised 3-paragraph analysis using all the signals and model output.",
    emoji: "💡",
    target: "tour-invest",
    position: "top",
    sideEffect: null,
  },
  {
    id: "u_chartai",
    title: "Chart AI — Upload Any Screenshot",
    body: "Switch to 📸 Chart AI and drag & drop, browse, or paste (Ctrl+V) any chart screenshot. The AI reads every price via OCR, detects patterns, reads all indicators, and returns a full verdict with entry zone, stop loss, and target.",
    emoji: "📸",
    target: "tour-tabs",
    position: "bottom",
    sideEffect: null,
  },
  {
    id: "u_portfolio",
    title: "Portfolio Tracker",
    body: "💼 Portfolio tracks your real holdings with live prices. Five sub-tabs: Overview, Holdings P&L, Performance (90-day history + CNN+LSTM forecast), Risk metrics (Sharpe ratio, drawdown, volatility), and AI Rebalance suggestions.",
    emoji: "💼",
    target: "tour-tabs",
    position: "bottom",
    sideEffect: null,
  },
  {
    id: "u_watchlist",
    title: "Watchlist",
    body: "⭐ Watchlist saves tickers you're monitoring. Each card shows the live price, 52W range bar with percentile position, and a Predict button that jumps straight to that asset. Star any loaded asset to add it instantly.",
    emoji: "⭐",
    target: "tour-tabs",
    position: "bottom",
    sideEffect: null,
  },
  {
    id: "u_alerts_open",
    title: "Price Alerts & Notes",
    body: "The 🔔 button in the header opens Alerts & Notes. Let's open it now.",
    emoji: "🔔",
    target: "tour-alerts-btn",
    position: "left",
    sideEffect: "open_alerts",
  },
  {
    id: "u_alerts_panel",
    title: "Setting a Price Alert",
    body: "Enter a ticker, target price, and direction (Above or Below). The app checks prices every 8 seconds and fires a toast notification when your level is hit.",
    emoji: "📈",
    target: "tour-alerts-panel",
    position: "left",
    sideEffect: null,
  },
  {
    id: "u_notes",
    title: "Notes",
    body: "The 📝 Notes tab lets you write analysis notes, trade logs, or watchlist reminders — tagged by category (Analysis, Trade, Idea, Watchlist, General) and fully searchable.",
    emoji: "📝",
    target: "tour-alerts-body",
    position: "left",
    sideEffect: null,
  },
  {
    id: "u_history_open",
    title: "Activity History",
    body: "The 🕐 button opens your full prediction and analysis history. Let's open it.",
    emoji: "🕐",
    target: "tour-history-btn",
    position: "left",
    sideEffect: "open_history",
  },
  {
    id: "u_history_panel",
    title: "History — Tap Any Card",
    body: "Every prediction and Chart AI analysis is logged here for 30 days, organised by tab. Tap any card to open a full detail panel — signals breakdown, day-by-day forecast table, position sizing, and for Chart AI: OCR data, patterns, indicators, and support levels.",
    emoji: "📋",
    target: "tour-history-panel",
    position: "left",
    sideEffect: null,
  },
  {
    id: "u_accuracy",
    title: "Accuracy Tracker",
    body: "The 🎯 Accuracy tab inside History tracks your predictions vs actual outcomes. When a prediction's horizon passes, it fetches the real price and scores it: direction accuracy %, price error %, and whether the CNN+LSTM beat the flat and momentum baselines.",
    emoji: "🎯",
    target: "tour-history-panel",
    position: "left",
    sideEffect: null,
  },
  {
    id: "u_prefs",
    title: "Theme & Currency",
    body: "Your dark/light mode preference and display currency are saved to your account and restored on every login. All 20 currencies update every price instantly — predictions, P&L, stop-loss, take-profit.",
    emoji: "⚙",
    target: "tour-theme",
    position: "left",
    sideEffect: "close_panels",
  },
  {
    id: "u_done",
    title: "You Know the Full App",
    body: "Start with a prediction, explore the AI Insight, add holdings to Portfolio, star tickers to your Watchlist, set alerts for key levels, and check the Accuracy tab once your horizons pass. The ❓ button replays this tour any time.",
    emoji: "✅",
    target: null,
    position: "center",
    sideEffect: null,
  },
];


function OnboardingTour({ theme, onDone, steps, onStepSideEffect }) {
  const [step, setStep] = useState(0);
  const [targetRect, setTargetRect] = useState(null);
  const [visible, setVisible] = useState(true);
  const isDark = theme === "dark";

  const activeSteps = steps || TOUR_STEPS;
  const current = activeSteps[step];
  const isFirst = step === 0;
  const isLast = step === activeSteps.length - 1;

  useEffect(() => {
    // Fire side effect first (open/close panels), then find element after delay
    if (current.sideEffect && onStepSideEffect) {
      onStepSideEffect(current.sideEffect);
    }
    const delay = current.sideEffect ? 380 : 0;
    if (current.target) {
      setTimeout(() => {
        const el = document.getElementById(current.target);
        if (el) {
          el.scrollIntoView({ behavior: "smooth", block: "nearest" });
          setTimeout(() => {
            const r = el.getBoundingClientRect();
            setTargetRect(r);
          }, 300);
        } else {
          setTargetRect(null);
        }
      }, delay);
    } else {
      setTargetRect(null);
    }
  }, [step, current.target, current.sideEffect]);

  const advance = () => {
    if (isLast) { handleDone(); return; }
    setVisible(false);
    setTimeout(() => { setStep(s => s + 1); setVisible(true); }, 180);
  };

  const back = () => {
    setVisible(false);
    setTimeout(() => { setStep(s => s - 1); setVisible(true); }, 180);
  };

  const handleDone = () => {
    try { localStorage.setItem("mp_toured", "1"); } catch(e) {}
    onDone();
  };

  const skip = () => handleDone();

  // Tooltip position calc
  const getTooltipStyle = () => {
    const base = {
      position: "fixed",
      zIndex: 10001,
      width: "clamp(280px, 80vw, 380px)",
      background: isDark ? "#13151a" : "#ffffff",
      border: `1px solid ${isDark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.12)"}`,
      borderRadius: 18,
      padding: "22px 24px",
      boxShadow: isDark
        ? "0 24px 64px rgba(0,0,0,0.8), 0 0 0 1px rgba(255,255,255,0.05)"
        : "0 24px 64px rgba(0,0,0,0.18), 0 0 0 1px rgba(0,0,0,0.05)",
      fontFamily: "'Space Mono','Courier New',monospace",
      color: isDark ? "#e0e0e0" : "#1a1a1a",
      transition: "opacity 0.18s, transform 0.18s",
      opacity: visible ? 1 : 0,
      transform: visible ? "translateY(0)" : "translateY(6px)",
    };

    if (!targetRect || current.position === "center") {
      return { ...base, top: "50%", left: "50%", transform: visible ? "translate(-50%,-50%)" : "translate(-50%,-44%)" };
    }

    const PAD = 16;
    const W = 380;
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    if (current.position === "bottom") {
      const left = Math.max(PAD, Math.min(vw - W - PAD, targetRect.left + targetRect.width / 2 - W / 2));
      return { ...base, top: Math.min(targetRect.bottom + 12, vh - 300), left };
    }
    if (current.position === "top") {
      const left = Math.max(PAD, Math.min(vw - W - PAD, targetRect.left + targetRect.width / 2 - W / 2));
      const top = targetRect.top - 12;
      return { ...base, top: "auto", bottom: vh - top, left };
    }
    if (current.position === "right") {
      return { ...base, top: Math.max(PAD, targetRect.top), left: Math.min(targetRect.right + 12, vw - W - PAD) };
    }
    if (current.position === "left") {
      return { ...base, top: Math.max(PAD, targetRect.top), right: vw - targetRect.left + 12, left: "auto" };
    }
    return { ...base, top: "50%", left: "50%", transform: visible ? "translate(-50%,-50%)" : "translate(-50%,-44%)" };
  };

  // Spotlight cutout via clip-path on overlay
  const getSpotlightClip = () => {
    if (!targetRect) return "none";
    const PAD = 10;
    const r = targetRect;
    const x1 = Math.max(0, r.left - PAD), y1 = Math.max(0, r.top - PAD);
    const x2 = r.right + PAD, y2 = r.bottom + PAD;
    const vw = window.innerWidth, vh = window.innerHeight;
    return `polygon(
      0 0, ${vw}px 0, ${vw}px ${vh}px, 0 ${vh}px, 0 0,
      ${x1}px ${y1}px, ${x1}px ${y2}px, ${x2}px ${y2}px, ${x2}px ${y1}px, ${x1}px ${y1}px
    )`;
  };

  const accentColor = "#a78bfa";

  return (
    <>
      {/* Overlay with spotlight */}
      <div
        onClick={advance}
        style={{
          position: "fixed", inset: 0, zIndex: 10000,
          background: "rgba(0,0,0,0.65)",
          backdropFilter: "blur(1px)",
          clipPath: getSpotlightClip(),
          transition: "clip-path 0.3s ease",
          cursor: "pointer",
        }}
      />
      {/* Highlighted border around target */}
      {targetRect && (
        <div style={{
          position: "fixed",
          zIndex: 10000,
          top: targetRect.top - 8,
          left: targetRect.left - 8,
          width: targetRect.width + 16,
          height: targetRect.height + 16,
          borderRadius: 14,
          border: `2px solid ${accentColor}`,
          boxShadow: `0 0 0 4px ${accentColor}20, 0 0 24px ${accentColor}40`,
          pointerEvents: "none",
          transition: "all 0.3s ease",
          animation: "pulse 2s infinite",
        }} />
      )}

      {/* Tooltip card */}
      <div style={getTooltipStyle()}>
        {/* Progress dots */}
        <div style={{ display: "flex", gap: 5, marginBottom: 16, justifyContent: "center" }}>
          {activeSteps.map((_, i) => (
            <div key={i} onClick={() => setStep(i)} style={{
              width: i === step ? 20 : 6, height: 6, borderRadius: 3,
              background: i === step ? accentColor : i < step ? `${accentColor}60` : (isDark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.12)"),
              transition: "all 0.3s", cursor: "pointer",
            }} />
          ))}
        </div>

        {/* Emoji + step counter */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
          <span style={{ fontSize: 28 }}>{current.emoji}</span>
          <span style={{ fontSize: 10, color: isDark ? "#555" : "#aaa", fontFamily: "monospace", letterSpacing: 1 }}>
            {step + 1} / {activeSteps.length}
          </span>
        </div>

        {/* Title */}
        <div style={{
          fontFamily: "'Syne',sans-serif", fontSize: "clamp(15px,3vw,18px)", fontWeight: 800,
          color: isDark ? "#fff" : "#111", marginBottom: 10, lineHeight: 1.3,
        }}>
          {current.title}
        </div>

        {/* Body */}
        <div style={{
          fontSize: "clamp(11px,2vw,13px)", color: isDark ? "#aaa" : "#555",
          lineHeight: 1.75, marginBottom: 20,
        }}>
          {current.body}
        </div>

        {/* Buttons */}
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {!isFirst && (
            <button onClick={back} style={{
              padding: "9px 16px", borderRadius: 9, border: `1px solid ${isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)"}`,
              background: "transparent", color: isDark ? "#666" : "#999",
              fontSize: 11, fontFamily: "monospace", fontWeight: 700,
            }}>← Back</button>
          )}
          <button onClick={advance} style={{
            flex: 1, padding: "10px 20px", borderRadius: 9,
            border: `1px solid ${accentColor}60`,
            background: `${accentColor}20`, color: accentColor,
            fontSize: "clamp(11px,2vw,12px)", fontFamily: "monospace", fontWeight: 800, letterSpacing: 0.5,
          }}>
            {isLast ? "🎉 Let's Go!" : "Next →"}
          </button>
          {!isLast && (
            <button onClick={skip} style={{
              padding: "9px 14px", borderRadius: 9, border: `1px solid ${isDark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.07)"}`,
              background: "transparent", color: isDark ? "#444" : "#bbb",
              fontSize: 10, fontFamily: "monospace", fontWeight: 700,
            }}>Skip</button>
          )}
        </div>

        {/* Click overlay hint */}
        {!isLast && (
          <div style={{ textAlign: "center", marginTop: 12, fontSize: 9, color: isDark ? "#333" : "#ccc", letterSpacing: 1 }}>
            CLICK ANYWHERE TO ADVANCE
          </div>
        )}
      </div>
    </>
  );
}

export { TOUR_STEPS, USER_TOUR_STEPS };
export default OnboardingTour;
