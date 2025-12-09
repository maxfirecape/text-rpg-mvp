import { useState, useEffect, useRef } from 'react';
import { useGameStore } from './store/gameStore';
import { processCommand } from './engine/parser'; 
import roomsData from './data/rooms.json';

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
  const tick = useGameStore(state => state.tick);
  
  const [input, setInput] = useState("");
  const [isMuted, setIsMuted] = useState(false);
  const logEndRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement>(new Audio());

  const currentRoom = roomsData.find(r => r.id === currentRoomId);

  // GAME LOOP (ATB TICK)
  useEffect(() => {
    const interval = setInterval(() => {
      tick(1); 
    }, 1000);
    return () => clearInterval(interval);
  }, [tick]);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [log]);

  useEffect(() => {
    const audio = audioRef.current;
    audio.volume = 0.4;
    if (isMuted) { audio.pause(); return; }
    const track = isCombat ? AUDIO_COMBAT : AUDIO_AMBIANCE;
    if (!audio.src.includes(track)) {
      audio.src = track; audio.loop = true; 
      audio.play().catch(() => {});
    } else if (audio.paused) audio.play().catch(() => {});
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
        <div style={{ display: 'flex', gap: '5px', marginTop:'2px' }}>
          {enemy.state === 'charging' && <span style={{ color:'yellow', fontSize:'0.7rem' }}>⚠ CHARGING</span>}
          {enemy.status.map((s, i) => (
            <span key={i} style={{ fontSize: '0.7rem', color: 'orange' }}>[{s.type}]</span>
          ))}
        </div>
      </div>
    ));
  };

  return (
    <div className="game-grid">
      <div className="sys-panel" style={{ gridArea: 'status', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
           <h2 style={{ color: 'var(--sys-cyan)', margin: 0 }}>PARTY</h2>
           <span style={{ color:'#ffd700' }}>${credits}</span>
        </div>
        <div style={{ borderBottom: '1px solid var(--sys-cyan)', opacity: 0.5, marginBottom:'10px' }}></div>
        {party.map(char => (
          <div key={char.id} style={{ marginBottom: '10px', padding: '5px', background: 'rgba(0,0,0,0.3)', borderRadius: '4px' }}>
            <div style={{ fontWeight: 'bold' }}>{char.name} <span style={{fontSize:'0.8em', color:'#aaa'}}>{char.classId.toUpperCase()}</span></div>
            <div style={{ fontSize:'0.9em' }}>HP: {char.hp}/{char.maxHp} | SP: {char.mp}/{char.maxMp}</div>
            <div style={{ width: '100%', height: '3px', background: '#333', marginTop: '4px' }}>
               <div style={{ width: `${(char.xp / char.maxXp)*100}%`, height: '100%', background: '#ffd700' }}></div>
            </div>
            {char.status.length > 0 && <div style={{fontSize:'0.7rem', color:'orange'}}>{char.status.map(s=>s.type).join(', ')}</div>}
          </div>
        ))}
      </div>

      <div className="sys-panel" style={{ gridArea: 'info', overflowY: 'auto' }}>
        <h3 style={{ color: 'var(--sys-cyan)', margin: 0 }}>BAG</h3>
        <div style={{ fontSize: '0.8em', color: '#ccc' }}>
           {inventory.length === 0 ? "Empty" : "Use 'i' to count items"}
        </div>
      </div>

      <div className="sys-panel" style={{ gridArea: 'header', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <span style={{ fontWeight:'bold' }}>{party.length < 3 ? "CHARACTER CREATION" : currentRoom?.name}</span>
        <button onClick={() => setIsMuted(!isMuted)}>{isMuted ? "UNMUTE" : "MUTE"}</button>
      </div>

      <div className="sys-panel" style={{ gridArea: 'image', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', background:'#000' }}>
        {isCombat && activeEnemies.length > 0 ? (
          <div style={{ width:'90%' }}>
            <h2 style={{ color:'red', textAlign:'center' }}>COMBAT ALERT</h2>
            {renderEnemyBars()}
          </div>
        ) : (!currentRoom?.image && <span style={{ color:'#555' }}>[VISUAL FEED OFFLINE]</span>)}
        {!isCombat && currentRoom?.image && <img src={currentRoom.image} style={{position:'absolute', width:'100%', height:'100%', objectFit:'cover', opacity:0.4}} />}
      </div>

      <div className="sys-panel" style={{ gridArea: 'output', overflowY: 'auto' }}>
        {log.map((l, i) => (
          <div key={i} style={{ marginBottom:'4px', paddingLeft:'5px', borderLeft:'2px solid cyan' }}>{l}</div>
        ))}
        <div ref={logEndRef} />
      </div>

      <form className="sys-panel" style={{ gridArea: 'input', display:'flex', alignItems:'center' }} onSubmit={handleSubmit}>
        <span style={{ marginRight:'10px', color:'cyan' }}>&gt;</span>
        <input autoFocus type="text" value={input} onChange={e => setInput(e.target.value)} style={{ background:'transparent', border:'none', color:'white', flex:1, fontSize:'1.1em' }} placeholder="Enter command..." />
      </form>
    </div>
  );
}

export default App;