import { create } from 'zustand';
import type { Character, Enemy, Item, Stats, StatusEffect } from '../types';
import skillsData from '../data/skills.json';
import itemsData from '../data/items.json';
import classesData from '../data/classes.json';

const getItem = (id: string | null) => itemsData.find(i => i.id === id) as Item | undefined;

// --- MATH ENGINE ---
const calcVal = (formula: string, stats: Stats, lvl: number = 1): number => {
  try {
    let e = formula.toLowerCase();
    e = e.replace(/\[?str\]?/g, stats.str.toString()).replace(/\[?dex\]?/g, stats.dex.toString())
         .replace(/\[?con\]?/g, stats.con.toString()).replace(/\[?wis\]?/g, stats.wis.toString())
         .replace(/\[?lvl\]?/g, lvl.toString());
    e = e.replace(/(\d+)d(\d+)/g, (m, c, s) => {
      let t = 0; for(let i=0; i<parseInt(c); i++) t += Math.floor(Math.random()*parseInt(s))+1; return t.toString();
    });
    return Math.floor(new Function('return ' + e)());
  } catch { return 1; }
};

interface GameState {
  party: Character[]; inventory: string[]; credits: number; currentRoomId: string; log: string[];
  isCombat: boolean; activeEnemies: Enemy[]; isInputLocked: boolean; activeDialogue: string | null;
  tempCharacterName: string | null; 
  
  // ACTIONS
  addLog: (m: string) => void;
  setRoom: (id: string) => void;
  setInputLock: (l: boolean) => void;
  setDialogue: (id: string|null) => void;
  setTempName: (n: string|null) => void;
  addCharacter: (c: Character, cr: number) => void;
  addToInventory: (id: string) => void;
  equipItem: (idx: number, id: string) => void;
  unequipItem: (idx: number, s: string, i?: number) => void;
  
  startCombat: (e: Enemy[]) => void;
  performAction: (aIdx: number, sId: string, tIdx: number, type?: 'enemy'|'party') => void;
  tick: (dt: number) => void; // REAL TIME UPDATE
}

export const useGameStore = create<GameState>()((set, get) => ({
  party: [], inventory: [], credits: 0, currentRoomId: 'room_01_cell', log: ["Welcome to Inertia.", "Enter Name for Hero 1:"], 
  isCombat: false, activeEnemies: [], isInputLocked: false, activeDialogue: null, tempCharacterName: null,

  addLog: (m) => set(s => ({ log: [...s.log, m] })),
  setRoom: (id) => set({ currentRoomId: id }),
  setInputLock: (l) => set({ isInputLocked: l }),
  setDialogue: (id) => set({ activeDialogue: id }),
  setTempName: (n) => set({ tempCharacterName: n }),
  addCharacter: (c, cr) => set(s => ({ party: [...s.party, c], credits: s.credits + cr, tempCharacterName: null })),
  addToInventory: (id) => set(s => ({ inventory: [...s.inventory, id] })),

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

  startCombat: (e) => set(s => ({ isCombat: true, activeEnemies: e.map(x => ({...x, atbTimer: Math.random()*30 + 10, state: 'idle'})), log: [...s.log, "COMBAT STARTED!"] })),

  // --- REAL TIME TICKER (Called by App.tsx every 1s) ---
  tick: (dt) => set(s => {
    if(!s.isCombat) return {};
    const newLog = [...s.log];
    const enemies = [...s.activeEnemies];
    const party = [...s.party];

    // 1. Process Status Effects (Party & Enemies)
    const handleStatus = (entity: any) => {
      if(entity.hp <= 0) return;
      entity.status = entity.status.filter((eff: any) => {
        eff.duration -= dt;
        
        // Poison/Burn: Tick every 5s
        if((eff.type === 'poison' || eff.type === 'burn') && Math.floor(eff.duration) % 5 === 0 && eff.duration > 0) {
           entity.hp = Math.max(0, entity.hp - 1);
           newLog.push(`${entity.name} takes 1 ${eff.type} dmg.`);
        }
        
        if(eff.duration <= 0) {
           if(eff.type === 'stun' || eff.type === 'frozen' || eff.type === 'disabled') newLog.push(`${entity.name} is no longer ${eff.type}.`);
           return false; // Remove
        }
        return true;
      });
    };
    party.forEach(handleStatus);
    enemies.forEach(handleStatus);

    // 2. Enemy ATB Logic
    enemies.forEach(e => {
      if(e.hp <= 0 || e.status.some((x:any) => ['stun','frozen','disabled'].includes(x.type))) return;

      e.atbTimer = (e.atbTimer || 0) - dt;

      if(e.state === 'idle' && e.atbTimer <= 0) {
         // Ready Phase
         newLog.push(`${e.name} readies their weapon!`);
         e.state = 'charging';
         e.atbTimer = 5; // 5s charge
      } 
      else if(e.state === 'charging' && e.atbTimer <= 0) {
         // STRIKE
         const targets = party.filter(p => p.hp > 0);
         if(targets.length > 0) {
           const t = targets[Math.floor(Math.random()*targets.length)];
           // Dmg: 0.7 - 1.1x Basic
           const mult = 0.7 + Math.random()*0.4;
           const baseDmg = Math.floor(Math.random()*4)+1 + Math.floor(e.stats.str/2);
           
           // Armor Reduction
           let reduct = 0;
           const arm = getItem(t.equipment.armor);
           if(arm?.defense) reduct += Math.random()*(arm.defense.max - arm.defense.min) + arm.defense.min;
           const dmg = Math.max(1, Math.floor((baseDmg * mult) * (1 - reduct)));
           
           // Evade Check (Evade Up doubles DEX effectively for dodge calc, simplified here as 50% flat)
           if(t.status.some((s:any) => s.type === 'evade_up') && Math.random() > 0.5) {
              newLog.push(`${e.name} strikes at ${t.name} but MISSES!`);
           } else {
              t.hp = Math.max(0, t.hp - dmg);
              newLog.push(`${e.name} strikes ${t.name} for ${dmg} DMG!`);
           }
         }
         // Reset
         e.state = 'idle';
         e.atbTimer = Math.random()*30 + 10; // 10-40s cooldown
      }
    });

    return { party, activeEnemies: enemies, log: newLog };
  }),

  // --- PLAYER ACTIONS ---
  performAction: (aIdx, sId, tIdx, type='enemy') => {
    set(s => {
      const p = [...s.party]; const e = [...s.activeEnemies]; const actor = p[aIdx];
      if(actor.hp <= 0 || actor.status.some(x => ['stun','frozen'].includes(x.type))) return { log: [...s.log, "Cannot act!"] };

      // Skill Lookup
      let skill: any = { type: 'physical', formula: getItem(actor.equipment.weapon)?.damage || "[STR]+1d2" };
      if(sId !== 'attack') {
        skill = skillsData.find(x => x.id === sId);
        if(!skill) return { log: [...s.log, "Unknown skill"] };
        if(actor.mp < skill.cost) return { log: [...s.log, "Not enough SP"] };
        actor.mp -= skill.cost;
      }

      let logMsg = "";
      
      // LOGIC SWITCH
      if(skill.type === 'buff') {
         const t = type==='party' ? p[tIdx] : actor; // Self if not spec
         t.status.push({ type: skill.name, duration: skill.duration, val: skill.val, stat: skill.stat });
         logMsg = `${actor.name} casts ${skill.name} on ${t.name}.`;
      }
      else if(skill.type === 'heal' || skill.type === 'revive') {
         // Resolve Target (Single vs AoE handled by logic or loop in parser)
         const t = p[tIdx];
         let amt = 0;
         if(skill.formula.includes('%')) { // Revive %
            if(skill.id === 'max_revive') amt = t.maxHp;
            else amt = Math.floor(t.maxHp * 0.5) + calcVal("2d4", actor.stats);
            if(t.hp <= 0) { t.hp = amt; logMsg = `${actor.name} revives ${t.name}!`; }
         } else { // Heal
            amt = calcVal(skill.formula, actor.stats, actor.level);
            t.hp = Math.min(t.maxHp, t.hp + amt);
            logMsg = `${actor.name} heals ${t.name} for ${amt}.`;
         }
      }
      else { // Damage / Debuff
         const t = e[tIdx];
         if(!t || t.hp <= 0) return { log: [...s.log, "Target dead"] };
         
         // Damage Formula
         let base = calcVal(skill.formula, actor.stats, actor.level);
         if(skill.val) base = Math.floor(base * skill.val); // Multiplier
         
         // Berzerk Check
         if(actor.status.some((x:any) => x.type === 'Berzerk')) base = Math.floor(base * 1.5);

         t.hp = Math.max(0, t.hp - base);
         logMsg = `${actor.name} hits ${t.name} for ${base}.`;

         // Status Application
         if(skill.status && Math.random() < (skill.chance || 1.0)) {
            t.status.push({ type: skill.status, duration: skill.duration });
            logMsg += ` Applied ${skill.status}!`;
         }
      }

      // Victory Check
      if(e.every(x => x.hp <= 0)) {
         return { activeEnemies: e, party: p, isCombat: false, log: [...s.log, logMsg, "VICTORY!"] };
      }

      return { activeEnemies: e, party: p, log: [...s.log, logMsg] };
    });
  }
}));