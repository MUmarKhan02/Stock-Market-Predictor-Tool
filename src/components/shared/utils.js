'use client';

// ── Math engine ──────────────────────────────────────────────
export function sigmoid(x) { return 1/(1+Math.exp(-Math.max(-60,Math.min(60,x)))); }
export function relu(x) { return Math.max(0,x); }
export function generatePriceData(n=300,seed=42,basePrice=150,volatility=0.018){let rng=seed;const rand=()=>{rng=(rng*1664525+1013904223)&0xffffffff;return(rng>>>0)/0xffffffff};const randn=()=>Math.sqrt(-2*Math.log(rand()+1e-10))*Math.cos(2*Math.PI*rand());const prices=[basePrice];for(let i=1;i<n;i++)prices.push(prices[i-1]*Math.exp(0.0002+volatility*randn()));return prices;}
export function computeRSI(prices,period=14){const rsi=new Array(prices.length).fill(50);for(let i=period;i<prices.length;i++){let g=0,l=0;for(let j=i-period+1;j<=i;j++){const d=prices[j]-prices[j-1];d>0?g+=d:l-=d;}rsi[i]=100-100/(1+g/(l+1e-10));}return rsi;}
export function computeMA(prices,period){return prices.map((_,i)=>i<period-1?prices[i]:prices.slice(i-period+1,i+1).reduce((a,b)=>a+b)/period);}
export function computeBollinger(prices,period=20){const ma=computeMA(prices,period);return prices.map((_,i)=>{if(i<period-1)return{upper:prices[i]*1.02,lower:prices[i]*0.98};const s=prices.slice(i-period+1,i+1);const std=Math.sqrt(s.reduce((a,v)=>a+(v-ma[i])**2,0)/period);return{upper:ma[i]+2*std,lower:ma[i]-2*std};});}
export function computeMACD(prices){const ema=(arr,n)=>{const k=2/(n+1);let e=arr[0];return arr.map(p=>{e=p*k+e*(1-k);return e;});};const ema12=ema(prices,12),ema26=ema(prices,26);const macd=ema12.map((v,i)=>v-ema26[i]);const signal=ema(macd,9);return{macd,signal,hist:macd.map((v,i)=>v-signal[i])};}
export function cnnExtract(window,kernels){return kernels.map(k=>{let c=0;for(let i=0;i<Math.min(k.length,window.length);i++)c+=window[i]*k[i];return relu(c/k.length);});}
export function lstmStep(input,h,c,W){const concat=[...input,h];const dot=w=>concat.reduce((s,x,i)=>s+x*(w[i%w.length]||0.4),0);const f=sigmoid(dot(W.Wf)),i_=sigmoid(dot(W.Wi)),o=sigmoid(dot(W.Wo)),g=Math.tanh(dot(W.Wg));const nc=f*c+i_*g;return{h:o*Math.tanh(nc),c:nc};}
export function cnnLstmPredict(priceHistory,steps=5){const n=priceHistory.length;const minP=Math.min(...priceHistory),maxP=Math.max(...priceHistory);const norm=priceHistory.map(p=>(p-minP)/(maxP-minP+1e-10));const kernels=[[0.1,0.15,0.2,0.25,0.3],[-0.3,-0.1,0,0.1,0.3],[0.3,-0.1,-0.4,-0.1,0.3],[0.2,0.2,0.2,0.2,0.2]];const W={Wf:[0.6,0.4,0.5,0.3,0.55,0.45],Wi:[0.3,0.5,0.2,0.6,0.35,0.45],Wo:[0.5,0.3,0.6,0.4,0.5,0.3],Wg:[0.4,0.6,0.3,0.5,0.4,0.6]};let h=0.5,c=0.5,lastF=[0.5,0.5,0.5,0.5];for(let i=20;i<n;i++){const f=cnnExtract(norm.slice(i-20,i),kernels);({h,c}=lstmStep(f,h,c,W));lastF=f;}const preds=[];let curH=h,curC=c,curN=norm[n-1];for(let s=0;s<steps;s++){const ev=lastF.map((f,i)=>Math.max(0,Math.min(1,f+(curH-0.5)*0.08+(i%2===0?0.015:-0.015)*s*0.1)));({h:curH,c:curC}=lstmStep(ev,curH,curC,W));curN=Math.max(0,Math.min(1,curN+(curH-0.5)*0.022));const price=curN*(maxP-minP)+minP,conf=Math.max(0.3,0.93-s*0.11);preds.push({price,upper:price*(1+(1-conf)*0.75),lower:price*(1-(1-conf)*0.75),confidence:conf});}return preds;}

export function analyzeInvestment(priceHistory,predictions,assetInfo,currentRSI,isCrypto=false){
  const lastPrice=priceHistory[priceHistory.length-1];
  const ma20=computeMA(priceHistory,20),ma50=computeMA(priceHistory,50);
  const boll=computeBollinger(priceHistory),macd=computeMACD(priceHistory);
  const n=priceHistory.length-1;
  const curMA20=ma20[n],curMA50=ma50[n],curBoll=boll[n];
  const curMACD=macd.macd[n],curSignal=macd.signal[n];
  const prevMACD=macd.macd[n-1],prevSignal=macd.signal[n-1];
  const signals=[];
  if(lastPrice>curMA20&&curMA20>curMA50)signals.push({name:"MA Trend",score:75,label:"Bullish",detail:"Price above MA20 & MA50 — uptrend confirmed",color:"#00d4aa"});
  else if(lastPrice<curMA20&&curMA20<curMA50)signals.push({name:"MA Trend",score:-75,label:"Bearish",detail:"Price below MA20 & MA50 — downtrend in play",color:"#ff6b6b"});
  else signals.push({name:"MA Trend",score:10,label:"Neutral",detail:"Mixed MA signals — no clear trend",color:"#fbbf24"});
  if(currentRSI<30)signals.push({name:"RSI",score:85,label:"Oversold",detail:`RSI ${currentRSI.toFixed(1)} — deeply oversold, potential bounce`,color:"#00d4aa"});
  else if(currentRSI>70)signals.push({name:"RSI",score:-70,label:"Overbought",detail:`RSI ${currentRSI.toFixed(1)} — overbought, pullback risk`,color:"#ff6b6b"});
  else signals.push({name:"RSI",score:currentRSI<50?20:-20,label:currentRSI<50?"Mild Bullish":"Mild Bearish",detail:`RSI ${currentRSI.toFixed(1)} — neutral zone`,color:"#fbbf24"});
  const bollRange=curBoll.upper-curBoll.lower,bollPos=(lastPrice-curBoll.lower)/(bollRange+1e-10);
  if(bollPos<0.2)signals.push({name:"Bollinger",score:80,label:"Near Lower Band",detail:"Price near lower Bollinger band — possible entry zone",color:"#00d4aa"});
  else if(bollPos>0.8)signals.push({name:"Bollinger",score:-65,label:"Near Upper Band",detail:"Price near upper Bollinger band — stretched",color:"#ff6b6b"});
  else signals.push({name:"Bollinger",score:30,label:"Mid-Band",detail:"Price within normal Bollinger range",color:"#fbbf24"});
  if(prevMACD<prevSignal&&curMACD>curSignal)signals.push({name:"MACD",score:90,label:"Bullish Cross",detail:"MACD just crossed above signal — strong buy signal",color:"#00d4aa"});
  else if(prevMACD>prevSignal&&curMACD<curSignal)signals.push({name:"MACD",score:-80,label:"Bearish Cross",detail:"MACD crossed below signal — sell signal",color:"#ff6b6b"});
  else if(curMACD>curSignal)signals.push({name:"MACD",score:50,label:"Bullish",detail:"MACD above signal line — positive momentum",color:"#00d4aa"});
  else signals.push({name:"MACD",score:-40,label:"Bearish",detail:"MACD below signal line — weak momentum",color:"#ff6b6b"});
  if(predictions&&predictions.length>0){const predChange=(predictions[predictions.length-1].price-lastPrice)/lastPrice*100;const avgConf=predictions.reduce((s,p)=>s+p.confidence,0)/predictions.length;if(predChange>3&&avgConf>0.65)signals.push({name:"CNN+LSTM",score:85,label:"Strong Upside",detail:`Model predicts +${predChange.toFixed(1)}% with ${(avgConf*100).toFixed(0)}% confidence`,color:"#00d4aa"});else if(predChange>0)signals.push({name:"CNN+LSTM",score:45,label:"Mild Upside",detail:`Model predicts +${predChange.toFixed(1)}%`,color:"#fbbf24"});else if(predChange<-3)signals.push({name:"CNN+LSTM",score:-75,label:"Downside Risk",detail:`Model predicts ${predChange.toFixed(1)}% — caution`,color:"#ff6b6b"});else signals.push({name:"CNN+LSTM",score:-20,label:"Mild Downside",detail:`Model predicts ${predChange.toFixed(1)}%`,color:"#ff6b6b"});}
  if(assetInfo){const range=assetInfo.weekHigh52-assetInfo.weekLow52;const pos=range>0?(lastPrice-assetInfo.weekLow52)/range:0.5;if(pos<0.25)signals.push({name:isCrypto?"Cycle Position":"52W Position",score:70,label:"Near Period Low",detail:"Near yearly low — potential value entry",color:"#00d4aa"});else if(pos>0.85)signals.push({name:isCrypto?"Cycle Position":"52W Position",score:-55,label:"Near Period High",detail:"Near yearly high — limited upside margin",color:"#ff6b6b"});else signals.push({name:isCrypto?"Cycle Position":"52W Position",score:20,label:"Mid Range",detail:`${(pos*100).toFixed(0)}th percentile of yearly range`,color:"#fbbf24"});}
  if(isCrypto){const vol=assetInfo?.volatility||0.04;if(vol>0.06)signals.push({name:"Crypto Volatility",score:-30,label:"High Volatility",detail:`Annualized vol ~${(vol*Math.sqrt(252)*100).toFixed(0)}% — size positions smaller`,color:"#fb923c"});else signals.push({name:"Crypto Volatility",score:10,label:"Moderate Vol",detail:`Annualized vol ~${(vol*Math.sqrt(252)*100).toFixed(0)}% — manageable risk`,color:"#fbbf24"});}
  const totalScore=signals.reduce((s,sig)=>s+sig.score,0)/signals.length;
  let verdict,verdictColor,verdictBg,verdictIcon,verdictDesc;
  if(totalScore>=50){verdict="BUY NOW";verdictColor="#00d4aa";verdictBg="rgba(0,212,170,0.08)";verdictIcon="🟢";verdictDesc="Multiple indicators align bullishly. This may be a favorable entry point.";}
  else if(totalScore>=15){verdict="CONSIDER BUYING";verdictColor="#7dd4b0";verdictBg="rgba(0,212,170,0.05)";verdictIcon="🔵";verdictDesc="Mostly positive signals with some caution. Consider a partial position.";}
  else if(totalScore>=-15){verdict="WAIT & WATCH";verdictColor="#fbbf24";verdictBg="rgba(251,191,36,0.06)";verdictIcon="🟡";verdictDesc="Mixed signals — no clear edge. Monitor for a cleaner setup.";}
  else if(totalScore>=-50){verdict="AVOID FOR NOW";verdictColor="#fb923c";verdictBg="rgba(251,146,60,0.07)";verdictIcon="🟠";verdictDesc="Bearish signals outweigh bullish ones. Wait for improvement.";}
  else{verdict="DO NOT BUY";verdictColor="#ff6b6b";verdictBg="rgba(255,107,107,0.08)";verdictIcon="🔴";verdictDesc="Strong bearish signals. High risk of loss at this time.";}
  let bestTiming=null;
  if(predictions&&predictions.length>0){const minIdx=predictions.reduce((mi,p,i,arr)=>p.price<arr[mi].price?i:mi,0);const isUp=predictions[predictions.length-1].price>lastPrice;if(isUp){if(minIdx===0)bestTiming={day:1,label:"TODAY",advice:"Price predicted to rise immediately — entering now captures the most upside.",urgency:"high",color:"#00d4aa"};else bestTiming={day:minIdx+1,label:`DAY +${minIdx+1}`,advice:`A dip predicted around day +${minIdx+1} before recovery. Target entry near $${predictions[minIdx].price.toFixed(2)}.`,urgency:"medium",color:"#fbbf24"};}else{bestTiming={day:null,label:"NOT YET",advice:`Downtrend predicted. Wait near $${predictions[predictions.length-1].price.toFixed(2)} before entering.`,urgency:"low",color:"#ff6b6b"};}}
  const volatility=assetInfo?.volatility||(isCrypto?0.05:0.02);
  const annualVol=volatility*Math.sqrt(252)*100;
  const winProb=Math.min(0.85,Math.max(0.15,(totalScore+100)/200));
  const avgReturn=predictions?.length?Math.abs((predictions[predictions.length-1].price-lastPrice)/lastPrice):0.03;
  const kelly=Math.max(0,(winProb*(1+avgReturn)-1)/avgReturn)*0.25;
  let positionTier,portfolioPct,sharesRationale,riskLevel,riskColor;
  if(totalScore>=60){positionTier="Full Position";portfolioPct=Math.min(isCrypto?10:15,Math.max(5,kelly*100));sharesRationale="Strong conviction — standard full allocation appropriate.";riskLevel="Moderate";riskColor="#00d4aa";}
  else if(totalScore>=30){positionTier="Standard Position";portfolioPct=Math.min(isCrypto?7:10,Math.max(3,kelly*100*0.75));sharesRationale="Good setup. Standard sizing with room to add on confirmation.";riskLevel="Moderate";riskColor="#7dd4b0";}
  else if(totalScore>=5){positionTier="Half Position";portfolioPct=Math.min(isCrypto?4:6,Math.max(2,kelly*100*0.5));sharesRationale="Cautiously positive. Start with half, add if price holds.";riskLevel="Moderate-High";riskColor="#fbbf24";}
  else if(totalScore>=-20){positionTier="Starter / Probe";portfolioPct=Math.min(isCrypto?2:3,Math.max(1,kelly*100*0.25));sharesRationale="Mixed signals — only a small probe position if you must enter.";riskLevel="High";riskColor="#fb923c";}
  else{positionTier="No Position";portfolioPct=0;sharesRationale="Bearish signals dominate. No position recommended.";riskLevel="Very High";riskColor="#ff6b6b";}
  portfolioPct=parseFloat(portfolioPct.toFixed(1));
  const stopLossPct=parseFloat(Math.min(isCrypto?15:8,Math.max(isCrypto?5:3,annualVol/(isCrypto?4:6))).toFixed(1));
  const takeProfitPct=parseFloat((stopLossPct*(totalScore>=30?2.5:1.8)).toFixed(1));
  return{signals,totalScore,verdict,verdictColor,verdictBg,verdictIcon,verdictDesc,bestTiming,sizing:{positionTier,portfolioPct,sharesRationale,riskLevel,riskColor,stopLossPct,takeProfitPct,stopLossPrice:parseFloat((lastPrice*(1-stopLossPct/100)).toFixed(2)),takeProfitPrice:parseFloat((lastPrice*(1+takeProfitPct/100)).toFixed(2)),annualVol:parseFloat(annualVol.toFixed(1)),winProb:parseFloat((winProb*100).toFixed(0))}};
}

// ═══════════════════════════════════════════════════════════════
//  CURRENCY CONFIG
// ═══════════════════════════════════════════════════════════════

// ── Currencies & formatting ──────────────────────────────────
export const CURRENCIES=[{code:"USD",symbol:"$",flag:"🇺🇸",name:"US Dollar"},{code:"EUR",symbol:"€",flag:"🇪🇺",name:"Euro"},{code:"GBP",symbol:"£",flag:"🇬🇧",name:"British Pound"},{code:"JPY",symbol:"¥",flag:"🇯🇵",name:"Japanese Yen"},{code:"CAD",symbol:"CA$",flag:"🇨🇦",name:"Canadian Dollar"},{code:"AUD",symbol:"A$",flag:"🇦🇺",name:"Australian Dollar"},{code:"CHF",symbol:"Fr",flag:"🇨🇭",name:"Swiss Franc"},{code:"CNY",symbol:"¥",flag:"🇨🇳",name:"Chinese Yuan"},{code:"INR",symbol:"₹",flag:"🇮🇳",name:"Indian Rupee"},{code:"KRW",symbol:"₩",flag:"🇰🇷",name:"South Korean Won"},{code:"BRL",symbol:"R$",flag:"🇧🇷",name:"Brazilian Real"},{code:"MXN",symbol:"MX$",flag:"🇲🇽",name:"Mexican Peso"},{code:"SGD",symbol:"S$",flag:"🇸🇬",name:"Singapore Dollar"},{code:"HKD",symbol:"HK$",flag:"🇭🇰",name:"Hong Kong Dollar"},{code:"SEK",symbol:"kr",flag:"🇸🇪",name:"Swedish Krona"},{code:"NOK",symbol:"kr",flag:"🇳🇴",name:"Norwegian Krone"},{code:"NZD",symbol:"NZ$",flag:"🇳🇿",name:"New Zealand Dollar"},{code:"ZAR",symbol:"R",flag:"🇿🇦",name:"South African Rand"},{code:"AED",symbol:"د.إ",flag:"🇦🇪",name:"UAE Dirham"},{code:"SAR",symbol:"﷼",flag:"🇸🇦",name:"Saudi Riyal"}];
export const STATIC_RATES={USD:1,EUR:0.92,GBP:0.79,JPY:149.5,CAD:1.36,AUD:1.53,CHF:0.90,CNY:7.24,INR:83.1,KRW:1325,BRL:4.97,MXN:17.2,SGD:1.34,HKD:7.82,SEK:10.42,NOK:10.58,NZD:1.63,ZAR:18.6,AED:3.67,SAR:3.75};
export function formatPrice(usdPrice,currency,isCrypto=false){if(usdPrice==null)return"—";const rate=STATIC_RATES[currency.code]??1;const c=usdPrice*rate;const s=currency.symbol;if(c>=1000000)return`${s}${(c/1000000).toFixed(2)}M`;if((currency.code==="JPY"||currency.code==="KRW")&&c>=1000)return`${s}${Math.round(c).toLocaleString()}`;if(c<0.01)return`${s}${c.toFixed(6)}`;if(c<1)return`${s}${c.toFixed(4)}`;return`${s}${c.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}`;}
export function fmtAmt(n,currency){const rate=STATIC_RATES[currency.code]??1;const c=n*rate;const s=currency.symbol;if(c>=1000000)return`${s}${(c/1000000).toFixed(1)}M`;return`${s}${c>=1000?c.toLocaleString(undefined,{maximumFractionDigits:0}):c.toLocaleString(undefined,{minimumFractionDigits:0,maximumFractionDigits:0})}`;}

// ═══════════════════════════════════════════════════════════════
//  API FETCH
// ═══════════════════════════════════════════════════════════════
export async function fetchAssetInfo(symbol,isCrypto){
  const prompt=isCrypto
    ?`For the cryptocurrency "${symbol.toUpperCase()}", provide ONLY a JSON object (no markdown):
{"ticker":"SYMBOL","name":"Full Crypto Name","currentPrice":45000,"previousClose":44000,"weekHigh52":70000,"weekLow52":20000,"marketCap":"850B","sector":"Cryptocurrency","volatility":0.06,"dominance":"45%","valid":true}
If not a real cryptocurrency, return {"valid":false}. Return ONLY JSON.`
    :`For the stock ticker "${symbol.toUpperCase()}", provide ONLY a JSON object (no markdown):
{"ticker":"TICKER","name":"Full Company Name","currentPrice":123.45,"previousClose":122.00,"weekHigh52":200.00,"weekLow52":100.00,"marketCap":"2.5T","sector":"Technology","volatility":0.02,"valid":true}
If not a real publicly traded stock, return {"valid":false}. Return ONLY JSON.`;
  const res=await fetch("/api/claude",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({model:"claude-sonnet-4-20250514",max_tokens:500,tools:[{type:"web_search_20250305",name:"web_search"}],messages:[{role:"user",content:prompt}]})});
  const data=await res.json();
  const text=data.content.filter(b=>b.type==="text").map(b=>b.text).join("");
  const match=text.match(/\{[\s\S]*?\}/);
  if(!match)throw new Error("No JSON");
  return JSON.parse(match[0]);
}

// ═══════════════════════════════════════════════════════════════
//  LOGO COMPONENT
// ═══════════════════════════════════════════════════════════════

// ── Storage: watchlist ──────────────────────────────────────
export function loadWatchlist(email){try{var r=localStorage.getItem("mp_wl_"+email);return r?JSON.parse(r):[];}catch(e){return[];}}
export function saveWatchlist(email,data){try{localStorage.setItem("mp_wl_"+email,JSON.stringify(data));}catch(e){}}
export function loadUserData(email, key) {
  try { const r = localStorage.getItem(`mp_${key}_${email}`); return r ? JSON.parse(r) : []; } catch(e) { return []; }
}

// ── Storage: user data ──────────────────────────────────────
export function saveUserData(email, key, data) {
  try { localStorage.setItem(`mp_${key}_${email}`, JSON.stringify(data)); } catch(e) {}
}
const HISTORY_TTL_DAYS = 30;
export function pruneOldHistory(entries) {
  const cutoff = Date.now() - HISTORY_TTL_DAYS * 24 * 60 * 60 * 1000;
  return entries.filter(e => {
    // entries store timestamp as locale string — we also store a ts epoch for filtering
    if (e.ts) return e.ts >= cutoff;
    // fallback: try parsing the timestamp string
    try { return new Date(e.timestamp).getTime() >= cutoff; } catch(_) { return true; }
  });
}

// ── Storage: accuracy ───────────────────────────────────────
export function loadAccuracy(email)  { try { const r = localStorage.getItem(`mp_accuracy_${email}`); return r ? JSON.parse(r) : []; } catch(e) { return []; } }
export function saveAccuracy(email, data) { try { localStorage.setItem(`mp_accuracy_${email}`, JSON.stringify(data)); } catch(e) {} }
export function recordPendingPrediction(email, entry) {
  if (!email || !entry.ticker || !entry.predPrice) return;
  const horizonDays = HORIZONS_DAYS[entry.horizon] || 5;
  const checkAfter  = Date.now() + horizonDays * TRADING_DAY_MS;
  const pending = loadAccuracy(email);
  // Avoid duplicate
  if (pending.find(p => p.id === entry.ts)) return;
  pending.unshift({
    id:          entry.ts || Date.now(),
    ticker:      entry.ticker,
    name:        entry.name || entry.ticker,
    isCrypto:    entry.isCrypto || false,
    priceAtPred: entry.price,
    predPrice:   entry.predPrice,
    direction:   entry.predPrice >= entry.price ? "up" : "down",
    horizon:     entry.horizon,
    horizonDays,
    checkAfter,
    createdAt:   Date.now(),
    // Baselines
    flatBaseline:     entry.price,                        // "no change"
    momentumBaseline: entry.price * (1 + (entry.change || 0) / 100), // continue current % move
    verdict:     entry.verdict,
    score:       entry.score,
    status:      "pending",   // pending | resolved
    actualPrice: null,
    resolvedAt:  null,
    pctError:    null,
    directionCorrect: null,
    modelBeatFlat:     null,
    modelBeatMomentum: null,
  });
  saveAccuracy(email, pending.slice(0, 100)); // keep last 100
}
export async function resolvePendingPredictions(email) {
  const pending = loadAccuracy(email);
  const now = Date.now();
  const toCheck = pending.filter(p => p.status === "pending" && p.checkAfter <= now);
  if (!toCheck.length) return pending;

  const updated = [...pending];
  for (const pred of toCheck) {
    try {
      const info = await fetchAssetInfo(pred.ticker, pred.isCrypto);
      if (!info.valid || !info.currentPrice) continue;
      const actual = info.currentPrice;
      const pctError = Math.abs((actual - pred.predPrice) / pred.predPrice * 100);
      const actualDir = actual >= pred.priceAtPred ? "up" : "down";
      const dirCorrect = actualDir === pred.direction;
      const modelErrFlat     = Math.abs(actual - pred.flatBaseline);
      const modelErrMomentum = Math.abs(actual - pred.momentumBaseline);
      const modelErr         = Math.abs(actual - pred.predPrice);
      const idx = updated.findIndex(p => p.id === pred.id);
      if (idx >= 0) {
        updated[idx] = {
          ...updated[idx],
          status:           "resolved",
          actualPrice:      actual,
          resolvedAt:       now,
          pctError:         parseFloat(pctError.toFixed(2)),
          directionCorrect: dirCorrect,
          modelBeatFlat:     modelErr < modelErrFlat,
          modelBeatMomentum: modelErr < modelErrMomentum,
          flatBaselineErr:   parseFloat((Math.abs(actual - pred.flatBaseline) / pred.priceAtPred * 100).toFixed(2)),
          momentumBaselineErr: parseFloat((Math.abs(actual - pred.momentumBaseline) / pred.priceAtPred * 100).toFixed(2)),
        };
      }
    } catch(e) { /* skip on error, try again next time */ }
  }
  saveAccuracy(email, updated);
  return updated;
}

// ── Storage: prefs ──────────────────────────────────────────
export function loadPrefs(email){
  try{
    const raw=localStorage.getItem("mp_prefs_"+email);
    return raw?JSON.parse(raw):{};
  }catch(e){return {};}
}
export function savePrefs(email,prefs){
  try{ localStorage.setItem("mp_prefs_"+email,JSON.stringify(prefs)); }catch(e){}
}
