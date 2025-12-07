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
  defense?: { min: number; max: number };
  statBonus?: Partial<Stats>;
  effect?: string;
  aliases?: string[];
  classes?: string[];
};

// 3. CHARACTERS
export type StatusEffect = {
  type: string;    // "poison", "stun", "buff_dex"
  duration: number; // Turns remaining
  val?: number;    // Amount (e.g. poison damage)
};

export type Character = {
  id: string;
  name: string;
  classId: string;
  level: number;
  xp: number;
  maxXp: number;
  hp: number;
  maxHp: number;
  mp: number;
  maxMp: number;
  stats: Stats;
  equipment: {
    weapon: string | null;
    armor: string | null;
    accessories: string[]; // Up to 3
  };
  isPlayerControlled: boolean;
  status: StatusEffect[];
  unlockedSkills: string[]; // List of skill IDs
};

// 4. ENEMIES
export type Enemy = {
  id: string;
  name: string;
  hp: number;
  maxHp: number;
  stats: { str: number; dex: number };
  xpReward: number;
  loot: string[];
  description?: string;
  messages: { lowHealth: string; death: string };
  status: StatusEffect[];
};

// 5. ROOMS
export type Room = {
  id: string;
  name: string;
  description: string;
  image?: string;
  exits: Record<string, string>;
  interactables?: Record<string, any>;
};