import { create } from 'zustand';
import type { Character, Enemy, Item, Stats, StatusEffect, Skill, Class, EnemyMove } from '../types';
import skillsData from '../data/skills.json';
import itemsData from '../data/items.json';
import enemiesData from '../data/enemies.json'; 
import classesDataJson from '../data/classes.json';

const classesData = classesDataJson as unknown as Class[];
const allEnemies = enemiesData as unknown as Enemy[];
const allSkills = skillsData as unknown as Skill[];
const getItem = (id: string | null) => itemsData.find(i => i.id === id) as Item | undefined;

const getEnemyDamage = (damageStr?: string): number => {
    if (!damageStr) return 0;
    if (damageStr.includes('-')) {
        const [min, max] = damageStr.split('-').map(Number);
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }
    return parseInt(damageStr) || 0;
};

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

  pendingChoice: { type: string; data: any } | null;
  introTimers: number[];
  
  setPendingChoice: (c: { type: string; data: any } | null) => void;
  addLog: (m: string) => void;
  setRoom: (id: string) => void;
  setInputLock: (l: boolean) => void;
  setDialogue: (id: string|null) => void;
  setTempName: (n: string|null) => void;
  addCharacter: (c: Character, cr: number) => void;
  addToInventory: (id: string) => void;
  equipItem: (idx: number, id: string, replaceSlot?: number) => void;
  unequipItem: (idx: number, s: string, i?: number) => void;
  useItem: (itemId: string, targetIdx?: number) => void;
  setChestLooted: (id: string) => void;
  
  resetGame: () => void;
  runIntro: () => void;
  clearIntro: () => void;
  
  saveGame: () => void; 
  loadGame: () => boolean; 
  getDerivedStats: (c: Character) => Stats;
  fullRestore: () => void;
  
  startCombat: (e: Enemy[]) => void;
  performAction: (aIdx: number, sId: string, tIdx: number, type?: 'enemy'|'party') => void;
  tick: (dt: number) => void; 
}

export const useGameStore = create<GameState>((set, get) => ({
  party: [], inventory: [], credits: 0, currentRoomId: 'room_01_cell', 
  log: [], 
  isCombat: false, activeEnemies: [], 
  isInputLocked: true, 
  activeDialogue: null, tempCharacterName: null,
  lootedChests: [], battleQueue: [], isGameOver: false,
  pendingChoice: null,
  introTimers: [],

  addLog: (m) => set(s => ({ log: [...s.log, m] })),
  setRoom: (id) => set({ currentRoomId: id }),
  setInputLock: (l) => set({ isInputLocked: l }),
  setDialogue: (id) => set({ activeDialogue: id }),
  setTempName: (n) => set({ tempCharacterName: n }),
  setPendingChoice: (c) => set({ pendingChoice: c }),

  addCharacter: (c, cr) => set(s => ({ party: [...s.party, { ...c, atbTimer: 3.5 }], credits: s.credits + cr, tempCharacterName: null })),
  addToInventory: (id) => set(s => ({ inventory: [...s.inventory, id] })),
  setChestLooted: (id) => set(s => ({ lootedChests: [...s.lootedChests, id] })),

  clearIntro: () => {
      const s = get();
      s.introTimers.forEach(t => clearTimeout(t));
      set({ introTimers: [], isInputLocked: false });
  },

  runIntro: () => {
      get().clearIntro();
      set({ log: [], isInputLocked: true, party: [], inventory: [], credits: 0, currentRoomId: 'room_01_cell' });
      
      const { addLog } = get();
      const timers: number[] = [];

      const schedule = (ms: number, text: string, unlock = false) => {
          const t = setTimeout(() => {
              addLog(text);
              if (unlock) set({ isInputLocked: false });
          }, ms);
          timers.push(Number(t));
      };

      addLog("In the dead of midnight, below the radiant crescent shaped moon, stood a crooked looking castle, tall and wide, at the edge of a mountain valley, nestled at the edge of a forest. A path extends out from the castle into the forest and out into a clearing with a small port town. At the end of this eerie path, heading from the village towards the castle, were three shadows on a mission - to rescue the port town chapel's head priest - Father Lin.");

      // --- TIMINGS SCALED BY 1.4 ---
      schedule(11200, "His kidnapping was swift, and happened a mere five hours ago, when the three shadows walking through the forest stopped in the port town for a glass of ale. A message left in his residence taunting the townsfolk by a certain infamous Baron Vladimir of Nocturn Castle encouraged adventurers to dare and seek out Father Lin, \"so when you do find him, you can join him in his wonderful sacrifice\".");
      
      schedule(22400, "Who would be so brazen to leave such a taunt, and with the town knowing his whereabouts?! How powerful is this man? The town immediately put a bounty on Baron Vladimir's head, but this didn't persuade the town's mercenaries' guild to act on this, who were all stricken with fear and grief.");
      
      schedule(30800, "That didn't stop the three of you heading out into the forest to claim the bounty and save the man's life. The townspeople warned of guards and creatures at Nocturn Castle's entrance, but that's all the information they know.");
      
      schedule(37800, "Welcome to Everlasting Night.");
      
      schedule(39200, "Who are you?", true); // Unlocks input

      set({ introTimers: timers });
  },

  resetGame: () => {
      get().runIntro();
  },

  saveGame: () => {
      const s = get();
      const data = {
        party: s.party,
        inventory: s.inventory,
        credits: s.credits,
        currentRoomId: s.currentRoomId,
        lootedChests: s.lootedChests
      };
      localStorage.setItem('rpg_save_v1', JSON.stringify(data));
      set(state => ({ log: [...state.log, "Game Saved."] }));
  },

  loadGame: () => {
      const raw = localStorage.getItem('rpg_save_v1');
      if (!raw) return false;
      
      get().clearIntro();

      const data = JSON.parse(raw);
      set({
        party: data.party, inventory: data.inventory, credits: data.credits, currentRoomId: data.currentRoomId,
        lootedChests: data.lootedChests || [], log: ["Game Loaded."], isCombat: false, activeEnemies: [], battleQueue: [], isGameOver: false, isInputLocked: false, pendingChoice: null
      });
      return true;
  },

  fullRestore: () => set(s => {
      const p = s.party.map(c => ({...c, hp: c.maxHp, mp: c.maxMp, status: []}));
      return { party: p, log: [...s.log, "Party fully rested."] };
  }),

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

  equipItem: (idx, id, replaceSlot) => set(s => {
    const p = [...s.party]; const c = p[idx]; const item = getItem(id);
    if(!item || !s.inventory.includes(id)) return {};
    
    if (item.type === 'accessory' && c.equipment.accessories.length >= 3 && replaceSlot === undefined) {
        return { 
            pendingChoice: { type: 'equip_replace', data: { charIdx: idx, itemId: id } }, 
            log: [...s.log, "Accessory slots full. Replace which one? (1, 2, 3)"] 
        };
    }

    const inv = [...s.inventory]; 
    
    if(item.type === 'weapon') { 
        if(c.equipment.weapon) inv.push(c.equipment.weapon); 
        inv.splice(inv.indexOf(id), 1);
        c.equipment.weapon = id; 
    }
    else if(item.type === 'armor') { 
        if(c.equipment.armor) inv.push(c.equipment.armor); 
        inv.splice(inv.indexOf(id), 1);
        c.equipment.armor = id; 
    }
    else if(item.type === 'accessory') {
        inv.splice(inv.indexOf(id), 1); 

        if (c.equipment.accessories.length >= 3 && replaceSlot !== undefined) {
            const oldItem = c.equipment.accessories[replaceSlot];
            c.equipment.accessories[replaceSlot] = id;
            inv.push(oldItem); 
        } else {
            c.equipment.accessories.push(id);
        }
    }
    return { party: p, inventory: inv, log: [...s.log, `${c.name} equipped ${item.name}.`], pendingChoice: null };
  }),

  unequipItem: (idx, slot, i=0) => set(s => { const p = [...s.party]; const c = p[idx]; const inv = [...s.inventory]; let r: string|null = null; if(slot==='weapon') { r=c.equipment.weapon; c.equipment.weapon=null; } else if(slot==='armor') { r=c.equipment.armor; c.equipment.armor=null; } else if(slot==='accessory') r=c.equipment.accessories.splice(i,1)[0]; if(r) inv.push(r); return { party: p, inventory: inv }; }),
  useItem: (itemId, targetIdx = 0) => set(s => {
      const inv = [...s.inventory];
      const idx = inv.indexOf(itemId);
      if (idx === -1) return { log: [...s.log, "You don't have that."] };
      const item = getItem(itemId);
      if (!item || item.type !== 'consumable') return { log: [...s.log, "You can't use that."] };
      const p = [...s.party];
      const target = p[targetIdx];
      let msg = `Used ${item.name}.`;
      if (item.effect?.startsWith('heal_')) { const val = calcVal(item.effect.replace('heal_', ''), target.stats, target.level); target.hp = Math.min(target.maxHp, target.hp + val); msg = `Healed ${target.name} for ${val} HP.`; }
      else if (item.effect === 'restore_skill') { target.mp = Math.min(target.maxMp, target.mp + 2); msg = `Restored SP to ${target.name}.`; }
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

    const processEntityTick = (entity: any) => {
        if (entity.hp <= 0) return entity;
        let newTimer = (entity.atbTimer || 0);
        if (newTimer > 0) newTimer -= dt;

        const isStunned = entity.status.some((x: StatusEffect) => ['stun','frozen','disabled'].includes(x.type));

        if (newTimer <= 0 && !nextQueue.includes(entity.id) && entity.isPlayerControlled && !isStunned) {
            nextQueue.push(entity.id);
        }

        const dotEffects = entity.status.filter((s: StatusEffect) => ['burn', 'poison'].includes(s.type));
        if (dotEffects.length > 0) {
            const dmg = dotEffects.length; 
            entity.hp = Math.max(0, entity.hp - dmg);
        }

        const hotEffects = entity.status.filter((s: StatusEffect) => ['Healing Rain', 'Group Rain'].includes(s.type));
        if (hotEffects.length > 0) hotEffects.forEach((s: StatusEffect) => { entity.hp = Math.min(entity.maxHp, entity.hp + (s.val || 1)); });

        const activeStatus = entity.status
            .map((eff: StatusEffect) => ({ ...eff, duration: eff.duration - dt }))
            .filter((eff: StatusEffect) => eff.duration > 0);
        
        return { ...entity, status: activeStatus, atbTimer: Math.max(0, newTimer) };
    };

    nextParty = nextParty.map(processEntityTick);

    let nextEnemies = s.activeEnemies.map((e: Enemy) => {
      let processedE = processEntityTick(e);
      
      if(processedE.hp <= 0 || processedE.status.some((x: StatusEffect) => ['stun','frozen','disabled'].includes(x.type))) {
          return processedE;
      }

      let newTimer = processedE.atbTimer;
      let newState = processedE.state;
      let currentMove = processedE.currentMove;
      let phases = processedE.phases || [];

      if (e.id.includes('warden')) {
          const hpPercent = processedE.hp / processedE.maxHp;
          if (hpPercent <= 0.60 && !phases.includes('enraged')) {
              phases.push('enraged');
              newLog.push(`|E| ${processedE.name} is getting heated! (BERZERK)`);
              processedE.status.push({ type: 'berzerk', duration: 999, val: 1.5, stat: 'dmg_mult' });
          } else if (hpPercent <= 0.40 && !phases.includes('tired')) {
              phases.push('tired');
              newLog.push(`|E| ${processedE.name} seems out of breath.`);
          } else if (hpPercent <= 0.20 && !phases.includes('staggered')) {
              phases.push('staggered');
              newLog.push(`|E| ${processedE.name} staggers!`);
          }
      }
      
      if (!phases.includes('low_hp_msg') && (processedE.hp / processedE.maxHp) <= 0.30) {
          phases.push('low_hp_msg');
          newLog.push(processedE.messages?.lowHealth || `|E| ${processedE.name} stumbles!`);
      }

      if(newState === 'idle' && newTimer <= 0) {
         const roll = Math.random() * 100;
         let accumulated = 0;
         let selectedMove: EnemyMove | undefined;
         
         const moveList = processedE.moves && processedE.moves.length > 0 ? processedE.moves : [{ name: "Attack", type: "attack", chance: 100, chargeTime: 1.0, staggerChance: 0.5, msgPrep: "Enemy readies weapon!", msgHit: "Enemy attacks!" } as EnemyMove];

         for (const move of moveList) {
             accumulated += move.chance;
             if (roll <= accumulated) { selectedMove = move; break; }
         }
         
         if (selectedMove) {
             newLog.push(`|E| ${selectedMove.msgPrep}`);
             newState = 'charging';
             newTimer = selectedMove.chargeTime; 
             currentMove = selectedMove;
         }
      } 
      else if(newState === 'charging' && newTimer <= 0 && currentMove) {
         newLog.push(`|E| ${currentMove.msgHit}`);
         
         if (currentMove.type === 'summon' && currentMove.summonId) {
             processedE.spawnRequest = currentMove.summonId; 
         } else if (currentMove.type === 'heal') {
             const healAmt = Math.floor((Math.random() * 6 + 1 + Math.random() * 6 + 1) * (currentMove.val || 2));
             processedE.hp = Math.min(processedE.maxHp, processedE.hp + healAmt);
             newLog.push(`|E| ${processedE.name} healed for ${healAmt}.`);
         } else {
             const livingTargets = nextParty.filter((p: Character) => p.hp > 0);
             if(livingTargets.length > 0) {
               const targets = currentMove.type === 'aoe_attack' ? livingTargets : [livingTargets[Math.floor(Math.random()*livingTargets.length)]];
               targets.forEach(target => {
                   const mult = currentMove?.val || 1.0;
                   const bzk = processedE.status.find((s:any) => s.type === 'berzerk')?.val || 1.0;
                   
                   let baseDmg = 0;
                   if (currentMove?.damage) {
                       baseDmg = getEnemyDamage(currentMove.damage);
                   } else {
                       baseDmg = Math.floor(Math.random()*4+1 + Math.floor(processedE.stats.str/2));
                   }
                   
                   baseDmg = Math.floor(baseDmg * mult * bzk);
                   
                   let reduct = 0;
                   const arm = getItem(target.equipment.armor);
                   if(arm?.defense) reduct += Math.random()*(arm.defense.max - arm.defense.min) + arm.defense.min;
                   
                   const dmg = Math.max(1, Math.floor(baseDmg * (1 - reduct)));
                   target.hp = Math.max(0, target.hp - dmg);
                   newLog.push(`|E| ${processedE.name} hit ${target.name} for ${dmg} (${target.hp} HP remain).`);
               });
             }
         }

         newState = 'idle';
         newTimer = Math.random()*2 + 3; 
         currentMove = undefined;
      }
      
      return { ...processedE, atbTimer: newTimer, state: newState, currentMove, phases };
    });

    const spawns: Enemy[] = [];
    nextEnemies = nextEnemies.map(e => {
        if ((e as any).spawnRequest) {
            const template = allEnemies.find(x => x.id === (e as any).spawnRequest);
            if (template) {
                spawns.push({ 
                    ...template, 
                    id: `e${Date.now()}_${Math.random()}`, 
                    name: `${template.name} (Add)`, 
                    hp: template.hp, maxHp: template.maxHp, status: [], moves: template.moves,
                    state: 'idle', atbTimer: 3, phases: []
                });
                newLog.push(`|E| A ${template.name} joined the battle!`);
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
        const isStunned = c?.status.some((s:any) => ['stun','frozen','disabled'].includes(s.type));
        return c && c.hp > 0 && !isStunned;
    });

    return { party: nextParty, activeEnemies: nextEnemies, log: newLog, battleQueue: cleanQueue };
  }),

  performAction: (aIdx, sId, tIdx, type='enemy') => {
    set(s => {
      const p = [...s.party]; const e = [...s.activeEnemies]; const actor = p[aIdx];
      let inv = [...s.inventory];

      if(actor.hp <= 0) return { log: [...s.log, `${actor.name} is down!`] };
      
      const isStunned = actor.status.some((s:any) => ['stun','frozen','disabled'].includes(s.type));
      if (isStunned) return { log: [...s.log, `${actor.name} cannot move!`] };

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
                    if (skill.id === 'heal') {
                        amt = Math.floor(actorStats.wis * 1.5);
                    }
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
         logMsg = logMsg || `${actor.name} hits ${t.name} for ${base} (${t.hp} HP remain).`;
         
         if(skill.status && Math.random() < (skill.chance || 1.0)) {
            t.status.push({ type: skill.status, duration: skill.duration || 5 });
            logMsg += ` ${skill.status.toUpperCase()}!`;
         }
      }

      if(e.every(x => x.hp <= 0)) {
         const xpTotal = e.reduce((sum, en) => sum + en.xpReward, 0);
         const share = Math.floor(xpTotal / p.length);
         const levelUpLogs: string[] = [];

         p.forEach(c => {
            const oldLvl = c.level; 
            c.xp += share;
            const newSkillsLearned: string[] = [];

            while(c.xp >= c.maxXp) {
               c.xp -= c.maxXp; 
               c.level++; 
               c.maxXp = Math.floor(c.maxXp * 1.5);
               c.maxHp += 5; c.hp = c.maxHp;
               
               const cls = classesData.find(cl => cl.id === c.classId);
               const newSkillsStr = cls?.unlocks ? cls.unlocks[c.level.toString()] : null;
               
               if(newSkillsStr) {
                   const newSkills = newSkillsStr.split(',').map(s => s.trim());
                   newSkills.forEach(k => { 
                       if(!c.unlockedSkills.includes(k)) {
                           c.unlockedSkills.push(k); 
                           const realSkill = allSkills.find(s => s.id === k);
                           newSkillsLearned.push(realSkill?.name || k);
                       }
                   });
               }
            }
            if (c.level > oldLvl) {
                let msg = `|L| ${c.name} reached Lv ${c.level}!`;
                if (newSkillsLearned.length > 0) msg += ` Learned: ${newSkillsLearned.join(', ')}`;
                levelUpLogs.push(msg);
            }
         });
         return { activeEnemies: e, party: p, inventory: inv, isCombat: false, battleQueue: [], log: [...s.log, logMsg, `VICTORY! +${xpTotal} XP`, ...levelUpLogs] };
      }
      return { activeEnemies: e, party: p, inventory: inv, battleQueue: newQueue, log: [...s.log, logMsg] };
    });
  }
}));