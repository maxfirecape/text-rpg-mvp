import { create } from 'zustand';
import type { Character, Enemy, Item } from '../types';
import skillsData from '../data/skills.json';
import itemsData from '../data/items.json'; // Needed for Armor Lookups

// Helper to find item stats
const getItemDef = (id: string | null): { min: number, max: number } | null => {
  if (!id) return null;
  const item = itemsData.find(i => i.id === id) as Item;
  return item?.defense || null;
};

interface GameState {
  party: Character[];
  inventory: string[]; 
  credits: number;
  currentRoomId: string;
  log: string[];
  isCombat: boolean;
  activeEnemies: Enemy[];
  isInputLocked: boolean; 
  activeDialogue: string | null;
  tempCharacterName: string | null; 
  actedInTurn: string[]; 
  
  addLog: (message: string) => void;
  setRoom: (roomId: string) => void;
  setInputLock: (locked: boolean) => void;
  setDialogue: (dialogueId: string | null) => void;
  setTempName: (name: string | null) => void;
  
  addCharacter: (char: Character) => void;
  updateCharacter: (id: string, updates: Partial<Character>) => void;
  addToInventory: (itemId: string) => void;
  
  startCombat: (enemies: Enemy[]) => void;
  performCombatAction: (actorIndex: number, skillId: string | 'attack', targetIndex: number, targetType?: 'enemy' | 'party') => void;
  enemyTurn: () => void;
}

export const useGameStore = create<GameState>()((set, get) => ({
  party: [],
  inventory: [],
  credits: 0,
  currentRoomId: 'room_01_cell',
  log: [
    "Project Inertia: Director's Cut",
    "Three heroes are locked in a cell...",
    "Enter name for Hero 1:"
  ], 
  isCombat: false,
  activeEnemies: [],
  isInputLocked: false,
  activeDialogue: null,
  tempCharacterName: null,
  actedInTurn: [],

  addLog: (msg) => set((state) => ({ log: [...state.log, msg] })),
  setRoom: (roomId) => set({ currentRoomId: roomId }),
  setInputLock: (locked) => set({ isInputLocked: locked }),
  setDialogue: (id) => set({ activeDialogue: id }),
  setTempName: (name) => set({ tempCharacterName: name }),

  addCharacter: (char) => set((state) => ({ 
    party: [...state.party, char],
    tempCharacterName: null 
  })),

  updateCharacter: (id, updates) => set((state) => ({
    party: state.party.map(c => c.id === id ? { ...c, ...updates } : c)
  })),

  addToInventory: (item) => set((state) => ({ 
    inventory: [...state.inventory, item] 
  })),

  startCombat: (enemies) => set((state) => ({ 
    isCombat: true, 
    activeEnemies: enemies,
    actedInTurn: [],
    log: [...state.log, `[SYSTEM] WARNING: COMBAT STARTED. ${enemies.length} hostiles detected.`]
  })),

  performCombatAction: (actorIndex, skillId, targetIndex, targetType = 'enemy') => {
    set((state) => {
      const party = [...state.party];
      const enemies = [...state.activeEnemies];
      const actor = party[actorIndex];
      
      let targetName = "";
      if (targetType === 'enemy') {
        if (!enemies[targetIndex] || enemies[targetIndex].hp <= 0) return { log: [...state.log, `Target is dead!`] };
        targetName = enemies[targetIndex].name;
      } else {
        if (!party[targetIndex]) return { log: [...state.log, `Invalid target!`] };
        targetName = party[targetIndex].name;
      }

      if (!actor || actor.hp <= 0) return { log: [...state.log, `[${actor?.name}] is down!`] };
      if (state.actedInTurn.includes(actor.id)) return { log: [...state.log, `[${actor.name}] has already acted!`] };

      let damage = 0;
      let logMsg = "";

      if (skillId === 'attack') {
        damage = Math.floor(actor.stats.str) + Math.floor(Math.random() * 4) + 1;
        if (targetType === 'enemy') {
           enemies[targetIndex].hp = Math.max(0, enemies[targetIndex].hp - damage);
        }
        logMsg = `[${actor.name}] attacks ${targetName} for ${damage} DMG!`;
      } 
      else {
        const skill = skillsData.find(s => s.id === skillId);
        if (!skill) return { log: [...state.log, `Unknown skill.`] };
        
        if (skill.classes && !skill.classes.includes(actor.classId)) {
           return { log: [...state.log, `[${actor.name}] cannot use ${skill.name} (Class Restriction)`] };
        }

        if (actor.mp < skill.cost) return { log: [...state.log, `[${actor.name}] needs ${skill.cost} SP!`] };

        party[actorIndex].mp -= skill.cost;

        if (skill.effect.includes('heal')) {
           const heal = actor.stats.wis + 5;
           if (targetType === 'party') {
             party[targetIndex].hp = Math.min(party[targetIndex].maxHp, party[targetIndex].hp + heal);
             logMsg = `[${actor.name}] casts ${skill.name} on ${targetName}, healing ${heal} HP.`;
           }
        }
        else if (skill.effect.includes('damage')) {
           damage = actor.stats.wis + 5; 
           if (skill.effect === 'damage_high') damage = actor.stats.dex + 5;
           if (skill.effect === 'damage_2.5x') damage = Math.floor(actor.stats.str * 2.5);
           
           if (targetType === 'enemy') {
             enemies[targetIndex].hp = Math.max(0, enemies[targetIndex].hp - damage);
           }
           logMsg = `[${actor.name}] uses ${skill.name} on ${targetName} for ${damage} DMG!`;
        }
        else if (skill.effect === 'steal_item') {
           if (targetType === 'enemy' && enemies[targetIndex].loot.length > 0) {
             const loot = enemies[targetIndex].loot.pop();
             state.inventory.push(loot!);
             logMsg = `[${actor.name}] stole ${loot}!`;
           } else {
             logMsg = `[${actor.name}] found nothing to steal.`;
           }
        }
      }

      if (enemies.every(e => e.hp <= 0)) {
        return { activeEnemies: enemies, party, isCombat: false, log: [...state.log, logMsg, `[SYSTEM] VICTORY!`] };
      }

      const newActedList = [...state.actedInTurn, actor.id];
      const livingHeroes = party.filter(c => c.hp > 0).length;

      if (newActedList.length >= livingHeroes) {
        setTimeout(() => { get().enemyTurn(); }, 1000);
      }

      return { activeEnemies: enemies, party, actedInTurn: newActedList, log: [...state.log, logMsg], inventory: state.inventory };
    });
  },

  enemyTurn: () => set((state) => {
    if (!state.isCombat || state.activeEnemies.length === 0) return {};
    
    const newLog = [...state.log];
    const newParty = [...state.party];
    let damageDealt = false;

    newLog.push("--- ENEMY TURN ---");

    state.activeEnemies.forEach(enemy => {
      if (enemy.hp <= 0) return; 

      const livingTargets = newParty.filter(c => c.hp > 0);
      if (livingTargets.length === 0) return;

      const target = livingTargets[Math.floor(Math.random() * livingTargets.length)];
      const realIndex = newParty.findIndex(c => c.id === target.id);
      
      // 1. RAW DAMAGE
      let dmg = Math.floor(Math.random() * 4) + 1 + Math.floor(enemy.stats.str / 2);
      
      // 2. ARMOR CALCULATION
      let totalReduct = 0;
      
      // Check Armor
      const armorDef = getItemDef(target.equipment.armor);
      if (armorDef) {
        totalReduct += Math.random() * (armorDef.max - armorDef.min) + armorDef.min;
      }
      
      // Check Accessories
      target.equipment.accessories.forEach(accId => {
        const accDef = getItemDef(accId);
        if (accDef) {
          totalReduct += Math.random() * (accDef.max - accDef.min) + accDef.min;
        }
      });

      // Apply Reduction
      const reducedDmg = Math.max(1, Math.floor(dmg * (1 - totalReduct)));
      
      newParty[realIndex].hp = Math.max(0, newParty[realIndex].hp - reducedDmg);
      newLog.push(`[${enemy.name}] hits ${target.name} for ${reducedDmg} DMG! (Resisted ${(totalReduct*100).toFixed(1)}%)`);
      damageDealt = true;
    });

    if (damageDealt) newLog.push("--- PLAYER TURN ---");

    return { party: newParty, log: newLog, actedInTurn: [] };
  })
}));