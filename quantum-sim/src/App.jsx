import { useState, useCallback, useMemo, useRef } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";

const cMul = (a, b) => [a[0]*b[0] - a[1]*b[1], a[0]*b[1] + a[1]*b[0]];
const cAdd = (a, b) => [a[0] + b[0], a[1] + b[1]];
const cAbs2 = (a) => a[0]*a[0] + a[1]*a[1];
const S2 = 1 / Math.sqrt(2);

const TH = {
  bg: '#F4F6FB', surface: '#FFFFFF', sidebar: '#EEF1F8',
  border: '#D8DEE9', borderLight: '#E8ECF4',
  text: '#1E293B', textMid: '#475569', textLight: '#94A3B8', textFaint: '#CBD5E1',
  wire: '#B0BEC5', accent: '#3B82F6', accentBg: '#EFF6FF',
  run: '#0EA5E9', hover: '#F1F5F9',
};

const GATE_DEFS = {
  I:  { matrix: [[[1,0],[0,0]],[[0,0],[1,0]]], label: 'I', color: '#94A3B8', bg: '#F1F5F9', desc: 'Identity', qubits: 1 },
  H:  { matrix: [[[S2,0],[S2,0]],[[S2,0],[-S2,0]]], label: 'H', color: '#D97706', bg: '#FFFBEB', desc: 'Hadamard', qubits: 1 },
  X:  { matrix: [[[0,0],[1,0]],[[1,0],[0,0]]], label: 'X', color: '#DC2626', bg: '#FEF2F2', desc: 'Pauli-X (NOT)', qubits: 1 },
  Y:  { matrix: [[[0,0],[0,-1]],[[0,1],[0,0]]], label: 'Y', color: '#059669', bg: '#ECFDF5', desc: 'Pauli-Y', qubits: 1 },
  Z:  { matrix: [[[1,0],[0,0]],[[0,0],[-1,0]]], label: 'Z', color: '#2563EB', bg: '#EFF6FF', desc: 'Pauli-Z', qubits: 1 },
  S:  { matrix: [[[1,0],[0,0]],[[0,0],[0,1]]], label: 'S', color: '#7C3AED', bg: '#F5F3FF', desc: 'Phase (S)', qubits: 1 },
  T:  { matrix: [[[1,0],[0,0]],[[0,0],[Math.cos(Math.PI/4), Math.sin(Math.PI/4)]]], label: 'T', color: '#0D9488', bg: '#F0FDFA', desc: 'π/8 Gate', qubits: 1 },
  CNOT: { label: 'CX', color: '#DC2626', bg: '#FEF2F2', desc: 'Controlled-X', qubits: 2 },
  CZ:   { label: 'CZ', color: '#2563EB', bg: '#EFF6FF', desc: 'Controlled-Z', qubits: 2 },
  SWAP: { label: 'SW', color: '#D97706', bg: '#FFFBEB', desc: 'SWAP', qubits: 2 },
};

function applySingleGate(state, matrix, qubit, n) {
  const dim = 1 << n; const newState = state.map(a => [...a]); const mask = 1 << qubit;
  for (let i = 0; i < dim; i++) {
    if ((i & mask) !== 0) continue; const j = i | mask;
    const a0 = state[i]; const a1 = state[j];
    newState[i] = cAdd(cMul(matrix[0][0], a0), cMul(matrix[0][1], a1));
    newState[j] = cAdd(cMul(matrix[1][0], a0), cMul(matrix[1][1], a1));
  }
  return newState;
}
function applyCNOT(state, control, target, n) {
  const dim = 1 << n; const newState = state.map(a => [...a]);
  for (let i = 0; i < dim; i++) {
    if (((i >> control) & 1) === 1 && ((i >> target) & 1) === 0) {
      const j = i ^ (1 << target); newState[i] = [...state[j]]; newState[j] = [...state[i]];
    }
  }
  return newState;
}
function applyCZ(state, control, target, n) {
  const dim = 1 << n; const newState = state.map(a => [...a]);
  for (let i = 0; i < dim; i++) {
    if (((i >> control) & 1) === 1 && ((i >> target) & 1) === 1) newState[i] = [-state[i][0], -state[i][1]];
  }
  return newState;
}
function applySWAP(state, q1, q2, n) {
  const dim = 1 << n; const newState = state.map(a => [...a]);
  for (let i = 0; i < dim; i++) {
    const b1 = (i >> q1) & 1; const b2 = (i >> q2) & 1;
    if (b1 !== b2) { const j = i ^ (1 << q1) ^ (1 << q2); if (i < j) { newState[i] = [...state[j]]; newState[j] = [...state[i]]; } }
  }
  return newState;
}
function simulate(numQubits, circuit, numSteps) {
  const dim = 1 << numQubits;
  let state = Array.from({ length: dim }, (_, i) => (i === 0 ? [1, 0] : [0, 0]));
  for (let step = 0; step < numSteps; step++) {
    const processed = new Set();
    for (let q = 0; q < numQubits; q++) {
      const key = `${q}-${step}`; if (processed.has(key)) continue;
      const gate = circuit[key]; if (!gate) continue;
      if (gate.type === 'CNOT_CTRL') { state = applyCNOT(state, q, gate.target, numQubits); processed.add(`${gate.target}-${step}`); }
      else if (gate.type === 'CZ_CTRL') { state = applyCZ(state, q, gate.target, numQubits); processed.add(`${gate.target}-${step}`); }
      else if (gate.type === 'SWAP_A') { state = applySWAP(state, q, gate.partner, numQubits); processed.add(`${gate.partner}-${step}`); }
      else if (['M','CNOT_TGT','CZ_TGT','SWAP_B'].includes(gate.type)) { continue; }
      else if (GATE_DEFS[gate.type]) { state = applySingleGate(state, GATE_DEFS[gate.type].matrix, q, numQubits); }
      processed.add(key);
    }
  }
  return state.map(a => cAbs2(a));
}
function basisLabel(index, n) { return '|' + index.toString(2).padStart(n, '0') + '\u27E9'; }

export default function QuantumCircuitSimulator() {
  const [numQubits, setNumQubits] = useState(2);
  const [numSteps, setNumSteps] = useState(10);
  const [circuit, setCircuit] = useState({});
  const [selectedGate, setSelectedGate] = useState(null);
  const [results, setResults] = useState(null);
  const [pendingMulti, setPendingMulti] = useState(null);
  const [hoveredCell, setHoveredCell] = useState(null);
  const [stateVector, setStateVector] = useState(null);
  const [showStateVec, setShowStateVec] = useState(false);

  const maxQubits = 8;
  const addQubit = () => { if (numQubits < maxQubits) { setNumQubits(n => n + 1); setResults(null); } };
  const removeQubit = () => {
    if (numQubits > 1) {
      const newN = numQubits - 1; const nc = {};
      Object.entries(circuit).forEach(([k, v]) => {
        const q = parseInt(k.split('-')[0]);
        if (q < newN && (v.target === undefined || v.target < newN) && (v.partner === undefined || v.partner < newN)) nc[k] = v;
      });
      setCircuit(nc); setNumQubits(newN); setResults(null);
    }
  };
  const addStep = () => setNumSteps(s => Math.min(s + 1, 30));
  const removeStep = () => {
    if (numSteps > 1) { const newS = numSteps - 1; const nc = {};
      Object.entries(circuit).forEach(([k, v]) => { if (parseInt(k.split('-')[1]) < newS) nc[k] = v; });
      setCircuit(nc); setNumSteps(newS);
    }
  };
  const clearCircuit = () => { setCircuit({}); setResults(null); setPendingMulti(null); setStateVector(null); };

  const handleCellClick = (qubit, step) => {
    if (!selectedGate) {
      const key = `${qubit}-${step}`; const existing = circuit[key];
      if (existing) {
        const nc = { ...circuit }; delete nc[key];
        if (existing.type === 'CNOT_CTRL') delete nc[`${existing.target}-${step}`];
        if (existing.type === 'CNOT_TGT') delete nc[`${existing.control}-${step}`];
        if (existing.type === 'CZ_CTRL') delete nc[`${existing.target}-${step}`];
        if (existing.type === 'CZ_TGT') delete nc[`${existing.control}-${step}`];
        if (existing.type === 'SWAP_A') delete nc[`${existing.partner}-${step}`];
        if (existing.type === 'SWAP_B') delete nc[`${existing.partner}-${step}`];
        setCircuit(nc); setResults(null);
      }
      return;
    }
    if (selectedGate === 'M' && !pendingMulti) {
      const key = `${qubit}-${step}`; if (circuit[key]) return;
      setCircuit({ ...circuit, [key]: { type: 'M' } }); setResults(null); return;
    }
    const gateInfo = GATE_DEFS[selectedGate]; if (!gateInfo) return;
    if (pendingMulti) {
      if (step !== pendingMulti.step || qubit === pendingMulti.qubit) { setPendingMulti(null); return; }
      const key1 = `${pendingMulti.qubit}-${step}`; const key2 = `${qubit}-${step}`;
      if (circuit[key2]) { setPendingMulti(null); return; }
      const nc = { ...circuit };
      if (pendingMulti.gate === 'CNOT') { nc[key1] = { type: 'CNOT_CTRL', target: qubit }; nc[key2] = { type: 'CNOT_TGT', control: pendingMulti.qubit }; }
      else if (pendingMulti.gate === 'CZ') { nc[key1] = { type: 'CZ_CTRL', target: qubit }; nc[key2] = { type: 'CZ_TGT', control: pendingMulti.qubit }; }
      else if (pendingMulti.gate === 'SWAP') { nc[key1] = { type: 'SWAP_A', partner: qubit }; nc[key2] = { type: 'SWAP_B', partner: pendingMulti.qubit }; }
      setCircuit(nc); setPendingMulti(null); setResults(null); return;
    }
    const key = `${qubit}-${step}`; if (circuit[key]) return;
    if (gateInfo.qubits === 2) { setPendingMulti({ gate: selectedGate, qubit, step }); return; }
    setCircuit({ ...circuit, [key]: { type: selectedGate } }); setResults(null);
  };

  const runSimulation = () => {
    const probs = simulate(numQubits, circuit, numSteps); setResults(probs);
    const dim = 1 << numQubits;
    let state = Array.from({ length: dim }, (_, i) => (i === 0 ? [1, 0] : [0, 0]));
    for (let step = 0; step < numSteps; step++) {
      const processed = new Set();
      for (let q = 0; q < numQubits; q++) {
        const k = `${q}-${step}`; if (processed.has(k)) continue;
        const gate = circuit[k]; if (!gate) continue;
        if (gate.type === 'CNOT_CTRL') { state = applyCNOT(state, q, gate.target, numQubits); processed.add(`${gate.target}-${step}`); }
        else if (gate.type === 'CZ_CTRL') { state = applyCZ(state, q, gate.target, numQubits); processed.add(`${gate.target}-${step}`); }
        else if (gate.type === 'SWAP_A') { state = applySWAP(state, q, gate.partner, numQubits); processed.add(`${gate.partner}-${step}`); }
        else if (!['M','CNOT_TGT','CZ_TGT','SWAP_B'].includes(gate.type) && GATE_DEFS[gate.type]) { state = applySingleGate(state, GATE_DEFS[gate.type].matrix, q, numQubits); }
        processed.add(k);
      }
    }
    setStateVector(state);
  };

  const chartData = useMemo(() => {
    if (!results) return [];
    return results.map((p, i) => ({ state: basisLabel(i, numQubits), probability: Math.round(p * 10000) / 10000 })).filter(d => d.probability > 0.0001);
  }, [results, numQubits]);

  const renderGate = (qubit, step) => {
    const key = `${qubit}-${step}`; const gate = circuit[key]; if (!gate) return null; const t = gate.type;
    if (t === 'CNOT_CTRL') return <div style={{ width: 14, height: 14, borderRadius: '50%', background: GATE_DEFS.CNOT.color, boxShadow: `0 0 0 2px ${TH.surface}` }} />;
    if (t === 'CNOT_TGT') return <div style={{ width: 24, height: 24, borderRadius: '50%', border: `2.5px solid ${GATE_DEFS.CNOT.color}`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: GATE_DEFS.CNOT.color, fontSize: 16, fontWeight: 'bold', background: TH.surface }}>{'\u2295'}</div>;
    if (t === 'CZ_CTRL' || t === 'CZ_TGT') return <div style={{ width: 14, height: 14, borderRadius: '50%', background: GATE_DEFS.CZ.color, boxShadow: `0 0 0 2px ${TH.surface}` }} />;
    if (t === 'SWAP_A' || t === 'SWAP_B') return <div style={{ fontSize: 18, color: GATE_DEFS.SWAP.color, fontWeight: 'bold' }}>{'\u2715'}</div>;
    if (t === 'M') return (
      <div style={{ width: 42, height: 42, borderRadius: 8, background: TH.surface, border: `2px solid ${TH.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
        <div style={{ width: 18, height: 10, borderBottom: `2px solid ${TH.textMid}`, borderRadius: '0 0 50% 50%', marginTop: 3, transform: 'rotate(180deg)' }} />
        <div style={{ fontSize: 9, color: TH.textMid, marginTop: 2, fontWeight: 600 }}>M</div>
      </div>
    );
    const def = GATE_DEFS[t]; if (!def) return null;
    return (
      <div style={{ width: 42, height: 42, borderRadius: 8, background: def.bg, border: `2px solid ${def.color}`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: def.color, fontWeight: 700, fontSize: 16, fontFamily: "'Source Code Pro', monospace", boxShadow: '0 1px 3px rgba(0,0,0,0.06)', transition: 'all 0.15s ease' }}>
        {def.label}
      </div>
    );
  };

  const getMultiQubitConnections = (step) => {
    const connections = [];
    for (let q = 0; q < numQubits; q++) {
      const gate = circuit[`${q}-${step}`];
      if (gate && gate.type === 'CNOT_CTRL') connections.push({ from: q, to: gate.target, color: GATE_DEFS.CNOT.color });
      if (gate && gate.type === 'CZ_CTRL') connections.push({ from: q, to: gate.target, color: GATE_DEFS.CZ.color });
      if (gate && gate.type === 'SWAP_A') connections.push({ from: q, to: gate.partner, color: GATE_DEFS.SWAP.color });
    }
    return connections;
  };

  const CELL_H = 58; const CELL_W = 58;
  const isPending = pendingMulti !== null;

  return (
    <div style={{ minHeight: '100vh', background: TH.bg, color: TH.text, fontFamily: "'DM Sans', 'Segoe UI', sans-serif", display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,wght@0,300;0,400;0,500;0,600;0,700;1,400&family=Source+Code+Pro:wght@400;500;600;700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        ::-webkit-scrollbar { width: 6px; height: 6px; }
        ::-webkit-scrollbar-track { background: ${TH.bg}; }
        ::-webkit-scrollbar-thumb { background: ${TH.border}; border-radius: 3px; }
        button:hover { filter: brightness(0.96); }
      `}</style>

      {/* Header */}
      <div style={{ padding: '12px 24px', borderBottom: `1px solid ${TH.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: TH.surface, flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 34, height: 34, borderRadius: 10, background: 'linear-gradient(135deg, #3B82F6 0%, #8B5CF6 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 17, fontWeight: 700, color: '#fff' }}>Q</div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: TH.text }}>Quantum Circuit Simulator</div>
            <div style={{ fontSize: 11, color: TH.textLight, fontWeight: 400 }}>{'\u91CF\u5B50\u96FB\u8DEF\u6A21\u64EC\u5668'} — Interactive Composer</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px', background: TH.bg, borderRadius: 8, border: `1px solid ${TH.borderLight}` }}>
            <span style={{ fontSize: 12, color: TH.textLight, fontWeight: 500 }}>Qubits</span>
            <button onClick={removeQubit} style={btnCtrl}>{'\u2212'}</button>
            <span style={{ fontSize: 13, fontWeight: 600, color: TH.text, minWidth: 16, textAlign: 'center' }}>{numQubits}</span>
            <button onClick={addQubit} style={btnCtrl}>+</button>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px', background: TH.bg, borderRadius: 8, border: `1px solid ${TH.borderLight}` }}>
            <span style={{ fontSize: 12, color: TH.textLight, fontWeight: 500 }}>Steps</span>
            <button onClick={removeStep} style={btnCtrl}>{'\u2212'}</button>
            <span style={{ fontSize: 13, fontWeight: 600, color: TH.text, minWidth: 20, textAlign: 'center' }}>{numSteps}</span>
            <button onClick={addStep} style={btnCtrl}>+</button>
          </div>
          <button onClick={clearCircuit} style={{ padding: '6px 14px', borderRadius: 8, border: `1px solid ${TH.border}`, background: TH.surface, color: TH.textMid, cursor: 'pointer', fontSize: 12, fontWeight: 500, fontFamily: 'inherit' }}>Clear</button>
          <button onClick={runSimulation} style={{ padding: '7px 22px', borderRadius: 8, border: 'none', cursor: 'pointer', background: 'linear-gradient(135deg, #0EA5E9 0%, #6366F1 100%)', color: '#fff', fontWeight: 600, fontSize: 13, fontFamily: 'inherit', boxShadow: '0 2px 8px rgba(14,165,233,0.3)' }}>{'\u25B6'} Run</button>
        </div>
      </div>

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Sidebar */}
        <div style={{ width: 190, borderRight: `1px solid ${TH.border}`, padding: '16px 12px', background: TH.sidebar, flexShrink: 0, overflowY: 'auto' }}>
          <div style={sectionLabel}>Single Qubit {'\u55AE\u91CF\u5B50\u4F4D\u5143'}</div>
          {['I','H','X','Y','Z','S','T'].map(g => (
            <button key={g} onClick={() => { setSelectedGate(selectedGate === g ? null : g); setPendingMulti(null); }}
              style={{ width: '100%', padding: '7px 10px', marginBottom: 3, borderRadius: 8, border: selectedGate === g ? `2px solid ${GATE_DEFS[g].color}` : '1px solid transparent', background: selectedGate === g ? GATE_DEFS[g].bg : 'transparent', color: TH.text, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10, fontFamily: 'inherit', fontSize: 13, transition: 'all 0.15s' }}>
              <span style={{ width: 30, height: 30, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 14, fontFamily: "'Source Code Pro', monospace", background: GATE_DEFS[g].bg, color: GATE_DEFS[g].color, flexShrink: 0, border: `1.5px solid ${GATE_DEFS[g].color}40` }}>{GATE_DEFS[g].label}</span>
              <span style={{ fontSize: 12, color: TH.textMid }}>{GATE_DEFS[g].desc}</span>
            </button>
          ))}

          <div style={{ ...sectionLabel, marginTop: 16 }}>Multi Qubit {'\u591A\u91CF\u5B50\u4F4D\u5143'}</div>
          {['CNOT','CZ','SWAP'].map(g => (
            <button key={g} onClick={() => { setSelectedGate(selectedGate === g ? null : g); setPendingMulti(null); }}
              style={{ width: '100%', padding: '7px 10px', marginBottom: 3, borderRadius: 8, border: selectedGate === g ? `2px solid ${GATE_DEFS[g].color}` : '1px solid transparent', background: selectedGate === g ? GATE_DEFS[g].bg : 'transparent', color: TH.text, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10, fontFamily: 'inherit', fontSize: 13, transition: 'all 0.15s' }}>
              <span style={{ width: 30, height: 30, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 13, fontFamily: "'Source Code Pro', monospace", background: GATE_DEFS[g].bg, color: GATE_DEFS[g].color, flexShrink: 0, border: `1.5px solid ${GATE_DEFS[g].color}40` }}>{GATE_DEFS[g].label}</span>
              <span style={{ fontSize: 12, color: TH.textMid }}>{GATE_DEFS[g].desc}</span>
            </button>
          ))}

          <div style={{ ...sectionLabel, marginTop: 16 }}>Measure {'\u91CF\u6E2C'}</div>
          <button onClick={() => { setSelectedGate(selectedGate === 'M' ? null : 'M'); setPendingMulti(null); }}
            style={{ width: '100%', padding: '7px 10px', marginBottom: 3, borderRadius: 8, border: selectedGate === 'M' ? `2px solid ${TH.textMid}` : '1px solid transparent', background: selectedGate === 'M' ? TH.hover : 'transparent', color: TH.text, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10, fontFamily: 'inherit', fontSize: 13 }}>
            <span style={{ width: 30, height: 30, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 14, background: '#F1F5F9', color: TH.textMid, flexShrink: 0, border: `1.5px solid ${TH.border}` }}>M</span>
            <span style={{ fontSize: 12, color: TH.textMid }}>Measurement</span>
          </button>

          <div style={{ marginTop: 20, padding: 12, background: TH.surface, borderRadius: 10, fontSize: 11.5, color: TH.textMid, lineHeight: 1.7, border: `1px solid ${TH.borderLight}` }}>
            <div style={{ fontWeight: 600, color: TH.text, marginBottom: 4, fontSize: 12 }}>{'\u64CD\u4F5C\u8AAA\u660E'} Usage</div>
            <div>1. {'\u9078\u64C7'} Gate{'\uFF08\u5DE6\u5074\u9762\u677F\uFF09'}</div>
            <div>2. {'\u9EDE\u64CA\u96FB\u8DEF\u683C\u653E\u7F6E'}</div>
            <div>3. {'\u96D9\u91CF\u5B50\u9596\u9700\u9EDE\u64CA\u5169\u500B'} Qubit</div>
            <div>4. {'\u7121\u9078\u64C7\u6642\u9EDE\u64CA\u53EF\u522A\u9664'}</div>
            <div>5. {'\u6309'} <span style={{ color: TH.accent, fontWeight: 600 }}>{'\u25B6'} Run</span> {'\u57F7\u884C\u6A21\u64EC'}</div>
          </div>

          {isPending && (
            <div style={{ marginTop: 10, padding: 10, background: '#FEF3C7', border: '1px solid #F59E0B', borderRadius: 8, fontSize: 12, color: '#92400E', lineHeight: 1.5 }}>
              {'\u8ACB\u9EDE\u64CA\u540C\u4E00'} Step {'\u7684\u53E6\u4E00\u500B'} Qubit {'\u4F5C\u70BA'} {pendingMulti.gate === 'CNOT' ? 'target' : pendingMulti.gate === 'SWAP' ? 'swap partner' : 'target'}
            </div>
          )}
        </div>

        {/* Main Area */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ flex: 1, overflow: 'auto', padding: '20px 20px 10px' }}>
            <div style={{ display: 'inline-block', minWidth: '100%' }}>
              <div style={{ display: 'flex', marginLeft: 68, marginBottom: 4 }}>
                {Array.from({ length: numSteps }, (_, s) => (
                  <div key={s} style={{ width: CELL_W, textAlign: 'center', fontSize: 10, color: TH.textLight, fontFamily: "'Source Code Pro', monospace", fontWeight: 500 }}>{s}</div>
                ))}
              </div>
              <div style={{ position: 'relative' }}>
                {Array.from({ length: numQubits }, (_, q) => (
                  <div key={q} style={{ display: 'flex', alignItems: 'center', height: CELL_H }}>
                    <div style={{ width: 63, textAlign: 'right', paddingRight: 8, fontFamily: "'Source Code Pro', monospace", fontSize: 13, color: TH.textMid, fontWeight: 600, flexShrink: 0 }}>
                      q<sub style={{ fontSize: 10 }}>{q}</sub> <span style={{ color: TH.textLight }}>|0{'\u27E9'}</span>
                    </div>
                    <div style={{ display: 'flex', position: 'relative' }}>
                      <div style={{ position: 'absolute', top: '50%', left: 0, right: 0, height: 1.5, background: TH.wire, zIndex: 0, opacity: 0.5 }} />
                      {Array.from({ length: numSteps }, (_, s) => {
                        const isHovered = hoveredCell && hoveredCell.q === q && hoveredCell.s === s;
                        const isPendingCell = pendingMulti && pendingMulti.qubit === q && pendingMulti.step === s;
                        const hasGate = !!circuit[`${q}-${s}`];
                        const canPlace = selectedGate && !hasGate;
                        const isPendingTarget = pendingMulti && pendingMulti.step === s && pendingMulti.qubit !== q && !hasGate;
                        return (
                          <div key={s} onClick={() => handleCellClick(q, s)}
                            onMouseEnter={() => setHoveredCell({ q, s })} onMouseLeave={() => setHoveredCell(null)}
                            style={{ width: CELL_W, height: CELL_H, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', zIndex: 1,
                              cursor: canPlace || isPendingTarget || (!selectedGate && hasGate) ? 'pointer' : 'default',
                              background: isPendingCell ? '#FEF3C720' : isPendingTarget && isHovered ? '#3B82F612' : isHovered && (canPlace || (!selectedGate && hasGate)) ? TH.hover : 'transparent',
                              borderRadius: 6, transition: 'background 0.1s' }}>
                            {renderGate(q, s)}
                            {!hasGate && isHovered && selectedGate && !isPending && GATE_DEFS[selectedGate] && GATE_DEFS[selectedGate].qubits === 1 && (
                              <div style={{ width: 42, height: 42, borderRadius: 8, border: `2px dashed ${GATE_DEFS[selectedGate].color}50`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: GATE_DEFS[selectedGate].color + '50', fontWeight: 700, fontSize: 16, fontFamily: "'Source Code Pro', monospace" }}>{GATE_DEFS[selectedGate].label}</div>
                            )}
                            {!hasGate && isHovered && selectedGate === 'M' && !isPending && (
                              <div style={{ width: 42, height: 42, borderRadius: 8, border: `2px dashed ${TH.textLight}`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: TH.textLight, fontWeight: 700, fontSize: 14 }}>M</div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
                {Array.from({ length: numSteps }, (_, s) => {
                  const conns = getMultiQubitConnections(s);
                  return conns.map((c, ci) => {
                    const top = Math.min(c.from, c.to) * CELL_H + CELL_H / 2;
                    const bottom = Math.max(c.from, c.to) * CELL_H + CELL_H / 2;
                    return <div key={`${s}-${ci}`} style={{ position: 'absolute', left: 68 + s * CELL_W + CELL_W / 2 - 1, top, width: 2.5, height: bottom - top, background: c.color, zIndex: 2, pointerEvents: 'none', borderRadius: 1 }} />;
                  });
                })}
                {pendingMulti && hoveredCell && hoveredCell.s === pendingMulti.step && hoveredCell.q !== pendingMulti.qubit && (() => {
                  const top = Math.min(pendingMulti.qubit, hoveredCell.q) * CELL_H + CELL_H / 2;
                  const bottom = Math.max(pendingMulti.qubit, hoveredCell.q) * CELL_H + CELL_H / 2;
                  const gc = GATE_DEFS[pendingMulti.gate] ? GATE_DEFS[pendingMulti.gate].color : '#666';
                  return <div style={{ position: 'absolute', left: 68 + pendingMulti.step * CELL_W + CELL_W / 2 - 1, top, width: 2.5, height: bottom - top, background: gc + '50', zIndex: 2, pointerEvents: 'none', borderRadius: 1 }} />;
                })()}
              </div>
            </div>
          </div>

          {/* Results */}
          <div style={{ borderTop: `1px solid ${TH.border}`, background: TH.surface, padding: '14px 24px', flexShrink: 0, minHeight: results ? 270 : 50, transition: 'min-height 0.3s' }}>
            {!results ? (
              <div style={{ fontSize: 13, color: TH.textLight, textAlign: 'center', padding: 8 }}>
                {'\u6309\u4E0B'} <span style={{ color: TH.accent, fontWeight: 600 }}>{'\u25B6'} Run</span> {'\u57F7\u884C\u6A21\u64EC\uFF0C\u67E5\u770B\u91CF\u6E2C\u7D50\u679C'} / Press Run to simulate
              </div>
            ) : (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: TH.text }}>
                    Measurement Probabilities <span style={{ color: TH.textLight, fontWeight: 400, fontSize: 12 }}>{'\u2014 \u91CF\u6E2C\u6A5F\u7387\u5206\u4F48'}</span>
                  </div>
                  <button onClick={() => setShowStateVec(!showStateVec)} style={{ padding: '4px 12px', borderRadius: 6, border: `1px solid ${TH.border}`, background: showStateVec ? TH.accentBg : TH.bg, color: showStateVec ? TH.accent : TH.textMid, cursor: 'pointer', fontSize: 11, fontWeight: 500, fontFamily: 'inherit' }}>
                    {showStateVec ? '\u25BE Hide' : '\u25B8 Show'} Statevector
                  </button>
                </div>
                <div style={{ height: 165 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
                      <XAxis dataKey="state" tick={{ fontSize: numQubits > 4 ? 9 : 11, fill: TH.textMid, fontFamily: "'Source Code Pro', monospace" }} interval={0} angle={numQubits > 5 ? -45 : 0} textAnchor={numQubits > 5 ? "end" : "middle"} height={numQubits > 5 ? 50 : 30} />
                      <YAxis tick={{ fontSize: 10, fill: TH.textLight }} domain={[0, 1]} tickFormatter={v => `${(v*100).toFixed(0)}%`} width={40} />
                      <Tooltip contentStyle={{ background: TH.surface, border: `1px solid ${TH.border}`, borderRadius: 8, fontSize: 12, fontFamily: "'Source Code Pro', monospace", boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }} labelStyle={{ color: TH.text }} formatter={(value) => [`${(value * 100).toFixed(2)}%`, 'Probability']} />
                      <Bar dataKey="probability" radius={[4, 4, 0, 0]} maxBarSize={42}>
                        {chartData.map((entry, index) => (
                          <Cell key={index} fill={entry.probability > 0.5 ? '#3B82F6' : entry.probability > 0.1 ? '#6366F1' : '#8B5CF6'} fillOpacity={0.82} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                {showStateVec && stateVector && (
                  <div style={{ marginTop: 10, padding: 12, background: TH.bg, borderRadius: 8, maxHeight: 130, overflowY: 'auto', fontFamily: "'Source Code Pro', monospace", fontSize: 12, border: `1px solid ${TH.borderLight}` }}>
                    {stateVector.map((amp, i) => {
                      const prob = cAbs2(amp); if (prob < 0.0001) return null;
                      const re = amp[0].toFixed(4); const im = amp[1].toFixed(4);
                      return (
                        <div key={i} style={{ display: 'flex', gap: 14, padding: '3px 0', color: TH.textMid }}>
                          <span style={{ color: '#3B82F6', minWidth: 65, fontWeight: 600 }}>{basisLabel(i, numQubits)}</span>
                          <span style={{ color: TH.text }}>{re}{parseFloat(im) >= 0 ? '+' : ''}{im}i</span>
                          <span style={{ color: TH.textLight }}>P = {(prob * 100).toFixed(2)}%</span>
                        </div>
                      );
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

const btnCtrl = {
  width: 22, height: 22, borderRadius: 5, border: '1px solid #D8DEE9',
  background: '#FFFFFF', color: '#475569', cursor: 'pointer', fontSize: 14,
  fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center',
  lineHeight: 1, fontWeight: 500, transition: 'all 0.15s',
};

const sectionLabel = {
  fontSize: 10, fontWeight: 600, color: '#94A3B8', textTransform: 'uppercase',
  letterSpacing: '0.08em', marginBottom: 8
};
