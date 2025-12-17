import { create } from 'zustand';
import type { Character, Enemy, Item, Stats, StatusEffect, Skill, Class, EnemyMove } from '../types';
import skillsData from '../data/skills.json';
import itemsData from '../data/items.json';
import enemiesData from '../data/enemies.json'; 
import classesDataJson from '../data/classes.json';

const classesData = classesDataJson as unknown as Class[];
const allEnemies = enemiesData as unknown as Enemy[];
const getItem = (id: string | null) => itemsData.find(i => i.id === id) as Item | undefined;

const calcVal = (formula: string, stats: Stats, lvl: number = 1): number => {
  try {
    let e = formula.toLowerCase();
    e = e.replace(/\[?str\]?/g, stats.str.toString()).replace(/\[?dex\]?/g, stats.dex.toString())
         .replace(/\[?con\]?/g, stats.con.toString()).replace(/\[?wis\]?/g, stats.wis.toString())
         .replace(/\[?lvl\]?/g, lvl.toString());
    e = e.replace(/(\d+)d(\d+)/g, (_m, c, s) => {
      let t = 0; for(let i=0; i<parseInt(c); i++) t += Math.floor(Math.random()*parseInt(s))+1; return t.toString();
    });
    return Math.floor(new Function('return ' + e)());
  } catch { return 1; }
};

export interface GameState {
  party: Character[]; inventory: string[]; credits: number; currentRoomId: string; log: string[];
  isCombat: boolean; activeEnemies: Enemy[]; isInputLocked: boolean; activeDialogue: string | null;
  tempCharacterName: string | null; 
  lootedChests: string[];
  battleQueue: string[];
  isGameOver: boolean;

  addLog: (m: string) => void;
  setRoom: (id: string) => void;
  setInputLock: (l: boolean) => void;
  setDialogue: (id: string|null) => void;
  setTempName: (n: string|null) => void;
  addCharacter: (c: Character, cr: number) => void;
  addToInventory: (id: string) => void;
  equipItem: (idx: number, id: string) => void;
  unequipItem: (idx: number, s: string, i?: number) => void;
  useItem: (itemId: string, targetIdx?: number) => void;
  setChestLooted: (id: string) => void;
  resetGame: () => void;
  saveGame: () => void; 
  loadGame: () => boolean; 
  getDerivedStats: (c: Character) => Stats;
  fullRestore: () => void;
  
  startCombat: (e: Enemy[]) => void;
  performAction: (aIdx: number, sId: string, tIdx: number, type?: 'enemy'|'party') => void;
  tick: (dt: number) => void; 
}

export const useGameStore = create<GameState>((set, get) => ({
  party: [], inventory: [], credits: 0, currentRoomId: 'room_01_cell', log: ["Welcome to Inertia.", "Enter Name for Hero 1:"], 
  isCombat: false, activeEnemies: [], isInputLocked: false, activeDialogue: null, tempCharacterName: null,
  lootedChests: [],
  battleQueue: [],
  isGameOver: false,

  addLog: (m) => set(s => ({ log: [...s.log, m] })),
  setRoom: (id) => set({ currentRoomId: id }),
  setInputLock: (l) => set({ isInputLocked: l }),
  setDialogue: (id) => set({ activeDialogue: id }),
  setTempName: (n) => set({ tempCharacterName: n }),
  addCharacter: (c, cr) => set(s => ({ party: [...s.party, { ...c, atbTimer: 3.5 }], credits: s.credits + cr, tempCharacterName: null })),
  addToInventory: (id) => set(s => ({ inventory: [...s.inventory, id] })),
  setChestLooted: (id) => set(s => ({ lootedChests: [...s.lootedChests, id] })),

  resetGame: () => set({
    party: [], inventory: [], credits: 0, currentRoomId: 'room_01_cell', 
    log: ["Welcome to Inertia.", "Enter Name for Hero 1:"],
    isCombat: false, activeEnemies: [], isInputLocked: false, activeDialogue: null, 
    tempCharacterName: null, lootedChests: [], battleQueue: [], isGameOver: false
  }),

  fullRestore: () => set(s => {
      const p = s.party.map(c => ({...c, hp: c.maxHp, mp: c.maxMp, status: []}));
      return { party: p, log: [...s.log, "Party fully rested."] };
  }),

  saveGame: () => {
    const s = get();
    const data = {
      party: s.party,
      inventory: s.inventory,
      credits: s.credits,
      currentRoomId: s.currentRoomId,
      lootedChests: s.lootedChests
    };
    try {
        localStorage.setItem('rpg_save_v1', JSON.stringify(data));
        set(state => ({ log: [...state.log, "Game Saved."] }));
    } catch (e) {
        console.error("Save failed", e);
        set(state => ({ log: [...state.log, "Save Failed!"] }));
    }
  },

  loadGame: () => {
    const raw = localStorage.getItem('rpg_save_v1');
    if (!raw) return false;
    try {
      const data = JSON.parse(raw);
      set({
        party: data.party,
        inventory: data.inventory,
        credits: data.credits,
        currentRoomId: data.currentRoomId,
        lootedChests: data.lootedChests || [],
        log: ["Game Loaded.", `Welcome back to ${data.currentRoomId}.`],
        isCombat: false, 
        activeEnemies: [],
        battleQueue: [],
        isGameOver: false,
        isInputLocked: false,
        activeDialogue: null
      });
      return true;
    } catch (e) {
      console.error("Save file corrupted", e);
      return false;
    }
  },

  getDerivedStats: (c: Character) => {
    const s = { ...c.stats };
    const items = [c.equipment.weapon, c.equipment.armor, ...c.equipment.accessories];
    items.forEach(id => {
        if (!id) return;
        const item = getItem(id);
        if (item?.statBonus) {
            if (item.statBonus.str) s.str += item.statBonus.str;
            if (item.statBonus.dex) s.dex += item.statBonus.dex;
            if (item.statBonus.con) s.con += item.statBonus.con;
            if (item.statBonus.wis) s.wis += item.statBonus.wis;
        }
    });
    return s;
  },

  equipItem: (idx, id) => set(s => {
    const p = [...s.party]; const c = p[idx]; const item = getItem(id);
    if(!item || !s.inventory.includes(id)) return {};
    const inv = [...s.inventory]; inv.splice(inv.indexOf(id), 1);
    if(item.type === 'weapon') { if(c.equipment.weapon) inv.push(c.equipment.weapon); c.equipment.weapon = id; }
    else if(item.type === 'armor') { if(c.equipment.armor) inv.push(c.equipment.armor); c.equipment.armor = id; }
    else if(item.type === 'accessory') {
      if(c.equipment.accessories.length >= 3) inv.push(c.equipment.accessories.shift()!);
      c.equipment.accessories.push(id);
    }
    return { party: p, inventory: inv, log: [...s.log, `${c.name} equipped ${item.name}.`] };
  }),

  unequipItem: (idx, slot, i=0) => set(s => {
    const p = [...s.party]; const c = p[idx]; const inv = [...s.inventory];
    let r: string|null = null;
    if(slot==='weapon') { r=c.equipment.weapon; c.equipment.weapon=null; }
    else if(slot==='armor') { r=c.equipment.armor; c.equipment.armor=null; }
    else if(slot==='accessory') r=c.equipment.accessories.splice(i,1)[0];
    if(r) inv.push(r);
    return { party: p, inventory: inv };
  }),

  useItem: (itemId, targetIdx = 0) => set(s => {
      const inv = [...s.inventory];
      const idx = inv.indexOf(itemId);
      if (idx === -1) return { log: [...s.log, "You don't have that."] };

      const item = getItem(itemId);
      if (!item || item.type !== 'consumable') return { log: [...s.log, "You can't use that."] };

      const p = [...s.party];
      const target = p[targetIdx];
      
      let msg = `Used ${item.name}.`;
      
      if (item.effect?.startsWith('heal_')) {
          const formula = item.effect.replace('heal_', '');
          const val = calcVal(formula, target.stats, target.level);
          target.hp = Math.min(target.maxHp, target.hp + val);
          msg = `Healed ${target.name} for ${val} HP.`;
      } else if (item.effect === 'restore_skill') {
          target.mp = Math.min(target.maxMp, target.mp + 2);
          msg = `Restored SP to ${target.name}.`;
      }

      inv.splice(idx, 1);
      return { party: p, inventory: inv, log: [...s.log, msg] };
  }),

  startCombat: (e) => set(s => ({ 
      isCombat: true, 
      activeEnemies: e.map(x => ({...x, atbTimer: Math.random()*2 + 3, state: 'idle', phases: [], moves: x.moves || [] })), 
      battleQueue: [], 
      log: [...s.log, "COMBAT STARTED!"] 
  })),

  tick: (dt) => set(s => {
    if(!s.isCombat || s.isGameOver) return {}; 

    const nextQueue = [...s.battleQueue];
    let newLog = [...s.log];
    let nextParty = [...s.party]; 

    // 1. Process Party Logic
    const processEntityTick = (entity: any) => {
        if (entity.hp <= 0) return entity;
        let newTimer = (entity.atbTimer || 0);
        if (newTimer > 0) newTimer -= dt;
        if (newTimer <= 0 && !nextQueue.includes(entity.id) && entity.isPlayerControlled) nextQueue.push(entity.id);

        const dotEffects = entity.status.filter((s: StatusEffect) => ['burn', 'poison'].includes(s.type));
        if (dotEffects.length > 0) {
            const dmg = dotEffects.length; 
            entity.hp = Math.max(0, entity.hp - dmg);
        }

        const hotEffects = entity.status.filter((s: StatusEffect) => ['Healing Rain', 'Group Rain'].includes(s.type));
        if (hotEffects.length > 0) hotEffects.forEach((s: StatusEffect) => { entity.hp = Math.min(entity.maxHp, entity.hp + (s.val || 1)); });

        const activeStatus = entity.status.filter((eff: StatusEffect) => {
            eff.duration -= dt;
            return eff.duration > 0;
        });
        
        if (activeStatus.length !== entity.status.length || newTimer !== entity.atbTimer || dotEffects.length > 0 || hotEffects.length > 0) {
            return { ...entity, status: activeStatus, atbTimer: Math.max(0, newTimer) };
        }
        return entity;
    };
    nextParty = nextParty.map(processEntityTick);

    // 2. ENEMY AI
    let nextEnemies = s.activeEnemies.map((e: Enemy) => {
      if(e.hp <= 0 || e.status.some((x: StatusEffect) => ['stun','frozen','disabled'].includes(x.type))) return e;

      let newTimer = (e.atbTimer || 0) - dt;
      let newState = e.state;
      let currentMove = e.currentMove;
      let phases = e.phases || [];

      // DoT Logic for Enemies
      const dotEffects = e.status.filter((s: StatusEffect) => ['burn', 'poison'].includes(s.type));
      if (dotEffects.length > 0) {
          const dmg = dotEffects.length; 
          e.hp = Math.max(0, e.hp - dmg);
          if (Math.random() > 0.8) newLog.push(`${e.name} burns/suffers for ${dmg} damage.`);
      }

      // --- WARDEN PHASE LOGIC ---
      if (e.id.includes('warden')) {
          const hpPercent = e.hp / e.maxHp;
          if (hpPercent <= 0.60 && !phases.includes('enraged')) {
              phases.push('enraged');
              newLog.push(`${e.name} is getting heated! (BERZERK)`);
              e.status.push({ type: 'berzerk', duration: 999, val: 1.5, stat: 'dmg_mult' });
          } else if (hpPercent <= 0.40 && !phases.includes('tired')) {
              phases.push('tired');
              newLog.push(`${e.name} seems out of breath.`);
          } else if (hpPercent <= 0.20 && !phases.includes('staggered')) {
              phases.push('staggered');
              newLog.push(`${e.name} staggers!`);
          }
      }
      
      // --- GENERIC LOW HEALTH LOGIC (30%) ---
      if (!phases.includes('low_hp_msg') && (e.hp / e.maxHp) <= 0.30) {
          phases.push('low_hp_msg');
          newLog.push(e.messages?.lowHealth || `${e.name} stumbles!`);
      }

      // --- STATE MACHINE ---
      if(e.state === 'idle' && newTimer <= 0) {
         const roll = Math.random() * 100;
         let accumulated = 0;
         let selectedMove: EnemyMove | undefined;
         
         if (!e.moves || e.moves.length === 0) {
             selectedMove = { name: "Attack", type: "attack", chance: 100, chargeTime: 1.0, staggerChance: 0.5, msgPrep: "Enemy readies weapon!", msgHit: "Enemy attacks!" };
         } else {
             for (const move of e.moves) {
                 accumulated += move.chance;
                 if (roll <= accumulated) {
                     selectedMove = move;
                     break;
                 }
             }
         }
         
         if (selectedMove) {
             newLog.push(selectedMove.msgPrep);
             newState = 'charging';
             newTimer = selectedMove.chargeTime; 
             currentMove = selectedMove;
         }
      } 
      else if(e.state === 'charging' && newTimer <= 0 && currentMove) {
         newLog.push(currentMove.msgHit);
         
         if (currentMove.type === 'summon' && currentMove.summonId) {
             e.spawnRequest = currentMove.summonId; 
         } else if (currentMove.type === 'heal') {
             const healAmt = Math.floor((Math.random() * 6 + 1 + Math.random() * 6 + 1) * (currentMove.val || 2));
             e.hp = Math.min(e.maxHp, e.hp + healAmt);
             newLog.push(`${e.name} healed for ${healAmt}.`);
         } else {
             const livingTargets = nextParty.filter((p: Character) => p.hp > 0);
             if(livingTargets.length > 0) {
               const targets = currentMove.type === 'aoe_attack' ? livingTargets : [livingTargets[Math.floor(Math.random()*livingTargets.length)]];
               targets.forEach(target => {
                   const mult = currentMove?.val || 1.0;
                   const bzk = e.status.find(s => s.type === 'berzerk')?.val || 1.0;
                   const baseDmg = Math.floor((Math.random()*4+1 + Math.floor(e.stats.str/2)) * mult * bzk);
                   
                   let reduct = 0;
                   const arm = getItem(target.equipment.armor);
                   if(arm?.defense) reduct += Math.random()*(arm.defense.max - arm.defense.min) + arm.defense.min;
                   
                   const dmg = Math.max(1, Math.floor(baseDmg * (1 - reduct)));
                   target.hp = Math.max(0, target.hp - dmg);
                   newLog.push(`${e.name} hit ${target.name} for ${dmg}.`);
               });
             }
         }

         newState = 'idle';
         newTimer = Math.random()*2 + 3; 
         currentMove = undefined;
      }
      
      return { ...e, atbTimer: newTimer, state: newState, currentMove, phases };
    });

    // --- HANDLE SPAWNS ---
    const spawns: Enemy[] = [];
    nextEnemies = nextEnemies.map(e => {
        if ((e as any).spawnRequest) {
            const template = allEnemies.find(x => x.id === (e as any).spawnRequest);
            if (template) {
                // --- FIX: INITIALIZE SPAWN STATE CORRECTLY ---
                spawns.push({ 
                    ...template, 
                    id: `e${Date.now()}_${Math.random()}`, 
                    name: `${template.name} (Add)`, 
                    hp: template.hp, maxHp: template.maxHp, status: [], moves: template.moves,
                    state: 'idle', // Crucial
                    atbTimer: 3,   // Crucial
                    phases: []
                });
                newLog.push(`A ${template.name} joined the battle!`);
            }
            delete (e as any).spawnRequest;
        }
        return e;
    });
    nextEnemies = [...nextEnemies, ...spawns];

    if (nextParty.every(p => p.hp <= 0)) {
        return { party: nextParty, activeEnemies: nextEnemies, log: [...newLog, "PARTY WIPED OUT!"], isGameOver: true };
    }

    const cleanQueue = nextQueue.filter(qid => {
        const c = nextParty.find(p => p.id === qid);
        return c && c.hp > 0;
    });

    return { party: nextParty, activeEnemies: nextEnemies, log: newLog, battleQueue: cleanQueue };
  }),

  performAction: (aIdx, sId, tIdx, type='enemy') => {
    set(s => {
      const p = [...s.party]; const e = [...s.activeEnemies]; const actor = p[aIdx];
      let inv = [...s.inventory];

      if(actor.hp <= 0) return { log: [...s.log, `${actor.name} is down!`] };
      if (s.battleQueue[0] !== actor.id) {
          return { log: [...s.log, `It is not ${actor.name}'s turn!`] };
      }

      let skill: Skill | undefined;
      let usedItem = false;
      const itemAction = getItem(sId);
      if (itemAction && itemAction.type === 'consumable') {
          if (!inv.includes(sId)) return { log: [...s.log, "You don't have that!"] };
          usedItem = true;
          skill = { id: itemAction.id, name: itemAction.name, cost: 0, type: 'utility', description: itemAction.description };
          if (itemAction.effect) {
             if (itemAction.effect.startsWith('heal_')) { skill.type = 'heal'; skill.formula = itemAction.effect.replace('heal_', ''); }
             else if (itemAction.effect === 'restore_skill') { skill.type = 'restore_mp'; skill.formula = '1d4'; }
             else if (itemAction.effect === 'revive') { skill.type = 'revive'; skill.formula = '50%'; }
          }
      } else {
          skill = skillsData.find(x => x.id === sId) as Skill | undefined;
          if(sId === 'attack') {
             skill = { id:'attack', name:'Attack', cost:0, type:'physical', formula: getItem(actor.equipment.weapon)?.damage || "[STR]+1d2", description:'' };
          }
      }

      if(!skill) return { log: [...s.log, "Unknown skill or item."] };
      
      if (!usedItem) {
          if (sId !== 'attack' && !actor.unlockedSkills.includes(sId)) { return { log: [...s.log, `${actor.name} does not know '${skill.name}'.`] }; }
          if(actor.mp < skill.cost) return { log: [...s.log, "Not enough SP"] };
          actor.mp -= skill.cost;
      } else {
          const itemIdx = inv.indexOf(sId);
          if (itemIdx > -1) inv.splice(itemIdx, 1);
      }

      const actorStats = get().getDerivedStats(actor);
      actor.atbTimer = 7; 
      const newQueue = [...s.battleQueue];
      newQueue.shift();
      let logMsg = "";

      if (skill.subType === 'steal') {
          const newCredits = s.credits + 50;
          logMsg = `${actor.name} stole $50!`;
          return { party: p, credits: newCredits, battleQueue: newQueue, log: [...s.log, logMsg] };
      }

      if(skill.type === 'buff') {
         const t = type==='party' ? p[tIdx] : actor; 
         t.status.push({ type: skill.name, duration: skill.duration || 10, val: skill.val, stat: skill.stat });
         logMsg = `${actor.name} uses ${skill.name} on ${t.name}.`;
      }
      else if(skill.type === 'restore_mp') {
         const t = p[tIdx];
         const amt = calcVal(skill.formula || "1", actorStats, actor.level);
         t.mp = Math.min(t.maxMp, t.mp + amt);
         logMsg = `${actor.name} restores ${amt} SP to ${t.name}.`;
      }
      else if(skill.type === 'heal' || skill.type === 'revive') {
         const targets = (skill.target === 'party') ? p : [p[tIdx]];
         targets.forEach(t => {
             if (skill.duration && skill.duration > 0) {
                 const amt = calcVal(skill.formula || "[WIS]", actorStats, actor.level);
                 t.status.push({ type: skill.name, duration: skill.duration, val: amt });
             } else {
                 let amt = 0;
                 if(skill.formula?.includes('%')) { 
                    if(skill.id === 'max_revive' || skill.formula === '100%') amt = t.maxHp;
                    else amt = Math.floor(t.maxHp * 0.5) + calcVal("2d4", actorStats);
                    if(t.hp <= 0) t.hp = amt; else t.hp = Math.min(t.maxHp, t.hp + amt);
                 } else {
                    amt = calcVal(skill.formula || "[WIS]", actorStats, actor.level);
                    t.hp = Math.min(t.maxHp, t.hp + amt);
                 }
             }
         });
         logMsg = `${actor.name} casts ${skill.name}.`;
      }
      else { 
         const t = e[tIdx];
         if (!t) return { log: [...s.log, "Target not found."] };
         if (t.hp <= 0) return { log: [...s.log, "Target is already dead."] };
         
         const hitChance = actor.stats.hitChance + (skill.hitChanceBonus || 0);
         const targetDex = t.stats.dex; 
         const evadeChance = targetDex * 0.5;
         const finalHitChance = hitChance - evadeChance;

         if (Math.random() * 100 > finalHitChance) {
             return { party: p, inventory: inv, battleQueue: newQueue, log: [...s.log, `${actor.name} attacks ${t.name} but MISSES!`] };
         }

         if (t.state === 'charging' && t.currentMove && t.currentMove.staggerChance > 0) {
             if (Math.random() < t.currentMove.staggerChance) {
                 t.state = 'idle';
                 t.atbTimer = 2; 
                 logMsg = `${actor.name} hits ${t.name} and STAGGERS them!`;
             }
         }

         let formula = skill.formula;
         if (skill.type === 'physical' && !formula) {
             const weapon = getItem(actor.equipment.weapon);
             formula = weapon?.damage || "[STR]+1d2";
         }

         let base = calcVal(formula || "1d4", actorStats, actor.level);
         if(skill.val) base = Math.floor(base * skill.val);
         if (skill.type === 'physical') base = Math.ceil(base / 3);

         t.hp = Math.max(0, t.hp - base);
         logMsg = logMsg || `${actor.name} hits ${t.name} for ${base}.`;
         
         if(skill.status && Math.random() < (skill.chance || 1.0)) {
            t.status.push({ type: skill.status, duration: skill.duration || 5 });
            logMsg += ` ${skill.status.toUpperCase()}!`;
         }
      }

      if(e.every(x => x.hp <= 0)) {
         const xpTotal = e.reduce((sum, en) => sum + en.xpReward, 0);
         const share = Math.floor(xpTotal / p.length);
         let levelUpMsg = "";
         p.forEach(c => {
            c.xp += share;
            while(c.xp >= c.maxXp) {
               c.xp -= c.maxXp; c.level++; c.maxXp = Math.floor(c.maxXp * 1.5);
               c.maxHp += 5; c.hp = c.maxHp;
               const cls = classesData.find(cl => cl.id === c.classId);
               const newSkillsStr = cls?.unlocks ? cls.unlocks[c.level.toString()] : null;
               if(newSkillsStr) {
                   const newSkills = newSkillsStr.split(',').map(s => s.trim());
                   newSkills.forEach(k => { if(!c.unlockedSkills.includes(k)) c.unlockedSkills.push(k); });
                   levelUpMsg = ` | ${c.name} reached Lv ${c.level}! Unlocked: ${newSkills.join(', ')}`;
               } else { levelUpMsg = ` | ${c.name} reached Lv ${c.level}!`; }
            }
         });
         return { activeEnemies: e, party: p, inventory: inv, isCombat: false, battleQueue: [], log: [...s.log, logMsg, `VICTORY! +${xpTotal} XP${levelUpMsg}`] };
      }
      return { activeEnemies: e, party: p, inventory: inv, battleQueue: newQueue, log: [...s.log, logMsg] };
    });
  }
}));