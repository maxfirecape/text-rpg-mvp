import { useState } from 'react';
import { useGameStore } from './store/gameStore';
import { processCommand } from './engine/parser'; 

function App() {
  // 1. HOOKS MUST BE AT THE TOP (This fixes the crash)
  const player = useGameStore(state => state.player);
  const log = useGameStore(state => state.log);
  const activeEnemy = useGameStore(state => state.activeEnemy);
  const isCombat = useGameStore(state => state.isCombat);
  
  const [input, setInput] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    processCommand(input); 
    setInput("");
  };

  // Helper to calculate HP % safely
  const getEnemyHpPercent = () => {
    if (!activeEnemy) return 0;
    return (activeEnemy.hp / activeEnemy.maxHp) * 100;
  };

  return (
    <div className="game-grid">
      {/* STATUS PANEL */}
      <div className="sys-panel" style={{ gridArea: 'status', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <h2 style={{ color: 'var(--sys-cyan)', margin: 0 }}>STATUS</h2>
        <div style={{ borderBottom: '1px solid var(--sys-cyan)', opacity: 0.5 }}></div>
        <div>
          <p><strong>NAME:</strong> {player?.name || "Unknown"}</p>
          <p><strong>CLASS:</strong> {player?.classId || "None"}</p>
          <p><strong>HP:</strong> <span style={{color: '#ff4444'}}>{player?.hp || 0}</span> / {player?.maxHp || 0}</p>
          <p><strong>SKILL SLOTS:</strong> <span style={{color: '#4444ff'}}>{player?.mp || 0}</span> / {player?.maxMp || 0}</p>
        </div>
      </div>

      {/* EQUIPMENT PANEL */}
      <div className="sys-panel" style={{ gridArea: 'info' }}>
        <h3 style={{ color: 'var(--sys-cyan)', margin: 0, fontSize: '1rem' }}>EQUIPMENT</h3>
        <p style={{ fontSize: '0.8rem', color: '#aaa' }}>No items equipped.</p>
      </div>

      {/* HEADER */}
      <div className="sys-panel" style={{ gridArea: 'header', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>LOCATION: CELL BLOCK 01</span>
        <span style={{ color: 'var(--sys-cyan)' }}>T: 00:00:00</span>
      </div>

      {/* IMAGE VISUALIZER / COMBAT HUD */}
      <div className="sys-panel" style={{ gridArea: 'image', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'black', position: 'relative' }}>
        
        {/* CONDITIONAL RENDERING: Safe now because variables were loaded at the top */}
        {isCombat && activeEnemy ? (
           <>
             <h2 style={{ color: '#ff0000', textShadow: '0 0 10px red', margin: '0 0 10px 0' }}>COMBAT ALERT</h2>
             <div style={{ fontSize: '2rem', fontWeight: 'bold', color: 'white' }}>{activeEnemy.name}</div>
             
             {/* Enemy HP Bar */}
             <div style={{ width: '80%', height: '20px', background: '#330000', marginTop: '10px', border: '1px solid red' }}>
               <div style={{ 
                 width: `${getEnemyHpPercent()}%`, 
                 height: '100%', 
                 background: 'red',
                 transition: 'width 0.2s' 
               }}></div>
             </div>
             <p style={{ color: 'red', marginTop: '5px' }}>HP: {activeEnemy.hp} / {activeEnemy.maxHp}</p>
           </>
        ) : (
          <span style={{ color: '#555' }}>[VISUAL FEED OFFLINE]</span>
        )}
      
      </div>

      {/* TEXT OUTPUT */}
      <div className="sys-panel" style={{ gridArea: 'output', overflowY: 'auto', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
        {log.map((line, index) => (
          <div key={index} style={{ marginBottom: '0.5rem', borderLeft: '2px solid var(--sys-cyan)', paddingLeft: '10px' }}>
            {line}
          </div>
        ))}
      </div>

      {/* INPUT */}
      <form className="sys-panel" style={{ gridArea: 'input', display: 'flex', padding: '0.5rem' }} onSubmit={handleSubmit}>
        <span style={{ padding: '0 1rem', display: 'flex', alignItems: 'center', color: 'var(--sys-cyan)' }}>{'>'}</span>
        <input 
          type="text" 
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Enter command..."
          autoFocus
          style={{ 
            background: 'transparent', 
            border: 'none', 
            color: 'white', 
            flex: 1, 
            fontSize: '1.1rem', 
            outline: 'none',
            fontFamily: 'monospace'
          }}
        />
      </form>
    </div>
  );
}

export default App;