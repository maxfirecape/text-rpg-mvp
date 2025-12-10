import { create } from 'zustand';
import type { Character, Enemy, Item, Stats, StatusEffect, Skill, Class } from '../types';
import skillsData from '../data/skills.json';
import itemsData from '../data/items.json';
import classesDataJson from '../data/classes.json';

const classesData = classesDataJson as unknown as Class[];
const getItem = (id: string | null) => itemsData.find(i => i.id === id) as Item | undefined;

// --- DYNAMIC MATH ENGINE ---
const calcVal = (formula: string, stats: Stats, lvl: number = 1): number => {
  try {
    let e = formula.toLowerCase();
    e = e.replace(/\[?str\]?/g, stats.str.toString()).replace(/\[?dex\]?/g, stats.dex.toString())
         .replace(/\[?con\]?/g, stats.con.toString()).replace(/\[?wis\]?/g, stats.wis.toString())
         .replace(/\[?lvl\]?/g, lvl.toString());
    // Fixed: _m ignores unused variable warning
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
  
  addLog: (m: string) => void;
  setRoom: (id: string) => void;
  setInputLock: (l: boolean) => void;
  setDialogue: (id: string|null) => void;
  setTempName: (n: string|null) => void;
  addCharacter: (c: Character, cr: number) => void;
  addToInventory: (id: string) => void;
  equipItem: (idx: number, id: string) => void;
  unequipItem: (idx: number, s: string, i?: number) => void;
  setChestLooted: (id: string) => void;
  
  startCombat: (e: Enemy[]) => void;
  performAction: (aIdx: number, sId: string, tIdx: number, type?: 'enemy'|'party') => void;
  tick: (dt: number) => void; 
}

export const useGameStore = create<GameState>((set, get) => ({
  party: [], inventory: [], credits: 0, currentRoomId: 'room_01_cell', log: ["Welcome to Inertia.", "Enter Name for Hero 1:"], 
  isCombat: false, activeEnemies: [], isInputLocked: false, activeDialogue: null, tempCharacterName: null,
  lootedChests: [],

  addLog: (m) => set(s => ({ log: [...s.log, m] })),
  setRoom: (id) => set({ currentRoomId: id }),
  setInputLock: (l) => set({ isInputLocked: l }),
  setDialogue: (id) => set({ activeDialogue: id }),
  setTempName: (n) => set({ tempCharacterName: n }),
  addCharacter: (c, cr) => set(s => ({ party: [...s.party, c], credits: s.credits + cr, tempCharacterName: null })),
  addToInventory: (id) => set(s => ({ inventory: [...s.inventory, id] })),
  setChestLooted: (id) => set(s => ({ lootedChests: [...s.lootedChests, id] })),

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

  startCombat: (e) => set(s => ({ isCombat: true, activeEnemies: e.map(x => ({...x, atbTimer: Math.random()*5 + 5, state: 'idle'})), log: [...s.log, "COMBAT STARTED!"] })),

  // --- FIXED TICK FUNCTION (IMMUTABLE UPDATES) ---
  tick: (dt) => set(s => {
    if(!s.isCombat) return {};

    // Helper: Process status duration immutably
    const processStatuses = (entity: any) => {
        if (entity.hp <= 0) return entity;
        const activeStatus = entity.status.filter((eff: StatusEffect) => {
            eff.duration -= dt;
            return eff.duration > 0;
        });
        if (activeStatus.length !== entity.status.length) {
            return { ...entity, status: activeStatus };
        }
        return entity;
    };

    // 1. Update Status Effects for everyone
    let nextParty = s.party.map(processStatuses);
    let nextEnemies = s.activeEnemies.map(processStatuses);
    const newLog = [...s.log];

    // 2. Process Enemy AI
    nextEnemies = nextEnemies.map((e: Enemy) => {
      // Skip dead or disabled enemies
      if(e.hp <= 0 || e.status.some((x: StatusEffect) => ['stun','frozen','disabled'].includes(x.type))) {
          return e;
      }

      let newTimer = (e.atbTimer || 0) - dt;
      let newState = e.state;

      // IDLE -> CHARGING
      if(e.state === 'idle' && newTimer <= 0) {
         newLog.push(`${e.name} readies weapon!`);
         newState = 'charging';
         newTimer = 5; 
      } 
      // CHARGING -> ATTACK
      else if(e.state === 'charging' && newTimer <= 0) {
         const livingTargets = nextParty.filter((p: Character) => p.hp > 0);
         
         if(livingTargets.length > 0) {
           // Pick random target
           const targetIndex = Math.floor(Math.random() * livingTargets.length);
           const targetId = livingTargets[targetIndex].id;

           // Calculate Enemy Damage Base
           const mult = 0.7 + Math.random()*0.4;
           const baseDmg = Math.floor(Math.random()*4)+1 + Math.floor(e.stats.str/2);
           
           // Apply damage to the specific party member immutably
           nextParty = nextParty.map((p: Character) => {
               if (p.id !== targetId) return p;

               // Calculate Reduction from Armor
               let reduct = 0;
               const arm = getItem(p.equipment.armor);
               if(arm?.defense) reduct += Math.random()*(arm.defense.max - arm.defense.min) + arm.defense.min;
               
               // Check Evasion
               if(p.status.some((st: StatusEffect) => st.type === 'evade_up') && Math.random() > 0.5) {
                   newLog.push(`${e.name} attacks ${p.name} but MISSES!`);
                   return p;
               }

               const dmg = Math.max(1, Math.floor((baseDmg * mult) * (1 - reduct)));
               newLog.push(`${e.name} hits ${p.name} for ${dmg} DMG!`);
               return { ...p, hp: Math.max(0, p.hp - dmg) };
           });
         }
         newState = 'idle';
         newTimer = Math.random()*15 + 5; 
      }

      return { ...e, atbTimer: newTimer, state: newState };
    });

    return { party: nextParty, activeEnemies: nextEnemies, log: newLog };
  }),

  performAction: (aIdx, sId, tIdx, type='enemy') => {
    set(s => {
      const p = [...s.party]; const e = [...s.activeEnemies]; const actor = p[aIdx];
      if(actor.hp <= 0) return { log: [...s.log, "Cannot act!"] };

      let skill = skillsData.find(x => x.id === sId) as Skill | undefined;
      if(sId === 'attack') {
         skill = { id:'attack', name:'Attack', cost:0, type:'physical', formula: getItem(actor.equipment.weapon)?.damage || "[STR]+1d2", description:'' };
      }

      if(!skill) return { log: [...s.log, "Unknown skill"] };
      if(actor.mp < skill.cost) return { log: [...s.log, "Not enough SP"] };
      actor.mp -= skill.cost;

      let logMsg = "";
      if(skill.type === 'buff') {
         const t = type==='party' ? p[tIdx] : actor; 
         t.status.push({ type: skill.name, duration: skill.duration || 10, val: skill.val, stat: skill.stat });
         logMsg = `${actor.name} casts ${skill.name} on ${t.name}.`;
      }
      else if(skill.type === 'heal' || skill.type === 'revive') {
         const t = p[tIdx];
         let amt = 0;
         if(skill.formula?.includes('%')) { 
            if(skill.id === 'max_revive') amt = t.maxHp;
            else amt = Math.floor(t.maxHp * 0.5) + calcVal("2d4", actor.stats);
            if(t.hp <= 0) { t.hp = amt; logMsg = `${actor.name} revives ${t.name}!`; }
         } else {
            amt = calcVal(skill.formula || "[WIS]", actor.stats, actor.level);
            t.hp = Math.min(t.maxHp, t.hp + amt);
            logMsg = `${actor.name} heals ${t.name} for ${amt}.`;
         }
      }
      else { 
         const t = e[tIdx];
         if(!t || t.hp <= 0) return { log: [...s.log, "Target dead"] };
         
         let base = calcVal(skill.formula || "1d4", actor.stats, actor.level);
         if(skill.val) base = Math.floor(base * skill.val);
         t.hp = Math.max(0, t.hp - base);
         logMsg = `${actor.name} hits ${t.name} for ${base}.`;
         
         // Apply Status
         if(skill.status && Math.random() < (skill.chance || 1.0)) {
            t.status.push({ type: skill.status, duration: skill.duration || 5 });
            logMsg += ` ${skill.status.toUpperCase()}!`;
         }
      }

      if(e.every(x => x.hp <= 0)) {
         // XP Logic
         const xpTotal = e.reduce((sum, en) => sum + en.xpReward, 0);
         const share = Math.floor(xpTotal / p.length);
         p.forEach(c => {
            c.xp += share;
            while(c.xp >= c.maxXp) {
               c.xp -= c.maxXp; c.level++; c.maxXp = Math.floor(c.maxXp*1.5);
               c.maxHp += 5; c.hp = c.maxHp;
               const cls = classesData.find(cl => cl.id === c.classId);
               const u = cls?.unlocks ? cls.unlocks[c.level.toString()] : null;
               if(u) u.split(',').forEach((k:string)=> { if(!c.unlockedSkills.includes(k.trim())) c.unlockedSkills.push(k.trim()); });
            }
         });
         return { activeEnemies: e, party: p, isCombat: false, log: [...s.log, logMsg, `VICTORY! +${xpTotal} XP`] };
      }
      return { activeEnemies: e, party: p, log: [...s.log, logMsg] };
    });
  }
}));