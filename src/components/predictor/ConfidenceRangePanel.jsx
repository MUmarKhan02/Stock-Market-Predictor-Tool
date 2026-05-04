'use client';

import { Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart } from "recharts";

function ConfidenceRangePanel({predictions,lastPrice,metrics,accent,isDark,fp}){
  var avgConf=parseFloat(metrics.avgConf);
  var hi=avgConf>=75,mid=avgConf>=55;
  var tier=hi?"HIGH":mid?"MODERATE":"LOW";
  var tc=hi?"#00d4aa":mid?"#fbbf24":"#ff6b6b";
  var desc=hi?"Strong conviction — bands are tight.":mid?"Reasonable conviction — use bands as a guide.":"Model is uncertain — treat forecast cautiously.";
  var lows=predictions.map(function(p){return p.lower;});
  var highs=predictions.map(function(p){return p.upper;});
  var lo=Math.min.apply(null,lows);
  var hi2=Math.max.apply(null,highs);
  var fin=predictions[predictions.length-1].price;
  var spreadPct=((hi2-lo)/lastPrice*100).toFixed(1);
  var bullPct=((hi2-lastPrice)/lastPrice*100).toFixed(1);
  var bearPct=((lo-lastPrice)/lastPrice*100).toFixed(1);
  var basePct=((fin-lastPrice)/lastPrice*100).toFixed(1);
  var baseUp=fin>=lastPrice;
  var dash=((avgConf/100)*163.4).toFixed(1)+" 163.4";
  var confData=predictions.map(function(p,i){return{day:i+1,conf:parseFloat((p.confidence*100).toFixed(1))};});
  return(
    <div style={{background:"var(--surface)",border:"1px solid "+tc+"30",borderRadius:14,padding:"clamp(12px,2.5vw,18px)",marginTop:12}}>
      <div style={{fontSize:9,color:"var(--text9)",letterSpacing:2,marginBottom:10,textTransform:"uppercase"}}>Confidence &amp; Prediction Range</div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:12,marginBottom:14,flexWrap:"wrap"}}>
        <div style={{flex:1,minWidth:0}}>
          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:4}}>
            <span style={{fontSize:"clamp(14px,3vw,18px)",fontWeight:800,color:tc,fontFamily:"'Syne',sans-serif"}}>{tier} CONFIDENCE</span>
            <span style={{fontSize:10,padding:"2px 8px",borderRadius:20,background:tc+"18",border:"1px solid "+tc+"30",color:"var(--text8)"}}>{avgConf}%</span>
          </div>
          <div style={{fontSize:11,color:"var(--text7)",lineHeight:1.5}}>{desc}</div>
        </div>
        <div style={{position:"relative",width:60,height:60,flexShrink:0}}>
          <svg width="60" height="60" viewBox="0 0 60 60">
            <circle cx="30" cy="30" r="24" fill="none" stroke="var(--border)" strokeWidth="5"/>
            <circle cx="30" cy="30" r="24" fill="none" stroke={tc} strokeWidth="5" strokeDasharray={dash} strokeLinecap="round" transform={"rotate(-90 30 30)"}/>
          </svg>
          <div style={{position:"absolute",inset:0,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center"}}>
            <div style={{fontSize:12,fontWeight:800,color:tc,fontFamily:"monospace"}}>{avgConf}%</div>
            <div style={{fontSize:7,color:"var(--text9)"}}>CONF</div>
          </div>
        </div>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginBottom:14}}>
        <div style={{background:"rgba(255,107,107,0.08)",border:"1px solid rgba(255,107,107,0.2)",borderRadius:10,padding:10,textAlign:"center"}}>
          <div style={{fontSize:8,color:"var(--text9)",marginBottom:3}}>BEAR CASE</div>
          <div style={{fontSize:"clamp(10px,2vw,13px)",fontWeight:800,color:"#ff6b6b",fontFamily:"monospace"}}>{fp(lo)}</div>
          <div style={{fontSize:9,color:"#ff6b6b"}}>▼ {bearPct}%</div>
          <div style={{fontSize:8,color:"var(--text10)",marginTop:2}}>Worst predicted low</div>
        </div>
        <div style={{background:baseUp?accent+"08":"rgba(255,107,107,0.08)",border:"1px solid "+(baseUp?accent+"20":"rgba(255,107,107,0.2)"),borderRadius:10,padding:10,textAlign:"center"}}>
          <div style={{fontSize:8,color:"var(--text9)",marginBottom:3}}>BASE CASE</div>
          <div style={{fontSize:"clamp(10px,2vw,13px)",fontWeight:800,color:baseUp?accent:"#ff6b6b",fontFamily:"monospace"}}>{fp(fin)}</div>
          <div style={{fontSize:9,color:baseUp?accent:"#ff6b6b"}}>{baseUp?"+":""}{basePct}%</div>
          <div style={{fontSize:8,color:"var(--text10)",marginTop:2}}>Model central forecast</div>
        </div>
        <div style={{background:accent+"08",border:"1px solid "+accent+"20",borderRadius:10,padding:10,textAlign:"center"}}>
          <div style={{fontSize:8,color:"var(--text9)",marginBottom:3}}>BULL CASE</div>
          <div style={{fontSize:"clamp(10px,2vw,13px)",fontWeight:800,color:accent,fontFamily:"monospace"}}>{fp(hi2)}</div>
          <div style={{fontSize:9,color:accent}}>▲ +{bullPct}%</div>
          <div style={{fontSize:8,color:"var(--text10)",marginTop:2}}>Best predicted high</div>
        </div>
      </div>
      <div style={{marginBottom:14}}>
        <div style={{display:"flex",justifyContent:"space-between",marginBottom:5}}>
          <div style={{fontSize:9,color:"var(--text9)",letterSpacing:2}}>PRICE RANGE ACROSS HORIZON</div>
          <div style={{fontSize:9,color:"var(--text8)"}}>{spreadPct}% spread</div>
        </div>
        <div style={{position:"relative",height:22,background:"var(--surface2)",borderRadius:6,overflow:"hidden",border:"1px solid var(--border)"}}>
          <div style={{position:"absolute",top:0,bottom:0,left:0,width:"50%",background:"rgba(255,107,107,0.15)",borderRight:"2px dashed rgba(255,107,107,0.5)"}}/>
          <div style={{position:"absolute",top:0,bottom:0,left:"50%",right:0,background:accent+"12",borderLeft:"2px dashed "+accent+"50"}}/>
          <div style={{position:"absolute",top:0,bottom:0,left:"50%",width:2,background:"var(--text6)"}}/>
          <div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"space-between",padding:"0 8px",fontSize:8,fontFamily:"monospace",pointerEvents:"none"}}>
            <span style={{color:"#ff6b6b"}}>{fp(lo)}</span>
            <span style={{color:"var(--text6)"}}>NOW</span>
            <span style={{color:accent}}>{fp(hi2)}</span>
          </div>
        </div>
      </div>
      <div style={{fontSize:9,color:"var(--text9)",letterSpacing:2,marginBottom:8}}>CONFIDENCE DECAY BY DAY</div>
      <ResponsiveContainer width="100%" height={80}>
        <AreaChart data={confData} margin={{top:4,right:4,left:0,bottom:0}}>
          <defs>
            <linearGradient id="confGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={tc} stopOpacity={0.25}/>
              <stop offset="95%" stopColor={tc} stopOpacity={0.02}/>
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--surface3)"/>
          <XAxis dataKey="day" stroke="var(--text12)" tick={{fill:isDark?"#444":"#888",fontSize:8}} tickFormatter={function(v){return"+"+v+"d";}}/>
          <YAxis domain={[0,100]} stroke="var(--text12)" tick={{fill:isDark?"#444":"#888",fontSize:8}} width={28} tickFormatter={function(v){return v+"%";}}/>
          <Tooltip contentStyle={{background:"var(--tooltip-bg)",border:"1px solid var(--border)",fontSize:9}} formatter={function(v){return[v+"%","Conf"];}}/>
          <Area type="monotone" dataKey="conf" stroke={tc} strokeWidth={2} fill="url(#confGrad)" dot={{r:3,fill:tc}} name="Confidence"/>
        </AreaChart>
      </ResponsiveContainer>
      <div style={{display:"flex",gap:4,marginTop:8,flexWrap:"wrap"}}>
        {confData.map(function(d,idx){
          var bc=d.conf>=70?"#00d4aa":d.conf>=50?"#fbbf24":"#ff6b6b";
          var first=idx===0;
          return(
            <div key={idx} style={{flex:1,minWidth:"clamp(32px,7vw,48px)",background:first?tc+"20":"var(--surface2)",border:"1px solid "+(first?tc+"40":"var(--border)"),borderRadius:6,padding:"4px 3px",textAlign:"center"}}>
              <div style={{fontSize:7,color:"var(--text9)",marginBottom:1}}>+{d.day}d</div>
              <div style={{fontSize:9,fontWeight:800,color:first?tc:bc,fontFamily:"monospace"}}>{d.conf}%</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default ConfidenceRangePanel;
