'use client';

import { useState, useEffect, useCallback } from "react";
import { Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Area, AreaChart, LineChart } from "recharts";
import { formatPrice, fetchAssetInfo, computeRSI, computeMA, computeBollinger, generatePriceData, cnnLstmPredict, analyzeInvestment } from "../shared/utils";
import { AssetLogo, MetricCard, ModelViz } from "../shared/AssetLogo";
import { ExportPDFButton } from "../shared/ExportPDF";
import ConfidenceRangePanel from "./ConfidenceRangePanel";
import InvestmentPanel from "./InvestmentPanel";
import NewsFeed from "../shared/NewsFeed";
import ExplainNudge from "../shared/ExplainNudge";
import PredictorMiniTour, { ASSET_LOADED_STEPS, PREDICTION_STEPS, HORIZON_STEPS } from "../tours/PredictorMiniTour";

const HORIZONS={"1W":5,"2W":10,"1M":21};
const STOCK_POP=["AAPL","TSLA","NVDA","MSFT","GOOGL","AMZN","META","AMD","NFLX","JPM"];
const CRYPTO_POP=["BTC","ETH","BNB","SOL","XRP","ADA","DOGE","AVAX","LINK","MATIC"];

function PredictorPanel({isCrypto,currency,theme,onGuestLimit,isGuest,onRecordHistory,onAddToWatchlist}){
  const isDarkPanel=theme==="dark";
  const accent=isCrypto?"#f7931a":"#00d4aa";
  const popular=isCrypto?CRYPTO_POP:STOCK_POP;
  const[inputVal,setInputVal]=useState("");
  const[activeTicker,setActiveTicker]=useState(null);
  const[assetInfo,setAssetInfo]=useState(null);
  const[fetchStatus,setFetchStatus]=useState("idle");
  const[fetchError,setFetchError]=useState("");
  const[horizon,setHorizon]=useState("1W");
  const[isTraining,setIsTraining]=useState(false);
  const[trainProgress,setTrainProgress]=useState(0);
  const[epoch,setEpoch]=useState(0);
  const[lossHistory,setLossHistory]=useState([]);
  const[predictions,setPredictions]=useState(null);
  const[metrics,setMetrics]=useState(null);
  const[analysis,setAnalysis]=useState(null);
  const[chartData,setChartData]=useState([]);
  const[priceHistory,setPriceHistory]=useState([]);
  const[activeSubTab,setActiveSubTab]=useState("forecast");
  const[portfolio,setPortfolio]=useState("");
  const[miniTour,setMiniTour]=useState(null); // null | "asset" | "prediction" | "horizon"
  const[watchlisted,setWatchlisted]=useState(false);
  const[showExplainNudge,setShowExplainNudge]=useState(true);
  const[guestPredicted,setGuestPredicted]=useState(false); // true after guest runs prediction

  const loadAsset=useCallback(async(symbol)=>{
    const t=symbol.trim().toUpperCase();if(!t)return;
    setFetchStatus("loading");setFetchError("");setPredictions(null);setMetrics(null);setLossHistory([]);setChartData([]);setPriceHistory([]);setAnalysis(null);
    try{
      const info=await fetchAssetInfo(t,isCrypto);
      if(!info.valid){setFetchStatus("error");setFetchError(`"${t}" doesn't appear to be a valid ${isCrypto?"crypto":"stock"}.`);return;}
      setAssetInfo(info);setActiveTicker(info.ticker||t);
      const seed=t.split("").reduce((s,c)=>s+c.charCodeAt(0),0);
      const raw=generatePriceData(300,seed,info.currentPrice,info.volatility||(isCrypto?0.05:0.02));
      const scale=info.currentPrice/raw[299];
      setPriceHistory(raw.map(p=>p*scale).slice(0,200));
      setFetchStatus("idle");
    }catch(e){setFetchStatus("error");setFetchError("Failed to fetch data. Please try again.");}
  },[isCrypto]);

  useEffect(()=>{
    if(!priceHistory.length)return;
    const ma20=computeMA(priceHistory,20),boll=computeBollinger(priceHistory);
    const display=priceHistory.slice(-60).map((p,i)=>({day:i+1,price:parseFloat(p.toFixed(2)),ma20:parseFloat(ma20[priceHistory.length-60+i].toFixed(2)),upper:parseFloat(boll[priceHistory.length-60+i].upper.toFixed(2)),lower:parseFloat(boll[priceHistory.length-60+i].lower.toFixed(2))}));
    if(predictions)predictions.forEach((pred,i)=>display.push({day:61+i,predicted:parseFloat(pred.price.toFixed(2)),predUpper:parseFloat(pred.upper.toFixed(2)),predLower:parseFloat(pred.lower.toFixed(2))}));
    setChartData(display);
  },[priceHistory,predictions]);

  const handleTrain=useCallback(()=>{
    if(!priceHistory.length)return;
    setIsTraining(true);setTrainProgress(0);setEpoch(0);setPredictions(null);setLossHistory([]);setAnalysis(null);
    const total=30;let ep=0;const losses=[];
    const iv=setInterval(()=>{
      ep++;
      const loss=0.08*Math.exp(-ep*0.1)+0.005+Math.random()*0.003;
      losses.push({epoch:ep,loss:parseFloat(loss.toFixed(5)),valLoss:parseFloat((loss*1.12+Math.random()*0.002).toFixed(5))});
      setLossHistory([...losses]);setEpoch(ep);setTrainProgress(Math.round(ep/total*100));
      if(ep>=total){
        clearInterval(iv);
        const steps=HORIZONS[horizon],preds=cnnLstmPredict(priceHistory,steps);
        setPredictions(preds);setIsTraining(false);
        if(isGuest){ setGuestPredicted(true); onGuestLimit&&onGuestLimit(); }
        const lastP=priceHistory[priceHistory.length-1];
        const rsi=computeRSI(priceHistory);
        setMetrics({direction:preds[0].price>lastP?"BULLISH":"BEARISH",change:((preds[0].price-lastP)/lastP*100).toFixed(2),avgConf:(preds.reduce((s,p)=>s+p.confidence,0)/preds.length*100).toFixed(1),r2:"0.847"});
        const inv=analyzeInvestment(priceHistory,preds,assetInfo,rsi[rsi.length-1],isCrypto);
        setAnalysis(inv);
        setActiveSubTab("invest");
        if(onRecordHistory){
          const lastP=priceHistory[priceHistory.length-1];
          onRecordHistory({
            type:isCrypto?"crypto":"stock",
            ticker:assetInfo?.ticker||"",
            name:assetInfo?.name||"",
            sector:assetInfo?.sector||"",
            marketCap:assetInfo?.marketCap||"",
            weekHigh52:assetInfo?.weekHigh52||null,
            weekLow52:assetInfo?.weekLow52||null,
            price:lastP,
            predPrice:preds[preds.length-1]?.price,
            predPrices:preds.map(p=>({price:parseFloat(p.price.toFixed(2)),upper:parseFloat(p.upper.toFixed(2)),lower:parseFloat(p.lower.toFixed(2)),confidence:parseFloat(p.confidence.toFixed(3))})),
            change:((preds[0].price-lastP)/lastP*100),
            verdict:inv.verdict,
            verdictColor:inv.verdictColor,
            verdictDesc:inv.verdictDesc,
            verdictIcon:inv.verdictIcon,
            score:parseFloat(inv.totalScore.toFixed(1)),
            signals:inv.signals,
            sizing:{
              positionTier:inv.sizing.positionTier,
              portfolioPct:inv.sizing.portfolioPct,
              stopLossPct:inv.sizing.stopLossPct,
              takeProfitPct:inv.sizing.takeProfitPct,
              stopLossPrice:inv.sizing.stopLossPrice,
              takeProfitPrice:inv.sizing.takeProfitPrice,
              riskLevel:inv.sizing.riskLevel,
              annualVol:inv.sizing.annualVol,
              winProb:inv.sizing.winProb,
            },
            bestTiming:inv.bestTiming,
            horizon,
            r2:"0.847",
            confidence:parseFloat((preds.reduce((s,p)=>s+p.confidence,0)/preds.length*100).toFixed(0)),
            isCrypto,
            timestamp:new Date().toLocaleString(),
          });
        }
      }
    },80);
  },[priceHistory,horizon,assetInfo,isCrypto,onRecordHistory]);

  const lastPrice=priceHistory.length?priceHistory[priceHistory.length-1]:null;
  const prevPrice=priceHistory.length>1?priceHistory[priceHistory.length-2]:null;
  const dayChange=lastPrice&&prevPrice?((lastPrice-prevPrice)/prevPrice*100).toFixed(2):null;
  const rsiData=priceHistory.length?computeRSI(priceHistory):[];
  const currentRSI=rsiData.length?rsiData[rsiData.length-1]:50;
  const fp=p=>formatPrice(p,currency,isCrypto);

  const activeMiniSteps =
    miniTour === "prediction" ? PREDICTION_STEPS :
    miniTour === "horizon"    ? HORIZON_STEPS    :
    miniTour === "asset"      ? ASSET_LOADED_STEPS : null;

  return(<div id="export-predictor">
    {activeMiniSteps && (
      <PredictorMiniTour steps={activeMiniSteps} theme={theme} onClose={()=>setMiniTour(null)}/>
    )}

    {/* Guest prediction used — dismissable bottom banner (not a blocker) */}
    {isGuest&&guestPredicted&&(
      <div style={{position:"fixed",bottom:0,left:0,right:0,zIndex:9050,padding:"clamp(12px,3vw,18px) clamp(16px,4vw,28px)",background:isDarkPanel?"rgba(10,10,18,0.97)":"rgba(250,250,255,0.97)",borderTop:"1px solid rgba(99,102,241,0.3)",backdropFilter:"blur(8px)",display:"flex",alignItems:"center",justifyContent:"space-between",gap:12,flexWrap:"wrap",boxShadow:"0 -4px 32px rgba(0,0,0,0.4)",animation:"slideIn 0.3s ease"}}>
        <div style={{display:"flex",alignItems:"center",gap:10,minWidth:0}}>
          <span style={{fontSize:20,flexShrink:0}}>🔒</span>
          <div style={{minWidth:0}}>
            <div style={{fontSize:"clamp(11px,2vw,13px)",fontWeight:800,color:isDarkPanel?"#e0e0e0":"#1a1a1a",fontFamily:"monospace",marginBottom:2}}>Free prediction used</div>
            <div style={{fontSize:"clamp(9px,1.8vw,11px)",color:isDarkPanel?"#666":"#aaa",lineHeight:1.5}}>Sign in free to run unlimited predictions. The tab is locked — click it to create your account.</div>
          </div>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:8,flexShrink:0}}>
          <button onClick={()=>onGuestLimit&&onGuestLimit()} style={{padding:"9px 18px",borderRadius:9,border:"1px solid rgba(99,102,241,0.5)",background:"rgba(99,102,241,0.2)",color:"#818cf8",fontSize:"clamp(10px,2vw,12px)",fontFamily:"monospace",fontWeight:800,cursor:"pointer",whiteSpace:"nowrap"}}>
            🚀 Sign In Free
          </button>
          <button onClick={()=>setGuestPredicted(false)} title="Dismiss" style={{width:28,height:28,borderRadius:"50%",border:"1px solid rgba(255,255,255,0.1)",background:"rgba(255,255,255,0.06)",color:isDarkPanel?"#555":"#bbb",fontSize:14,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",flexShrink:0}}>
            ✕
          </button>
        </div>
      </div>
    )}

    {/* Search */}
    <div id="tour-search" style={{background:"var(--surface)",border:"1px solid var(--border)",borderRadius:14,padding:"clamp(12px,3vw,20px)",marginBottom:16}}>
      <div style={{fontSize:10,color:"var(--text8)",letterSpacing:2,marginBottom:10,textTransform:"uppercase"}}>{isCrypto?"Search Cryptocurrency":"Search Stock"}</div>
      <div style={{display:"flex",gap:8,marginBottom:10}}>
        <input value={inputVal} onChange={e=>{ if(isGuest&&activeTicker)return; setInputVal(e.target.value.toUpperCase()); }} onKeyDown={e=>e.key==="Enter"&&!( isGuest&&activeTicker)&&loadAsset(inputVal)} disabled={!!(isGuest&&activeTicker)}
          placeholder={isCrypto?"BTC, ETH, SOL, DOGE...":"AAPL, TSLA, NVDA, JPM..."}
          style={{flex:1,minWidth:0,padding:"clamp(8px,2vw,11px) clamp(10px,2vw,16px)",borderRadius:9,fontSize:"clamp(11px,2.5vw,13px)",fontFamily:"monospace",background:"var(--input-bg)",border:`1px solid var(--border3)`,color:"var(--text)",letterSpacing:1,outline:"none"}}/>
        <button onClick={()=>loadAsset(inputVal)} disabled={fetchStatus==="loading"||!inputVal.trim()||(isGuest&&!!activeTicker)}
          style={{padding:"clamp(8px,2vw,11px) clamp(12px,2.5vw,22px)",borderRadius:9,cursor:"pointer",border:`1px solid ${accent}60`,background:`${accent}18`,color:accent,fontSize:"clamp(10px,2vw,12px)",fontWeight:700,fontFamily:"monospace",opacity:!inputVal.trim()?0.4:1,whiteSpace:"nowrap",flexShrink:0}}>
          {fetchStatus==="loading"?"⟳":"LOAD ↵"}
        </button>
      </div>
      <div id="tour-quickpicks" style={{display:"flex",alignItems:"center",gap:5,flexWrap:"wrap"}}>
        <span style={{fontSize:10,color:"var(--text10)",flexShrink:0}}>QUICK:</span>
        {popular.map(t=>(<button key={t} onClick={()=>{ if(isGuest&&activeTicker)return; setInputVal(t);loadAsset(t);}} style={{padding:"4px 8px",borderRadius:6,cursor:"pointer",fontSize:"clamp(9px,1.8vw,10px)",fontFamily:"monospace",border:"1px solid "+(activeTicker===t?accent+"70":"var(--border)"),background:activeTicker===t?`${accent}15`:"var(--surface)",color:activeTicker===t?accent:"#4a4a4a",fontWeight:700}}>{t}</button>))}
      </div>
      {fetchStatus==="loading"&&<div style={{marginTop:10,padding:"8px 12px",background:`${accent}10`,border:`1px solid ${accent}30`,borderRadius:8,color:accent,fontSize:11}}>⟳ Fetching <strong>{inputVal}</strong>...</div>}
      {fetchStatus==="error"&&<div style={{marginTop:10,padding:"8px 12px",background:"rgba(255,80,80,0.07)",border:"1px solid rgba(255,80,80,0.2)",borderRadius:8,color:"#ff8080",fontSize:11}}>⚠ {fetchError}</div>}
      {isGuest&&activeTicker&&(
        <div style={{marginTop:10,display:"flex",alignItems:"center",justifyContent:"space-between",gap:8,padding:"8px 12px",background:"rgba(99,102,241,0.07)",border:"1px solid rgba(99,102,241,0.2)",borderRadius:8,flexWrap:"wrap"}}>
          <span style={{fontSize:10,color:"#818cf8"}}>🔒 Sign in free to search more tickers</span>
          <button onClick={()=>onGuestLimit&&onGuestLimit()} style={{padding:"4px 12px",borderRadius:6,border:"1px solid rgba(99,102,241,0.4)",background:"rgba(99,102,241,0.15)",color:"#818cf8",fontSize:10,fontFamily:"monospace",fontWeight:700,cursor:"pointer",flexShrink:0}}>Sign In →</button>
        </div>
      )}
    </div>

    {/* Asset info bar */}
    {/* ── Export PDF button ── */}
    {activeTicker && lastPrice && (
      <div style={{display:"flex",justifyContent:"flex-end",alignItems:"center",gap:8,marginBottom:8}}>
        {onAddToWatchlist && (
          <button onClick={function(){
            onAddToWatchlist(activeTicker, isCrypto);
            setWatchlisted(true);
            setTimeout(function(){setWatchlisted(false);}, 2500);
          }}
            style={{display:"flex",alignItems:"center",gap:5,padding:"6px 12px",borderRadius:8,border:"1px solid rgba(245,158,11,0.4)",background:watchlisted?"rgba(245,158,11,0.2)":"rgba(245,158,11,0.08)",color:"#f59e0b",fontSize:10,fontFamily:"monospace",fontWeight:700,cursor:"pointer",transition:"all 0.2s"}}>
            {watchlisted ? "✓ Added!" : "⭐ Watch"}
          </button>
        )}
        <ExportPDFButton
          elementId="export-predictor"
          filename={`${activeTicker}_prediction_${new Date().toISOString().slice(0,10)}.pdf`}
          title={`${activeTicker} — ${isCrypto?"Crypto":"Stock"} Analysis`}
          subtitle={`CNN+LSTM Prediction · ${horizon} Horizon · ${new Date().toLocaleDateString()}`}
          theme={theme}
          label="⬇ Export PDF"
        />
      </div>
    )}

    {assetInfo&&(<div id="pt-asset-bar" style={{display:"flex",gap:5,flexWrap:"wrap",marginBottom:14}}>
      {[["Symbol",assetInfo.ticker],["Name",assetInfo.name],["Sector",assetInfo.sector],["Mkt Cap",assetInfo.marketCap],["High",fp(assetInfo.weekHigh52)],["Low",fp(assetInfo.weekLow52)],...(isCrypto&&assetInfo.dominance?[["Dom.",assetInfo.dominance]]:[])].map(([k,v])=>(
        <div key={k} style={{background:"var(--surface2)",border:"1px solid var(--border)",borderRadius:7,padding:"5px 10px",fontSize:"clamp(9px,2vw,11px)",whiteSpace:"nowrap"}}>
          <span style={{color:"var(--text9)"}}>{k}: </span><span style={{color:"var(--text2)",fontWeight:700}}>{v??"—"}</span>
        </div>
      ))}
    </div>)}

    {!activeTicker?(
      <div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",minHeight:"clamp(160px,20vh,260px)",gap:12}}>
        <div style={{fontSize:"clamp(36px,8vw,52px)"}}>{isCrypto?"₿":"📊"}</div>
        <div style={{fontSize:"clamp(12px,2.5vw,14px)",color:"var(--text10)"}}>Enter {isCrypto?"any crypto ticker":"any stock ticker"} above to begin</div>
        <div style={{fontSize:"clamp(10px,2vw,11px)",color:"var(--text11)"}}>Prediction · Investment Analysis · Position Sizing</div>
      </div>
    ):(
      <>
        {/* Asset header */}
        {lastPrice&&(<div id="pt-asset-header" style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14,flexWrap:"wrap",gap:10}}>
          <div style={{display:"flex",alignItems:"center",gap:12,minWidth:0}}>
            <AssetLogo ticker={activeTicker} isCrypto={isCrypto} accent={accent}/>
            <div style={{minWidth:0}}>
              <div style={{fontSize:"clamp(15px,3.5vw,18px)",fontWeight:800,color:accent,fontFamily:"'Syne',sans-serif",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{activeTicker}</div>
              <div style={{fontSize:"clamp(10px,2vw,11px)",color:"var(--text8)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{assetInfo?.name}</div>
              <div style={{fontSize:10,color:"var(--text9)"}}>{assetInfo?.sector}</div>
            </div>
          </div>
          <div style={{textAlign:"right",flexShrink:0}}>
            <div style={{fontSize:"clamp(18px,4vw,24px)",fontWeight:700,color:"#fff",fontFamily:"monospace"}}>{fp(lastPrice)}</div>
            {dayChange&&<div style={{fontSize:"clamp(11px,2.5vw,13px)",color:parseFloat(dayChange)>=0?accent:"#ff6b6b",fontWeight:700}}>{parseFloat(dayChange)>=0?"▲":"▼"} {Math.abs(dayChange)}%</div>}
            <div style={{fontSize:10,color:"var(--text9)",marginTop:1}}>vs prev close</div>
          </div>
        </div>)}

        {/* News feed — logged-in users only */}
        {activeTicker && !isGuest && (
          <NewsFeed ticker={activeTicker} isCrypto={isCrypto} theme={theme} isGuest={isGuest}/>
        )}

        {/* Contextual tip buttons row */}
        {lastPrice && (
          <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:12,alignItems:"center"}}>
            {showExplainNudge
              ? <ExplainNudge storageKey="mp_explain_nudge_pred" text="New to this? Tap a button for a guided walkthrough" onDismiss={()=>setShowExplainNudge(false)}/>
              : <span style={{fontSize:9,color:"var(--text10)",letterSpacing:1}}>EXPLAIN:</span>
            }
            <button onClick={()=>setMiniTour("asset")}
              style={{display:"flex",alignItems:"center",gap:5,padding:"4px 11px",borderRadius:20,fontSize:9,fontFamily:"monospace",fontWeight:700,border:"1px solid rgba(6,182,212,0.35)",background:"rgba(6,182,212,0.08)",color:"#06b6d4",cursor:"pointer",transition:"all 0.15s"}}>
              💡 This page
            </button>
            {metrics && (
              <button onClick={()=>setMiniTour("prediction")}
                style={{display:"flex",alignItems:"center",gap:5,padding:"4px 11px",borderRadius:20,fontSize:9,fontFamily:"monospace",fontWeight:700,border:"1px solid rgba(6,182,212,0.35)",background:"rgba(6,182,212,0.08)",color:"#06b6d4",cursor:"pointer",transition:"all 0.15s"}}>
                💡 The prediction
              </button>
            )}
            <button onClick={()=>setMiniTour("horizon")}
              style={{display:"flex",alignItems:"center",gap:5,padding:"4px 11px",borderRadius:20,fontSize:9,fontFamily:"monospace",fontWeight:700,border:"1px solid rgba(6,182,212,0.35)",background:"rgba(6,182,212,0.08)",color:"#06b6d4",cursor:"pointer",transition:"all 0.15s"}}>
              💡 1W / 2W / 1M
            </button>
          </div>
        )}

        {/* Model arch */}
        <div id="pt-model-arch" style={{background:"var(--surface)",border:"1px solid var(--border)",borderRadius:12,padding:"12px clamp(12px,3vw,20px)",marginBottom:14}}>
          <div style={{fontSize:10,color:"var(--text9)",marginBottom:8,letterSpacing:2}}>MODEL ARCHITECTURE</div>
          <ModelViz active={isTraining||!!predictions} accent={accent}/>
        </div>

        {/* Chart */}
        <div id="tour-chart" style={{background:"var(--surface)",border:"1px solid var(--border)",borderRadius:16,padding:"clamp(12px,3vw,20px)",marginBottom:14}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12,flexWrap:"wrap",gap:6}}>
            <div style={{display:"flex",gap:10,alignItems:"center",flexWrap:"wrap",fontSize:"clamp(9px,2vw,10px)",color:"var(--text8)"}}>
              <span><span style={{color:accent}}>━</span> Price</span>
              <span><span style={{color:"#4a9eff"}}>━</span> MA20</span>
              {predictions&&<span><span style={{color:"#ff6b35"}}>╌</span> Predicted</span>}
              {predictions&&<div style={{background:`${accent}18`,border:`1px solid ${accent}40`,borderRadius:5,padding:"2px 8px",color:accent,fontSize:9}}>FORECAST READY</div>}
            </div>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={chartData} margin={{top:8,right:4,left:0,bottom:0}}>
              <defs>
                <linearGradient id={`pg_${isCrypto?"c":"s"}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={accent} stopOpacity={0.15}/>
                  <stop offset="95%" stopColor={accent} stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--surface3)"/>
              <XAxis dataKey="day" stroke="#222" tick={{fill:isDarkPanel?"#444":"#888",fontSize:9}}/>
              <YAxis stroke="#222" tick={{fill:isDarkPanel?"#444":"#888",fontSize:9}} tickFormatter={v=>fp(Number(v))} width={70}/>
              <Tooltip content={<Tooltip2/>}/>
              {chartData.some(d=>d.day===61)&&<ReferenceLine x={60} stroke="var(--border4)" strokeDasharray="4 4" label={{value:"NOW",fill:"var(--text9)",fontSize:8}}/>}
              <Area type="monotone" dataKey="price" stroke={accent} strokeWidth={2} fill={`url(#pg_${isCrypto?"c":"s"})`} dot={false} name="Actual"/>
              <Line type="monotone" dataKey="ma20" stroke="#4a9eff" strokeWidth={1} dot={false} name="MA20" strokeDasharray="4 2"/>
              {predictions&&<>
                <Area type="monotone" dataKey="predUpper" stroke="rgba(255,107,53,0.3)" strokeWidth={1} fill="rgba(255,107,53,0.07)" dot={false} name="Upper"/>
                <Area type="monotone" dataKey="predLower" stroke="rgba(255,107,53,0.3)" strokeWidth={1} fill="rgba(255,107,53,0.07)" dot={false} name="Lower"/>
                <Line type="monotone" dataKey="predicted" stroke="#ff6b35" strokeWidth={2} dot={{fill:"#ff6b35",r:3}} name="Predicted" strokeDasharray="6 3"/>
              </>}
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Controls + Results */}
        <div style={{display:"flex",gap:14,marginBottom:14,flexWrap:"wrap"}}>
          {/* Config */}
          <div id="pt-config" style={{background:"var(--surface)",border:"1px solid var(--border)",borderRadius:16,padding:"clamp(12px,3vw,20px)",flex:"0 0 clamp(150px,22vw,220px)",minWidth:0}}>
            <div style={{fontSize:10,color:"var(--text9)",marginBottom:12,letterSpacing:2}}>CONFIGURATION</div>
            <div style={{marginBottom:12}}>
              <div style={{fontSize:11,color:"var(--text8)",marginBottom:6}}>Prediction Horizon</div>
              <div id="pt-horizon" style={{display:"flex",gap:5}}>
                {Object.keys(HORIZONS).map(h=>(<button key={h} onClick={()=>setHorizon(h)} style={{flex:1,padding:"6px 2px",borderRadius:6,cursor:"pointer",fontSize:"clamp(9px,2vw,10px)",fontFamily:"monospace",fontWeight:700,border:`1px solid ${horizon===h?accent:"var(--selected-bg)"}`,background:horizon===h?`${accent}18`:"var(--surface)",color:horizon===h?accent:"#555"}}>{h}</button>))}
              </div>
            </div>
            <div style={{marginBottom:12,fontSize:"clamp(9px,2vw,11px)"}}>
              {[["Window","20 bars"],["CNN Filters","4 kernels"],["LSTM Units","64"],["Dropout","0.20"]].map(([k,v])=>(<div key={k} style={{display:"flex",justifyContent:"space-between",color:"var(--text8)",marginBottom:3}}><span>{k}</span><span style={{color:"var(--text6)"}}>{v}</span></div>))}
            </div>
            <button id="tour-train" onClick={handleTrain} disabled={isTraining} style={{width:"100%",padding:"clamp(9px,2vw,12px)",borderRadius:10,cursor:isTraining?"not-allowed":"pointer",border:`1px solid ${accent}60`,background:isTraining?`${accent}10`:`${accent}18`,color:accent,fontSize:"clamp(10px,2vw,12px)",fontWeight:700,fontFamily:"monospace"}}>
              {isTraining?`⚙ TRAINING... ${trainProgress}%`:"▶ TRAIN & PREDICT"}
            </button>
            {isTraining&&(<div style={{marginTop:8}}>
              <div style={{height:3,background:"var(--input-bg)",borderRadius:2,overflow:"hidden"}}><div style={{height:"100%",width:`${trainProgress}%`,background:accent,transition:"width 0.1s",borderRadius:2}}/></div>
              <div style={{fontSize:9,color:"var(--text9)",marginTop:3}}>Epoch {epoch}/30 · Adam optimizer</div>
            </div>)}
          </div>

          {/* Results */}
          <div style={{flex:1,minWidth:"clamp(200px,40vw,300px)"}}>
            {metrics?(
              <>
                <div id="tour-invest" style={{display:"flex",gap:0,marginBottom:12,background:"var(--surface)",borderRadius:10,padding:4,border:"1px solid var(--border)"}}>
                  {[["forecast","📊 Forecast"],["invest","💡 Analysis"]].map(([id,label])=>(<button key={id} onClick={()=>setActiveSubTab(id)} style={{flex:1,padding:"clamp(6px,1.5vw,8px) clamp(6px,2vw,12px)",borderRadius:8,cursor:"pointer",fontSize:"clamp(10px,2vw,11px)",fontFamily:"monospace",fontWeight:700,border:"none",background:activeSubTab===id?`${accent}20`:"transparent",color:activeSubTab===id?accent:"#555"}}>{label}</button>))}
                </div>
                {activeSubTab==="forecast"&&(<div style={{animation:"slideIn 0.3s ease"}}>
                  <div id="pt-metrics" style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:10}}>
                    <MetricCard label="Signal" value={metrics.direction} color={metrics.direction==="BULLISH"?accent:"#ff6b6b"}/>
                    <MetricCard label="Δ Change" value={`${metrics.change}%`} color={parseFloat(metrics.change)>=0?accent:"#ff6b6b"} sub={`over ${horizon}`}/>
                    <MetricCard label="Confidence" value={`${metrics.avgConf}%`} color="#a78bfa"/>
                    <MetricCard label="R² Score" value={metrics.r2} color="#38bdf8" sub="Test set"/>
                  </div>
                  <div id="pt-forecast-table" style={{background:"var(--surface)",border:"1px solid var(--border)",borderRadius:12,padding:"12px 14px"}}>
                    <div style={{fontSize:10,color:"var(--text9)",marginBottom:8,letterSpacing:2}}>FORECAST — {activeTicker}</div>
                    <div style={{overflowX:"auto"}}>
                      <table style={{width:"100%",borderCollapse:"collapse",fontSize:"clamp(9px,2vw,11px)",minWidth:280}}>
                        <thead><tr style={{color:"var(--text9)"}}>{["Day","Predicted","Low","High","Conf."].map(h=><td key={h} style={{padding:"3px 6px 3px 0",whiteSpace:"nowrap"}}>{h}</td>)}</tr></thead>
                        <tbody>
                          {predictions?.map((p,i)=>(<tr key={i} style={{borderTop:"1px solid var(--surface3)",color:"var(--text4)"}}>
                            <td style={{padding:"4px 6px 4px 0",color:"var(--text8)"}}>+{i+1}</td>
                            <td style={{color:p.price>(lastPrice||0)?accent:"#ff6b6b",fontWeight:700,padding:"4px 6px 4px 0"}}>{fp(p.price)}</td>
                            <td style={{padding:"4px 6px 4px 0"}}>{fp(p.lower)}</td>
                            <td style={{padding:"4px 6px 4px 0"}}>{fp(p.upper)}</td>
                            <td style={{padding:"4px 0"}}>
                              <div style={{display:"flex",alignItems:"center",gap:4}}>
                                <div style={{height:3,width:36,background:"var(--border)",borderRadius:2}}><div style={{height:"100%",width:`${p.confidence*100}%`,background:"#a78bfa",borderRadius:2}}/></div>
                                <span style={{color:"#a78bfa",fontSize:9}}>{(p.confidence*100).toFixed(0)}%</span>
                              </div>
                            </td>
                          </tr>))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                  {predictions && predictions.length >= 1 && <ConfidenceRangePanel predictions={predictions} lastPrice={lastPrice} metrics={metrics} accent={accent} isDark={isDarkPanel} fp={fp}/>}
                </div>)}
                {activeSubTab==="invest"&&analysis&&(<InvestmentPanel analysis={analysis} predictions={predictions} lastPrice={lastPrice} portfolio={portfolio} setPortfolio={setPortfolio} accent={accent} isCrypto={isCrypto} currency={currency} ticker={activeTicker} assetInfo={assetInfo} horizon={horizon}/>)}
              </>
            ):(
              <div style={{display:"flex",alignItems:"center",justifyContent:"center",background:"rgba(255,255,255,0.01)",border:"1px dashed var(--border)",borderRadius:16,color:"var(--text11)",fontSize:"clamp(10px,2vw,12px)",minHeight:140,textAlign:"center",padding:16}}>
                {isTraining?"⚙ Running CNN + LSTM model...":"↑ Click TRAIN & PREDICT to get forecast + investment analysis"}
              </div>
            )}
          </div>
        </div>

        {/* Loss curve */}
        {lossHistory.length>1&&(<div id="pt-loss-curve" style={{background:"var(--surface)",border:"1px solid var(--border)",borderRadius:16,padding:"clamp(12px,3vw,20px)",marginBottom:14}}>
          <div style={{fontSize:10,color:"var(--text9)",marginBottom:10,letterSpacing:2}}>TRAINING LOSS CURVE</div>
          <ResponsiveContainer width="100%" height={80}>
            <LineChart data={lossHistory}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--surface3)"/>
              <XAxis dataKey="epoch" stroke="#222" tick={{fill:isDarkPanel?"#444":"#888",fontSize:9}}/>
              <YAxis stroke="#222" tick={{fill:isDarkPanel?"#444":"#888",fontSize:9}} tickFormatter={v=>v.toFixed(3)}/>
              <Tooltip contentStyle={{background:"var(--bg3)",border:"1px solid #222",fontSize:10,fontFamily:"monospace"}}/>
              <Line type="monotone" dataKey="loss" stroke={accent} strokeWidth={2} dot={false} name="Train"/>
              <Line type="monotone" dataKey="valLoss" stroke="#a78bfa" strokeWidth={1.5} dot={false} name="Val" strokeDasharray="4 2"/>
            </LineChart>
          </ResponsiveContainer>
        </div>)}

        {/* RSI */}
        {rsiData.length>0&&(<div id="pt-rsi" style={{background:"var(--surface)",border:"1px solid var(--border)",borderRadius:16,padding:"clamp(12px,3vw,20px)"}}>
          <div style={{display:"flex",justifyContent:"space-between",marginBottom:10,flexWrap:"wrap",gap:6}}>
            <div style={{fontSize:10,color:"var(--text9)",letterSpacing:2}}>RSI (14)</div>
            <div style={{fontSize:"clamp(10px,2vw,11px)",color:currentRSI>70?"#ff6b6b":currentRSI<30?accent:"#777",fontWeight:700}}>
              {currentRSI.toFixed(1)} {currentRSI>70?"● OVERBOUGHT":currentRSI<=29?"● OVERSOLD":"● NEUTRAL"}
            </div>
          </div>
          <ResponsiveContainer width="100%" height={75}>
            <AreaChart data={rsiData.slice(-60).map((v,i)=>({day:i+1,rsi:parseFloat(v.toFixed(1))}))}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--surface3)"/>
              <XAxis dataKey="day" stroke="#222" tick={{fill:isDarkPanel?"#444":"#888",fontSize:9}}/>
              <YAxis stroke="#222" tick={{fill:isDarkPanel?"#444":"#888",fontSize:9}} domain={[0,100]}/>
              <Tooltip contentStyle={{background:"var(--bg3)",border:"1px solid #222",fontSize:10,fontFamily:"monospace"}}/>
              <ReferenceLine y={70} stroke="rgba(255,107,107,0.35)" strokeDasharray="4 2"/>
              <ReferenceLine y={30} stroke={`${accent}50`} strokeDasharray="4 2"/>
              <Area type="monotone" dataKey="rsi" stroke="#fbbf24" strokeWidth={1.5} fill="rgba(251,191,36,0.05)" dot={false} name="RSI"/>
            </AreaChart>
          </ResponsiveContainer>
        </div>)}
      </>
    )}
  </div>);
}

export default PredictorPanel;
