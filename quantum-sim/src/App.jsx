import { useState, useCallback, useMemo, useRef } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";

/* ========== Complex Number Arithmetic ========== */
const cMul = (a, b) => [a[0]*b[0] - a[1]*b[1], a[0]*b[1] + a[1]*b[0]];
const cAdd = (a, b) => [a[0] + b[0], a[1] + b[1]];
const cAbs2 = (a) => a[0]*a[0] + a[1]*a[1];
const S2 = 1 / Math.sqrt(2);

/* ========== Gate Definitions ========== */
const GATE_DEFS = {
  I:  { matrix: [[[1,0],[0,0]],[[0,0],[1,0]]], label: 'I', color: '#8e8ea0', desc: 'Identity', qubits: 1 },
  H:  { matrix: [[[S2,0],[S2,0]],[[S2,0],[-S2,0]]], label: 'H', color: '#F5A623', desc: 'Hadamard', qubits: 1 },
  X:  { matrix: [[[0,0],[1,0]],[[1,0],[0,0]]], label: 'X', color: '#E85D75', desc: 'Pauli-X (NOT)', qubits: 1 },
  Y:  { matrix: [[[0,0],[0,-1]],[[0,1],[0,0]]], label: 'Y', color: '#50C878', desc: 'Pauli-Y', qubits: 1 },
  Z:  { matrix: [[[1,0],[0,0]],[[0,0],[-1,0]]], label: 'Z', color: '#4A90D9', desc: 'Pauli-Z', qubits: 1 },
  S:  { matrix: [[[1,0],[0,0]],[[0,0],[0,1]]], label: 'S', color: '#9B59B6', desc: 'Phase (S)', qubits: 1 },
  T:  { matrix: [[[1,0],[0,0]],[[0,0],[Math.cos(Math.PI/4), Math.sin(Math.PI/4)]]], label: 'T', color: '#1ABC9C', desc: 'π/8 Gate', qubits: 1 },
  CNOT: { label: 'CX', color: '#E85D75', desc: 'Controlled-X', qubits: 2 },
  CZ:   { label: 'CZ', color: '#4A90D9', desc: 'Controlled-Z', qubits: 2 },
  SWAP: { label: 'SW', color: '#F39C12', desc: 'SWAP', qubits: 2 },
};

/* ========== Simulation Engine ========== */
function applySingleGate(state, matrix, qubit, n) {
  const dim = 1 << n;
  const newState = state.map(a => [...a]);
  const mask = 1 << qubit;
  for (let i = 0; i < dim; i++) {
    if ((i & mask) !== 0) continue; // only process where qubit bit = 0
    const j = i | mask; // partner with qubit bit = 1
    const a0 = state[i];
    const a1 = state[j];
    newState[i] = cAdd(cMul(matrix[0][0], a0), cMul(matrix[0][1], a1));
    newState[j] = cAdd(cMul(matrix[1][0], a0), cMul(matrix[1][1], a1));
  }
  return newState;
}

function applyCNOT(state, control, target, n) {
  const dim = 1 << n;
  const newState = state.map(a => [...a]);
  for (let i = 0; i < dim; i++) {
    if (((i >> control) & 1) === 1 && ((i >> target) & 1) === 0) {
      const j = i ^ (1 << target);
      newState[i] = [...state[j]];
      newState[j] = [...state[i]];
    }
  }
  return newState;
}

function applyCZ(state, control, target, n) {
  const dim = 1 << n;
  const newState = state.map(a => [...a]);
  for (let i = 0; i < dim; i++) {
    if (((i >> control) & 1) === 1 && ((i >> target) & 1) === 1) {
      newState[i] = [-state[i][0], -state[i][1]];
    }
  }
  return newState;
}

function applySWAP(state, q1, q2, n) {
  const dim = 1 << n;
  const newState = state.map(a => [...a]);
  for (let i = 0; i < dim; i++) {
    const b1 = (i >> q1) & 1;
    const b2 = (i >> q2) & 1;
    if (b1 !== b2) {
      const j = i ^ (1 << q1) ^ (1 << q2);
      if (i < j) {
        newState[i] = [...state[j]];
        newState[j] = [...state[i]];
      }
    }
  }
  return newState;
}

function simulate(numQubits, circuit, numSteps) {
  const dim = 1 << numQubits;
  let state = Array.from({ length: dim }, (_, i) => (i === 0 ? [1, 0] : [0, 0]));

  for (let step = 0; step < numSteps; step++) {
    const processed = new Set();
    for (let q = 0; q < numQubits; q++) {
      const key = `${q}-${step}`;
      if (processed.has(key)) continue;
      const gate = circuit[key];
      if (!gate) continue;

      if (gate.type === 'CNOT_CTRL') {
        state = applyCNOT(state, q, gate.target, numQubits);
        processed.add(`${gate.target}-${step}`);
      } else if (gate.type === 'CZ_CTRL') {
        state = applyCZ(state, q, gate.target, numQubits);
        processed.add(`${gate.target}-${step}`);
      } else if (gate.type === 'SWAP_A') {
        state = applySWAP(state, q, gate.partner, numQubits);
        processed.add(`${gate.partner}-${step}`);
      } else if (gate.type === 'M' || gate.type === 'CNOT_TGT' || gate.type === 'CZ_TGT' || gate.type === 'SWAP_B') {
        continue;
      } else if (GATE_DEFS[gate.type]) {
        state = applySingleGate(state, GATE_DEFS[gate.type].matrix, q, numQubits);
      }
      processed.add(key);
    }
  }

  return state.map(a => cAbs2(a));
}

/* ========== Statevector Display ========== */
function basisLabel(index, n) {
  return '|' + index.toString(2).padStart(n, '0') + '⟩';
}

/* ========== Main Component ========== */
export default function QuantumCircuitSimulator() {
  const [numQubits, setNumQubits] = useState(2);
  const [numSteps, setNumSteps] = useState(10);
  const [circuit, setCircuit] = useState({});
  const [selectedGate, setSelectedGate] = useState(null);
  const [results, setResults] = useState(null);
  const [pendingMulti, setPendingMulti] = useState(null); // { gate, qubit, step }
  const [hoveredCell, setHoveredCell] = useState(null);
  const [stateVector, setStateVector] = useState(null);
  const [showStateVec, setShowStateVec] = useState(false);

  const maxQubits = 8;

  const addQubit = () => {
    if (numQubits < maxQubits) {
      setNumQubits(n => n + 1);
      setResults(null);
    }
  };

  const removeQubit = () => {
    if (numQubits > 1) {
      const newN = numQubits - 1;
      const newCircuit = {};
      Object.entries(circuit).forEach(([key, val]) => {
        const q = parseInt(key.split('-')[0]);
        if (q < newN) {
          // Also check targets/partners
          if (val.target !== undefined && val.target >= newN) return;
          if (val.partner !== undefined && val.partner >= newN) return;
          newCircuit[key] = val;
        }
      });
      setCircuit(newCircuit);
      setNumQubits(newN);
      setResults(null);
    }
  };

  const addStep = () => setNumSteps(s => Math.min(s + 1, 30));
  const removeStep = () => {
    if (numSteps > 1) {
      const newS = numSteps - 1;
      const newCircuit = {};
      Object.entries(circuit).forEach(([key, val]) => {
        const step = parseInt(key.split('-')[1]);
        if (step < newS) newCircuit[key] = val;
      });
      setCircuit(newCircuit);
      setNumSteps(newS);
    }
  };

  const clearCircuit = () => {
    setCircuit({});
    setResults(null);
    setPendingMulti(null);
    setStateVector(null);
  };

  const handleCellClick = (qubit, step) => {
    if (!selectedGate) {
      // Remove gate if clicking occupied cell with no gate selected
      const key = `${qubit}-${step}`;
      const existing = circuit[key];
      if (existing) {
        const newCircuit = { ...circuit };
        delete newCircuit[key];
        // Remove partner for multi-qubit gates
        if (existing.type === 'CNOT_CTRL') delete newCircuit[`${existing.target}-${step}`];
        if (existing.type === 'CNOT_TGT') delete newCircuit[`${existing.control}-${step}`];
        if (existing.type === 'CZ_CTRL') delete newCircuit[`${existing.target}-${step}`];
        if (existing.type === 'CZ_TGT') delete newCircuit[`${existing.control}-${step}`];
        if (existing.type === 'SWAP_A') delete newCircuit[`${existing.partner}-${step}`];
        if (existing.type === 'SWAP_B') delete newCircuit[`${existing.partner}-${step}`];
        setCircuit(newCircuit);
        setResults(null);
      }
      return;
    }

    // Handle Measurement separately (not in GATE_DEFS)
    if (selectedGate === 'M' && !pendingMulti) {
      const key = `${qubit}-${step}`;
      if (circuit[key]) return;
      setCircuit({ ...circuit, [key]: { type: 'M' } });
      setResults(null);
      return;
    }

    const gateInfo = GATE_DEFS[selectedGate];
    if (!gateInfo) return;

    // Handle pending multi-qubit gate placement (second click)
    if (pendingMulti) {
      if (step !== pendingMulti.step || qubit === pendingMulti.qubit) {
        setPendingMulti(null);
        return;
      }
      const key1 = `${pendingMulti.qubit}-${step}`;
      const key2 = `${qubit}-${step}`;
      // Check if target cell is occupied
      if (circuit[key2]) {
        setPendingMulti(null);
        return;
      }

      const newCircuit = { ...circuit };
      if (pendingMulti.gate === 'CNOT') {
        newCircuit[key1] = { type: 'CNOT_CTRL', target: qubit };
        newCircuit[key2] = { type: 'CNOT_TGT', control: pendingMulti.qubit };
      } else if (pendingMulti.gate === 'CZ') {
        newCircuit[key1] = { type: 'CZ_CTRL', target: qubit };
        newCircuit[key2] = { type: 'CZ_TGT', control: pendingMulti.qubit };
      } else if (pendingMulti.gate === 'SWAP') {
        newCircuit[key1] = { type: 'SWAP_A', partner: qubit };
        newCircuit[key2] = { type: 'SWAP_B', partner: pendingMulti.qubit };
      }
      setCircuit(newCircuit);
      setPendingMulti(null);
      setResults(null);
      return;
    }

    const key = `${qubit}-${step}`;
    if (circuit[key]) return; // cell occupied

    if (gateInfo.qubits === 2) {
      // Start multi-qubit placement
      setPendingMulti({ gate: selectedGate, qubit, step });
      return;
    }

    // Single qubit gate or measurement
    const newCircuit = { ...circuit };
    if (selectedGate === 'M') {
      newCircuit[key] = { type: 'M' };
    } else {
      newCircuit[key] = { type: selectedGate };
    }
    setCircuit(newCircuit);
    setResults(null);
  };

  const runSimulation = () => {
    const probs = simulate(numQubits, circuit, numSteps);
    setResults(probs);

    // Also compute full state vector for display
    const dim = 1 << numQubits;
    let state = Array.from({ length: dim }, (_, i) => (i === 0 ? [1, 0] : [0, 0]));
    // Re-simulate to get state vector (not just probs)
    for (let step = 0; step < numSteps; step++) {
      const processed = new Set();
      for (let q = 0; q < numQubits; q++) {
        const k = `${q}-${step}`;
        if (processed.has(k)) continue;
        const gate = circuit[k];
        if (!gate) continue;
        if (gate.type === 'CNOT_CTRL') {
          state = applyCNOT(state, q, gate.target, numQubits);
          processed.add(`${gate.target}-${step}`);
        } else if (gate.type === 'CZ_CTRL') {
          state = applyCZ(state, q, gate.target, numQubits);
          processed.add(`${gate.target}-${step}`);
        } else if (gate.type === 'SWAP_A') {
          state = applySWAP(state, q, gate.partner, numQubits);
          processed.add(`${gate.partner}-${step}`);
        } else if (!['M','CNOT_TGT','CZ_TGT','SWAP_B'].includes(gate.type) && GATE_DEFS[gate.type]) {
          state = applySingleGate(state, GATE_DEFS[gate.type].matrix, q, numQubits);
        }
        processed.add(k);
      }
    }
    setStateVector(state);
  };

  // Chart data
  const chartData = useMemo(() => {
    if (!results) return [];
    return results.map((p, i) => ({
      state: basisLabel(i, numQubits),
      probability: Math.round(p * 10000) / 10000,
      pct: (p * 100).toFixed(2),
    })).filter(d => d.probability > 0.0001);
  }, [results, numQubits]);

  // Render gate in cell
  const renderGate = (qubit, step) => {
    const key = `${qubit}-${step}`;
    const gate = circuit[key];
    if (!gate) return null;

    const t = gate.type;

    if (t === 'CNOT_CTRL') {
      return (
        <div style={{ width: 14, height: 14, borderRadius: '50%', background: GATE_DEFS.CNOT.color, border: '2px solid #fff' }} />
      );
    }
    if (t === 'CNOT_TGT') {
      return (
        <div style={{ width: 22, height: 22, borderRadius: '50%', border: `2px solid ${GATE_DEFS.CNOT.color}`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: GATE_DEFS.CNOT.color, fontSize: 16, fontWeight: 'bold' }}>⊕</div>
      );
    }
    if (t === 'CZ_CTRL') {
      return (
        <div style={{ width: 14, height: 14, borderRadius: '50%', background: GATE_DEFS.CZ.color, border: '2px solid #fff' }} />
      );
    }
    if (t === 'CZ_TGT') {
      return (
        <div style={{ width: 14, height: 14, borderRadius: '50%', background: GATE_DEFS.CZ.color, border: '2px solid #fff' }} />
      );
    }
    if (t === 'SWAP_A' || t === 'SWAP_B') {
      return (
        <div style={{ fontSize: 18, color: GATE_DEFS.SWAP.color, fontWeight: 'bold' }}>✕</div>
      );
    }
    if (t === 'M') {
      return (
        <div style={{
          width: 40, height: 40, borderRadius: 4, background: '#2d2d3f',
          border: '2px solid #8e8ea0', display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexDirection: 'column', position: 'relative'
        }}>
          <div style={{ width: 20, height: 12, borderBottom: '2px solid #ccc', borderRadius: '0 0 50% 50%', marginTop: 2, transform: 'rotate(180deg)' }} />
          <div style={{ fontSize: 8, color: '#ccc', marginTop: 2 }}>M</div>
        </div>
      );
    }

    // Single qubit gate
    const def = GATE_DEFS[t];
    if (!def) return null;
    return (
      <div style={{
        width: 40, height: 40, borderRadius: 6, background: def.color + '22',
        border: `2px solid ${def.color}`, display: 'flex', alignItems: 'center',
        justifyContent: 'center', color: def.color, fontWeight: 700, fontSize: 16,
        fontFamily: "'JetBrains Mono', 'Fira Code', monospace", cursor: 'pointer',
        transition: 'all 0.15s ease'
      }}>
        {def.label}
      </div>
    );
  };

  // Find vertical connections for multi-qubit gates
  const getMultiQubitConnections = (step) => {
    const connections = [];
    for (let q = 0; q < numQubits; q++) {
      const gate = circuit[`${q}-${step}`];
      if (gate && gate.type === 'CNOT_CTRL') {
        connections.push({ from: q, to: gate.target, color: GATE_DEFS.CNOT.color });
      }
      if (gate && gate.type === 'CZ_CTRL') {
        connections.push({ from: q, to: gate.target, color: GATE_DEFS.CZ.color });
      }
      if (gate && gate.type === 'SWAP_A') {
        connections.push({ from: q, to: gate.partner, color: GATE_DEFS.SWAP.color });
      }
    }
    return connections;
  };

  const CELL_H = 56;
  const CELL_W = 56;

  const isPending = pendingMulti !== null;

  return (
    <div style={{
      minHeight: '100vh', background: '#0B0E17', color: '#E0E0E0',
      fontFamily: "'Outfit', 'Segoe UI', sans-serif", display: 'flex', flexDirection: 'column',
      overflow: 'hidden'
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500;700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        ::-webkit-scrollbar { width: 6px; height: 6px; }
        ::-webkit-scrollbar-track { background: #141822; }
        ::-webkit-scrollbar-thumb { background: #2a3040; border-radius: 3px; }
        ::-webkit-scrollbar-thumb:hover { background: #3a4560; }
      `}</style>

      {/* Header */}
      <div style={{
        padding: '14px 24px', borderBottom: '1px solid #1a1f2e',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        background: '#0d1019', flexShrink: 0
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 8,
            background: 'linear-gradient(135deg, #4A90D9 0%, #9B59B6 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 16, fontWeight: 700
          }}>Q</div>
          <div>
            <div style={{ fontSize: 16, fontWeight: 600, letterSpacing: '0.02em' }}>Quantum Circuit Simulator</div>
            <div style={{ fontSize: 11, color: '#666', fontWeight: 400 }}>量子電路模擬器</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{ fontSize: 12, color: '#666', marginRight: 4 }}>Qubits: {numQubits}</span>
          <button onClick={removeQubit} style={btnSm}>−</button>
          <button onClick={addQubit} style={btnSm}>+</button>
          <div style={{ width: 1, height: 20, background: '#1a1f2e', margin: '0 6px' }} />
          <span style={{ fontSize: 12, color: '#666', marginRight: 4 }}>Steps: {numSteps}</span>
          <button onClick={removeStep} style={btnSm}>−</button>
          <button onClick={addStep} style={btnSm}>+</button>
          <div style={{ width: 1, height: 20, background: '#1a1f2e', margin: '0 6px' }} />
          <button onClick={clearCircuit} style={{ ...btnSm, padding: '4px 12px', fontSize: 12 }}>Clear</button>
          <button onClick={runSimulation} style={{
            padding: '6px 20px', borderRadius: 6, border: 'none', cursor: 'pointer',
            background: 'linear-gradient(135deg, #4A90D9 0%, #6C5CE7 100%)',
            color: '#fff', fontWeight: 600, fontSize: 13, fontFamily: 'inherit',
            transition: 'all 0.2s', letterSpacing: '0.02em'
          }}>
            ▶ Run
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Gate Palette */}
        <div style={{
          width: 180, borderRight: '1px solid #1a1f2e', padding: '16px 12px',
          background: '#0d1019', flexShrink: 0, overflowY: 'auto'
        }}>
          <div style={{ fontSize: 10, fontWeight: 600, color: '#555', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 10 }}>
            Single Qubit 單量子位元
          </div>
          {['I', 'H', 'X', 'Y', 'Z', 'S', 'T'].map(g => (
            <button key={g} onClick={() => { setSelectedGate(selectedGate === g ? null : g); setPendingMulti(null); }}
              style={{
                width: '100%', padding: '8px 10px', marginBottom: 4, borderRadius: 6,
                border: selectedGate === g ? `2px solid ${GATE_DEFS[g].color}` : '2px solid transparent',
                background: selectedGate === g ? GATE_DEFS[g].color + '18' : '#141822',
                color: selectedGate === g ? GATE_DEFS[g].color : '#999',
                cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10,
                fontFamily: 'inherit', fontSize: 13, transition: 'all 0.15s'
              }}>
              <span style={{
                width: 28, height: 28, borderRadius: 4, display: 'flex', alignItems: 'center',
                justifyContent: 'center', fontWeight: 700, fontSize: 14,
                fontFamily: "'JetBrains Mono', monospace",
                background: GATE_DEFS[g].color + '22', color: GATE_DEFS[g].color, flexShrink: 0
              }}>{GATE_DEFS[g].label}</span>
              <span style={{ fontSize: 11, color: '#777' }}>{GATE_DEFS[g].desc}</span>
            </button>
          ))}

          <div style={{ fontSize: 10, fontWeight: 600, color: '#555', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '16px 0 10px' }}>
            Multi Qubit 多量子位元
          </div>
          {['CNOT', 'CZ', 'SWAP'].map(g => (
            <button key={g} onClick={() => { setSelectedGate(selectedGate === g ? null : g); setPendingMulti(null); }}
              style={{
                width: '100%', padding: '8px 10px', marginBottom: 4, borderRadius: 6,
                border: selectedGate === g ? `2px solid ${GATE_DEFS[g].color}` : '2px solid transparent',
                background: selectedGate === g ? GATE_DEFS[g].color + '18' : '#141822',
                color: selectedGate === g ? GATE_DEFS[g].color : '#999',
                cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10,
                fontFamily: 'inherit', fontSize: 13, transition: 'all 0.15s'
              }}>
              <span style={{
                width: 28, height: 28, borderRadius: 4, display: 'flex', alignItems: 'center',
                justifyContent: 'center', fontWeight: 700, fontSize: 13,
                fontFamily: "'JetBrains Mono', monospace",
                background: GATE_DEFS[g].color + '22', color: GATE_DEFS[g].color, flexShrink: 0
              }}>{GATE_DEFS[g].label}</span>
              <span style={{ fontSize: 11, color: '#777' }}>{GATE_DEFS[g].desc}</span>
            </button>
          ))}

          <div style={{ fontSize: 10, fontWeight: 600, color: '#555', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '16px 0 10px' }}>
            Measure 量測
          </div>
          <button onClick={() => { setSelectedGate(selectedGate === 'M' ? null : 'M'); setPendingMulti(null); }}
            style={{
              width: '100%', padding: '8px 10px', marginBottom: 4, borderRadius: 6,
              border: selectedGate === 'M' ? '2px solid #8e8ea0' : '2px solid transparent',
              background: selectedGate === 'M' ? '#8e8ea018' : '#141822',
              color: selectedGate === 'M' ? '#ccc' : '#999',
              cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10,
              fontFamily: 'inherit', fontSize: 13, transition: 'all 0.15s'
            }}>
            <span style={{
              width: 28, height: 28, borderRadius: 4, display: 'flex', alignItems: 'center',
              justifyContent: 'center', fontWeight: 700, fontSize: 14,
              background: '#8e8ea022', color: '#8e8ea0', flexShrink: 0
            }}>M</span>
            <span style={{ fontSize: 11, color: '#777' }}>Measurement</span>
          </button>

          {/* Instructions */}
          <div style={{ marginTop: 20, padding: 10, background: '#141822', borderRadius: 6, fontSize: 11, color: '#555', lineHeight: 1.6 }}>
            <div style={{ fontWeight: 600, color: '#777', marginBottom: 4 }}>操作說明</div>
            <div>1. 選擇 Gate</div>
            <div>2. 點擊電路格放置</div>
            <div>3. 雙量子閘需點兩次</div>
            <div>4. 無選擇時點擊可刪除</div>
            <div>5. 按 Run 執行模擬</div>
          </div>

          {isPending && (
            <div style={{
              marginTop: 10, padding: 10, background: '#F5A62318', border: '1px solid #F5A623',
              borderRadius: 6, fontSize: 12, color: '#F5A623', lineHeight: 1.5
            }}>
              請點擊同一行的另一個 qubit 作為 {pendingMulti.gate === 'CNOT' ? 'target' : pendingMulti.gate === 'SWAP' ? 'swap partner' : 'target'}
            </div>
          )}
        </div>

        {/* Main Area */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {/* Circuit */}
          <div style={{ flex: 1, overflow: 'auto', padding: '20px 20px 10px' }}>
            <div style={{ display: 'inline-block', minWidth: '100%' }}>
              {/* Step labels */}
              <div style={{ display: 'flex', marginLeft: 60, marginBottom: 4 }}>
                {Array.from({ length: numSteps }, (_, s) => (
                  <div key={s} style={{
                    width: CELL_W, textAlign: 'center', fontSize: 10, color: '#444',
                    fontFamily: "'JetBrains Mono', monospace"
                  }}>{s}</div>
                ))}
              </div>

              {/* Circuit grid */}
              <div style={{ position: 'relative' }}>
                {Array.from({ length: numQubits }, (_, q) => (
                  <div key={q} style={{ display: 'flex', alignItems: 'center', height: CELL_H }}>
                    {/* Qubit label */}
                    <div style={{
                      width: 55, textAlign: 'right', paddingRight: 8,
                      fontFamily: "'JetBrains Mono', monospace", fontSize: 13, color: '#666',
                      fontWeight: 500, flexShrink: 0
                    }}>
                      q<sub>{q}</sub> |0⟩
                    </div>

                    {/* Wire + cells */}
                    <div style={{ display: 'flex', position: 'relative' }}>
                      {/* Horizontal wire */}
                      <div style={{
                        position: 'absolute', top: '50%', left: 0,
                        right: 0, height: 1, background: '#2a3040', zIndex: 0
                      }} />

                      {Array.from({ length: numSteps }, (_, s) => {
                        const isHovered = hoveredCell?.q === q && hoveredCell?.s === s;
                        const isPendingCell = pendingMulti?.qubit === q && pendingMulti?.step === s;
                        const hasGate = !!circuit[`${q}-${s}`];
                        const canPlace = selectedGate && !hasGate;
                        const isPendingTarget = pendingMulti && pendingMulti.step === s && pendingMulti.qubit !== q && !hasGate;

                        return (
                          <div key={s}
                            onClick={() => handleCellClick(q, s)}
                            onMouseEnter={() => setHoveredCell({ q, s })}
                            onMouseLeave={() => setHoveredCell(null)}
                            style={{
                              width: CELL_W, height: CELL_H, display: 'flex',
                              alignItems: 'center', justifyContent: 'center',
                              position: 'relative', zIndex: 1,
                              cursor: canPlace || isPendingTarget || (!selectedGate && hasGate) ? 'pointer' : 'default',
                              background: isPendingCell ? '#F5A62312'
                                : isPendingTarget && isHovered ? '#4A90D920'
                                : isHovered && (canPlace || (!selectedGate && hasGate)) ? '#ffffff08'
                                : 'transparent',
                              borderRadius: 4,
                              transition: 'background 0.1s'
                            }}>
                            {renderGate(q, s)}
                            {!hasGate && isHovered && selectedGate && !isPending && GATE_DEFS[selectedGate]?.qubits === 1 && (
                              <div style={{
                                width: 40, height: 40, borderRadius: 6,
                                border: `2px dashed ${GATE_DEFS[selectedGate].color}50`,
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                color: GATE_DEFS[selectedGate].color + '50', fontWeight: 700, fontSize: 16,
                                fontFamily: "'JetBrains Mono', monospace"
                              }}>
                                {GATE_DEFS[selectedGate].label}
                              </div>
                            )}
                            {!hasGate && isHovered && selectedGate === 'M' && !isPending && (
                              <div style={{
                                width: 40, height: 40, borderRadius: 4,
                                border: '2px dashed #8e8ea050',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                color: '#8e8ea050', fontWeight: 700, fontSize: 14
                              }}>M</div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}

                {/* Vertical connections for multi-qubit gates */}
                {Array.from({ length: numSteps }, (_, s) => {
                  const conns = getMultiQubitConnections(s);
                  return conns.map((c, ci) => {
                    const top = Math.min(c.from, c.to) * CELL_H + CELL_H / 2;
                    const bottom = Math.max(c.from, c.to) * CELL_H + CELL_H / 2;
                    return (
                      <div key={`${s}-${ci}`} style={{
                        position: 'absolute',
                        left: 60 + s * CELL_W + CELL_W / 2 - 1,
                        top: top,
                        width: 2,
                        height: bottom - top,
                        background: c.color,
                        zIndex: 2,
                        pointerEvents: 'none'
                      }} />
                    );
                  });
                })}

                {/* Pending multi-gate connection preview */}
                {pendingMulti && hoveredCell && hoveredCell.s === pendingMulti.step && hoveredCell.q !== pendingMulti.qubit && (
                  (() => {
                    const top = Math.min(pendingMulti.qubit, hoveredCell.q) * CELL_H + CELL_H / 2;
                    const bottom = Math.max(pendingMulti.qubit, hoveredCell.q) * CELL_H + CELL_H / 2;
                    const gateColor = GATE_DEFS[pendingMulti.gate]?.color || '#fff';
                    return (
                      <div style={{
                        position: 'absolute',
                        left: 60 + pendingMulti.step * CELL_W + CELL_W / 2 - 1,
                        top: top,
                        width: 2,
                        height: bottom - top,
                        background: gateColor + '60',
                        zIndex: 2,
                        pointerEvents: 'none'
                      }} />
                    );
                  })()
                )}
              </div>
            </div>
          </div>

          {/* Results Panel */}
          <div style={{
            borderTop: '1px solid #1a1f2e', background: '#0d1019',
            padding: '14px 20px', flexShrink: 0,
            minHeight: results ? 260 : 50, transition: 'min-height 0.3s'
          }}>
            {!results ? (
              <div style={{ fontSize: 13, color: '#444', textAlign: 'center', padding: 8 }}>
                按下 ▶ Run 執行模擬，查看量測結果 / Press Run to simulate
              </div>
            ) : (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#888' }}>
                    Measurement Probabilities — 量測機率分佈
                  </div>
                  <button onClick={() => setShowStateVec(!showStateVec)} style={{
                    ...btnSm, padding: '3px 10px', fontSize: 11
                  }}>
                    {showStateVec ? 'Hide' : 'Show'} Statevector
                  </button>
                </div>

                {/* Histogram */}
                <div style={{ height: 160 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
                      <XAxis dataKey="state" tick={{ fontSize: numQubits > 4 ? 9 : 11, fill: '#888', fontFamily: "'JetBrains Mono', monospace" }} interval={0} angle={numQubits > 5 ? -45 : 0} textAnchor={numQubits > 5 ? "end" : "middle"} height={numQubits > 5 ? 50 : 30} />
                      <YAxis tick={{ fontSize: 10, fill: '#666' }} domain={[0, 1]} tickFormatter={v => `${(v*100).toFixed(0)}%`} width={40} />
                      <Tooltip
                        contentStyle={{ background: '#1a1f2e', border: '1px solid #2a3040', borderRadius: 6, fontSize: 12, fontFamily: "'JetBrains Mono', monospace" }}
                        labelStyle={{ color: '#ccc' }}
                        formatter={(value) => [`${(value * 100).toFixed(2)}%`, 'Probability']}
                      />
                      <Bar dataKey="probability" radius={[3, 3, 0, 0]} maxBarSize={40}>
                        {chartData.map((entry, index) => (
                          <Cell key={index} fill={entry.probability > 0.5 ? '#4A90D9' : entry.probability > 0.1 ? '#6C5CE7' : '#9B59B6'} fillOpacity={0.85} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                {/* Statevector display */}
                {showStateVec && stateVector && (
                  <div style={{
                    marginTop: 10, padding: 10, background: '#141822', borderRadius: 6,
                    maxHeight: 120, overflowY: 'auto', fontFamily: "'JetBrains Mono', monospace", fontSize: 11
                  }}>
                    {stateVector.map((amp, i) => {
                      const prob = cAbs2(amp);
                      if (prob < 0.0001) return null;
                      const re = amp[0].toFixed(4);
                      const im = amp[1].toFixed(4);
                      return (
                        <div key={i} style={{ display: 'flex', gap: 12, padding: '2px 0', color: '#aaa' }}>
                          <span style={{ color: '#4A90D9', minWidth: 60 }}>{basisLabel(i, numQubits)}</span>
                          <span>{re}{parseFloat(im) >= 0 ? '+' : ''}{im}i</span>
                          <span style={{ color: '#666' }}>P={( prob * 100).toFixed(2)}%</span>
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

const btnSm = {
  padding: '4px 8px', borderRadius: 4, border: '1px solid #2a3040',
  background: '#141822', color: '#999', cursor: 'pointer', fontSize: 14,
  fontFamily: 'inherit', transition: 'all 0.15s', lineHeight: 1,
};
