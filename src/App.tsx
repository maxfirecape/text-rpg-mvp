import { useState, useEffect, useRef } from 'react';
import { useGameStore } from './store/gameStore';
import { processCommand } from './engine/parser'; 
import roomsData from './data/rooms.json';
import skillsData from './data/skills.json';
import itemsData from './data/items.json';

// --- AUDIO CONFIGURATION ---
const BASE = import.meta.env.BASE_URL; 
const cleanPath = (p: string) => (BASE.endsWith('/') ? BASE + p : BASE + '/' + p);

const AUDIO_INTRO = cleanPath("characterCreation.m4a");
const AUDIO_CHAR_INIT = cleanPath("characterInit.m4a"); 
const AUDIO_COMBAT = cleanPath("testbattle.m4a"); // <--- UPDATED TO testbattle.m4a
const AUDIO_AMBIANCE = cleanPath("rain.mp3");

function App() {
  const party = useGameStore(state => state.party);
  const log = useGameStore(state => state.log);
  const activeEnemies = useGameStore(state => state.activeEnemies);
  const isCombat = useGameStore(state => state.isCombat);
  const credits = useGameStore(state => state.credits);
  const inventory = useGameStore(state => state.inventory);
  const currentRoomId = useGameStore(state => state.currentRoomId);
  const tick = useGameStore(state => state.tick);
  const battleQueue = useGameStore(state => state.battleQueue);
  const isGameOver = useGameStore(state => state.isGameOver);
  const resetGame = useGameStore(state => state.resetGame);
  const runIntro = useGameStore(state => state.runIntro);
  const characterInitPlayed = useGameStore(state => state.characterInitPlayed);
  const setCharInitPlayed = useGameStore(state => state.setCharInitPlayed);
  
  const [input, setInput] = useState("");
  const [isMuted, setIsMuted] = useState(false);
  const logEndRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement>(new Audio());

  const currentRoom = roomsData.find(r => r.id === currentRoomId);

  const getShortAlias = (aliases?: string[]) => {
      if (!aliases || aliases.length === 0) return "";
      return aliases.reduce((a, b) => a.length <= b.length ? a : b);
  };

  useEffect(() => {
      runIntro();
  }, []);

  useEffect(() => {
    const interval = setInterval(() => tick(1), 1000);
    return () => clearInterval(interval);
  }, [tick]);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [log]);

  // --- AUDIO LOGIC ---
  useEffect(() => {
    const audio = audioRef.current;
    audio.volume = 0.4;
    
    if (isMuted) { 
        audio.pause(); 
        return; 
    }

    let track = AUDIO_AMBIANCE; 
    let shouldLoop = true;
    
    // 1. Character Creation (Loop)
    if (party.length < 3) {
        track = AUDIO_INTRO; 
    } 
    // 2. Character Init Jingle (One-shot)
    else if (!characterInitPlayed) {
        track = AUDIO_CHAR_INIT;
        shouldLoop = false;
    } 
    // 3. Combat (Loop)
    else if (isCombat) {
        track = AUDIO_COMBAT; 
    }
    // 4. Exploration (Loop) - Default

    // Logic to switch tracks smoothly
    if (!audio.src.includes(track)) {
      audio.src = track; 
      audio.loop = shouldLoop; 
      
      // Attempt play (catch error if user hasn't clicked yet)
      audio.play().catch((e) => { console.log("Audio play failed:", e); });

      // Handle One-Shot Completion for Init Jingle
      if (track === AUDIO_CHAR_INIT) {
          audio.onended = () => {
              setCharInitPlayed(); // Updates store -> triggers re-render -> switches to Ambiance
          };
      } else {
          audio.onended = null; // Clear listener for loops
      }

    } else if (audio.paused) {
      // Resume if unmuted
      audio.play().catch((e) => { console.log("Audio resume failed:", e); });
    }
  }, [isCombat, isMuted, party.length, characterInitPlayed]); 

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isGameOver) return;
    processCommand(input); 
    setInput("");
  };

  const renderEnemyBars = () => {
    return activeEnemies.map((enemy, index) => (
      <div key={enemy.id} style={{ width: '100%', marginBottom: '6px', opacity: enemy.hp <= 0 ? 0.3 : 1 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: '#ffaaaa' }}>
          <span>{enemy.name} <span style={{color:'cyan'}}>({index + 1})</span> {enemy.hp <= 0 && "(DEAD)"}</span>
          <span>{enemy.hp}/{enemy.maxHp}</span>
        </div>
        <div style={{ width: '100%', height: '6px', background: '#330000', border: '1px solid red' }}>
          <div style={{ width: `${(enemy.hp / enemy.maxHp) * 100}%`, height: '100%', background: 'red', transition: 'width 0.2s' }}></div>
        </div>
        <div style={{ display: 'flex', gap: '5px', marginTop:'2px' }}>
          {enemy.state === 'charging' && <span style={{ color:'yellow', fontSize:'0.7rem' }}>⚠ CHARGING</span>}
          {enemy.status.map((s, i) => (
            <span key={i} style={{ fontSize: '0.7rem', color: 'orange' }}>[{s.type}: {Math.ceil(s.duration)}s]</span>
          ))}
        </div>
      </div>
    ));
  };

  const renderContextPanel = () => {
    if (party.length < 3) return null;

    if (isCombat) {
      const activeCharId = battleQueue[0];
      const activeChar = party.find(p => p.id === activeCharId);
      
      if (!activeChar) return <div style={{ color: '#666', fontStyle: 'italic', fontSize:'0.9em' }}>Waiting for turn...</div>;

      const invCounts: {[key:string]:number} = {};
      inventory.forEach(id => { invCounts[id] = (invCounts[id] || 0) + 1; });

      return (
        <div>
          <h4 style={{ color: 'var(--sys-cyan)', margin: '0 0 5px 0', borderBottom:'1px solid #333' }}>
            ACT: {activeChar.name.toUpperCase()}
          </h4>
          <div style={{ marginBottom: '10px' }}>
            <div style={{ fontSize:'0.85em', color:'#ccc' }}>Attack (a)</div>
            <div style={{ fontSize:'0.85em', color:'#ccc' }}>Cast (c)</div>
            <div style={{ fontSize:'0.85em', color:'#ccc' }}>Use [item]</div>
          </div>
          <div style={{ marginBottom: '10px' }}>
            <div style={{ fontWeight:'bold', color:'white', fontSize:'0.8em' }}>SKILLS</div>
            {activeChar.unlockedSkills.map(sid => {
                // @ts-ignore
                const sk = skillsData.find(s => s.id === sid);
                return sk ? (
                  <div key={sid} style={{ fontSize:'0.85em', color:'#00eaff' }}>
                     {sk.name} <span style={{color:'#888', fontSize:'0.8em'}}>({getShortAlias(sk.aliases)})</span>
                  </div>
                ) : null;
            })}
          </div>
          <div>
            <div style={{ fontWeight:'bold', color:'white', fontSize:'0.8em' }}>ITEMS</div>
            {Object.keys(invCounts).map(iid => {
                // @ts-ignore
                const it = itemsData.find(i => i.id === iid);
                if (it && it.type === 'consumable') {
                    return (
                        <div key={iid} style={{ fontSize:'0.85em', color:'#00eaff' }}>
                            {it.name} x{invCounts[iid]} <span style={{color:'#888', fontSize:'0.8em'}}>({getShortAlias(it.aliases)})</span>
                        </div>
                    )
                }
                return null;
            })}
          </div>
          {battleQueue.length > 1 && (
              <div style={{ marginTop:'10px', borderTop:'1px solid #333', paddingTop:'2px' }}>
                  <div style={{fontSize:'0.7em', color:'#888'}}>NEXT: {party.find(p => p.id === battleQueue[1])?.name}</div>
              </div>
          )}
        </div>
      );
    }

    return (
      <div>
        <h4 style={{ color: 'var(--sys-cyan)', margin: '0 0 8px 0', borderBottom:'1px solid #333' }}>ROOM ACTIONS</h4>
        <div style={{ marginBottom: '10px' }}>
          {currentRoom?.exits ? Object.keys(currentRoom.exits).map(dir => (
             <div key={dir} style={{ fontSize:'0.85em', color:'#ccc' }}>
               Go {dir.charAt(0).toUpperCase() + dir.slice(1)} ({dir.charAt(0)})
             </div>
          )) : <div style={{color:'#666', fontSize:'0.8em'}}>No exits?</div>}
        </div>
        <div>
           {currentRoom?.interactables ? Object.keys(currentRoom.interactables)
             .filter(k => k !== 'door') 
             .map(obj => (
             <div key={obj} style={{ fontSize:'0.85em', color:'#00eaff' }}>
               x {obj}
             </div>
           )) : null}
        </div>
        <div style={{ marginTop:'10px', fontSize:'0.8em', color:'#666', display:'flex', flexDirection:'column', gap:'2px' }}>
           <div>help (h)</div>
           <div>inventory (i)</div>
           <div>stats</div>
           <div>look (l)</div>
           <div>check / examine (x)</div>
           <div>equipment (eq)</div>
           <div>use (u) [item]</div>
           <div>Character and Enemy Names (ID Numbers)</div>
           <div>cast (c)</div>
           <div>save, load, reset</div>
        </div>
      </div>
    );
  };

  return (
    <div className="game-layout">
      {isGameOver && (
          <div style={{
              position:'absolute', top:0, left:0, width:'100%', height:'100%', 
              background:'rgba(0,0,0,0.9)', zIndex:999, display:'flex', flexDirection:'column',
              alignItems:'center', justifyContent:'center', color:'red'
          }}>
              <h1 style={{fontSize:'3rem', margin:0}}>YOU DIED</h1>
              <button onClick={resetGame} style={{ background:'transparent', border:'1px solid red', color:'red', padding:'10px 20px', fontSize:'1.2rem', cursor:'pointer', marginTop:'20px' }}>
                  RESTART
              </button>
          </div>
      )}

      <div className="sidebar">
        <div className="panel-section tech-border" style={{ flex: '0 0 auto', maxHeight:'60%', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom:'5px' }}>
               <span style={{ color: 'var(--sys-cyan)', fontWeight:'bold' }}>PARTY</span>
               <span style={{ color:'#ffd700' }}>${credits}</span>
            </div>
            
            {party.length === 0 && <div style={{color:'#666', fontStyle:'italic', fontSize:'0.8em'}}>No heroes registered.</div>}

            {party.map((char, index) => (
              <div key={char.id} style={{ marginBottom: '6px', padding: '6px', background: 'rgba(255,255,255,0.05)', borderRadius: '4px' }}>
                <div style={{ fontWeight: 'bold', fontSize:'0.9em', display:'flex', justifyContent:'space-between' }}>
                    <span>
                        {char.name} <span style={{color:'cyan'}}>({index + 1})</span> 
                        <span style={{fontSize:'0.8em', color:'#aaa', marginLeft:'5px'}}>{char.classId.substring(0,3).toUpperCase()}</span>
                    </span>
                    {battleQueue[0] === char.id && <span style={{color:'lime', fontSize:'0.8em'}}>◀ ACT</span>}
                </div>
                <div style={{ fontSize:'0.8em', color:'#ccc', marginTop:'2px' }}>HP: {char.hp}/{char.maxHp} | SP: {char.mp}/{char.maxMp}</div>
                
                <div style={{ width: '100%', height: '3px', background: '#333', marginTop: '3px' }}>
                   <div style={{ width: `${(char.xp / char.maxXp)*100}%`, height: '100%', background: '#ffd700' }}></div>
                </div>
                
                {isCombat && (
                    <div style={{ display: 'flex', alignItems: 'center', marginTop: '3px', gap: '5px' }}>
                        <div style={{ flex: 1, height: '4px', background: '#222' }}>
                            <div style={{ 
                                width: `${Math.max(0, 100 - (char.atbTimer / 7) * 100)}%`, 
                                height: '100%', 
                                background: char.atbTimer <= 0 ? 'lime' : 'orange',
                                transition: 'width 1s linear'
                            }}></div>
                        </div>
                    </div>
                )}
                
                {char.status.length > 0 && <div style={{fontSize:'0.7rem', color:'orange', marginTop:'2px'}}>
                    {char.status.map(s => `${s.type} (${Math.ceil(s.duration)}s)`).join(', ')}
                </div>}
              </div>
            ))}
        </div>

        {/* CONTEXT SECTION (Fills Remaining Space) */}
        {party.length >= 3 && (
            <div className="panel-section tech-border" style={{ flex: 1, minHeight: 0, marginTop: '10px' }}>
                {renderContextPanel()}
            </div>
        )}
      </div>

      <div className="main-content">
        <div className="panel-section" style={{ display:'flex', justifyContent:'space-between', alignItems:'center', height:'40px' }}>
            <span style={{ fontWeight:'bold' }}>{party.length < 3 ? "CREATION" : currentRoom?.name}</span>
            <button onClick={() => setIsMuted(!isMuted)} style={{background:'none', border:'1px solid #333', color:'#666', fontSize:'0.7em', cursor:'pointer'}}>
                {isMuted ? "UNMUTE" : "MUTE"}
            </button>
        </div>

        <div style={{ height: '140px', background:'#000', position:'relative', display:'flex', justifyContent:'center', alignItems:'center', overflow:'hidden' }}>
            {isCombat && activeEnemies.length > 0 ? (
                <div style={{ width:'80%', zIndex:10 }}>
                    <div style={{textAlign:'center', color:'red', fontWeight:'bold', fontSize:'0.9em', marginBottom:'5px'}}>COMBAT ALERT</div>
                    {renderEnemyBars()}
                </div>
            ) : (!currentRoom?.image && <span style={{ color:'#333' }}>NO VISUAL</span>)}
            
            {!isCombat && currentRoom?.image && (
                <img src={currentRoom.image} style={{ width:'100%', height:'100%', objectFit:'cover', opacity:0.5 }} />
            )}
        </div>

        <div className="log-area">
            {log.map((l, i) => {
                let color = '#ccc';
                let text = l;
                let weight = 'normal';

                if (l.startsWith('|E|')) {
                    color = '#ffe066'; 
                    text = l.replace('|E| ', '');
                } else if (l.startsWith('|L|')) {
                    color = '#00ffcc'; 
                    text = l.replace('|L| ', '');
                    weight = 'bold';
                }

                return (
                    <div key={i} style={{ marginBottom:'4px', paddingLeft:'8px', borderLeft:'2px solid cyan', fontSize:'0.95em', lineHeight:'1.4em', color, fontWeight: weight }}>
                        {text}
                    </div>
                );
            })}
            <div ref={logEndRef} />
        </div>

        <div className="panel-section" style={{ background: 'var(--sys-panel)' }}>
            <form style={{ display:'flex', alignItems:'center' }} onSubmit={handleSubmit}>
                <span style={{ marginRight:'10px', color:'cyan' }}>&gt;</span>
                <input 
                    autoFocus 
                    type="text" 
                    value={input} 
                    onChange={e => setInput(e.target.value)} 
                    style={{ background:'transparent', border:'none', color:'white', flex:1, fontSize:'1.1em', outline:'none' }} 
                    placeholder="Enter command..." 
                />
            </form>
        </div>
      </div>

    </div>
  );
}

export default App;