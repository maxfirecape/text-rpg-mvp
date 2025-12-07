import { useState, useEffect, useRef } from 'react';
import { useGameStore } from './store/gameStore';
import { processCommand } from './engine/parser'; 
import roomsData from './data/rooms.json'; // Import room data for images

// Audio Tracks
const AUDIO_COMBAT = "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3"; 
const AUDIO_AMBIANCE = "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-15.mp3";

function App() {
  const party = useGameStore(state => state.party);
  const log = useGameStore(state => state.log);
  const activeEnemies = useGameStore(state => state.activeEnemies);
  const isCombat = useGameStore(state => state.isCombat);
  const inventory = useGameStore(state => state.inventory);
  const currentRoomId = useGameStore(state => state.currentRoomId);
  
  const [input, setInput] = useState("");
  const [isMuted, setIsMuted] = useState(false); // Mute State
  const logEndRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement>(new Audio());

  // Helper: Get Current Room Data
  const currentRoom = roomsData.find(r => r.id === currentRoomId);

  // Auto-scroll
  useEffect(() => {
    if (logEndRef.current) {
      logEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [log]);

  // Audio Logic
  useEffect(() => {
    const audio = audioRef.current;
    audio.volume = 0.2;
    
    if (isMuted) {
      audio.pause();
      return;
    }

    const track = isCombat ? AUDIO_COMBAT : AUDIO_AMBIANCE;
    
    // Only change track if it's different
    if (audio.src !== track) {
      audio.src = track;
      audio.loop = true;
      audio.play().catch(e => console.log("Audio waiting for interaction"));
    } else if (audio.paused) {
      audio.play().catch(e => console.log("Audio waiting for interaction"));
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
      <div key={enemy.id} style={{ width: '100%', marginBottom: '10px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', color: '#ffaaaa' }}>
          <span>{enemy.name}</span>
          <span>{enemy.hp}/{enemy.maxHp}</span>
        </div>
        <div style={{ width: '100%', height: '10px', background: '#330000', border: '1px solid red' }}>
          <div style={{ width: `${(enemy.hp / enemy.maxHp) * 100}%`, height: '100%', background: 'red', transition: 'width 0.2s' }}></div>
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
        {party.length === 0 ? <p style={{color:'#666'}}>Initializing...</p> : party.map((char) => (
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

      {/* 3. HEADER & AUDIO CONTROLS */}
      <div className="sys-panel" style={{ gridArea: 'header', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: '1.1rem', fontWeight: 'bold', textTransform: 'uppercase', color: 'white' }}>
           {party.length < 3 ? "Project Inertia: Director's Cut" : currentRoom?.name || "Unknown Location"}
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          <button 
            onClick={() => setIsMuted(!isMuted)}
            style={{ background: 'transparent', border: '1px solid var(--sys-cyan)', color: 'var(--sys-cyan)', cursor: 'pointer', fontSize: '0.8rem', padding: '2px 8px' }}
          >
            {isMuted ? "UNMUTE" : "MUTE AUDIO"}
          </button>
          <span style={{ color: 'var(--sys-cyan)' }}>T: 00:00:00</span>
        </div>
      </div>

      {/* 4. IMAGE VISUALIZER */}
      <div className="sys-panel" style={{ gridArea: 'image', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'black', position: 'relative', overflow: 'hidden' }}>
        
 {/* ROOM IMAGE LAYER */}
 {!isCombat && currentRoom?.image && (
          <img 
            src={currentRoom.image} 
            onError={(e) => { e.currentTarget.style.display = 'none'; }} // Hide if broken
            alt="Room Visual" 
            style={{ position: 'absolute', width: '100%', height: '100%', objectFit: 'cover', opacity: 0.5, filter: 'grayscale(30%)' }} 
          />
        )}

        {/* COMBAT HUD LAYER */}
        {isCombat && activeEnemies.length > 0 ? (
           <div style={{ width: '80%', zIndex: 10, background: 'rgba(0,0,0,0.7)', padding: '10px', border: '1px solid red' }}>
             <h2 style={{ color: '#ff0000', textShadow: '0 0 10px red', margin: '0 0 10px 0', textAlign: 'center' }}>COMBAT ALERT</h2>
             {renderEnemyBars()}
           </div>
        ) : (
          !currentRoom?.image && <span style={{ color: '#555' }}>[VISUAL FEED OFFLINE]</span>
        )}
      </div>

      {/* 5. TEXT OUTPUT */}
      <div className="sys-panel" style={{ gridArea: 'output', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
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