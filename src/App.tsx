import { useState, useEffect, useRef } from 'react';
import { useGameStore } from './store/gameStore';
import { processCommand } from './engine/parser'; 

// Placeholder Audio (You can replace these URLs with local files later)
const AUDIO_COMBAT = "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3"; 
const AUDIO_AMBIANCE = "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-15.mp3";

function App() {
  const party = useGameStore(state => state.party);
  const log = useGameStore(state => state.log);
  const activeEnemies = useGameStore(state => state.activeEnemies);
  const isCombat = useGameStore(state => state.isCombat);
  const inventory = useGameStore(state => state.inventory);
  
  const [input, setInput] = useState("");
  const logEndRef = useRef<HTMLDivElement>(null);
  
  // Audio Refs
  const audioRef = useRef<HTMLAudioElement>(new Audio());

  // SCROLL FIX: Auto-scroll when log updates
  useEffect(() => {
    if (logEndRef.current) {
      logEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [log]);

  // AUDIO LOGIC: Switch tracks based on combat state
  useEffect(() => {
    audioRef.current.volume = 0.3;
    if (isCombat) {
      audioRef.current.src = AUDIO_COMBAT;
      audioRef.current.loop = true;
      audioRef.current.play().catch(e => console.log("Audio play failed (interact first):", e));
    } else {
      audioRef.current.src = AUDIO_AMBIANCE;
      audioRef.current.loop = true;
      audioRef.current.play().catch(e => console.log("Audio play failed:", e));
    }
  }, [isCombat]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    processCommand(input); 
    setInput("");
  };

  const renderEnemyBars = () => {
    return activeEnemies.map((enemy) => (
      <div key={enemy.id} style={{ width: '100%', marginBottom: '10px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', color: '#ffaaaa' }}>
          <span>{enemy.name}</span>
          <span>{enemy.hp}/{enemy.maxHp}</span>
        </div>
        <div style={{ width: '100%', height: '10px', background: '#330000', border: '1px solid red' }}>
          <div style={{ 
            width: `${(enemy.hp / enemy.maxHp) * 100}%`, 
            height: '100%', 
            background: 'red',
            transition: 'width 0.2s' 
          }}></div>
        </div>
      </div>
    ));
  };

  return (
    <div className="game-grid">
      
      {/* 1. STATUS PANEL */}
      <div className="sys-panel" style={{ gridArea: 'status', display: 'flex', flexDirection: 'column', gap: '0.5rem', overflowY: 'auto' }}>
        <h2 style={{ color: 'var(--sys-cyan)', margin: 0, fontSize: '1.2rem' }}>PARTY STATUS</h2>
        <div style={{ borderBottom: '1px solid var(--sys-cyan)', opacity: 0.5 }}></div>
        {party.length === 0 ? <p style={{color:'#666'}}>No Signal...</p> : party.map((char) => (
          <div key={char.id} style={{ background: 'rgba(0,0,0,0.3)', padding: '5px', borderRadius: '4px', borderLeft: '2px solid var(--sys-cyan)' }}>
            <div style={{ fontWeight: 'bold', fontSize: '0.9rem' }}>{char.name} <span style={{fontSize: '0.7rem', color:'#aaa'}}>{char.classId.toUpperCase()}</span></div>
            <div style={{ display: 'flex', gap: '10px', fontSize: '0.8rem' }}>
              <span style={{ color: '#ff5555' }}>HP {char.hp}/{char.maxHp}</span>
              <span style={{ color: '#5555ff' }}>SP {char.mp}/{char.maxMp}</span>
            </div>
          </div>
        ))}
      </div>

      {/* 2. INVENTORY PANEL */}
      <div className="sys-panel" style={{ gridArea: 'info', overflowY: 'auto' }}>
        <h3 style={{ color: 'var(--sys-cyan)', margin: 0, fontSize: '1rem' }}>INVENTORY</h3>
        <div style={{ borderBottom: '1px solid var(--sys-cyan)', opacity: 0.5, marginBottom: '5px' }}></div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
          {inventory.map((item, i) => (
            <span key={i} style={{ background: '#112233', padding: '2px 6px', borderRadius: '3px', fontSize: '0.8rem', border: '1px solid #334455' }}>{item}</span>
          ))}
        </div>
      </div>

      {/* 3. HEADER */}
      <div className="sys-panel" style={{ gridArea: 'header', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: '1.1rem', fontWeight: 'bold', textTransform: 'uppercase', color: 'white' }}>
           Dingy Cell Block, Colosseum Auxiliary Building
        </span>
        <span style={{ color: 'var(--sys-cyan)' }}>T: 00:00:00</span>
      </div>

      {/* 4. IMAGE VISUALIZER */}
      <div className="sys-panel" style={{ gridArea: 'image', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'black', position: 'relative', overflow: 'hidden' }}>
        {/* If an image exists for the room (and not in combat), show it */}
        {!isCombat && <img src="https://i.imgur.com/8Q5QX7s.jpg" style={{ position: 'absolute', width: '100%', height: '100%', objectFit: 'cover', opacity: 0.4 }} alt="Room" />}
        
        {isCombat && activeEnemies.length > 0 ? (
           <div style={{ width: '80%', zIndex: 10 }}>
             <h2 style={{ color: '#ff0000', textShadow: '0 0 10px red', margin: '0 0 10px 0', textAlign: 'center' }}>COMBAT ALERT</h2>
             {renderEnemyBars()}
           </div>
        ) : (
          <div style={{ zIndex: 10, color: '#aaa', textShadow: '0 0 5px cyan' }}>[VISUAL FEED ACTIVE]</div>
        )}
      </div>

      {/* 5. TEXT OUTPUT (FIXED SCROLL BORDER) */}
      <div className="sys-panel" style={{ gridArea: 'output', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* INNER SCROLL CONTAINER: This handles the scrolling, while the parent holds the border */}
        <div style={{ flex: 1, overflowY: 'auto', paddingRight: '5px' }}>
          {log.map((line, index) => (
            <div key={index} style={{ marginBottom: '0.5rem', borderLeft: '2px solid var(--sys-cyan)', paddingLeft: '10px', lineHeight: '1.4' }}>
              {line}
            </div>
          ))}
          <div ref={logEndRef} />
        </div>
      </div>

      {/* 6. INPUT */}
      <form className="sys-panel" style={{ gridArea: 'input', display: 'flex', padding: '0.5rem' }} onSubmit={handleSubmit}>
        <span style={{ padding: '0 1rem', display: 'flex', alignItems: 'center', color: 'var(--sys-cyan)' }}>{'>'}</span>
        <input 
          type="text" 
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Enter command..."
          autoFocus
          style={{ background: 'transparent', border: 'none', color: 'white', flex: 1, fontSize: '1.1rem', outline: 'none', fontFamily: 'monospace' }}
        />
      </form>
    </div>
  );
}

export default App;