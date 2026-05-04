'use client';

import { useState } from "react";
import { formatPrice, fmtAmt } from "../shared/utils";

async function fetchAIInsight(ticker, analysis, predictions, assetInfo, isCrypto, horizon, currency) {
  const lastPrice = predictions && predictions.length ? predictions[0] : null;
  const predPrice = predictions && predictions.length ? predictions[predictions.length - 1].price : null;
  const predChange = predPrice && analysis ? ((predPrice - analysis._lastPrice) / analysis._lastPrice * 100).toFixed(1) : null;
  const signalSummary = analysis.signals.map(function(s) {
    return s.name + ": " + s.label + " (" + (s.score > 0 ? "+" : "") + s.score + ")";
  }).join(", ");

  var prompt = "You are a professional market analyst. Given the following technical analysis data, write a concise but insightful 3-paragraph analysis for a retail investor. Be direct, specific, and actionable. Do NOT give generic disclaimers — the user already knows this is not financial advice.\n\n" +
    "Asset: " + ticker + " (" + (isCrypto ? "Cryptocurrency" : "Stock") + ")\n" +
    "Current Price: " + (assetInfo ? assetInfo.currentPrice : "N/A") + "\n" +
    "Sector: " + (assetInfo ? assetInfo.sector : "N/A") + "\n" +
    "52W High: " + (assetInfo ? assetInfo.weekHigh52 : "N/A") + " | 52W Low: " + (assetInfo ? assetInfo.weekLow52 : "N/A") + "\n" +
    "CNN+LSTM Verdict: " + analysis.verdict + " (Score: " + analysis.totalScore.toFixed(0) + "/100)\n" +
    "Prediction Horizon: " + horizon + (predChange ? " | Predicted change: " + predChange + "%" : "") + "\n" +
    "Signal Breakdown: " + signalSummary + "\n" +
    "Best Entry Timing: " + (analysis.bestTiming ? analysis.bestTiming.label + " — " + analysis.bestTiming.advice : "N/A") + "\n" +
    "Position Sizing: " + analysis.sizing.positionTier + ", " + analysis.sizing.portfolioPct + "% of portfolio suggested\n" +
    "Risk Level: " + analysis.sizing.riskLevel + " | Annual Volatility: " + analysis.sizing.annualVol + "%\n\n" +
    "Write exactly 3 paragraphs:\n" +
    "1. What the technical picture says right now (use the signals, be specific)\n" +
    "2. What the CNN+LSTM model is predicting and whether it aligns or conflicts with the technicals\n" +
    "3. A clear, actionable take: what a prudent investor should watch for or do\n\n" +
    "Keep each paragraph 2-3 sentences. Be specific with numbers. Write for someone who understands investing but not deep technicals.";

  var res = await fetch("/api/claude", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 600,
      messages: [{ role: "user", content: prompt }]
    })
  });
  var data = await res.json();
  var text = "";
  if (data.content && data.content.length) {
    for (var i = 0; i < data.content.length; i++) {
      if (data.content[i].type === "text") text += data.content[i].text;
    }
  }
  return text.trim();
}

const InvestmentPanel=({analysis,predictions,lastPrice,portfolio,setPortfolio,accent,isCrypto,currency,ticker,assetInfo,horizon})=>{
  const{signals,totalScore,verdict,verdictColor,verdictBg,verdictIcon,verdictDesc,bestTiming,sizing}=analysis;
  const [insightTab, setInsightTab] = useState("signals");
  const [aiInsight, setAiInsight] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState(null);

  const loadInsight = async function() {
    if (aiInsight || aiLoading) return;
    setAiLoading(true); setAiError(null);
    try {
      var analysisWithPrice = Object.assign({}, analysis, { _lastPrice: lastPrice });
      var text = await fetchAIInsight(ticker||"", analysisWithPrice, predictions, assetInfo, isCrypto, horizon||"1W", currency);
      setAiInsight(text);
    } catch(e) {
      setAiError("Could not load AI insight. Please try again.");
    }
    setAiLoading(false);
  };
  const scoreBarW=Math.min(100,Math.max(0,(totalScore+100)/2));
  const portNum=parseFloat(portfolio)||0;
  const allocD=portNum*sizing.portfolioPct/100;
  const unitLabel=isCrypto?"units":"shares";
  const units=lastPrice>0?(isCrypto?parseFloat((allocD/lastPrice).toFixed(6)):Math.floor(allocD/lastPrice)):0;
  const spend=units*lastPrice;
  const gain=units*(sizing.takeProfitPrice-lastPrice);
  const loss=units*(lastPrice-sizing.stopLossPrice);
  const fp=p=>formatPrice(p,currency,isCrypto);
  const fa=n=>fmtAmt(n,currency);

  return(<div style={{animation:"slideIn 0.5s ease"}}>
    {/* Verdict */}
    <div style={{background:verdictBg,border:`2px solid ${verdictColor}40`,borderRadius:16,padding:"clamp(12px,3vw,24px)",marginBottom:14,position:"relative",overflow:"hidden"}}>
      <div style={{position:"absolute",top:-20,right:-20,fontSize:"clamp(40px,8vw,80px)",opacity:0.05}}>{isCrypto?"₿":"💹"}</div>
      <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",flexWrap:"wrap",gap:10}}>
        <div style={{flex:1,minWidth:0}}>
          <div style={{fontSize:10,color:"var(--text8)",letterSpacing:3,marginBottom:6,textTransform:"uppercase"}}>Investment Decision</div>
          <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:8,flexWrap:"wrap"}}>
            <span style={{fontSize:"clamp(20px,4vw,28px)"}}>{verdictIcon}</span>
            <span style={{fontFamily:"'Syne',sans-serif",fontSize:"clamp(16px,4vw,26px)",fontWeight:800,color:verdictColor}}>{verdict}</span>
          </div>
          <div style={{fontSize:"clamp(10px,2vw,12px)",color:"var(--text4)",lineHeight:1.6}}>{verdictDesc}</div>
        </div>
        <div style={{textAlign:"center",minWidth:90,flexShrink:0}}>
          <div style={{fontSize:10,color:"var(--text8)",marginBottom:4,letterSpacing:2}}>SCORE</div>
          <div style={{fontSize:"clamp(24px,5vw,36px)",fontWeight:800,color:verdictColor,fontFamily:"monospace",lineHeight:1}}>{totalScore.toFixed(0)}</div>
          <div style={{fontSize:10,color:"var(--text9)",marginTop:3}}>/ 100</div>
          <div style={{height:5,background:"var(--border)",borderRadius:3,marginTop:6,overflow:"hidden"}}><div style={{height:"100%",width:`${scoreBarW}%`,background:verdictColor,borderRadius:3,transition:"width 1s ease"}}/></div>
        </div>
      </div>
    </div>

    {/* Best time */}
    {bestTiming&&(<div style={{background:"var(--surface)",border:`1px solid ${bestTiming.color}30`,borderRadius:14,padding:"clamp(12px,3vw,20px)",marginBottom:14}}>
      <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10}}><span style={{fontSize:16}}>⏰</span><div style={{fontSize:10,color:"var(--text8)",letterSpacing:3,textTransform:"uppercase"}}>Best Time to Invest</div></div>
      <div style={{display:"flex",alignItems:"center",gap:12,flexWrap:"wrap",marginBottom:12}}>
        <div style={{background:`${bestTiming.color}15`,border:`1px solid ${bestTiming.color}40`,borderRadius:10,padding:"8px 16px",textAlign:"center",minWidth:90,flexShrink:0}}>
          <div style={{fontSize:9,color:"var(--text8)",marginBottom:3}}>ENTRY WINDOW</div>
          <div style={{fontSize:"clamp(13px,3vw,18px)",fontWeight:800,color:bestTiming.color,fontFamily:"monospace"}}>{bestTiming.label}</div>
        </div>
        <div style={{flex:1,minWidth:120,fontSize:"clamp(10px,2vw,12px)",color:"var(--text4)",lineHeight:1.6}}>{bestTiming.advice}</div>
      </div>
      {predictions&&(<div>
        <div style={{fontSize:10,color:"var(--text9)",marginBottom:6,letterSpacing:2}}>PRICE FORECAST TIMELINE</div>
        <div style={{display:"flex",gap:4,alignItems:"flex-end",overflowX:"auto",paddingBottom:4}}>
          <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:3,flexShrink:0}}>
            <div style={{fontSize:9,color:"var(--text8)",fontFamily:"monospace"}}>{fp(lastPrice)}</div>
            <div style={{width:38,height:38,background:`${accent}20`,border:`2px solid ${accent}`,borderRadius:7,display:"flex",alignItems:"center",justifyContent:"center",fontSize:8,color:accent,fontWeight:700}}>NOW</div>
          </div>
          <div style={{color:"var(--border2)",fontSize:11,paddingBottom:16}}>→</div>
          {predictions.map((p,i)=>{
            const isBest=bestTiming.day===i+1,isUp=p.price>lastPrice;
            const bH=Math.max(22,Math.min(54,38+(p.price-lastPrice)/lastPrice*380));
            return(<div key={i} style={{display:"flex",flexDirection:"column",alignItems:"center",gap:3,flexShrink:0}}>
              <div style={{fontSize:8,color:isUp?accent:"#ff6b6b",fontFamily:"monospace"}}>{fp(p.price)}</div>
              <div style={{width:38,height:bH,background:isBest?`${bestTiming.color}25`:`${isUp?accent:"#ff6b6b"}12`,border:(isBest?"2":"1")+"px solid "+(isBest?bestTiming.color:isUp?accent+"50":"rgba(255,107,107,0.3)"),borderRadius:5,display:"flex",alignItems:"center",justifyContent:"center",fontSize:7,color:isBest?bestTiming.color:isUp?accent:"#ff6b6b",fontWeight:isBest?700:400,position:"relative"}}>
                {isBest&&<div style={{position:"absolute",top:-13,fontSize:11}}>⭐</div>}
                +{i+1}d
              </div>
            </div>);
          })}
        </div>
        {bestTiming.day&&<div style={{fontSize:9,color:"var(--text8)",marginTop:6}}>⭐ = Recommended entry point</div>}
      </div>)}
    </div>)}

    {/* How much */}
    <div style={{background:"var(--surface)",border:`1px solid ${sizing.riskColor}30`,borderRadius:14,padding:"clamp(12px,3vw,20px)",marginBottom:14}}>
      <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:12}}><span style={{fontSize:16}}>💰</span><div style={{fontSize:10,color:"var(--text8)",letterSpacing:3,textTransform:"uppercase"}}>How Much to Invest</div></div>
      <div style={{marginBottom:12}}>
        <div style={{fontSize:11,color:"var(--text7)",marginBottom:6}}>Enter your total portfolio / capital ($)</div>
        <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
          <div style={{position:"relative",flex:"1 1 140px",minWidth:0}}>
            <span style={{position:"absolute",left:10,top:"50%",transform:"translateY(-50%)",color:"var(--text8)",fontSize:13}}>$</span>
            <input value={portfolio} onChange={e=>setPortfolio(e.target.value.replace(/[^0-9.]/g,""))} placeholder="e.g. 10000" style={{width:"100%",padding:"9px 10px 9px 26px",borderRadius:8,fontSize:12,fontFamily:"monospace",background:"var(--input-bg)",border:"1px solid var(--border4)",color:"var(--text)",outline:"none"}}/>
          </div>
          <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
            {["1000","5000","10000","25000","50000"].map(v=>(
              <button key={v} onClick={()=>setPortfolio(v)} style={{padding:"9px 8px",borderRadius:7,cursor:"pointer",border:"1px solid "+(portfolio===v?accent+"60":"var(--selected-bg)"),background:portfolio===v?accent+"18":"var(--surface2)",color:portfolio===v?accent:"#555",fontSize:"clamp(8px,1.8vw,10px)",fontFamily:"monospace",fontWeight:700,whiteSpace:"nowrap"}}>
                ${parseInt(v).toLocaleString()}
              </button>
            ))}
          </div>
        </div>
      </div>
      <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:12}}>
        {[{label:"Position Size",value:sizing.positionTier,sub:`${sizing.portfolioPct}% of portfolio`,color:sizing.riskColor},{label:"Risk Level",value:sizing.riskLevel,sub:`Vol: ${sizing.annualVol}%/yr`,color:sizing.riskColor},{label:"Win Prob.",value:`${sizing.winProb}%`,sub:"Model estimate",color:"#a78bfa"}].map(({label,value,sub,color})=>(
          <div key={label} style={{background:`${color}10`,border:`1px solid ${color}30`,borderRadius:10,padding:"10px 12px",flex:1,minWidth:"clamp(80px,18vw,120px)"}}>
            <div style={{fontSize:10,color:"var(--text8)",marginBottom:3,letterSpacing:1}}>{label.toUpperCase()}</div>
            <div style={{fontSize:"clamp(12px,2.5vw,16px)",fontWeight:800,color,fontFamily:"monospace",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{value}</div>
            <div style={{fontSize:10,color:"var(--text7)",marginTop:3}}>{sub}</div>
          </div>
        ))}
      </div>
      {portNum>0&&(<div style={{background:"var(--surface3)",borderRadius:12,padding:"clamp(10px,2vw,16px)",marginBottom:12,border:"1px solid var(--border)"}}>
        <div style={{fontSize:10,color:"var(--text9)",marginBottom:10,letterSpacing:2}}>YOUR POSITION BREAKDOWN</div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(clamp(90px,18vw,130px),1fr))",gap:8}}>
          {[{label:"Allocate",value:fa(allocD),sub:`${sizing.portfolioPct}% of ${fa(portNum)}`,color:accent},{label:isCrypto?"Units":"Shares",value:isCrypto?units.toFixed(4):units.toLocaleString(),sub:`@ ${fp(lastPrice)}`,color:"var(--text)"},{label:"Actual Spend",value:fa(spend),sub:`${units} ${unitLabel}`,color:"var(--text)"},{label:"Stop Loss",value:fp(sizing.stopLossPrice),sub:`-${sizing.stopLossPct}% · lose ${fa(loss)}`,color:"#ff6b6b"},{label:"Take Profit",value:fp(sizing.takeProfitPrice),sub:`+${sizing.takeProfitPct}% · gain ${fa(gain)}`,color:accent},{label:"Risk/Reward",value:`1 : ${(sizing.takeProfitPct/sizing.stopLossPct).toFixed(1)}`,sub:"target ratio",color:"#fbbf24"}].map(({label,value,sub,color})=>(
            <div key={label} style={{background:"var(--surface2)",borderRadius:8,padding:"9px 10px"}}>
              <div style={{fontSize:9,color:"var(--text8)",marginBottom:3,letterSpacing:1}}>{label}</div>
              <div style={{fontSize:"clamp(11px,2.5vw,14px)",fontWeight:800,color,fontFamily:"monospace",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{value}</div>
              <div style={{fontSize:9,color:"var(--text9)",marginTop:2,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{sub}</div>
            </div>
          ))}
        </div>
      </div>)}
      <div style={{marginBottom:12}}>
        <div style={{fontSize:10,color:"var(--text9)",marginBottom:6,letterSpacing:2}}>PRICE TARGETS</div>
        <div style={{position:"relative",height:34,background:"var(--surface2)",borderRadius:8,overflow:"hidden"}}>
          <div style={{position:"absolute",left:0,top:0,bottom:0,width:`${sizing.stopLossPct/(sizing.stopLossPct+sizing.takeProfitPct)*100}%`,background:"rgba(255,107,107,0.15)",borderRight:"2px dashed rgba(255,107,107,0.5)"}}/>
          <div style={{position:"absolute",right:0,top:0,bottom:0,width:`${sizing.takeProfitPct/(sizing.stopLossPct+sizing.takeProfitPct)*100}%`,background:`${accent}12`,borderLeft:`2px dashed ${accent}60`}}/>
          <div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"space-between",padding:"0 clamp(6px,2vw,12px)",fontSize:"clamp(8px,1.8vw,10px)",fontFamily:"monospace"}}>
            <span style={{color:"#ff6b6b"}}>▼ {fp(sizing.stopLossPrice)}</span>
            <span style={{color:"var(--text5)"}}>{fp(lastPrice)}</span>
            <span style={{color:accent}}>▲ {fp(sizing.takeProfitPrice)}</span>
          </div>
        </div>
      </div>
      <div style={{fontSize:"clamp(10px,2vw,11px)",color:"var(--text8)",lineHeight:1.6,borderTop:"1px solid var(--input-bg)",paddingTop:10}}>
        💡 <strong style={{color:"var(--text6)"}}>Rationale:</strong> {sizing.sharesRationale}
      </div>
    </div>

    {/* Signals + AI Insight tabs */}
    <div style={{background:"var(--surface)",border:"1px solid var(--border)",borderRadius:14,padding:"clamp(12px,3vw,20px)"}}>
      {/* Tab switcher */}
      <div style={{display:"flex",gap:4,marginBottom:14,background:"var(--surface2)",borderRadius:9,padding:3,border:"1px solid var(--border)"}}>
        <button onClick={function(){setInsightTab("signals");}} style={{flex:1,padding:"6px 4px",borderRadius:7,fontSize:"clamp(9px,1.8vw,10px)",fontFamily:"monospace",fontWeight:700,border:"none",cursor:"pointer",background:insightTab==="signals"?accent+"20":"transparent",color:insightTab==="signals"?accent:"var(--text9)",transition:"all 0.15s"}}>
          🔌 Signals
        </button>
        <button onClick={function(){setInsightTab("ai"); loadInsight();}} style={{flex:1,padding:"6px 4px",borderRadius:7,fontSize:"clamp(9px,1.8vw,10px)",fontFamily:"monospace",fontWeight:700,border:"none",cursor:"pointer",background:insightTab==="ai"?"rgba(139,92,246,0.2)":"transparent",color:insightTab==="ai"?"#a78bfa":"var(--text9)",transition:"all 0.15s",display:"flex",alignItems:"center",justifyContent:"center",gap:4}}>
          🤖 AI Insight
        </button>
      </div>

      {/* Signals tab */}
      {insightTab==="signals"&&(
        <div style={{display:"flex",flexDirection:"column",gap:8}}>
          {signals.map(function(sig,i){
            var bw=Math.min(100,Math.max(0,(sig.score+100)/2));
            return(<div key={i} style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
              <div style={{minWidth:"clamp(70px,14vw,110px)",fontSize:"clamp(9px,2vw,11px)",color:"var(--text5)",fontWeight:700,flexShrink:0}}>{sig.name}</div>
              <div style={{flex:"1 1 120px",minWidth:0}}>
                <div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}>
                  <span style={{fontSize:"clamp(9px,2vw,10px)",color:sig.color,fontWeight:700}}>{sig.label}</span>
                  <span style={{fontSize:9,color:"var(--text9)"}}>{sig.score>0?"+":""}{sig.score}</span>
                </div>
                <div style={{height:4,background:"var(--input-bg)",borderRadius:2,overflow:"hidden"}}><div style={{height:"100%",width:bw+"%",background:sig.color,borderRadius:2,opacity:0.7}}/></div>
              </div>
              <div style={{fontSize:9,color:"var(--text8)",flex:"2 1 140px",minWidth:0,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{sig.detail}</div>
            </div>);
          })}
        </div>
      )}

      {/* AI Insight tab */}
      {insightTab==="ai"&&(
        <div>
          {aiLoading&&(
            <div style={{textAlign:"center",padding:"clamp(20px,4vw,36px) 16px"}}>
              <div style={{fontSize:26,marginBottom:10,animation:"pulse 1.5s infinite"}}>🤖</div>
              <div style={{fontSize:12,color:"#a78bfa",fontFamily:"monospace",fontWeight:700,marginBottom:4}}>Analyzing {ticker}...</div>
              <div style={{fontSize:10,color:"var(--text8)",lineHeight:1.6}}>Claude is reading the signals, model output,<br/>and market context to write your insight.</div>
            </div>
          )}
          {aiError&&!aiLoading&&(
            <div style={{textAlign:"center",padding:"20px 16px"}}>
              <div style={{fontSize:11,color:"#ff8080",marginBottom:10}}>{aiError}</div>
              <button onClick={function(){setAiInsight(null);setAiError(null);loadInsight();}} style={{padding:"7px 16px",borderRadius:8,border:"1px solid rgba(139,92,246,0.4)",background:"rgba(139,92,246,0.1)",color:"#a78bfa",fontSize:10,fontFamily:"monospace",fontWeight:700,cursor:"pointer"}}>
                Try again
              </button>
            </div>
          )}
          {aiInsight&&!aiLoading&&(
            <div>
              <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:12}}>
                <span style={{fontSize:16}}>🤖</span>
                <div style={{fontSize:10,color:"var(--text9)",letterSpacing:2}}>CLAUDE AI ANALYSIS — {ticker}</div>
                <button onClick={function(){setAiInsight(null);loadInsight();}} title="Refresh" style={{marginLeft:"auto",padding:"3px 9px",borderRadius:6,border:"1px solid var(--border3)",background:"var(--surface2)",color:"var(--text8)",fontSize:9,fontFamily:"monospace",cursor:"pointer"}}>
                  ↻ Refresh
                </button>
              </div>
              <div style={{fontSize:"clamp(11px,2vw,13px)",color:"var(--text4)",lineHeight:1.85}}>
                {aiInsight.split("\n\n").map(function(para, i) {
                  return para.trim() ? (
                    <p key={i} style={{marginBottom:i < aiInsight.split("\n\n").length - 1 ? 14 : 0, margin:"0 0 14px 0"}}>
                      {para.trim()}
                    </p>
                  ) : null;
                })}
              </div>
              <div style={{marginTop:12,paddingTop:10,borderTop:"1px solid var(--border)",fontSize:9,color:"var(--text10)",lineHeight:1.5}}>
                Educational purposes only. Not financial advice. Always do your own research.
              </div>
            </div>
          )}
          {!aiInsight&&!aiLoading&&!aiError&&(
            <div style={{textAlign:"center",padding:"clamp(20px,4vw,36px) 16px"}}>
              <div style={{fontSize:26,marginBottom:10}}>🤖</div>
              <div style={{fontSize:12,color:"var(--text6)",fontWeight:700,marginBottom:6}}>AI Insight ready</div>
              <div style={{fontSize:10,color:"var(--text8)",marginBottom:14,lineHeight:1.6}}>Claude will read all 7 signals, the CNN+LSTM forecast, and market context to write a personalised 3-paragraph analysis.</div>
              <button onClick={loadInsight} style={{padding:"10px 22px",borderRadius:10,border:"1px solid rgba(139,92,246,0.4)",background:"rgba(139,92,246,0.15)",color:"#a78bfa",fontSize:12,fontFamily:"monospace",fontWeight:800,cursor:"pointer"}}>
                🤖 Generate Insight
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  </div>);
};

export default InvestmentPanel;
