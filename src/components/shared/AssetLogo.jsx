'use client';

import { useState, useEffect } from "react";

const CG={BTC:"1/large/bitcoin.png",ETH:"279/large/ethereum.png",BNB:"825/large/bnb-icon2_2x.png",SOL:"4128/large/solana.png",XRP:"44/large/xrp-symbol-white-128.png",ADA:"975/large/cardano.png",DOGE:"5/large/dogecoin.png",AVAX:"12559/large/Avalanche_Circle_RedWhite_Trans.png",LINK:"877/large/chainlink-new-logo.png",MATIC:"4713/large/matic-token-icon.png",DOT:"12171/large/polkadot.png",UNI:"12504/large/uniswap-uni-logo.png",LTC:"2/large/litecoin.png",ATOM:"1481/large/cosmos_hub.png",SHIB:"11939/large/shiba.png",TRX:"1094/large/tron-logo.png",NEAR:"10365/large/near.jpg",ALGO:"4030/large/algorand.png",FTM:"4001/large/Fantom.png"};
const SD={GOOGL:"google.com",GOOG:"google.com",META:"meta.com",JPM:"jpmorganchase.com",BAC:"bankofamerica.com",WMT:"walmart.com",COST:"costco.com",HD:"homedepot.com",TGT:"target.com",UNH:"unitedhealthgroup.com",LLY:"lilly.com",JNJ:"jnj.com",PFE:"pfizer.com",MRK:"merck.com",ABBV:"abbvie.com",V:"visa.com",MA:"mastercard.com",PYPL:"paypal.com",GS:"goldmansachs.com",MS:"morganstanley.com",C:"citigroup.com",WFC:"wellsfargo.com",AXP:"americanexpress.com",BLK:"blackrock.com",NFLX:"netflix.com",DIS:"disney.com",CMCSA:"comcast.com",T:"att.com",VZ:"verizon.com",TMUS:"t-mobile.com",XOM:"exxonmobil.com",CVX:"chevron.com",BA:"boeing.com",CAT:"caterpillar.com",GE:"ge.com",UBER:"uber.com",ABNB:"airbnb.com",SHOP:"shopify.com",SPOT:"spotify.com",SNAP:"snap.com",COIN:"coinbase.com",NKE:"nike.com",SBUX:"starbucks.com",MCD:"mcdonalds.com",TSM:"tsmc.com",INTC:"intel.com",QCOM:"qualcomm.com",TXN:"ti.com",AVGO:"broadcom.com",CRM:"salesforce.com",NOW:"servicenow.com",SNOW:"snowflake.com",PLTR:"palantir.com",DDOG:"datadoghq.com",NET:"cloudflare.com",CRWD:"crowdstrike.com",PANW:"paloaltonetworks.com"};


function AssetLogo({ticker,isCrypto,accent}){
  const[src,setSrc]=useState(null);
  const[ok,setOk]=useState(false);
  const[err,setErr]=useState(false);
  useEffect(()=>{
    setOk(false);setErr(false);setSrc(null);
    if(!ticker)return;
    if(isCrypto){const p=CG[ticker.toUpperCase()];if(p)setSrc(`https://assets.coingecko.com/coins/images/${p}`);else setErr(true);}
    else{const d=SD[ticker.toUpperCase()]||`${ticker.toLowerCase().replace(/[^a-z]/g,"")}.com`;setSrc(`https://logo.clearbit.com/${d}`);}
  },[ticker,isCrypto]);
  const sz=52;
  if(err||!src)return(<div style={{width:sz,height:sz,borderRadius:12,background:`${accent}20`,border:`2px solid ${accent}40`,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}><span style={{fontSize:16,fontWeight:800,color:accent,fontFamily:"monospace"}}>{ticker?.slice(0,2)}</span></div>);
  return(<div style={{width:sz,height:sz,borderRadius:12,background:"var(--border)",border:`2px solid ${accent}30`,overflow:"hidden",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,position:"relative"}}>{!ok&&<span style={{fontSize:14,fontWeight:800,color:accent,fontFamily:"monospace",position:"absolute"}}>{ticker?.slice(0,2)}</span>}<img src={src} alt={ticker} onLoad={()=>setOk(true)} onError={()=>{setErr(true);setOk(false);}} style={{width:"100%",height:"100%",objectFit:"contain",padding:4,opacity:ok?1:0,transition:"opacity 0.3s"}}/></div>);
}

// ═══════════════════════════════════════════════════════════════
//  SHARED SMALL COMPONENTS
// ═══════════════════════════════════════════════════════════════
const MetricCard=({label,value,sub,color})=>(
  <div style={{background:"var(--surface2)",border:"1px solid var(--border)",borderRadius:12,padding:"12px 14px",flex:1,minWidth:0}}>
    <div style={{fontSize:10,color:"var(--text8)",marginBottom:3,textTransform:"uppercase",letterSpacing:1,fontFamily:"monospace",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{label}</div>
    <div style={{fontSize:"clamp(14px,3vw,20px)",fontWeight:800,color,fontFamily:"monospace",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{value}</div>
    {sub&&<div style={{fontSize:10,color:"var(--text8)",marginTop:2,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{sub}</div>}
  </div>
);

const Tooltip2=({active,payload,label})=>{
  if(!active||!payload?.length)return null;
  return(<div style={{background:"var(--bg2)",border:"1px solid rgba(100,200,170,0.3)",borderRadius:8,padding:"8px 12px",fontSize:11,fontFamily:"monospace",maxWidth:200}}>
    <div style={{color:"var(--text7)",marginBottom:4}}>Day {label}</div>
    {payload.map((p,i)=>p.value!=null&&<div key={i} style={{color:p.color,marginBottom:2,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{p.name}: <strong>{Number(p.value).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}</strong></div>)}
  </div>);
};

const ModelViz=({active,accent})=>{
  const layers=[{label:"Input",icon:"📈"},{label:"CNN L1",icon:"⚡"},{label:"CNN L2",icon:"⚡"},{label:"LSTM",icon:"🔄"},{label:"Dense",icon:"🔗"},{label:"Output",icon:"🎯"}];
  return(<div style={{display:"flex",alignItems:"center",gap:3,flexWrap:"wrap",justifyContent:"center"}}>
    {layers.map((l,i)=>(
      <div key={i} style={{display:"flex",alignItems:"center",gap:3}}>
        <div style={{background:active?accent+"18":"var(--surface3)",border:"1px solid "+(active?accent+"60":"var(--border3)"),borderRadius:8,padding:"5px 8px",textAlign:"center",transition:"all 0.4s",minWidth:"clamp(40px,7vw,60px)"}}>
          <div style={{fontSize:"clamp(10px,2vw,14px)"}}>{l.icon}</div>
          <div style={{fontSize:"clamp(7px,1.5vw,9px)",fontWeight:700,color:active?accent:"#555",fontFamily:"monospace"}}>{l.label}</div>
        </div>
        {i!==layers.length-1&&<div style={{color:active?accent:"#2a2a2a",fontSize:"clamp(10px,2vw,14px)",transition:"color 0.4s"}}>→</div>}
      </div>
    ))}
  </div>);
};

export { AssetLogo, MetricCard, Tooltip2, ModelViz };
