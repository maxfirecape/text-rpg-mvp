// 1. STATS
export type Stats = {
  str: number;
  con: number;
  dex: number;
  wis: number;
  hitChance: number;
  skillSlots: number;
};

// 2. ITEMS
export type Item = {
  id: string;
  name: string;
  type: 'weapon' | 'armor' | 'accessory' | 'consumable' | 'key';
  description: string;
  damage?: string;
  defense?: number;
  statBonus?: Partial<Stats>;
  effect?: string;
  aliases?: string[]; // For natural language (e.g. "hp pot")
};

// 3. CHARACTERS (Scalable Party Members)
export type Character = {
  id: string;          // Unique Instance ID (e.g., "hero_1", "npc_rex")
  name: string;        // Display Name (e.g., "Jin-Woo", "Rex")
  classId: string;     // Refers to classes.json
  hp: number;
  maxHp: number;
  mp: number;
  maxMp: number;
  stats: Stats;
  equipment: {
    weapon: string | null;
    armor: string | null;
    accessories: string[];
  };
  isPlayerControlled: boolean; // TRUE for created heroes, FALSE for recruited NPCs
};

// 4. ENEMIES
export type Enemy = {
  id: string;
  name: string;
  hp: number;
  maxHp: number;
  stats: {
    str: number;
    dex: number;
  };
  xpReward: number;
  loot: string[];
  messages: {
    lowHealth: string;
    death: string;
  };
};

// 5. ROOMS
export type Room = {
  id: string;
  name: string;
  description: string;
  exits: Record<string, string>;
  interactables?: Record<string, any>;
};