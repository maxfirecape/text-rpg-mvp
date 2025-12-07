import { useState, useEffect, useRef } from 'react';
import { useGameStore } from './store/gameStore';
import { processCommand } from './engine/parser'; 
import roomsData from './data/rooms.json';

// --- AUDIO CONFIGURATION ---
// 1. Download your "Sick Bass" tracks.
// 2. Name them 'battle.mp3' and 'dungeon.mp3'.
// 3. Drag them into the 'public' folder in your file explorer.
const AUDIO_COMBAT = "/battle.mp3"; 
const AUDIO_AMBIANCE = "/dungeon.mp3";

function App() {
  const party = useGameStore(state => state.party);
  const log = useGameStore(state => state.log);
  const activeEnemies = useGameStore(state => state.activeEnemies);
  const isCombat = useGameStore(state => state.isCombat);
  const inventory = useGameStore(state => state.inventory);
  const credits = useGameStore(state => state.credits);
  const currentRoomId = useGameStore(state => state.currentRoomId);
  const actedInTurn = useGameStore(state => state.actedInTurn);
  
  const [input, setInput] = useState("");
  const [isMuted, setIsMuted] = useState(false);
  const logEndRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement>(new Audio());

  const currentRoom = roomsData.find(r => r.id === currentRoomId);

  // DETERMINE ACTIVE HERO
  const activeHero = isCombat 
    ? party.find(c => c.hp > 0 && !actedInTurn.includes(c.id))
    : party[0]; 

  // Auto-scroll Log
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [log]);

  // Audio System
  useEffect(() => {
    const audio = audioRef.current;
    audio.volume = 0.4; // 40% Volume
    
    if (isMuted) { 
      audio.pause(); 
      return; 
    }

    const track = isCombat ? AUDIO_COMBAT : AUDIO_AMBIANCE;
    
    // Switch tracks seamlessly
    if (!audio.src.includes(track)) {
      audio.src = track;
      audio.loop = true;
      const playPromise = audio.play();
      if (playPromise !== undefined) {
        playPromise.catch(error => {
          console.log("Audio waiting for user interaction.");
        });
      }
    } else if (audio.paused) {
      audio.play().catch(() => {});
    }
  }, [isCombat, isMuted]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    processCommand(input); 
    setInput("");
  };

  const renderEnemyBars = () => {
    return activeEnemies.map((enemy) => (
      <div key={enemy.id} style={{ width: '100%', marginBottom: '10px', opacity: enemy.hp <= 0 ? 0.3 : 1 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', color: '#ffaaaa' }}>
          <span>{enemy.name} {enemy.hp <= 0 && "(DEAD)"}</span>
          <span>{enemy.hp}/{enemy.maxHp}</span>
        </div>
        <div style={{ width: '100%', height: '10px', background: '#330000', border: '1px solid red' }}>
          <div style={{ width: `${(enemy.hp / enemy.maxHp) * 100}%`, height: '100%', background: 'red', transition: 'width 0.2s' }}></div>
        </div>
        {/* Enemy Status */}
        <div style={{ display: 'flex', gap: '5px' }}>
          {enemy.status.map((s, i) => (
            <span key={i} style={{ fontSize: '0.7rem', color: 'orange', textTransform: 'uppercase' }}>[{s.type}]</span>
          ))}
        </div>
      </div>
    ));
  };

  return (
    <div className="game-grid">
      
      {/* 1. STATUS PANEL */}
      <div className="sys-panel" style={{ gridArea: 'status', display: 'flex', flexDirection: 'column', gap: '0.5rem', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ color: 'var(--sys-cyan)', margin: 0, fontSize: '1.2rem' }}>PARTY</h2>
          <span style={{ color: '#ffd700', fontSize: '0.9rem' }}>$ {credits}</span>
        </div>
        <div style={{ borderBottom: '1px solid var(--sys-cyan)', opacity: 0.5 }}></div>
        
        {party.length === 0 ? <p style={{color:'#666', fontSize:'0.8rem'}}>Awaiting Neural Link...</p> : party.map((char) => {
          const isActive = isCombat && char.id === activeHero?.id;
          return (
            <div key={char.id} style={{ 
              background: isActive ? 'rgba(0, 255, 200, 0.05)' : 'rgba(0,0,0,0.3)', 
              padding: '8px', 
              borderRadius: '4px', 
              borderLeft: isActive ? '4px solid #00ff00' : '2px solid var(--sys-cyan)',
              border: isActive ? '1px solid #00ff00' : 'none',
              transition: 'all 0.3s'
            }}>
              <div style={{ display:'flex', justifyContent:'space-between', fontWeight: 'bold', fontSize: '0.9rem', color: isActive ? '#00ff00' : 'white' }}>
                <span>{char.name}</span>
                <span style={{fontSize: '0.7rem', color:'#aaa'}}>LVL {char.level} {char.classId.toUpperCase()}</span>
              </div>
              
              {/* XP BAR */}
              <div style={{ width: '100%', height: '3px', background: '#333', marginTop: '4px', marginBottom: '4px' }}>
                 <div style={{ width: `${(char.xp / char.maxXp)*100}%`, height: '100%', background: '#ffd700' }}></div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}>
                <span style={{ color: '#ff5555' }}>HP {char.hp}/{char.maxHp}</span>
                <span style={{ color: '#5555ff' }}>SP {char.mp}/{char.maxMp}</span>
              </div>

              {/* ACTIVE STATUS EFFECTS */}
              {char.status.length > 0 && (
                <div style={{ marginTop: '4px', display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                  {char.status.map((s, idx) => (
                    <span key={idx} style={{ 
                      background: '#330000', color: '#ff4444', fontSize: '0.6rem', 
                      padding: '1px 3px', borderRadius: '2px', border: '1px solid #ff4444' 
                    }}>
                      {s.type.toUpperCase()} ({s.duration})
                    </span>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* 2. INVENTORY PANEL */}
      <div className="sys-panel" style={{ gridArea: 'info', overflowY: 'auto' }}>
        <h3 style={{ color: 'var(--sys-cyan)', margin: 0, fontSize: '1rem' }}>EQUIPMENT & BAG</h3>
        <div style={{ borderBottom: '1px solid var(--sys-cyan)', opacity: 0.5, marginBottom: '5px' }}></div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
          {inventory.length === 0 && <span style={{color:'#555', fontSize:'0.8rem'}}>Empty.</span>}
          {inventory.map((item, i) => (
            <span key={i} style={{ 
              background: '#112233', padding: '2px 6px', borderRadius: '3px', 
              fontSize: '0.8rem', border: '1px solid #334455', color: '#ccc' 
            }}>
              {item}
            </span>
          ))}
        </div>
      </div>

      {/* 3. HEADER */}
      <div className="sys-panel" style={{ gridArea: 'header', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: '1.1rem', fontWeight: 'bold', textTransform: 'uppercase', color: 'white', letterSpacing: '1px' }}>
           {party.length < 3 ? "Project Inertia: Director's Cut" : currentRoom?.name || "Unknown Zone"}
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          <button onClick={() => setIsMuted(!isMuted)} style={{ 
            background: isMuted ? '#330000' : 'transparent', 
            border: '1px solid var(--sys-cyan)', 
            color: isMuted ? '#ff5555' : 'var(--sys-cyan)', 
            cursor: 'pointer', fontSize: '0.7rem', padding: '4px 10px', textTransform:'uppercase' 
          }}>
            {isMuted ? "AUDIO OFF" : "AUDIO ON"}
          </button>
          <span style={{ color: 'var(--sys-cyan)', fontFamily: 'monospace' }}>T: 00:00:00</span>
        </div>
      </div>

      {/* 4. IMAGE VISUALIZER */}
      <div className="sys-panel" style={{ gridArea: 'image', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#050505', position: 'relative', overflow: 'hidden' }}>
        {!isCombat && currentRoom?.image && (
          <img src={currentRoom.image} onError={(e) => { e.currentTarget.style.display = 'none'; }} alt="Vis" style={{ position: 'absolute', width: '100%', height: '100%', objectFit: 'cover', opacity: 0.4, filter: 'grayscale(20%) sepia(20%)' }} />
        )}
        {isCombat && activeEnemies.length > 0 ? (
           <div style={{ width: '85%', zIndex: 10, background: 'rgba(0,0,0,0.8)', padding: '15px', border: '1px solid red', boxShadow: '0 0 15px rgba(255,0,0,0.2)' }}>
             <h2 style={{ color: '#ff0000', textShadow: '0 0 10px red', margin: '0 0 15px 0', textAlign: 'center', letterSpacing: '2px' }}>COMBAT ALERT</h2>
             {renderEnemyBars()}
           </div>
        ) : (!currentRoom?.image && <span style={{ color: '#333', fontSize: '2rem', fontWeight:'bold' }}>NO SIGNAL</span>)}
      </div>

      {/* 5. TEXT OUTPUT */}
      <div className="sys-panel" style={{ gridArea: 'output', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ flex: 1, overflowY: 'auto', paddingRight: '5px', scrollBehavior: 'smooth' }}>
          {log.map((line, index) => (
            <div key={index} style={{ 
              marginBottom: '0.6rem', 
              borderLeft: line.includes('>') ? 'none' : '2px solid var(--sys-cyan)', 
              paddingLeft: line.includes('>') ? '0' : '10px', 
              color: line.includes('>') ? '#aaa' : line.includes('COMBAT') ? '#ff5555' : 'white',
              lineHeight: '1.5',
              fontSize: '1rem'
            }}>
              {line}
            </div>
          ))}
          <div ref={logEndRef} />
        </div>
      </div>

      {/* 6. INPUT */}
      <form className="sys-panel" style={{ gridArea: 'input', display: 'flex', padding: '0.5rem', alignItems:'center' }} onSubmit={handleSubmit}>
        <span style={{ padding: '0 1rem', fontSize: '1.2rem', color: 'var(--sys-cyan)' }}>{'>'}</span>
        <input 
          type="text" 
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={party.length < 3 ? "Initialize Hero..." : isCombat ? `[${activeHero?.name}]: Command...` : "Awaiting Input..."}
          autoFocus
          style={{ background: 'transparent', border: 'none', color: 'white', flex: 1, fontSize: '1.1rem', outline: 'none', fontFamily: 'monospace' }}
        />
      </form>
    </div>
  );
}

export default App;