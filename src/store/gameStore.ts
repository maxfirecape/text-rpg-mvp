import { create } from 'zustand';
import type { Character, Room, Item, Enemy } from '../types';

interface GameState {
  // PARTY STATE
  party: Character[];
  inventory: string[]; 
  credits: number;
  
  // WORLD STATE
  currentRoomId: string;
  log: string[];
  
  // COMBAT STATE
  isCombat: boolean;
  activeEnemies: Enemy[];
  
  // GAME FLOW
  isInputLocked: boolean; 
  
  // ACTIONS
  addLog: (message: string) => void;
  setRoom: (roomId: string) => void;
  
  // PARTY MANAGEMENT
  addCharacter: (char: Character) => void;
  updateCharacter: (id: string, updates: Partial<Character>) => void;
  addToInventory: (itemId: string) => void;
  
  // COMBAT ACTIONS
  startCombat: (enemies: Enemy[]) => void;
  dealDamageToEnemy: (enemyIndex: number, amount: number) => void;
  dealDamageToParty: (charIndex: number, amount: number) => void;
  
  // ENEMY AI
  enemyTurn: () => void;
}

export const useGameStore = create<GameState>()((set, get) => ({
  party: [],
  inventory: [],
  credits: 0,
  
  currentRoomId: 'room_01_cell',
  log: ["System initialized...", "Welcome to Project Inertia."], 
  
  isCombat: false,
  activeEnemies: [],
  isInputLocked: false,

  // --- BASIC ACTIONS ---
  addLog: (msg) => set((state) => ({ log: [...state.log, msg] })),
  setRoom: (roomId) => set({ currentRoomId: roomId }),

  // --- PARTY ACTIONS ---
  addCharacter: (char) => set((state) => ({ party: [...state.party, char] })),

  updateCharacter: (id, updates) => set((state) => ({
    party: state.party.map(c => c.id === id ? { ...c, ...updates } : c)
  })),

  addToInventory: (item) => set((state) => ({ 
    inventory: [...state.inventory, item] 
  })),

  // --- COMBAT ACTIONS ---
  startCombat: (enemies) => set((state) => ({ 
    isCombat: true, 
    activeEnemies: enemies,
    log: [...state.log, `WARNING: COMBAT STARTED. ${enemies.length} hostiles detected.`]
  })),

  dealDamageToEnemy: (index, amount) => {
    set((state) => {
      const enemies = [...state.activeEnemies];
      if (!enemies[index]) return {}; 

      enemies[index].hp = Math.max(0, enemies[index].hp - amount);

      // Check Victory condition
      if (enemies.every(e => e.hp <= 0)) {
        return { 
          activeEnemies: [], 
          isCombat: false, 
          log: [...state.log, `VICTORY. All targets eliminated.`] 
        };
      }
      
      // LOGIC UPGRADE: If enemies are alive, queue their turn automatically
      setTimeout(() => {
        get().enemyTurn();
      }, 1000); // 1 second delay for pacing

      return { activeEnemies: enemies };
    });
  },

  dealDamageToParty: (index, amount) => set((state) => {
    const party = [...state.party];
    if (!party[index]) return {};
    party[index].hp = Math.max(0, party[index].hp - amount);
    return { party };
  }),

  // --- ENEMY AI LOGIC ---
  enemyTurn: () => set((state) => {
    if (!state.isCombat || state.activeEnemies.length === 0) return {};
    
    const newLog = [...state.log];
    const newParty = [...state.party];

    // Each living enemy attacks a random living party member
    state.activeEnemies.forEach(enemy => {
      if (enemy.hp <= 0) return; // Dead enemies don't attack

      // Find living targets
      const livingTargets = newParty.filter(c => c.hp > 0);
      if (livingTargets.length === 0) return;

      // Pick Random Target
      const targetIndex = Math.floor(Math.random() * livingTargets.length);
      const target = livingTargets[targetIndex];
      const realIndex = newParty.findIndex(c => c.id === target.id);

      // Roll Damage (1d4 + STR bonus simulated)
      const dmg = Math.floor(Math.random() * 4) + 1 + Math.floor(enemy.stats.str / 2);
      
      newParty[realIndex].hp = Math.max(0, newParty[realIndex].hp - dmg);
      newLog.push(`> ${enemy.name} attacks ${target.name} for ${dmg} DMG!`);
    });

    return { party: newParty, log: newLog };
  })
}));