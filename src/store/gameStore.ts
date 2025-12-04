import { create } from 'zustand';
import type { Player, Item, Enemy } from '../types'; // Note: import type!

interface GameState {
  player: Player | null;
  currentRoomId: string;
  log: string[];
  
  // COMBAT STATE
  isCombat: boolean;
  activeEnemy: Enemy | null;
  
  // ACTIONS
  initializePlayer: (p: Player) => void;
  setRoom: (roomId: string) => void;
  addLog: (message: string) => void;
  
  // COMBAT ACTIONS
  startCombat: (enemy: Enemy) => void;
  attackEnemy: () => void;
  enemyTurn: () => void;
}

export const useGameStore = create<GameState>()((set, get) => ({
  player: null,
  currentRoomId: 'room_01_cell',
  log: ["System initialized...", "Welcome, Player."], 
  isCombat: false,
  activeEnemy: null,

  initializePlayer: (p) => set({ player: p }),
  setRoom: (roomId) => set({ currentRoomId: roomId }),
  addLog: (msg) => set((state) => ({ log: [...state.log, msg] })),

  // 1. START THE FIGHT
  startCombat: (enemy) => set({ 
    isCombat: true, 
    activeEnemy: enemy,
    log: [...get().log, `WARNING: COMBAT STARTED. [${enemy.name}] engages!`]
  }),

  // 2. PLAYER ATTACK LOGIC
  attackEnemy: () => set((state) => {
    if (!state.activeEnemy || !state.player) return {};

    // Calculate Damage: (STR / 2) + d6 (Simulated)
    const baseDmg = Math.floor(state.player.stats.str / 2);
    const rng = Math.floor(Math.random() * 6) + 1;
    const totalDmg = baseDmg + rng;

    const newEnemyHp = Math.max(0, state.activeEnemy.hp - totalDmg);
    
    // Log the hit
    const hitLog = `> You hit ${state.activeEnemy.name} for ${totalDmg} DMG!`;
    const newLog = [...state.log, hitLog];

    // Check Death
    if (newEnemyHp <= 0) {
      return {
        activeEnemy: null,
        isCombat: false,
        log: [...newLog, `VICTORY: ${state.activeEnemy.messages.death}`, `+${state.activeEnemy.xpReward} XP`]
      };
    }

    return {
      activeEnemy: { ...state.activeEnemy, hp: newEnemyHp },
      log: newLog
    };
  }),

  // 3. ENEMY TURN (Simplified for MVP)
  enemyTurn: () => set((state) => {
    if (!state.activeEnemy || !state.player) return {};
    
    const dmg = Math.floor(Math.random() * 4) + 1; // 1d4 damage
    const newPlayerHp = Math.max(0, state.player.hp - dmg);
    
    return {
      player: { ...state.player, hp: newPlayerHp },
      log: [...state.log, `> ${state.activeEnemy.name} hits you for ${dmg} damage!`]
    };
  })
}));