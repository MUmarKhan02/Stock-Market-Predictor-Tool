'use client';

import { useState, useEffect } from "react";
import { Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, LineChart } from "recharts";
import { formatPrice, loadAccuracy, recordPendingPrediction, resolvePendingPredictions, saveAccuracy } from "../shared/utils";
import { fetchAssetInfo } from "../shared/utils";




function AccuracyPanel({ user, currency, theme }) {
  const isDark = theme === "dark";
  const fp = (v, isCrypto) => v != null ? formatPrice(v, currency, isCrypto || false) : "—";
  const [records, setRecords] = useState(() => user ? loadAccuracy(user.email) : []);
  const [checking, setChecking] = useState(false);
  const [lastChecked, setLastChecked] = useState(null);
  const [filter, setFilter] = useState("all"); // all | pending | resolved

  // Auto-check on mount
  useEffect(() => {
    if (!user) return;
    const hasPending = records.some(r => r.status === "pending" && r.checkAfter <= Date.now());
    if (hasPending) checkNow();
  }, []);

  const checkNow = async () => {
    if (!user || checking) return;
    setChecking(true);
    const updated = await resolvePendingPredictions(user.email);
    setRecords(updated);
    setLastChecked(new Date().toLocaleTimeString());
    setChecking(false);
  };

  const resolved  = records.filter(r => r.status === "resolved");
  const pending   = records.filter(r => r.status === "pending");
  const displayed = filter === "pending" ? pending : filter === "resolved" ? resolved : records;

  // Aggregate stats
  const stats = resolved.length > 0 ? (() => {
    const dirAcc   = resolved.filter(r => r.directionCorrect).length / resolved.length * 100;
    const avgErr   = resolved.reduce((s, r) => s + r.pctError, 0) / resolved.length;
    const beatFlat = resolved.filter(r => r.modelBeatFlat).length / resolved.length * 100;
    const beatMom  = resolved.filter(r => r.modelBeatMomentum).length / resolved.length * 100;
    const avgFlatErr = resolved.reduce((s, r) => s + (r.flatBaselineErr || 0), 0) / resolved.length;
    const avgMomErr  = resolved.reduce((s, r) => s + (r.momentumBaselineErr || 0), 0) / resolved.length;
    return { dirAcc, avgErr, beatFlat, beatMom, avgFlatErr, avgMomErr };
  })() : null;

  const pendingReady = pending.filter(r => r.checkAfter <= Date.now()).length;

  const ScoreBar = ({ val, max = 100, color }) => (
    <div style={{ height: 5, background: "var(--border)", borderRadius: 3, overflow: "hidden", marginTop: 4 }}>
      <div style={{ height: "100%", width: `${Math.min(100, (val / max) * 100)}%`, background: color, borderRadius: 3, transition: "width 0.8s ease" }} />
    </div>
  );

  return (
    <div style={{ animation: "slideIn 0.3s ease" }}>

      {/* ── Stats overview ── */}
      {stats && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 10, color: "var(--text9)", letterSpacing: 2, marginBottom: 10 }}>
            MODEL PERFORMANCE — {resolved.length} RESOLVED PREDICTION{resolved.length !== 1 ? "S" : ""}
          </div>

          {/* Main accuracy cards */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(clamp(110px,22vw,150px), 1fr))", gap: 10, marginBottom: 14 }}>
            {[
              { label: "Direction Accuracy", val: `${stats.dirAcc.toFixed(0)}%`, sub: "predicted up/down correctly", color: stats.dirAcc >= 60 ? "#00d4aa" : stats.dirAcc >= 45 ? "#fbbf24" : "#ff6b6b", raw: stats.dirAcc },
              { label: "Avg Price Error",    val: `${stats.avgErr.toFixed(1)}%`, sub: "mean absolute % error",     color: stats.avgErr <= 3 ? "#00d4aa" : stats.avgErr <= 8 ? "#fbbf24" : "#ff6b6b",  raw: Math.max(0, 100 - stats.avgErr * 5) },
              { label: "Beat Flat Baseline", val: `${stats.beatFlat.toFixed(0)}%`, sub: "vs 'price unchanged'",   color: stats.beatFlat >= 55 ? "#00d4aa" : "#fbbf24", raw: stats.beatFlat },
              { label: "Beat Momentum",      val: `${stats.beatMom.toFixed(0)}%`,  sub: "vs trend continuation",  color: stats.beatMom >= 55 ? "#00d4aa" : "#fbbf24",  raw: stats.beatMom },
            ].map(({ label, val, sub, color, raw }) => (
              <div key={label} style={{ background: `${color}10`, border: `1px solid ${color}25`, borderRadius: 12, padding: "11px 12px" }}>
                <div style={{ fontSize: 9, color: "var(--text9)", marginBottom: 4, letterSpacing: 1 }}>{label.toUpperCase()}</div>
                <div style={{ fontSize: "clamp(16px,3.5vw,22px)", fontWeight: 800, color, fontFamily: "monospace", marginBottom: 2 }}>{val}</div>
                <ScoreBar val={raw} color={color} />
                <div style={{ fontSize: 9, color: "var(--text8)", marginTop: 4, lineHeight: 1.4 }}>{sub}</div>
              </div>
            ))}
          </div>

          {/* CNN+LSTM vs Baselines comparison table */}
          <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, padding: "clamp(10px,2vw,16px)", marginBottom: 14 }}>
            <div style={{ fontSize: 10, color: "var(--text9)", letterSpacing: 2, marginBottom: 12 }}>CNN+LSTM VS BASELINES (avg price error)</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {[
                { label: "CNN+LSTM Model",     err: stats.avgErr,      color: stats.avgErr <= stats.avgFlatErr && stats.avgErr <= stats.avgMomErr ? "#00d4aa" : "#fbbf24", icon: "🧠" },
                { label: "Flat Baseline",       err: stats.avgFlatErr,  color: "#555", icon: "➖", desc: "assumes price stays unchanged" },
                { label: "Momentum Baseline",   err: stats.avgMomErr,   color: "#555", icon: "📈", desc: "assumes current trend continues" },
              ].map(({ label, err, color, icon, desc }) => {
                const maxErr = Math.max(stats.avgErr, stats.avgFlatErr, stats.avgMomErr, 1);
                const barW = (1 - err / (maxErr * 1.2)) * 100;
                return (
                  <div key={label}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                      <span style={{ fontSize: 11, color: "var(--text5)", fontWeight: 700 }}>{icon} {label}</span>
                      <span style={{ fontSize: 11, color, fontFamily: "monospace", fontWeight: 800 }}>{err.toFixed(1)}% avg error</span>
                    </div>
                    <div style={{ height: 6, background: "var(--border)", borderRadius: 3, overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${Math.max(4, barW)}%`, background: color, borderRadius: 3, transition: "width 0.8s ease" }} />
                    </div>
                    {desc && <div style={{ fontSize: 9, color: "var(--text10)", marginTop: 2 }}>{desc}</div>}
                  </div>
                );
              })}
            </div>
            <div style={{ marginTop: 10, fontSize: 10, color: "var(--text8)", lineHeight: 1.6 }}>
              {stats.avgErr <= stats.avgFlatErr && stats.avgErr <= stats.avgMomErr
                ? "✅ The CNN+LSTM model is outperforming both baselines."
                : (stats.avgErr <= stats.avgFlatErr || stats.avgErr <= stats.avgMomErr)
                  ? "〰 The model beats one baseline but not the other yet."
                  : "⚠ The model is currently underperforming both baselines — more data needed."}
            </div>
          </div>
        </div>
      )}

      {/* ── Check now button ── */}
      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 14, flexWrap: "wrap" }}>
        <button onClick={checkNow} disabled={checking}
          style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 16px", borderRadius: 9, border: "1px solid rgba(56,189,248,0.4)", background: "rgba(56,189,248,0.1)", color: "#38bdf8", fontSize: 11, fontFamily: "monospace", fontWeight: 700, cursor: checking ? "not-allowed" : "pointer", opacity: checking ? 0.6 : 1 }}>
          {checking ? "⟳ Checking prices..." : "🔄 Check Now"}
        </button>
        {pendingReady > 0 && (
          <div style={{ fontSize: 11, color: "#fbbf24", background: "rgba(251,191,36,0.1)", border: "1px solid rgba(251,191,36,0.3)", padding: "6px 12px", borderRadius: 8 }}>
            ⏰ {pendingReady} prediction{pendingReady > 1 ? "s" : ""} ready to resolve
          </div>
        )}
        {lastChecked && <div style={{ fontSize: 9, color: "var(--text10)" }}>Last checked: {lastChecked}</div>}
      </div>

      {/* ── Filter tabs ── */}
      {records.length > 0 && (
        <div style={{ display: "flex", gap: 4, marginBottom: 14, flexWrap: "wrap" }}>
          {[["all", `All (${records.length})`], ["pending", `Pending (${pending.length})`], ["resolved", `Resolved (${resolved.length})`]].map(([id, label]) => (
            <button key={id} onClick={() => setFilter(id)} style={{
              padding: "6px 12px", borderRadius: 8, fontSize: 10, fontFamily: "monospace", fontWeight: 700,
              border: `1px solid ${filter === id ? "rgba(56,189,248,0.5)" : "var(--border)"}`,
              background: filter === id ? "rgba(56,189,248,0.12)" : "var(--surface)",
              color: filter === id ? "#38bdf8" : "var(--text8)", cursor: "pointer", transition: "all 0.15s",
            }}>{label}</button>
          ))}
        </div>
      )}

      {/* ── Prediction records list ── */}
      {displayed.length > 0 ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {displayed.map((r, i) => {
            const isPending  = r.status === "pending";
            const daysLeft   = isPending ? Math.max(0, Math.ceil((r.checkAfter - Date.now()) / (24 * 60 * 60 * 1000))) : 0;
            const dirColor   = r.directionCorrect === true ? "#00d4aa" : r.directionCorrect === false ? "#ff6b6b" : "var(--text8)";
            const errColor   = r.pctError != null ? (r.pctError <= 3 ? "#00d4aa" : r.pctError <= 8 ? "#fbbf24" : "#ff6b6b") : "var(--text8)";
            const accent     = r.isCrypto ? "#f7931a" : "#00d4aa";
            return (
              <div key={r.id || i} style={{ background: "var(--surface)", border: `1px solid ${isPending ? "var(--border)" : r.directionCorrect ? "rgba(0,212,170,0.2)" : "rgba(255,107,107,0.2)"}`, borderRadius: 14, padding: "clamp(10px,2vw,14px)", borderLeft: `3px solid ${isPending ? "var(--border2)" : r.directionCorrect ? "#00d4aa" : "#ff6b6b"}` }}>

                {/* Header row */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 8, marginBottom: 8 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                    <AssetLogo ticker={r.ticker} isCrypto={r.isCrypto} accent={accent} />
                    <div>
                      <div style={{ fontSize: "clamp(12px,2.5vw,14px)", fontWeight: 800, color: accent, fontFamily: "'Syne',sans-serif" }}>{r.ticker}</div>
                      <div style={{ fontSize: 10, color: "var(--text8)" }}>{r.name}</div>
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                    <span style={{ padding: "3px 9px", borderRadius: 20, background: "var(--surface2)", fontSize: 9, fontFamily: "monospace", color: "var(--text7)", fontWeight: 700 }}>{r.horizon}</span>
                    {isPending ? (
                      <span style={{ padding: "3px 9px", borderRadius: 20, background: "rgba(251,191,36,0.12)", border: "1px solid rgba(251,191,36,0.3)", fontSize: 9, color: "#fbbf24", fontWeight: 700 }}>
                        {daysLeft === 0 ? "⏰ Ready" : `⏳ ${daysLeft}d left`}
                      </span>
                    ) : (
                      <span style={{ padding: "3px 9px", borderRadius: 20, background: r.directionCorrect ? "rgba(0,212,170,0.12)" : "rgba(255,107,107,0.1)", border: `1px solid ${r.directionCorrect ? "rgba(0,212,170,0.3)" : "rgba(255,107,107,0.25)"}`, fontSize: 9, color: r.directionCorrect ? "#00d4aa" : "#ff6b6b", fontWeight: 700 }}>
                        {r.directionCorrect ? "✓ Direction" : "✗ Direction"}
                      </span>
                    )}
                  </div>
                </div>

                {/* Price comparison grid */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(clamp(80px,16vw,110px), 1fr))", gap: 6, marginBottom: 8 }}>
                  {[
                    { label: "Price at Pred.", val: fp(r.priceAtPred, r.isCrypto), color: "var(--text4)" },
                    { label: "CNN+LSTM Pred.", val: fp(r.predPrice, r.isCrypto),   color: r.direction === "up" ? "#00d4aa" : "#ff6b6b" },
                    ...(!isPending ? [
                      { label: "Actual Price",  val: fp(r.actualPrice, r.isCrypto), color: "var(--text2)" },
                      { label: "Price Error",   val: `${r.pctError}%`,             color: errColor },
                    ] : []),
                  ].map(({ label, val, color }) => (
                    <div key={label} style={{ background: "var(--surface2)", borderRadius: 8, padding: "7px 9px" }}>
                      <div style={{ fontSize: 8, color: "var(--text9)", marginBottom: 2, letterSpacing: 1 }}>{label.toUpperCase()}</div>
                      <div style={{ fontSize: "clamp(10px,2vw,12px)", fontWeight: 800, color, fontFamily: "monospace" }}>{val}</div>
                    </div>
                  ))}
                </div>

                {/* Baseline comparison (resolved only) */}
                {!isPending && r.flatBaselineErr != null && (
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 6 }}>
                    <div style={{ flex: 1, minWidth: 80, background: "var(--surface2)", borderRadius: 7, padding: "5px 8px" }}>
                      <div style={{ fontSize: 8, color: "var(--text10)", marginBottom: 1 }}>FLAT BASELINE ERR</div>
                      <div style={{ fontSize: 10, fontWeight: 700, color: r.modelBeatFlat ? "#00d4aa" : "#ff8080", fontFamily: "monospace" }}>
                        {r.flatBaselineErr.toFixed(1)}% {r.modelBeatFlat ? "🔼 model better" : "🔽 model worse"}
                      </div>
                    </div>
                    <div style={{ flex: 1, minWidth: 80, background: "var(--surface2)", borderRadius: 7, padding: "5px 8px" }}>
                      <div style={{ fontSize: 8, color: "var(--text10)", marginBottom: 1 }}>MOMENTUM BASELINE ERR</div>
                      <div style={{ fontSize: 10, fontWeight: 700, color: r.modelBeatMomentum ? "#00d4aa" : "#ff8080", fontFamily: "monospace" }}>
                        {r.momentumBaselineErr.toFixed(1)}% {r.modelBeatMomentum ? "🔼 model better" : "🔽 model worse"}
                      </div>
                    </div>
                  </div>
                )}

                {/* Footer */}
                <div style={{ fontSize: 9, color: "var(--text10)", display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <span>Predicted: {new Date(r.createdAt).toLocaleDateString()}</span>
                  {!isPending && r.resolvedAt && <span>Resolved: {new Date(r.resolvedAt).toLocaleDateString()}</span>}
                  {isPending && <span>Check after: {new Date(r.checkAfter).toLocaleDateString()}</span>}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div style={{ textAlign: "center", padding: "clamp(30px,5vw,50px) 20px", color: "var(--text9)" }}>
          <div style={{ fontSize: "clamp(28px,5vw,40px)", marginBottom: 10 }}>🎯</div>
          <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text6)", marginBottom: 6 }}>No predictions tracked yet</div>
          <div style={{ fontSize: 11, color: "var(--text9)", lineHeight: 1.7 }}>
            Run a stock or crypto prediction — it'll automatically appear here and be checked for accuracy once the horizon period passes.
          </div>
        </div>
      )}
    </div>
  );
}

export default AccuracyPanel;
