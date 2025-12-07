// 1. STATS
export type Stats = {
  str: number;
  con: number;
  dex: number;
  wis: number;
  hitChance: number;
  skillSlots: number;
};

// 2. ITEMS (Updated Defense to be a Range)
export type Item = {
  id: string;
  name: string;
  type: 'weapon' | 'armor' | 'accessory' | 'consumable' | 'key';
  description: string;
  damage?: string;
  defense?: { min: number; max: number }; // FIXED: Now supports 5%-8% ranges
  statBonus?: Partial<Stats>;
  effect?: string;
  aliases?: string[];
  classes?: string[]; // Added to match skills.json structure
};

// ... (Keep Character, Enemy, and Room definitions the same)
export type Character = {
  id: string;
  name: string;
  classId: string;
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
  isPlayerControlled: boolean;
  status: string[];
};

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
  description?: string;
  messages: {
    lowHealth: string;
    death: string;
  };
  status: string[];
};

export type Room = {
  id: string;
  name: string;
  description: string;
  image?: string;
  exits: Record<string, string>;
  interactables?: Record<string, any>;
};