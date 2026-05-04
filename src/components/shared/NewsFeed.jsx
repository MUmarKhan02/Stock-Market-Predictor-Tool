'use client';

import { useState, useEffect } from "react";
import { formatPrice } from "./utils";
import AssetLogo from "./AssetLogo";

async function fetchNewsFeed(ticker, isCrypto) {
  var query = isCrypto
    ? ticker + " cryptocurrency news today price"
    : ticker + " stock news today earnings";
  var prompt = "Search for the latest news about " + ticker + ". Return ONLY a JSON array of exactly 5 news items, no markdown:\n" +
    '[{"headline":"...","source":"...","time":"...","sentiment":"bullish|bearish|neutral","summary":"one sentence max"}]\n' +
    "Use real recent headlines. sentiment should reflect whether the news is positive or negative for the stock/crypto price. Return ONLY the JSON array.";
  var res = await fetch("/api/claude", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 800,
      tools: [{ type: "web_search_20250305", name: "web_search" }],
      messages: [{ role: "user", content: prompt }]
    })
  });
  var data = await res.json();
  var text = data.content.filter(function(b){ return b.type === "text"; }).map(function(b){ return b.text; }).join("");
  var match = text.match(/\[[\s\S]*\]/);
  if (!match) throw new Error("No JSON array");
  return JSON.parse(match[0]);
}

function NewsFeed({ ticker, isCrypto, theme, isGuest }) {
  var [news, setNews] = useState(null);
  var [loading, setLoading] = useState(false);
  var [error, setError] = useState(null);
  var [expanded, setExpanded] = useState(false);
  var isDark = theme === "dark";
  var accent = isCrypto ? "#f7931a" : "#00d4aa";

  useEffect(function() {
    if (isGuest || !ticker) return;
    setNews(null); setError(null); setExpanded(false);
    setLoading(true);
    fetchNewsFeed(ticker, isCrypto)
      .then(function(items) { setNews(items); setLoading(false); })
      .catch(function() { setError(true); setLoading(false); });
  }, [ticker, isCrypto, isGuest]);

  if (isGuest) return null;

  var sentimentColor = function(s) {
    if (!s) return "var(--text9)";
    var l = s.toLowerCase();
    if (l === "bullish")  return "#00d4aa";
    if (l === "bearish")  return "#ff6b6b";
    return "#fbbf24";
  };
  var sentimentBg = function(s) {
    if (!s) return "var(--surface2)";
    var l = s.toLowerCase();
    if (l === "bullish")  return "rgba(0,212,170,0.08)";
    if (l === "bearish")  return "rgba(255,107,107,0.08)";
    return "rgba(251,191,36,0.08)";
  };
  var sentimentIcon = function(s) {
    if (!s) return "●";
    var l = s.toLowerCase();
    if (l === "bullish") return "▲";
    if (l === "bearish") return "▼";
    return "●";
  };

  return (
    <div style={{ marginBottom:14 }}>
      {/* Header */}
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:8 }}>
        <div style={{ display:"flex", alignItems:"center", gap:6 }}>
          <span style={{ fontSize:13 }}>📰</span>
          <span style={{ fontSize:10, color:"var(--text9)", letterSpacing:2, fontFamily:"monospace" }}>LATEST NEWS — {ticker}</span>
          {loading && <span style={{ fontSize:9, color:accent, animation:"pulse 1.5s infinite" }}>fetching...</span>}
        </div>
        {news && (
          <button onClick={function(){ setExpanded(function(v){ return !v; }); }}
            style={{ fontSize:9, color:"var(--text8)", background:"none", border:"none", cursor:"pointer", fontFamily:"monospace", padding:"2px 6px" }}>
            {expanded ? "▲ less" : "▼ more"}
          </button>
        )}
      </div>

      {/* Error */}
      {error && !loading && (
        <div style={{ fontSize:10, color:"var(--text9)", padding:"8px 12px", background:"var(--surface)", borderRadius:8, border:"1px solid var(--border)" }}>
          Could not load news.
          <button onClick={function(){
            setError(null); setLoading(true);
            fetchNewsFeed(ticker, isCrypto)
              .then(function(items){ setNews(items); setLoading(false); })
              .catch(function(){ setError(true); setLoading(false); });
          }} style={{ marginLeft:8, color:accent, background:"none", border:"none", cursor:"pointer", fontFamily:"monospace", fontSize:10 }}>Retry</button>
        </div>
      )}

      {/* Loading skeleton */}
      {loading && (
        <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
          {[1,2,3].map(function(i){
            return (
              <div key={i} style={{ height:48, borderRadius:9, background:"var(--surface)", border:"1px solid var(--border)", animation:"pulse 1.5s infinite", opacity: 1 - i * 0.15 }}/>
            );
          })}
        </div>
      )}

      {/* News items */}
      {news && !loading && (
        <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
          {(expanded ? news : news.slice(0, 3)).map(function(item, i) {
            var sc = sentimentColor(item.sentiment);
            var sb = sentimentBg(item.sentiment);
            return (
              <div key={i} style={{ background:sb, border:"1px solid " + sc + "20", borderRadius:9, padding:"9px 12px", borderLeft:"3px solid " + sc }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", gap:8, marginBottom:item.summary ? 4 : 0 }}>
                  <div style={{ fontSize:"clamp(10px,2vw,12px)", fontWeight:700, color:"var(--text3)", lineHeight:1.4, flex:1, minWidth:0 }}>
                    {item.headline}
                  </div>
                  <span style={{ fontSize:8, color:sc, fontWeight:700, background:sc+"15", border:"1px solid "+sc+"30", borderRadius:4, padding:"2px 6px", flexShrink:0, fontFamily:"monospace", whiteSpace:"nowrap" }}>
                    {sentimentIcon(item.sentiment)} {item.sentiment ? item.sentiment.toUpperCase() : "NEUTRAL"}
                  </span>
                </div>
                {item.summary && (
                  <div style={{ fontSize:10, color:"var(--text7)", lineHeight:1.5, marginBottom:4 }}>
                    {item.summary}
                  </div>
                )}
                <div style={{ display:"flex", gap:8, fontSize:9, color:"var(--text10)" }}>
                  {item.source && <span>{item.source}</span>}
                  {item.time && <span>· {item.time}</span>}
                </div>
              </div>
            );
          })}
          {!expanded && news.length > 3 && (
            <button onClick={function(){ setExpanded(true); }}
              style={{ fontSize:10, color:"var(--text8)", background:"var(--surface)", border:"1px solid var(--border)", borderRadius:8, padding:"6px 12px", cursor:"pointer", fontFamily:"monospace", textAlign:"center" }}>
              + {news.length - 3} more headlines
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default NewsFeed;
