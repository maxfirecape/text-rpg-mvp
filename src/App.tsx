import { useState, useEffect, useRef } from 'react';
import { useGameStore } from './store/gameStore';
import { processCommand } from './engine/parser'; 
import roomsData from './data/rooms.json';
import skillsData from './data/skills.json';

const AUDIO_COMBAT = "/battle.mp3"; 
const AUDIO_AMBIANCE = "/dungeon.mp3";

function App() {
  const party = useGameStore(state => state.party);
  const log = useGameStore(state => state.log);
  const activeEnemies = useGameStore(state => state.activeEnemies);
  const isCombat = useGameStore(state => state.isCombat);
  const credits = useGameStore(state => state.credits);
  const currentRoomId = useGameStore(state => state.currentRoomId);
  const tick = useGameStore(state => state.tick);
  const battleQueue = useGameStore(state => state.battleQueue);
  const isGameOver = useGameStore(state => state.isGameOver);
  const resetGame = useGameStore(state => state.resetGame);
  
  const [input, setInput] = useState("");
  const [isMuted, setIsMuted] = useState(false);
  const logEndRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement>(new Audio());

  const currentRoom = roomsData.find(r => r.id === currentRoomId);

  // --- GAME LOOP ---
  useEffect(() => {
    const interval = setInterval(() => tick(1), 1000);
    return () => clearInterval(interval);
  }, [tick]);

  // --- AUTO SCROLL ---
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [log]);

  // --- AUDIO ---
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
    if (!input.trim() || isGameOver) return;
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

  const renderContextPanel = () => {
    // 1. BATTLE MODE
    if (isCombat) {
      const activeCharId = battleQueue[0];
      const activeChar = party.find(p => p.id === activeCharId);
      
      if (!activeChar) {
        return <div style={{ color: '#888', fontStyle: 'italic' }}>Wait...</div>;
      }

      return (
        <div>
          <h3 style={{ color: 'var(--sys-cyan)', margin: '0 0 10px 0', borderBottom:'1px solid #333' }}>
            ACTION: {activeChar.name.toUpperCase()}
          </h3>
          
          <div style={{ marginBottom: '15px' }}>
            <div style={{ fontWeight:'bold', color:'white' }}>BASIC</div>
            <div style={{ fontSize:'0.9em', color:'#ccc' }}>Attack (a)</div>
            <div style={{ fontSize:'0.9em', color:'#ccc' }}>Defend (d) - <span style={{color:'#666'}}>Not Impl</span></div>
          </div>

          <div>
            <div style={{ fontWeight:'bold', color:'white' }}>SKILLS</div>
            {activeChar.unlockedSkills.length === 0 && <div style={{color:'#666'}}>No skills.</div>}
            {activeChar.unlockedSkills.map(sid => {
                // @ts-ignore
                const sk = skillsData.find(s => s.id === sid);
                return sk ? (
                  <div key={sid} style={{ fontSize:'0.9em', color:'#00eaff', marginBottom:'4px' }}>
                     {sk.name} <span style={{color:'#888'}}>({sk.aliases ? sk.aliases[0] : '?'})</span>
                     <span style={{float:'right', color:'#ff00ff'}}>{sk.cost} SP</span>
                  </div>
                ) : null;
            })}
          </div>

          {/* NEXT UP DISPLAY */}
          {battleQueue.length > 1 && (
              <div style={{ marginTop:'15px', borderTop:'1px solid #333', paddingTop:'5px' }}>
                  <div style={{fontSize:'0.7em', color:'#888'}}>NEXT:</div>
                  {battleQueue.slice(1).map(qid => {
                      const c = party.find(p => p.id === qid);
                      return <div key={qid} style={{fontSize:'0.8em', color:'#666'}}>{c?.name}</div>
                  })}
              </div>
          )}

          <div style={{ marginTop:'20px', fontSize:'0.8em', color:'#666', borderTop:'1px solid #333', paddingTop:'5px' }}>
            TIP: Type command or abbreviation.
          </div>
        </div>
      );
    }

    // 2. EXPLORATION MODE
    return (
      <div>
        <h3 style={{ color: 'var(--sys-cyan)', margin: '0 0 10px 0', borderBottom:'1px solid #333' }}>
          ROOM ACTIONS
        </h3>

        <div style={{ marginBottom: '15px' }}>
          <div style={{ fontWeight:'bold', color:'white' }}>NAVIGATION</div>
          {currentRoom?.exits ? Object.keys(currentRoom.exits).map(dir => (
             <div key={dir} style={{ fontSize:'0.9em', color:'#ccc' }}>
               Go {dir.charAt(0).toUpperCase() + dir.slice(1)} ({dir.charAt(0)})
             </div>
          )) : <div style={{color:'#666'}}>No exits?</div>}
        </div>

        <div style={{ marginBottom: '15px' }}>
           <div style={{ fontWeight:'bold', color:'white' }}>OBJECTS</div>
           {currentRoom?.interactables ? Object.keys(currentRoom.interactables)
             .filter(k => k !== 'door') 
             .map(obj => (
             <div key={obj} style={{ fontSize:'0.9em', color:'#00eaff' }}>
               Examine {obj} (x {obj})
             </div>
           )) : <div style={{color:'#666'}}>Nothing of note.</div>}
        </div>

        <div>
           <div style={{ fontWeight:'bold', color:'white' }}>SYSTEM</div>
           <div style={{ fontSize:'0.9em', color:'#ccc' }}>Inventory (i)</div>
           <div style={{ fontSize:'0.9em', color:'#ccc' }}>Status (stats)</div>
           <div style={{ fontSize:'0.9em', color:'#ccc' }}>Look (l)</div>
           <div style={{ fontSize:'0.9em', color:'#ccc' }}>Save / Load</div>
        </div>
      </div>
    );
  };

  return (
    <div className="game-grid" style={{position:'relative'}}>
      
      {/* GAME OVER OVERLAY */}
      {isGameOver && (
          <div style={{
              position:'absolute', top:0, left:0, width:'100%', height:'100%', 
              background:'rgba(0,0,0,0.9)', zIndex:999, display:'flex', flexDirection:'column',
              alignItems:'center', justifyContent:'center', color:'red'
          }}>
              <h1 style={{fontSize:'4rem', fontFamily:'serif'}}>YOU DIED</h1>
              <button 
                onClick={resetGame}
                style={{
                    background:'transparent', border:'1px solid red', color:'red', 
                    padding:'10px 30px', fontSize:'1.5rem', cursor:'pointer'
                }}
              >
                  RESTART
              </button>
          </div>
      )}

      {/* LEFT PANEL: PARTY STATUS */}
      <div className="sys-panel" style={{ gridArea: 'status', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
           <h2 style={{ color: 'var(--sys-cyan)', margin: 0 }}>PARTY</h2>
           <span style={{ color:'#ffd700' }}>${credits}</span>
        </div>
        <div style={{ borderBottom: '1px solid var(--sys-cyan)', opacity: 0.5, marginBottom:'10px' }}></div>
        
        {party.map(char => (
          <div key={char.id} style={{ marginBottom: '10px', padding: '5px', background: 'rgba(0,0,0,0.3)', borderRadius: '4px' }}>
            <div style={{ fontWeight: 'bold' }}>
                {char.name} <span style={{fontSize:'0.8em', color:'#aaa'}}>{char.classId.toUpperCase()}</span>
                {battleQueue[0] === char.id && <span style={{marginLeft:'5px', color:'lime', fontSize:'0.7em'}}>◀ ACT</span>}
            </div>
            <div style={{ fontSize:'0.9em' }}>HP: {char.hp}/{char.maxHp} | SP: {char.mp}/{char.maxMp}</div>
            
            {/* XP BAR */}
            <div style={{ width: '100%', height: '3px', background: '#333', marginTop: '4px' }}>
               <div style={{ width: `${(char.xp / char.maxXp)*100}%`, height: '100%', background: '#ffd700' }}></div>
            </div>
            
            {/* COOLDOWN BAR (Battle Only) */}
            {isCombat && (
                <div style={{ display: 'flex', alignItems: 'center', marginTop: '2px', gap: '5px' }}>
                    <span style={{ fontSize: '0.7em', color: '#888' }}>CD:</span>
                    <div style={{ flex: 1, height: '4px', background: '#222' }}>
                        <div style={{ 
                            // 7 Second Cooldown Visualization
                            width: `${Math.max(0, 100 - (char.atbTimer / 7) * 100)}%`, 
                            height: '100%', 
                            background: char.atbTimer <= 0 ? 'lime' : 'orange',
                            transition: 'width 1s linear'
                        }}></div>
                    </div>
                </div>
            )}

            {char.status.length > 0 && <div style={{fontSize:'0.7rem', color:'orange'}}>{char.status.map(s=>s.type).join(', ')}</div>}
          </div>
        ))}
      </div>

      {/* RIGHT PANEL: CONTEXTUAL ACTIONS */}
      <div className="sys-panel" style={{ gridArea: 'info', overflowY: 'auto' }}>
        {renderContextPanel()}
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