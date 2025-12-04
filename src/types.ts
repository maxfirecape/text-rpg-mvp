// 1. STATS
export type Stats = {
  str: number;
  con: number;
  dex: number;
  wis: number;
  hitChance: number;
  skillSlots: number;
};

// 2. ITEMS (This was missing!)
export type Item = {
  id: string;
  name: string;
  type: 'weapon' | 'armor' | 'accessory' | 'consumable' | 'key';
  description: string;
  damage?: string;
  defense?: number;
  statBonus?: Partial<Stats>;
  effect?: string;
};

// 3. PLAYER
export type Player = {
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
  inventory: string[];
  credits: number;
};

// 4. ROOMS
export type Room = {
  id: string;
  name: string;
  description: string;
  exits: Record<string, string>;
  interactables?: Record<string, any>;
};

// ... (Keep existing Stats, Item, Player, Room definitions)

// 5. ENEMIES
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