import { useState, useMemo, useEffect } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";

const cMul = (a, b) => [a[0]*b[0]-a[1]*b[1], a[0]*b[1]+a[1]*b[0]];
const cAdd = (a, b) => [a[0]+b[0], a[1]+b[1]];
const cAbs2 = (a) => a[0]*a[0]+a[1]*a[1];
const S2 = 1/Math.sqrt(2);

const TH = {
  bg:'#F4F6FB',surface:'#FFFFFF',sidebar:'#EEF1F8',
  border:'#D8DEE9',borderLight:'#E8ECF4',
  text:'#1E293B',textMid:'#475569',textLight:'#94A3B8',
  wire:'#B0BEC5',accent:'#3B82F6',accentBg:'#EFF6FF',
  run:'#0EA5E9',hover:'#F1F5F9',
};

const GATE_DEFS = {
  I:{matrix:[[[1,0],[0,0]],[[0,0],[1,0]]],label:'I',color:'#94A3B8',bg:'#F1F5F9',desc:'Identity',qubits:1},
  H:{matrix:[[[S2,0],[S2,0]],[[S2,0],[-S2,0]]],label:'H',color:'#D97706',bg:'#FFFBEB',desc:'Hadamard',qubits:1},
  X:{matrix:[[[0,0],[1,0]],[[1,0],[0,0]]],label:'X',color:'#DC2626',bg:'#FEF2F2',desc:'Pauli-X',qubits:1},
  Y:{matrix:[[[0,0],[0,-1]],[[0,1],[0,0]]],label:'Y',color:'#059669',bg:'#ECFDF5',desc:'Pauli-Y',qubits:1},
  Z:{matrix:[[[1,0],[0,0]],[[0,0],[-1,0]]],label:'Z',color:'#2563EB',bg:'#EFF6FF',desc:'Pauli-Z',qubits:1},
  S:{matrix:[[[1,0],[0,0]],[[0,0],[0,1]]],label:'S',color:'#7C3AED',bg:'#F5F3FF',desc:'Phase(S)',qubits:1},
  T:{matrix:[[[1,0],[0,0]],[[0,0],[Math.cos(Math.PI/4),Math.sin(Math.PI/4)]]],label:'T',color:'#0D9488',bg:'#F0FDFA',desc:'\u03C0/8',qubits:1},
  CNOT:{label:'CX',color:'#DC2626',bg:'#FEF2F2',desc:'CNOT',qubits:2},
  CZ:{label:'CZ',color:'#2563EB',bg:'#EFF6FF',desc:'CZ',qubits:2},
  SWAP:{label:'SW',color:'#D97706',bg:'#FFFBEB',desc:'SWAP',qubits:2},
};

function applySingleGate(st,m,q,n){const d=1<<n;const ns=st.map(a=>[...a]);const mk=1<<q;for(let i=0;i<d;i++){if((i&mk)!==0)continue;const j=i|mk;ns[i]=cAdd(cMul(m[0][0],st[i]),cMul(m[0][1],st[j]));ns[j]=cAdd(cMul(m[1][0],st[i]),cMul(m[1][1],st[j]));}return ns;}
function applyCNOT(st,c,t,n){const d=1<<n;const ns=st.map(a=>[...a]);for(let i=0;i<d;i++){if(((i>>c)&1)===1&&((i>>t)&1)===0){const j=i^(1<<t);ns[i]=[...st[j]];ns[j]=[...st[i]];}}return ns;}
function applyCZ(st,c,t,n){const d=1<<n;const ns=st.map(a=>[...a]);for(let i=0;i<d;i++){if(((i>>c)&1)===1&&((i>>t)&1)===1)ns[i]=[-st[i][0],-st[i][1]];}return ns;}
function applySWAP(st,q1,q2,n){const d=1<<n;const ns=st.map(a=>[...a]);for(let i=0;i<d;i++){const b1=(i>>q1)&1,b2=(i>>q2)&1;if(b1!==b2){const j=i^(1<<q1)^(1<<q2);if(i<j){ns[i]=[...st[j]];ns[j]=[...st[i]];}}}return ns;}

function runSim(nq,circ,ns){
  const d=1<<nq;let st=Array.from({length:d},(_,i)=>(i===0?[1,0]:[0,0]));
  for(let s=0;s<ns;s++){const pr=new Set();for(let q=0;q<nq;q++){const k=`${q}-${s}`;if(pr.has(k))continue;const g=circ[k];if(!g)continue;
    if(g.type==='CNOT_CTRL'){st=applyCNOT(st,q,g.target,nq);pr.add(`${g.target}-${s}`);}
    else if(g.type==='CZ_CTRL'){st=applyCZ(st,q,g.target,nq);pr.add(`${g.target}-${s}`);}
    else if(g.type==='SWAP_A'){st=applySWAP(st,q,g.partner,nq);pr.add(`${g.partner}-${s}`);}
    else if(['M','CNOT_TGT','CZ_TGT','SWAP_B'].includes(g.type)){continue;}
    else if(GATE_DEFS[g.type]){st=applySingleGate(st,GATE_DEFS[g.type].matrix,q,nq);}
    pr.add(k);}}
  return st;
}
function basisLabel(i,n){return '|'+i.toString(2).padStart(n,'0')+'\u27E9';}

function useIsMobile(){
  const [m,setM]=useState(window.innerWidth<768);
  useEffect(()=>{const h=()=>setM(window.innerWidth<768);window.addEventListener('resize',h);return()=>window.removeEventListener('resize',h);},[]);
  return m;
}

export default function App(){
  const [nq,setNq]=useState(2);
  const [ns,setNs]=useState(10);
  const [circ,setCirc]=useState({});
  const [selGate,setSelGate]=useState(null);
  const [results,setResults]=useState(null);
  const [pending,setPending]=useState(null);
  const [hovered,setHovered]=useState(null);
  const [sv,setSv]=useState(null);
  const [showSv,setShowSv]=useState(false);
  const [showPalette,setShowPalette]=useState(false);
  const isMobile=useIsMobile();

  const addQ=()=>{if(nq<8){setNq(n=>n+1);setResults(null);}};
  const rmQ=()=>{if(nq>1){const nn=nq-1;const nc={};Object.entries(circ).forEach(([k,v])=>{const q=parseInt(k.split('-')[0]);if(q<nn&&(v.target===undefined||v.target<nn)&&(v.partner===undefined||v.partner<nn))nc[k]=v;});setCirc(nc);setNq(nn);setResults(null);}};
  const addS=()=>setNs(s=>Math.min(s+1,30));
  const rmS=()=>{if(ns>1){const nn=ns-1;const nc={};Object.entries(circ).forEach(([k,v])=>{if(parseInt(k.split('-')[1])<nn)nc[k]=v;});setCirc(nc);setNs(nn);}};
  const clear=()=>{setCirc({});setResults(null);setPending(null);setSv(null);};

  const handleClick=(q,s)=>{
    if(!selGate){const k=`${q}-${s}`;const ex=circ[k];if(ex){const nc={...circ};delete nc[k];
      if(ex.type==='CNOT_CTRL')delete nc[`${ex.target}-${s}`];if(ex.type==='CNOT_TGT')delete nc[`${ex.control}-${s}`];
      if(ex.type==='CZ_CTRL')delete nc[`${ex.target}-${s}`];if(ex.type==='CZ_TGT')delete nc[`${ex.control}-${s}`];
      if(ex.type==='SWAP_A')delete nc[`${ex.partner}-${s}`];if(ex.type==='SWAP_B')delete nc[`${ex.partner}-${s}`];
      setCirc(nc);setResults(null);}return;}
    if(selGate==='M'&&!pending){const k=`${q}-${s}`;if(circ[k])return;setCirc({...circ,[k]:{type:'M'}});setResults(null);return;}
    const gi=GATE_DEFS[selGate];if(!gi)return;
    if(pending){if(s!==pending.step||q===pending.qubit){setPending(null);return;}
      const k1=`${pending.qubit}-${s}`,k2=`${q}-${s}`;if(circ[k2]){setPending(null);return;}
      const nc={...circ};
      if(pending.gate==='CNOT'){nc[k1]={type:'CNOT_CTRL',target:q};nc[k2]={type:'CNOT_TGT',control:pending.qubit};}
      else if(pending.gate==='CZ'){nc[k1]={type:'CZ_CTRL',target:q};nc[k2]={type:'CZ_TGT',control:pending.qubit};}
      else if(pending.gate==='SWAP'){nc[k1]={type:'SWAP_A',partner:q};nc[k2]={type:'SWAP_B',partner:pending.qubit};}
      setCirc(nc);setPending(null);setResults(null);return;}
    const k=`${q}-${s}`;if(circ[k])return;
    if(gi.qubits===2){setPending({gate:selGate,qubit:q,step:s});return;}
    setCirc({...circ,[k]:{type:selGate}});setResults(null);
  };

  const run=()=>{const st=runSim(nq,circ,ns);setResults(st.map(a=>cAbs2(a)));setSv(st);};

  const chartData=useMemo(()=>{
    if(!results)return[];
    return results.map((p,i)=>({state:basisLabel(i,nq),probability:Math.round(p*10000)/10000})).filter(d=>d.probability>0.0001);
  },[results,nq]);

  const renderGate=(q,s)=>{
    const g=circ[`${q}-${s}`];if(!g)return null;const t=g.type;
    const sz=isMobile?36:42;
    if(t==='CNOT_CTRL')return <div style={{width:14,height:14,borderRadius:'50%',background:GATE_DEFS.CNOT.color,boxShadow:`0 0 0 2px ${TH.surface}`}}/>;
    if(t==='CNOT_TGT')return <div style={{width:22,height:22,borderRadius:'50%',border:`2.5px solid ${GATE_DEFS.CNOT.color}`,display:'flex',alignItems:'center',justifyContent:'center',color:GATE_DEFS.CNOT.color,fontSize:15,fontWeight:'bold',background:TH.surface}}>{'\u2295'}</div>;
    if(t==='CZ_CTRL'||t==='CZ_TGT')return <div style={{width:14,height:14,borderRadius:'50%',background:GATE_DEFS.CZ.color,boxShadow:`0 0 0 2px ${TH.surface}`}}/>;
    if(t==='SWAP_A'||t==='SWAP_B')return <div style={{fontSize:16,color:GATE_DEFS.SWAP.color,fontWeight:'bold'}}>{'\u2715'}</div>;
    if(t==='M')return(<div style={{width:sz,height:sz,borderRadius:7,background:TH.surface,border:`2px solid ${TH.border}`,display:'flex',alignItems:'center',justifyContent:'center',flexDirection:'column',boxShadow:'0 1px 3px rgba(0,0,0,0.06)'}}>
      <div style={{width:16,height:9,borderBottom:`2px solid ${TH.textMid}`,borderRadius:'0 0 50% 50%',marginTop:2,transform:'rotate(180deg)'}}/><div style={{fontSize:8,color:TH.textMid,marginTop:1,fontWeight:600}}>M</div></div>);
    const def=GATE_DEFS[t];if(!def)return null;
    return(<div style={{width:sz,height:sz,borderRadius:7,background:def.bg,border:`2px solid ${def.color}`,display:'flex',alignItems:'center',justifyContent:'center',color:def.color,fontWeight:700,fontSize:isMobile?14:16,fontFamily:"'Source Code Pro',monospace",boxShadow:'0 1px 3px rgba(0,0,0,0.06)'}}>{def.label}</div>);
  };

  const getConns=(s)=>{
    const c=[];for(let q=0;q<nq;q++){const g=circ[`${q}-${s}`];
      if(g&&g.type==='CNOT_CTRL')c.push({from:q,to:g.target,color:GATE_DEFS.CNOT.color});
      if(g&&g.type==='CZ_CTRL')c.push({from:q,to:g.target,color:GATE_DEFS.CZ.color});
      if(g&&g.type==='SWAP_A')c.push({from:q,to:g.partner,color:GATE_DEFS.SWAP.color});}return c;
  };

  const CH=isMobile?48:58,CW=isMobile?48:58;
  const LBL_W=isMobile?50:63;

  const selectGate=(g)=>{setSelGate(selGate===g?null:g);setPending(null);};

  // Gate palette content (shared between mobile and desktop)
  const paletteContent=(
    <>
      <div style={secLbl}>Single Qubit</div>
      <div style={isMobile?{display:'flex',flexWrap:'wrap',gap:4,marginBottom:8}:{}}>
        {['I','H','X','Y','Z','S','T'].map(g=>(
          <button key={g} onClick={()=>selectGate(g)} style={isMobile?{
            padding:'6px 10px',borderRadius:8,border:selGate===g?`2px solid ${GATE_DEFS[g].color}`:`1px solid ${TH.borderLight}`,
            background:selGate===g?GATE_DEFS[g].bg:TH.surface,color:GATE_DEFS[g].color,cursor:'pointer',display:'flex',alignItems:'center',gap:6,
            fontFamily:'inherit',fontSize:13,fontWeight:600
          }:{
            width:'100%',padding:'7px 10px',marginBottom:3,borderRadius:8,
            border:selGate===g?`2px solid ${GATE_DEFS[g].color}`:'1px solid transparent',
            background:selGate===g?GATE_DEFS[g].bg:'transparent',color:TH.text,cursor:'pointer',
            display:'flex',alignItems:'center',gap:10,fontFamily:'inherit',fontSize:13,transition:'all 0.15s'
          }}>
            <span style={{width:isMobile?26:30,height:isMobile?26:30,borderRadius:6,display:'flex',alignItems:'center',justifyContent:'center',fontWeight:700,fontSize:isMobile?13:14,fontFamily:"'Source Code Pro',monospace",background:GATE_DEFS[g].bg,color:GATE_DEFS[g].color,flexShrink:0,border:`1.5px solid ${GATE_DEFS[g].color}40`}}>{GATE_DEFS[g].label}</span>
            {!isMobile&&<span style={{fontSize:12,color:TH.textMid}}>{GATE_DEFS[g].desc}</span>}
          </button>
        ))}
      </div>
      <div style={{...secLbl,marginTop:isMobile?4:16}}>Multi Qubit</div>
      <div style={isMobile?{display:'flex',flexWrap:'wrap',gap:4,marginBottom:8}:{}}>
        {['CNOT','CZ','SWAP'].map(g=>(
          <button key={g} onClick={()=>selectGate(g)} style={isMobile?{
            padding:'6px 10px',borderRadius:8,border:selGate===g?`2px solid ${GATE_DEFS[g].color}`:`1px solid ${TH.borderLight}`,
            background:selGate===g?GATE_DEFS[g].bg:TH.surface,color:GATE_DEFS[g].color,cursor:'pointer',display:'flex',alignItems:'center',gap:6,
            fontFamily:'inherit',fontSize:13,fontWeight:600
          }:{
            width:'100%',padding:'7px 10px',marginBottom:3,borderRadius:8,
            border:selGate===g?`2px solid ${GATE_DEFS[g].color}`:'1px solid transparent',
            background:selGate===g?GATE_DEFS[g].bg:'transparent',color:TH.text,cursor:'pointer',
            display:'flex',alignItems:'center',gap:10,fontFamily:'inherit',fontSize:13
          }}>
            <span style={{width:isMobile?26:30,height:isMobile?26:30,borderRadius:6,display:'flex',alignItems:'center',justifyContent:'center',fontWeight:700,fontSize:13,fontFamily:"'Source Code Pro',monospace",background:GATE_DEFS[g].bg,color:GATE_DEFS[g].color,flexShrink:0,border:`1.5px solid ${GATE_DEFS[g].color}40`}}>{GATE_DEFS[g].label}</span>
            {!isMobile&&<span style={{fontSize:12,color:TH.textMid}}>{GATE_DEFS[g].desc}</span>}
          </button>
        ))}
      </div>
      <div style={{...secLbl,marginTop:isMobile?4:16}}>Measure</div>
      <div style={isMobile?{display:'flex',gap:4}:{}}>
        <button onClick={()=>selectGate('M')} style={isMobile?{
          padding:'6px 10px',borderRadius:8,border:selGate==='M'?`2px solid ${TH.textMid}`:`1px solid ${TH.borderLight}`,
          background:selGate==='M'?TH.hover:TH.surface,color:TH.textMid,cursor:'pointer',display:'flex',alignItems:'center',gap:6,
          fontFamily:'inherit',fontSize:13,fontWeight:600
        }:{
          width:'100%',padding:'7px 10px',marginBottom:3,borderRadius:8,
          border:selGate==='M'?`2px solid ${TH.textMid}`:'1px solid transparent',
          background:selGate==='M'?TH.hover:'transparent',color:TH.text,cursor:'pointer',
          display:'flex',alignItems:'center',gap:10,fontFamily:'inherit',fontSize:13
        }}>
          <span style={{width:isMobile?26:30,height:isMobile?26:30,borderRadius:6,display:'flex',alignItems:'center',justifyContent:'center',fontWeight:700,fontSize:14,background:'#F1F5F9',color:TH.textMid,flexShrink:0,border:`1.5px solid ${TH.border}`}}>M</span>
          {!isMobile&&<span style={{fontSize:12,color:TH.textMid}}>Measurement</span>}
        </button>
      </div>
      {!isMobile&&<div style={{marginTop:20,padding:12,background:TH.surface,borderRadius:10,fontSize:11.5,color:TH.textMid,lineHeight:1.7,border:`1px solid ${TH.borderLight}`}}>
        <div style={{fontWeight:600,color:TH.text,marginBottom:4,fontSize:12}}>{'\u64CD\u4F5C\u8AAA\u660E'} Usage</div>
        <div>1. {'\u9078\u64C7'} Gate</div><div>2. {'\u9EDE\u64CA\u96FB\u8DEF\u683C\u653E\u7F6E'}</div>
        <div>3. {'\u96D9\u91CF\u5B50\u9598\u9700\u9EDE\u64CA\u5169\u500B'} Qubit</div>
        <div>4. {'\u7121\u9078\u64C7\u6642\u9EDE\u64CA\u53EF\u522A\u9664'}</div>
        <div>5. {'\u6309'} <span style={{color:TH.accent,fontWeight:600}}>{'\u25B6'} Run</span> {'\u57F7\u884C\u6A21\u64EC'}</div>
      </div>}
    </>
  );

  return(
    <div style={{minHeight:'100vh',background:TH.bg,color:TH.text,fontFamily:"'DM Sans','Segoe UI',sans-serif",display:'flex',flexDirection:'column',overflow:'hidden'}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=Source+Code+Pro:wght@400;500;600;700&display=swap');
        *{box-sizing:border-box;margin:0;padding:0;}
        ::-webkit-scrollbar{width:5px;height:5px;}
        ::-webkit-scrollbar-track{background:${TH.bg};}
        ::-webkit-scrollbar-thumb{background:${TH.border};border-radius:3px;}
        button:active{transform:scale(0.97);}
      `}</style>

      {/* === HEADER === */}
      <div style={{padding:isMobile?'10px 12px':'12px 24px',borderBottom:`1px solid ${TH.border}`,display:'flex',alignItems:'center',justifyContent:'space-between',background:TH.surface,flexShrink:0,gap:8,flexWrap:'wrap'}}>
        <div style={{display:'flex',alignItems:'center',gap:8,minWidth:0}}>
          <div style={{width:30,height:30,borderRadius:8,background:'linear-gradient(135deg,#3B82F6,#8B5CF6)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:15,fontWeight:700,color:'#fff',flexShrink:0}}>Q</div>
          <div style={{minWidth:0}}>
            <div style={{fontSize:isMobile?13:15,fontWeight:700,color:TH.text,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>Quantum Circuit Simulator</div>
            {!isMobile&&<div style={{fontSize:11,color:TH.textLight}}>{'\u91CF\u5B50\u96FB\u8DEF\u6A21\u64EC\u5668'}</div>}
          </div>
        </div>
        <div style={{display:'flex',gap:4,alignItems:'center',flexWrap:'wrap'}}>
          <div style={{display:'flex',alignItems:'center',gap:3,padding:'3px 8px',background:TH.bg,borderRadius:6,border:`1px solid ${TH.borderLight}`}}>
            <span style={{fontSize:11,color:TH.textLight,fontWeight:500}}>Q</span>
            <button onClick={rmQ} style={btnC}>{'\u2212'}</button>
            <span style={{fontSize:12,fontWeight:600,color:TH.text,minWidth:14,textAlign:'center'}}>{nq}</span>
            <button onClick={addQ} style={btnC}>+</button>
          </div>
          <div style={{display:'flex',alignItems:'center',gap:3,padding:'3px 8px',background:TH.bg,borderRadius:6,border:`1px solid ${TH.borderLight}`}}>
            <span style={{fontSize:11,color:TH.textLight,fontWeight:500}}>S</span>
            <button onClick={rmS} style={btnC}>{'\u2212'}</button>
            <span style={{fontSize:12,fontWeight:600,color:TH.text,minWidth:18,textAlign:'center'}}>{ns}</span>
            <button onClick={addS} style={btnC}>+</button>
          </div>
          <button onClick={clear} style={{padding:'5px 10px',borderRadius:6,border:`1px solid ${TH.border}`,background:TH.surface,color:TH.textMid,cursor:'pointer',fontSize:11,fontWeight:500,fontFamily:'inherit'}}>Clear</button>
          <button onClick={run} style={{padding:'6px 16px',borderRadius:6,border:'none',cursor:'pointer',background:'linear-gradient(135deg,#0EA5E9,#6366F1)',color:'#fff',fontWeight:600,fontSize:12,fontFamily:'inherit',boxShadow:'0 2px 8px rgba(14,165,233,0.3)'}}>{'\u25B6'} Run</button>
        </div>
      </div>

      {/* === MOBILE: Gate Toggle Bar === */}
      {isMobile&&(
        <div style={{borderBottom:`1px solid ${TH.border}`,background:TH.sidebar,flexShrink:0}}>
          <button onClick={()=>setShowPalette(!showPalette)} style={{width:'100%',padding:'8px 12px',background:'transparent',border:'none',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'space-between',fontFamily:'inherit',fontSize:13,color:TH.text,fontWeight:500}}>
            <span>{selGate?<><span style={{display:'inline-flex',width:22,height:22,borderRadius:4,alignItems:'center',justifyContent:'center',fontWeight:700,fontSize:12,fontFamily:"'Source Code Pro',monospace",background:selGate==='M'?'#F1F5F9':(GATE_DEFS[selGate]?.bg||'#F1F5F9'),color:selGate==='M'?TH.textMid:(GATE_DEFS[selGate]?.color||TH.textMid),marginRight:6,border:`1.5px solid ${selGate==='M'?TH.border:(GATE_DEFS[selGate]?.color||TH.border)}40`,verticalAlign:'middle'}}>{selGate==='M'?'M':(GATE_DEFS[selGate]?.label||selGate)}</span>{selGate==='M'?'Measurement':(GATE_DEFS[selGate]?.desc||selGate)} selected</>:'Select a Gate \u9078\u64C7\u91CF\u5B50\u908F\u8F2F\u9598'}</span>
            <span style={{fontSize:10,color:TH.textLight}}>{showPalette?'\u25B2':'\u25BC'}</span>
          </button>
          {showPalette&&<div style={{padding:'8px 12px 12px',maxHeight:200,overflowY:'auto'}}>{paletteContent}</div>}
        </div>
      )}

      {/* === MOBILE: Pending hint === */}
      {isMobile&&pending&&<div style={{padding:'6px 12px',background:'#FEF3C7',borderBottom:'1px solid #F59E0B',fontSize:12,color:'#92400E',textAlign:'center'}}>
        {'\u8ACB\u9EDE\u64CA\u540C\u4E00'} Step {'\u7684\u53E6\u4E00\u500B'} Qubit
      </div>}

      <div style={{display:'flex',flex:1,overflow:'hidden'}}>
        {/* === DESKTOP SIDEBAR === */}
        {!isMobile&&<div style={{width:180,borderRight:`1px solid ${TH.border}`,padding:'16px 12px',background:TH.sidebar,flexShrink:0,overflowY:'auto'}}>
          {paletteContent}
          {pending&&<div style={{marginTop:10,padding:10,background:'#FEF3C7',border:'1px solid #F59E0B',borderRadius:8,fontSize:12,color:'#92400E',lineHeight:1.5}}>
            {'\u8ACB\u9EDE\u64CA\u540C\u4E00'} Step {'\u7684\u53E6\u4E00\u500B'} Qubit
          </div>}
        </div>}

        {/* === MAIN AREA === */}
        <div style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden'}}>
          <div style={{flex:1,overflow:'auto',padding:isMobile?'12px 8px 8px':'20px 20px 10px',WebkitOverflowScrolling:'touch'}}>
            <div style={{display:'inline-block',minWidth:'100%'}}>
              <div style={{display:'flex',marginLeft:LBL_W+5,marginBottom:4}}>
                {Array.from({length:ns},(_,s)=><div key={s} style={{width:CW,textAlign:'center',fontSize:isMobile?8:10,color:TH.textLight,fontFamily:"'Source Code Pro',monospace",fontWeight:500}}>{s}</div>)}
              </div>
              <div style={{position:'relative'}}>
                {Array.from({length:nq},(_,q)=>(
                  <div key={q} style={{display:'flex',alignItems:'center',height:CH}}>
                    <div style={{width:LBL_W,textAlign:'right',paddingRight:6,fontFamily:"'Source Code Pro',monospace",fontSize:isMobile?11:13,color:TH.textMid,fontWeight:600,flexShrink:0}}>
                      q<sub style={{fontSize:isMobile?8:10}}>{q}</sub> <span style={{color:TH.textLight}}>|0{'\u27E9'}</span>
                    </div>
                    <div style={{display:'flex',position:'relative'}}>
                      <div style={{position:'absolute',top:'50%',left:0,right:0,height:1.5,background:TH.wire,zIndex:0,opacity:0.5}}/>
                      {Array.from({length:ns},(_,s)=>{
                        const isH=hovered&&hovered.q===q&&hovered.s===s;
                        const hasG=!!circ[`${q}-${s}`];
                        const canP=selGate&&!hasG;
                        const isPT=pending&&pending.step===s&&pending.qubit!==q&&!hasG;
                        return(
                          <div key={s} onClick={()=>handleClick(q,s)}
                            onMouseEnter={()=>setHovered({q,s})} onMouseLeave={()=>setHovered(null)}
                            style={{width:CW,height:CH,display:'flex',alignItems:'center',justifyContent:'center',position:'relative',zIndex:1,
                              cursor:canP||isPT||(!selGate&&hasG)?'pointer':'default',
                              background:isPT&&isH?'#3B82F612':isH&&(canP||(!selGate&&hasG))?TH.hover:'transparent',
                              borderRadius:5,transition:'background 0.1s'}}>
                            {renderGate(q,s)}
                            {!hasG&&isH&&selGate&&!pending&&GATE_DEFS[selGate]&&GATE_DEFS[selGate].qubits===1&&(
                              <div style={{width:isMobile?36:42,height:isMobile?36:42,borderRadius:7,border:`2px dashed ${GATE_DEFS[selGate].color}50`,display:'flex',alignItems:'center',justifyContent:'center',color:GATE_DEFS[selGate].color+'50',fontWeight:700,fontSize:isMobile?13:16,fontFamily:"'Source Code Pro',monospace"}}>{GATE_DEFS[selGate].label}</div>
                            )}
                            {!hasG&&isH&&selGate==='M'&&!pending&&(
                              <div style={{width:isMobile?36:42,height:isMobile?36:42,borderRadius:7,border:`2px dashed ${TH.textLight}`,display:'flex',alignItems:'center',justifyContent:'center',color:TH.textLight,fontWeight:700,fontSize:13}}>M</div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
                {/* Vertical lines */}
                {Array.from({length:ns},(_,s)=>{const cn=getConns(s);return cn.map((c,ci)=>{
                  const t=Math.min(c.from,c.to)*CH+CH/2,b=Math.max(c.from,c.to)*CH+CH/2;
                  return <div key={`${s}-${ci}`} style={{position:'absolute',left:LBL_W+5+s*CW+CW/2-1,top:t,width:2.5,height:b-t,background:c.color,zIndex:2,pointerEvents:'none',borderRadius:1}}/>;
                });})}
                {pending&&hovered&&hovered.s===pending.step&&hovered.q!==pending.qubit&&(()=>{
                  const t=Math.min(pending.qubit,hovered.q)*CH+CH/2,b=Math.max(pending.qubit,hovered.q)*CH+CH/2;
                  const gc=GATE_DEFS[pending.gate]?GATE_DEFS[pending.gate].color:'#666';
                  return <div style={{position:'absolute',left:LBL_W+5+pending.step*CW+CW/2-1,top:t,width:2.5,height:b-t,background:gc+'50',zIndex:2,pointerEvents:'none',borderRadius:1}}/>;
                })()}
              </div>
            </div>
          </div>

          {/* === RESULTS === */}
          <div style={{borderTop:`1px solid ${TH.border}`,background:TH.surface,padding:isMobile?'10px 12px':'14px 24px',flexShrink:0,minHeight:results?(isMobile?220:270):44,transition:'min-height 0.3s'}}>
            {!results?(
              <div style={{fontSize:isMobile?12:13,color:TH.textLight,textAlign:'center',padding:6}}>
                {'\u6309'} <span style={{color:TH.accent,fontWeight:600}}>{'\u25B6'} Run</span> {'\u57F7\u884C\u6A21\u64EC'} / Press Run to simulate
              </div>
            ):(
              <div>
                <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:8,flexWrap:'wrap',gap:6}}>
                  <div style={{fontSize:isMobile?12:14,fontWeight:600,color:TH.text}}>
                    Probabilities <span style={{color:TH.textLight,fontWeight:400,fontSize:11}}>{'\u2014 \u91CF\u6E2C\u6A5F\u7387'}</span>
                  </div>
                  <button onClick={()=>setShowSv(!showSv)} style={{padding:'3px 10px',borderRadius:5,border:`1px solid ${TH.border}`,background:showSv?TH.accentBg:TH.bg,color:showSv?TH.accent:TH.textMid,cursor:'pointer',fontSize:10,fontWeight:500,fontFamily:'inherit'}}>
                    {showSv?'\u25BE Hide':'\u25B8 Show'} State
                  </button>
                </div>
                <div style={{height:isMobile?130:165}}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} margin={{top:5,right:5,bottom:5,left:0}}>
                      <XAxis dataKey="state" tick={{fontSize:nq>4?8:(isMobile?9:11),fill:TH.textMid,fontFamily:"'Source Code Pro',monospace"}} interval={0} angle={nq>4?-45:0} textAnchor={nq>4?"end":"middle"} height={nq>4?45:28}/>
                      <YAxis tick={{fontSize:9,fill:TH.textLight}} domain={[0,1]} tickFormatter={v=>`${(v*100).toFixed(0)}%`} width={35}/>
                      <Tooltip contentStyle={{background:TH.surface,border:`1px solid ${TH.border}`,borderRadius:6,fontSize:11,fontFamily:"'Source Code Pro',monospace",boxShadow:'0 4px 12px rgba(0,0,0,0.08)'}} formatter={(v)=>[`${(v*100).toFixed(2)}%`,'P']}/>
                      <Bar dataKey="probability" radius={[3,3,0,0]} maxBarSize={isMobile?30:42}>
                        {chartData.map((e,i)=><Cell key={i} fill={e.probability>0.5?'#3B82F6':e.probability>0.1?'#6366F1':'#8B5CF6'} fillOpacity={0.82}/>)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                {showSv&&sv&&(
                  <div style={{marginTop:8,padding:10,background:TH.bg,borderRadius:6,maxHeight:isMobile?100:130,overflowY:'auto',fontFamily:"'Source Code Pro',monospace",fontSize:isMobile?10:12,border:`1px solid ${TH.borderLight}`}}>
                    {sv.map((amp,i)=>{const p=cAbs2(amp);if(p<0.0001)return null;
                      return(<div key={i} style={{display:'flex',gap:isMobile?8:14,padding:'2px 0',color:TH.textMid}}>
                        <span style={{color:'#3B82F6',minWidth:isMobile?50:65,fontWeight:600}}>{basisLabel(i,nq)}</span>
                        <span style={{color:TH.text}}>{amp[0].toFixed(3)}{parseFloat(amp[1].toFixed(3))>=0?'+':''}{amp[1].toFixed(3)}i</span>
                        <span style={{color:TH.textLight}}>{(p*100).toFixed(1)}%</span>
                      </div>);
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

const btnC={width:20,height:20,borderRadius:4,border:'1px solid #D8DEE9',background:'#FFF',color:'#475569',cursor:'pointer',fontSize:13,fontFamily:'inherit',display:'flex',alignItems:'center',justifyContent:'center',lineHeight:1,fontWeight:500};
const secLbl={fontSize:10,fontWeight:600,color:'#94A3B8',textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:6};
