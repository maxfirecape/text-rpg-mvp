
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

// 3. SKILLS
export type Skill = {
  id: string;
  name: string;
  cost: number;
  type: string;
  effect?: string; 
  formula?: string;
  val?: number;
  stat?: string;
  duration?: number;
  chance?: number;
  status?: string;
  description: string;
  aliases?: string[];
  classes?: string[];
  hitChanceBonus?: number;
  bonusDamage?: string;
  subType?: string;
  target?: string;
};

// 4. CHARACTERS & STATUS
export type StatusEffect = {
  type: string;
  duration: number;
  val?: number;
  stat?: string;
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
    accessories: string[];
  };
  isPlayerControlled: boolean;
  status: StatusEffect[];
  unlockedSkills: string[];
};

// 5. CLASSES
export type Class = {
  id: string;
  name: string;
  stats: Stats;
  startingEquipment: string[];
  startingItems: string[];
  startingCredits: number;
  unlocks: { [key: string]: string };
};

// 6. ENEMIES
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
  atbTimer?: number;
  state?: 'idle' | 'charging' | 'attacking';
};

// 7. INTERACTABLES
export type Interactable = {
  type?: 'npc';
  name?: string;
  locked?: boolean;
  loot?: string;
  message: string;
};

// 8. ROOMS
export type Room = {
  id: string;
  name: string;
  description: string;
  image?: string;
  exits: { [key: string]: string }; 
  interactables?: { [key: string]: Interactable }; 
};
