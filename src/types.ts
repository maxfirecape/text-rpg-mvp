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
  atbTimer: number; 
};

// 5. CLASSES
export type Class = {
  id: string;
  name: string;
  stats: Stats;
  startingEquipment: string[];
  startingItems: string[];
  startingCredits: number;
  startingSkills?: string[];
  unlocks: { [key: string]: string };
};

// 6. ENEMIES & AI
export type EnemyMove = {
  name: string;
  type: 'attack' | 'heavy_attack' | 'aoe_attack' | 'heal' | 'summon';
  chance: number;       
  chargeTime: number;   
  staggerChance: number;
  msgPrep: string;
  msgHit: string;
  val?: number;         // Multiplier or Heal amount
  damage?: string;      // <--- NEW: "5-12", "3", etc.
  summonId?: string;    
};

export type Enemy = {
  id: string;
  name: string;
  hp: number;
  maxHp: number;
  stats: { str: number; dex: number };
  xpReward: number;
  loot: string[];
  description?: string;
  messages?: { lowHealth?: string; death: string; [key: string]: string | undefined };
  status: StatusEffect[];
  atbTimer?: number;
  state?: 'idle' | 'charging' | 'attacking';
  
  // AI Fields
  moves: EnemyMove[];
  currentMove?: EnemyMove; 
  phases?: string[]; 
  spawnRequest?: string; 
};

// 7. INTERACTABLES
export type Interactable = {
  type?: 'npc' | 'container' | 'door' | 'event' | 'rest';
  name?: string;
  locked?: boolean;
  reqKey?: string;       
  loot?: string;         
  message: string;
  onOpen?: 'ambush' | 'battle' | 'heal'; 
  ambushEnemyId?: string;
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