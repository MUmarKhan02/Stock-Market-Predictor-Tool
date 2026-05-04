'use client';

import { useState } from "react";
import { formatPrice } from "../shared/utils";
import { AssetLogo } from "../shared/AssetLogo";
import { fetchAssetInfo, loadWatchlist, saveWatchlist } from "../shared/utils";

function WatchlistPanel({user, currency, theme, onNavigateToPredictor}) {
  const isDark = theme === "dark";
  const fp = function(v, isCrypto){ return formatPrice(v, currency, isCrypto||false); };
  const [items, setItems] = useState(function(){ return user ? loadWatchlist(user.email) : []; });
  const [inputVal, setInputVal] = useState("");
  const [loading, setLoading] = useState({});
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  var saveItems = function(next) { setItems(next); if(user) saveWatchlist(user.email, next); };

  var addTicker = async function(raw) {
    var t = (raw||inputVal).trim().toUpperCase();
    if (!t) return;
    if (items.find(function(i){ return i.ticker === t; })) { setError(t+" is already on your watchlist."); return; }
    setLoading(function(p){ var n=Object.assign({},p); n[t]=true; return n; });
    setError("");
    try {
      var isCrypto = ["BTC","ETH","BNB","SOL","XRP","ADA","DOGE","AVAX","LINK","MATIC","LTC","BCH","DOT","UNI","ATOM"].includes(t);
      var info = await fetchAssetInfo(t, isCrypto);
      if (!info.valid) { setError('"'+t+'" not found. Check the ticker and try again.'); }
      else {
        var entry = {
          ticker: info.ticker||t,
          name: info.name||t,
          isCrypto: isCrypto,
          sector: info.sector||"",
          currentPrice: info.currentPrice||0,
          weekHigh52: info.weekHigh52||0,
          weekLow52: info.weekLow52||0,
          change: 0,
          addedAt: Date.now(),
          lastRefreshed: Date.now(),
        };
        saveItems([entry, ...items]);
        setInputVal("");
      }
    } catch(e) { setError("Failed to fetch "+t+". Try again."); }
    setLoading(function(p){ var n=Object.assign({},p); delete n[t]; return n; });
  };

  var removeTicker = function(ticker) {
    saveItems(items.filter(function(i){ return i.ticker !== ticker; }));
  };

  var refreshAll = async function() {
    if (refreshing || !items.length) return;
    setRefreshing(true);
    var updated = [...items];
    for (var i = 0; i < updated.length; i++) {
      try {
        var info = await fetchAssetInfo(updated[i].ticker, updated[i].isCrypto);
        if (info.valid) {
          var prev = updated[i].currentPrice;
          updated[i] = Object.assign({}, updated[i], {
            currentPrice: info.currentPrice||updated[i].currentPrice,
            weekHigh52: info.weekHigh52||updated[i].weekHigh52,
            weekLow52: info.weekLow52||updated[i].weekLow52,
            change: prev > 0 ? ((info.currentPrice - prev) / prev * 100) : 0,
            lastRefreshed: Date.now(),
          });
        }
      } catch(e) {}
    }
    saveItems(updated);
    setRefreshing(false);
  };

  var POPULAR = ["AAPL","TSLA","NVDA","MSFT","BTC","ETH","GOOGL","AMZN","META","SOL"];

  return (
    <div style={{animation:"slideIn 0.3s ease"}}>

      {/* Header row */}
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16,flexWrap:"wrap",gap:10}}>
        <div>
          <div style={{fontSize:10,color:WL_ACCENT,letterSpacing:3,marginBottom:3}}>WATCHLIST</div>
          <div style={{fontFamily:"'Syne',sans-serif",fontSize:"clamp(18px,4vw,24px)",fontWeight:800,color:"var(--text)"}}>
            My Watchlist
            <span style={{marginLeft:10,fontSize:"clamp(11px,2vw,13px)",fontWeight:400,color:"var(--text8)"}}>
              {items.length} asset{items.length !== 1 ? "s" : ""}
            </span>
          </div>
        </div>
        {items.length > 0 && (
          <button onClick={refreshAll} disabled={refreshing}
            style={{display:"flex",alignItems:"center",gap:6,padding:"8px 16px",borderRadius:9,border:"1px solid "+WL_ACCENT+"40",background:WL_ACCENT+"10",color:WL_ACCENT,fontSize:11,fontFamily:"monospace",fontWeight:700,cursor:refreshing?"not-allowed":"pointer",opacity:refreshing?0.6:1}}>
            {refreshing ? "Refreshing..." : "↻ Refresh Prices"}
          </button>
        )}
      </div>

      {/* Add ticker */}
      <div style={{background:"var(--surface)",border:"1px solid var(--border)",borderRadius:14,padding:"clamp(14px,3vw,20px)",marginBottom:16}}>
        <div style={{fontSize:10,color:"var(--text8)",letterSpacing:2,marginBottom:10}}>ADD TO WATCHLIST</div>
        <div style={{display:"flex",gap:8,marginBottom:10,flexWrap:"wrap"}}>
          <input
            value={inputVal}
            onChange={function(e){setInputVal(e.target.value.toUpperCase()); setError("");}}
            onKeyDown={function(e){if(e.key==="Enter") addTicker();}}
            placeholder="Ticker — AAPL, BTC, TSLA..."
            style={{flex:1,minWidth:120,padding:"9px 12px",borderRadius:9,fontSize:12,fontFamily:"monospace",background:"var(--input-bg)",border:"1px solid var(--border3)",color:"var(--text)",outline:"none"}}
          />
          <button onClick={function(){addTicker();}} disabled={!inputVal.trim()||loading[inputVal.trim().toUpperCase()]}
            style={{padding:"9px 20px",borderRadius:9,border:"1px solid "+WL_ACCENT+"50",background:WL_ACCENT+"18",color:WL_ACCENT,fontSize:12,fontFamily:"monospace",fontWeight:800,cursor:"pointer",flexShrink:0,opacity:!inputVal.trim()?0.4:1}}>
            + Add
          </button>
        </div>
        {error && <div style={{fontSize:11,color:"#ff8080",marginBottom:8}}>{error}</div>}
        <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>
          <span style={{fontSize:9,color:"var(--text9)",alignSelf:"center",letterSpacing:1}}>QUICK ADD:</span>
          {POPULAR.filter(function(t){ return !items.find(function(i){ return i.ticker===t; }); }).slice(0,8).map(function(t){
            return (
              <button key={t} onClick={function(){addTicker(t);}} disabled={!!loading[t]}
                style={{padding:"4px 9px",borderRadius:6,border:"1px solid var(--border)",background:"var(--surface2)",color:loading[t]?"var(--text10)":"var(--text8)",fontSize:10,fontFamily:"monospace",fontWeight:700,cursor:"pointer"}}>
                {loading[t] ? "..." : t}
              </button>
            );
          })}
        </div>
      </div>

      {/* Empty state */}
      {items.length === 0 && (
        <div style={{textAlign:"center",padding:"clamp(40px,6vw,60px) 20px",color:"var(--text9)"}}>
          <div style={{fontSize:"clamp(32px,6vw,48px)",marginBottom:12}}>⭐</div>
          <div style={{fontSize:14,fontWeight:700,color:"var(--text6)",marginBottom:6}}>Your watchlist is empty</div>
          <div style={{fontSize:11,color:"var(--text9)",lineHeight:1.7}}>Add tickers above, or star any asset<br/>while predicting to add it instantly.</div>
        </div>
      )}

      {/* Watchlist cards */}
      {items.length > 0 && (
        <div style={{display:"flex",flexDirection:"column",gap:10}}>
          {items.map(function(item) {
            var accent = item.isCrypto ? "#f7931a" : "#00d4aa";
            var range = item.weekHigh52 - item.weekLow52;
            var rangePct = range > 0 ? Math.min(100, Math.max(0, (item.currentPrice - item.weekLow52) / range * 100)) : 50;
            var up = item.change >= 0;
            return (
              <div key={item.ticker} style={{background:"var(--surface)",border:"1px solid var(--border)",borderRadius:14,padding:"clamp(12px,2.5vw,16px)",borderLeft:"3px solid "+accent}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap",gap:8,marginBottom:10}}>
                  {/* Left: logo + name */}
                  <div style={{display:"flex",alignItems:"center",gap:10,minWidth:0}}>
                    <AssetLogo ticker={item.ticker} isCrypto={item.isCrypto} accent={accent}/>
                    <div style={{minWidth:0}}>
                      <div style={{fontSize:"clamp(13px,2.5vw,16px)",fontWeight:800,color:accent,fontFamily:"'Syne',sans-serif"}}>{item.ticker}</div>
                      <div style={{fontSize:10,color:"var(--text8)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",maxWidth:140}}>{item.name}</div>
                      {item.sector && <div style={{fontSize:9,color:"var(--text10)"}}>{item.sector}</div>}
                    </div>
                  </div>
                  {/* Right: price + change */}
                  <div style={{textAlign:"right",flexShrink:0}}>
                    <div style={{fontSize:"clamp(14px,2.5vw,18px)",fontWeight:800,color:"var(--text2)",fontFamily:"monospace"}}>{fp(item.currentPrice, item.isCrypto)}</div>
                    {item.change !== 0 && (
                      <div style={{fontSize:11,color:up?"#00d4aa":"#ff6b6b",fontWeight:700}}>{up?"▲":"▼"} {Math.abs(item.change).toFixed(2)}%</div>
                    )}
                  </div>
                </div>

                {/* 52W range bar */}
                {item.weekHigh52 > 0 && (
                  <div style={{marginBottom:10}}>
                    <div style={{display:"flex",justifyContent:"space-between",marginBottom:4,fontSize:8,color:"var(--text9)"}}>
                      <span>52W Low: {fp(item.weekLow52, item.isCrypto)}</span>
                      <span style={{color:accent,fontWeight:700}}>{rangePct.toFixed(0)}th pct</span>
                      <span>52W High: {fp(item.weekHigh52, item.isCrypto)}</span>
                    </div>
                    <div style={{height:5,background:"var(--surface2)",borderRadius:3,overflow:"hidden",border:"1px solid var(--border)"}}>
                      <div style={{height:"100%",width:rangePct+"%",background:accent,borderRadius:3,opacity:0.7}}/>
                    </div>
                  </div>
                )}

                {/* Action buttons */}
                <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                  <button onClick={function(){onNavigateToPredictor(item.ticker, item.isCrypto);}}
                    style={{flex:1,minWidth:100,padding:"7px 10px",borderRadius:8,border:"1px solid "+accent+"50",background:accent+"12",color:accent,fontSize:10,fontFamily:"monospace",fontWeight:700,cursor:"pointer"}}>
                    ▶ Predict
                  </button>
                  <button onClick={function(){removeTicker(item.ticker);}}
                    style={{padding:"7px 12px",borderRadius:8,border:"1px solid rgba(255,107,107,0.25)",background:"rgba(255,107,107,0.06)",color:"#ff8080",fontSize:10,fontFamily:"monospace",fontWeight:700,cursor:"pointer"}}>
                    ✕ Remove
                  </button>
                </div>

                {item.lastRefreshed && (
                  <div style={{fontSize:8,color:"var(--text10)",marginTop:6}}>
                    Updated {new Date(item.lastRefreshed).toLocaleTimeString()}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default WatchlistPanel;
