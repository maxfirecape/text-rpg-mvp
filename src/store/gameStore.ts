import { create } from 'zustand';
import type { Character, Enemy, Item, Stats, StatusEffect } from '../types';
import skillsData from '../data/skills.json';
import itemsData from '../data/items.json';
import classesData from '../data/classes.json';

// --- HELPERS ---
const getItem = (id: string | null): Item | undefined => {
  return itemsData.find(i => i.id === id) as Item | undefined;
};

// Formula Parser
const calculateDamage = (formula: string, stats: Stats): number => {
  try {
    let expression = formula.toLowerCase();
    expression = expression.replace(/\[?str\]?/g, stats.str.toString());
    expression = expression.replace(/\[?dex\]?/g, stats.dex.toString());
    expression = expression.replace(/\[?con\]?/g, stats.con.toString());
    expression = expression.replace(/\[?wis\]?/g, stats.wis.toString());
    expression = expression.replace(/(\d+)d(\d+)/g, (match, count, sides) => {
      let total = 0;
      for (let i = 0; i < parseInt(count); i++) total += Math.floor(Math.random() * parseInt(sides)) + 1;
      return total.toString();
    });
    const result = new Function('return ' + expression)();
    return Math.floor(result);
  } catch (err) { return 1; }
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
  
  addCharacter: (char: Character, startCredits: number) => void;
  updateCharacter: (id: string, updates: Partial<Character>) => void;
  addToInventory: (itemId: string) => void;
  
  // INVENTORY COMMANDS
  equipItem: (charIndex: number, itemId: string) => void;
  unequipItem: (charIndex: number, slot: 'weapon' | 'armor' | 'accessory', index?: number) => void;
  
  // COMBAT & PROGRESSION
  startCombat: (enemies: Enemy[]) => void;
  performCombatAction: (actorIndex: number, skillId: string | 'attack', targetIndex: number, targetType?: 'enemy' | 'party') => void;
  enemyTurn: () => void;
  gainXp: (amount: number) => void;
}

export const useGameStore = create<GameState>()((set, get) => ({
  party: [],
  inventory: [],
  credits: 0,
  currentRoomId: 'room_01_cell',
  log: ["Project Inertia: Director's Cut", "Three heroes are locked in a cell...", "Enter name for Hero 1:"], 
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

  addCharacter: (char, startCredits) => set((state) => ({ 
    party: [...state.party, char],
    credits: state.credits + startCredits,
    tempCharacterName: null 
  })),

  updateCharacter: (id, updates) => set((state) => ({
    party: state.party.map(c => c.id === id ? { ...c, ...updates } : c)
  })),

  addToInventory: (item) => set((state) => ({ inventory: [...state.inventory, item] })),

  // --- EQUIPPING LOGIC ---
  equipItem: (charIndex, itemId) => set((state) => {
    const party = [...state.party];
    const char = party[charIndex];
    const item = getItem(itemId);
    
    if (!item) return { log: [...state.log, "Item data not found."] };
    if (!state.inventory.includes(itemId)) return { log: [...state.log, "You don't have that item."] };

    // Remove from inventory
    const invIndex = state.inventory.indexOf(itemId);
    const newInventory = [...state.inventory];
    newInventory.splice(invIndex, 1);

    // Unequip existing if slot full
    if (item.type === 'weapon') {
      if (char.equipment.weapon) newInventory.push(char.equipment.weapon);
      char.equipment.weapon = itemId;
    } else if (item.type === 'armor') {
      if (char.equipment.armor) newInventory.push(char.equipment.armor);
      char.equipment.armor = itemId;
    } else if (item.type === 'accessory') {
      if (char.equipment.accessories.length >= 3) {
        const removed = char.equipment.accessories.shift(); // Remove first
        if (removed) newInventory.push(removed);
      }
      char.equipment.accessories.push(itemId);
    }

    return { party, inventory: newInventory, log: [...state.log, `${char.name} equipped ${item.name}.`] };
  }),

  unequipItem: (charIndex, slot, index = 0) => set((state) => {
    const party = [...state.party];
    const char = party[charIndex];
    const newInventory = [...state.inventory];
    let removedItem: string | null = null;

    if (slot === 'weapon' && char.equipment.weapon) {
      removedItem = char.equipment.weapon;
      char.equipment.weapon = null;
    } else if (slot === 'armor' && char.equipment.armor) {
      removedItem = char.equipment.armor;
      char.equipment.armor = null;
    } else if (slot === 'accessory' && char.equipment.accessories[index]) {
      removedItem = char.equipment.accessories.splice(index, 1)[0];
    }

    if (removedItem) {
      newInventory.push(removedItem);
      return { party, inventory: newInventory, log: [...state.log, `${char.name} unequipped ${getItem(removedItem)?.name}.`] };
    }
    return {};
  }),

  // --- PROGRESSION ---
  gainXp: (amount) => set((state) => {
    const party = state.party.map(char => {
      // Add XP
      let newXp = char.xp + amount;
      let newLevel = char.level;
      let leveledUp = false;

      // Level Up Logic
      while (newXp >= char.maxXp) {
        newXp -= char.maxXp;
        newLevel++;
        char.maxXp = Math.floor(char.maxXp * 1.5); // Increase requirement
        char.maxHp += 5 + char.stats.con;
        char.hp = char.maxHp; // Full heal on level up
        leveledUp = true;
        
        // Unlock Skills
        const classData = classesData.find(c => c.id === char.classId);
        // @ts-ignore: JSON keys are strings
        const newSkill = classData?.unlocks ? classData.unlocks[newLevel.toString()] : null;
        if (newSkill) {
           const skillsToAdd = newSkill.split(',').map(s => s.trim());
           skillsToAdd.forEach(s => { if(!char.unlockedSkills.includes(s)) char.unlockedSkills.push(s); });
        }
      }
      if (leveledUp) {
        state.log.push(`LEVEL UP! ${char.name} is now Level ${newLevel}!`);
      }
      return { ...char, xp: newXp, level: newLevel };
    });
    return { party, log: [...state.log] }; // Log array updated in map
  }),

  startCombat: (enemies) => set((state) => ({ 
    isCombat: true, 
    activeEnemies: enemies,
    actedInTurn: [],
    log: [...state.log, `[SYSTEM] COMBAT STARTED. ${enemies.length} hostiles detected.`]
  })),

  // --- MAIN ACTION ---
  performCombatAction: (actorIndex, skillId, targetIndex, targetType = 'enemy') => {
    set((state) => {
      const party = [...state.party];
      const enemies = [...state.activeEnemies];
      const actor = party[actorIndex];
      let logMsg = "";

      // Resolve Target
      let targetName = "";
      if (targetType === 'enemy') {
        if (!enemies[targetIndex] || enemies[targetIndex].hp <= 0) return { log: [...state.log, "Target dead."] };
        targetName = enemies[targetIndex].name;
      } else {
        targetName = party[targetIndex]?.name || "Ally";
      }

      // 1. Status Check (Stun/Freeze)
      if (actor.status.some(s => s.type === 'stun' || s.type === 'frozen')) {
        return { 
          log: [...state.log, `[${actor.name}] is stunned/frozen!`], 
          actedInTurn: [...state.actedInTurn, actor.id] 
        };
      }

      // 2. Action Cost
      let skill = null;
      if (skillId !== 'attack') {
        skill = skillsData.find(s => s.id === skillId);
        if (!skill) return { log: [...state.log, "Unknown skill"] };
        if (actor.mp < skill.cost) return { log: [...state.log, "Not enough SP!"] };
        actor.mp -= skill.cost;
      }

      // 3. Execution
      let damage = 0;
      
      // BASIC ATTACK
      if (skillId === 'attack') {
        const weapon = getItem(actor.equipment.weapon);
        const formula = weapon?.damage || "[STR] + 1d2";
        damage = calculateDamage(formula, actor.stats);
        if (targetType === 'enemy') enemies[targetIndex].hp = Math.max(0, enemies[targetIndex].hp - damage);
        logMsg = `[${actor.name}] attacks ${targetName} for ${damage} DMG!`;
      } 
      // ADVANCED SKILLS
      else if (skill) {
        // Special Consumable Logic (Tent/Phoenix handled in Parser usually, but skill-based here)
        
        if (skill.effect.includes('damage')) {
           // Base logic + multipliers
           let baseDmg = 0;
           const weapon = getItem(actor.equipment.weapon);
           
           if (skill.effect === 'damage_fire') baseDmg = calculateDamage("2d6", actor.stats);
           else if (skill.effect === 'damage_high') baseDmg = calculateDamage(weapon?.damage || "1d4", actor.stats) + calculateDamage("2d4", actor.stats);
           else if (skill.effect === 'damage_2.5x') baseDmg = Math.floor(calculateDamage(weapon?.damage || "1d4", actor.stats) * 2.5);
           else baseDmg = calculateDamage("1d6", actor.stats) + actor.stats.wis;

           if (targetType === 'enemy') {
             enemies[targetIndex].hp = Math.max(0, enemies[targetIndex].hp - baseDmg);
             // Apply Status Chance
             if (skill.effect === 'damage_fire' && Math.random() < 0.5) enemies[targetIndex].status.push({ type: 'burn', duration: 3 });
             if (skill.effect === 'damage_shock' && Math.random() < 0.8) enemies[targetIndex].status.push({ type: 'stun', duration: 1 });
           }
           logMsg = `[${actor.name}] uses ${skill.name} on ${targetName} for ${baseDmg} DMG!`;
        }
        else if (skill.effect.includes('heal')) {
           const heal = actor.stats.wis + 5;
           if (targetType === 'party') {
             party[targetIndex].hp = Math.min(party[targetIndex].maxHp, party[targetIndex].hp + heal);
             logMsg = `[${actor.name}] casts ${skill.name} on ${targetName} (+${heal} HP).`;
           }
        }
        else if (skill.effect === 'steal_item' && targetType === 'enemy') {
           if (enemies[targetIndex].loot.length > 0) {
             const loot = enemies[targetIndex].loot.pop();
             state.inventory.push(loot!);
             logMsg = `[${actor.name}] stole ${loot}!`;
           } else logMsg = "Nothing to steal.";
        }
      }

      // Check Victory
      if (enemies.every(e => e.hp <= 0)) {
        // Grant XP
        const totalXp = enemies.reduce((sum, e) => sum + e.xpReward, 0);
        get().gainXp(Math.floor(totalXp / party.length)); // Split XP
        return { activeEnemies: enemies, party, isCombat: false, log: [...state.log, logMsg, `VICTORY! +${totalXp} XP`] };
      }

      // Turn Management
      const newActed = [...state.actedInTurn, actor.id];
      if (newActed.length >= party.filter(c => c.hp > 0).length) {
        setTimeout(() => get().enemyTurn(), 1000);
      }

      return { activeEnemies: enemies, party, actedInTurn: newActed, log: [...state.log, logMsg], inventory: state.inventory };
    });
  },

  enemyTurn: () => set((state) => {
    if (!state.isCombat) return {};
    const newLog = [...state.log];
    newLog.push("--- ENEMY TURN ---");
    
    // 1. Process Status Effects (Poison ticks)
    const party = state.party.map(c => {
      let hp = c.hp;
      const cleanStatus = c.status.filter(s => {
        if (s.type === 'poison' || s.type === 'burn') { hp = Math.max(0, hp - 1); newLog.push(`${c.name} takes burn/poison dmg.`); }
        s.duration--;
        return s.duration > 0;
      });
      return { ...c, hp, status: cleanStatus };
    });

    state.activeEnemies.forEach(enemy => {
      if (enemy.hp <= 0) return;
      
      // Status Check
      const stunned = enemy.status.find(s => s.type === 'stun' || s.type === 'frozen');
      if (stunned) {
        newLog.push(`${enemy.name} is stunned!`);
        return;
      }

      const targets = party.filter(c => c.hp > 0);
      if (targets.length === 0) return;
      
      const target = targets[Math.floor(Math.random() * targets.length)];
      const idx = party.findIndex(c => c.id === target.id);
      
      // Calc Dmg & Armor
      let dmg = Math.floor(Math.random() * 4) + 1 + Math.floor(enemy.stats.str / 2);
      let reduct = 0;
      const armor = getItem(target.equipment.armor);
      if (armor?.defense) reduct += Math.random() * (armor.defense.max - armor.defense.min) + armor.defense.min;
      
      const finalDmg = Math.max(1, Math.floor(dmg * (1 - Math.min(0.9, reduct))));
      party[idx].hp = Math.max(0, party[idx].hp - finalDmg);
      newLog.push(`[${enemy.name}] hits ${target.name} for ${finalDmg} DMG!`);
    });

    newLog.push("--- PLAYER TURN ---");
    return { party, log: newLog, actedInTurn: [] };
  })
}));