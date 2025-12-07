import { useGameStore } from '../store/gameStore';
import classesData from '../data/classes.json';
import roomsData from '../data/rooms.json';
import enemiesData from '../data/enemies.json';
import itemsData from '../data/items.json';
import skillsData from '../data/skills.json';
import type { Character, Item, Enemy } from '../types';

// --- HELPERS ---
const getRoom = (id: string) => roomsData.find(r => r.id === id);
const findItem = (q: string) => itemsData.find(i => i.id === q || i.name.toLowerCase() === q || i.aliases?.includes(q));
const findSkill = (q: string) => skillsData.find(s => s.id === q || s.name.toLowerCase() === q || s.aliases?.includes(q));

// Target Resolvers
const resolveEnemyIndex = (q: string, enemies: Enemy[]) => {
  if (!q) return enemies.findIndex(e => e.hp > 0);
  const l = q.toLowerCase();
  if (l === 'a') return 0; if (l === 'b') return 1; if (l === 'c') return 2;
  return enemies.findIndex(e => e.name.toLowerCase().includes(l));
};

const resolvePartyIndex = (q: string, party: Character[]) => {
  if (!q) return -1;
  const l = q.toLowerCase();
  // Check exact names or "hero 1"
  if (l === 'hero 1') return 0;
  if (l === 'hero 2') return 1;
  if (l === 'hero 3') return 2;
  return party.findIndex(c => c.name.toLowerCase().includes(l));
};

// --- DIALOGUE HANDLERS ---
const handleDialogue = (input: string, store: any) => {
  if (store.activeDialogue === "rex_intro") {
    if (["1", "2"].includes(input)) {
      store.setInputLock(true);
      store.setDialogue(null);
      store.addLog(input === "1" ? "> That's right." : "> ...");
      setTimeout(() => {
        store.addLog(`Guards: "Quiet!" | Rex smirks.`);
        store.setInputLock(false);
      }, 2000);
    } else store.addLog("Select 1 or 2.");
    return true;
  }
  return false;
};

// --- COMMAND HANDLERS ---

const cmdLook = (args: string, store: any) => {
  const room = getRoom(store.currentRoomId);
  if (!room) return;
  
  if (!args) {
    store.addLog(`[${room.name}]`);
    store.addLog(room.description);
    // List visible NPCs/Interactables hint
    if (room.interactables) {
      const visible = Object.keys(room.interactables).filter(k => k !== 'door' && k !== 'chest');
      if (visible.length > 0) store.addLog(`You see: ${visible.join(', ')}`);
    }
  } else {
    cmdExamine(args, store);
  }
};

const cmdExamine = (args: string, store: any) => {
  if (!args) { store.addLog("Examine what?"); return; }
  const room = getRoom(store.currentRoomId);
  const target = args.toLowerCase();

  // 1. Check Room Objects
  if (room?.interactables) {
    const key = Object.keys(room.interactables).find(k => k.toLowerCase() === target);
    if (key) {
      const obj = room.interactables[key];
      if (key === "prisoner" || key === "rex") {
        store.setDialogue("rex_intro"); // Trigger dialogue
        store.setInputLock(true);
        setTimeout(() => {
           store.addLog(`Rex looks up. "Took you long enough..."`); 
           store.addLog("1. That's right");
           store.addLog("2. Stay silent");
           store.setInputLock(false);
        }, 500);
      } else {
        store.addLog(obj.message || "You see nothing special.");
      }
      return;
    }
  }

  // 2. Check Inventory Items
  const item = findItem(target);
  if (item && store.inventory.includes(item.id)) {
    store.addLog(`[${item.name}]: ${item.description}`);
    // Show stats if gear
    if (item.damage) store.addLog(`Damage: ${item.damage}`);
    if (item.defense) store.addLog(`Defense: ${item.defense.min * 100}% - ${item.defense.max * 100}%`);
    return;
  }

  store.addLog(`You don't see '${args}' here.`);
};

const cmdMove = (dir: string, store: any) => {
  const room = getRoom(store.currentRoomId);
  // Map short direction to full
  const d = {n:'north', s:'south', e:'east', w:'west', u:'up', d:'down'}[dir] || dir;
  
  if (room?.exits && room.exits[d]) {
    store.setRoom(room.exits[d]);
    const newRoom = getRoom(room.exits[d]);
    if (newRoom) store.addLog(newRoom.description);
  } else {
    store.addLog("You can't go that way.");
  }
};

const cmdInventory = (args: string, store: any) => {
  store.addLog(`CREDITS: ${store.credits}`);
  if (store.inventory.length === 0) store.addLog("Your bag is empty.");
  else store.addLog(`BAG: ${store.inventory.join(', ')}`);
};

const cmdStats = (args: string, store: any) => {
  // If arg provided, look for that char, otherwise list all or leader
  const targetIdx = resolvePartyIndex(args, store.party);
  const target = targetIdx !== -1 ? store.party[targetIdx] : null;

  if (target) {
    store.addLog(`--- ${target.name} (${target.classId.toUpperCase()}) ---`);
    store.addLog(`LVL: ${target.level} | XP: ${target.xp}/${target.maxXp}`);
    store.addLog(`HP: ${target.hp}/${target.maxHp} | SP: ${target.mp}/${target.maxMp}`);
    store.addLog(`STR: ${target.stats.str} | DEX: ${target.stats.dex}`);
    store.addLog(`CON: ${target.stats.con} | WIS: ${target.stats.wis}`);
  } else {
    // List brief stats for all
    store.party.forEach((c: Character) => {
      store.addLog(`[${c.name}] Lvl ${c.level} ${c.classId} - XP: ${c.xp}/${c.maxXp}`);
    });
  }
};

const cmdSkills = (args: string, store: any) => {
  const targetIdx = resolvePartyIndex(args, store.party);
  const target = targetIdx !== -1 ? store.party[targetIdx] : store.party[0]; // Default P1

  if (target) {
    store.addLog(`--- SKILLS: ${target.name} ---`);
    if (target.unlockedSkills.length === 0) store.addLog("No skills unlocked.");
    target.unlockedSkills.forEach((sid: string) => {
      const s = skillsData.find(sk => sk.id === sid);
      if (s) store.addLog(`> ${s.name} (${s.cost} SP): ${s.description}`);
    });
  }
};

const cmdEquip = (args: string, store: any) => {
  // Syntax: "equip [item] on [person]" or just "equip [item]" (P1)
  const parts = args.split(" on ");
  const itemName = parts[0];
  const charName = parts[1] || store.party[0].name;

  const item = findItem(itemName);
  const charIdx = resolvePartyIndex(charName, store.party);

  if (!item) { store.addLog("Unknown item."); return; }
  if (charIdx === -1) { store.addLog("Character not found."); return; }

  store.equipItem(charIdx, item.id);
};

const cmdUnequip = (args: string, store: any) => {
  // Syntax: "remove weapon on hero"
  const parts = args.split(" on ");
  const slotName = parts[0].toLowerCase(); // weapon, armor, accessory
  const charName = parts[1] || store.party[0].name;
  
  const charIdx = resolvePartyIndex(charName, store.party);
  if (charIdx === -1) { store.addLog("Character not found."); return; }

  if (['weapon', 'armor', 'accessory'].includes(slotName)) {
    store.unequipItem(charIdx, slotName as any);
  } else {
    store.addLog("Slot must be: weapon, armor, or accessory.");
  }
};

const cmdCombatAction = (command: string, args: string, store: any) => {
  if (!store.isCombat) { store.addLog("There is no one to fight."); return; }

  // 1. Who is acting?
  const actorIndex = store.party.findIndex((c: Character) => c.hp > 0 && !store.actedInTurn.includes(c.id));
  if (actorIndex === -1) { store.addLog("Wait for enemy turn..."); return; }

  // 2. Parse Action
  if (['attack', 'a', 'kill'].includes(command)) {
    const tIdx = resolveEnemyIndex(args, store.activeEnemies);
    store.performCombatAction(actorIndex, 'attack', tIdx, 'enemy');
  } 
  else if (['cast', 'c', 'use'].includes(command)) {
    // "cast fire on guard"
    let spellStr = args;
    let targetStr = "";
    if (args.includes(" on ")) {
      const parts = args.split(" on ");
      spellStr = parts[0];
      targetStr = parts[1];
    }
    
    const skill = findSkill(spellStr);
    if (!skill) { store.addLog("Unknown spell/skill."); return; }

    // Target Party or Enemy?
    if (skill.effect.includes("heal") || skill.effect.includes("buff")) {
      let tid = resolvePartyIndex(targetStr, store.party);
      if (tid === -1 && !targetStr) tid = actorIndex; // Self
      store.performCombatAction(actorIndex, skill.id, tid, 'party');
    } else {
      const tid = resolveEnemyIndex(targetStr, store.activeEnemies);
      store.performCombatAction(actorIndex, skill.id, tid, 'enemy');
    }
  }
};

const cmdOpen = (args: string, store: any) => {
  if (args.includes('door') && store.currentRoomId === 'room_01_cell') {
    store.addLog("You kick the door open! 3 Guards attack!");
    const g = enemiesData.find(e => e.id === 'guard_01');
    if (g) {
      // Create unique instances
      const guards = ['A', 'B', 'C'].map((l, i) => ({ 
        ...g, id: `g${i}`, name: `Guard ${l}`, hp: g.hp, maxHp: g.maxHp, status: [], loot: [...(g.loot||[])] 
      } as Enemy));
      store.startCombat(guards);
    }
  } else if (args.includes('chest') && store.currentRoomId === 'room_02_corridor') {
    store.addLog("You open the chest and find a Lucky Charm!");
    store.addToInventory("lucky_charm");
  } else {
    store.addLog("It won't open.");
  }
};

const cmdHelp = (store: any) => {
  store.addLog("=== COMMANDS ===");
  store.addLog("EXPLORE: look (l), north (n), south (s), open [obj]");
  store.addLog("INSPECT: examine (x) [obj], check [obj]");
  store.addLog("SELF: inventory (i), stats [name], skills [name]");
  store.addLog("GEAR: equip [item] on [name], remove [slot] on [name]");
  store.addLog("COMBAT: attack (a) [target], cast (c) [spell] on [target]");
};

// --- MAIN PARSER ---
export const processCommand = (input: string) => {
  const store = useGameStore.getState();
  const clean = input.trim();
  if (!clean) return;
  const parts = clean.split(" ");
  const command = parts[0].toLowerCase();
  const args = parts.slice(1).join(" ");

  store.addLog(`> ${input}`);

  // 0. Handle Dialogue/Cutscenes
  if (handleDialogue(clean, store)) return;
  if (store.isInputLocked) return;

  // 1. Handle Character Creation (Keep logic simple here)
  if (store.party.length < 3) {
    if (!store.tempCharacterName) {
      if (clean.length < 2) { store.addLog("Name too short."); return; }
      store.setTempName(clean);
      store.addLog(`Welcome, ${clean}. Choose Class: [rogue], [fighter], [wizard], [cleric]`);
    } else {
      const cls = classesData.find(c => c.id === command || c.name.toLowerCase() === command);
      if (cls) {
        const newHero: Character = {
          id: `h${Date.now()}`, name: store.tempCharacterName, classId: cls.id,
          level: 1, xp: 0, maxXp: 100, hp: 20 + cls.stats.con, maxHp: 20 + cls.stats.con,
          mp: cls.stats.skillSlots, maxMp: cls.stats.skillSlots, stats: cls.stats,
          equipment: { weapon: null, armor: null, accessories: [] },
          isPlayerControlled: true, status: [],
          unlockedSkills: cls.startingItems.filter(i => skillsData.some(s => s.id === i)) // MVP: Start skills
        };
        store.addCharacter(newHero, cls.startingCredits);
        cls.startingEquipment.forEach(id => store.addToInventory(id));
        cls.startingItems.forEach(id => store.addToInventory(id));
        store.addLog(`Registered ${newHero.name}.`);
        if (useGameStore.getState().party.length < 3) store.addLog(`Enter Name for Hero ${useGameStore.getState().party.length + 1}:`);
        else {
          store.addLog("INITIALIZATION COMPLETE.");
          setTimeout(() => { const r = getRoom(store.currentRoomId); if(r) store.addLog(r.description); }, 1000);
        }
      } else store.addLog("Invalid Class.");
    }
    return;
  }

  // 2. MAIN GAME COMMANDS (Dictionary)
  switch (command) {
    case 'n': case 's': case 'e': case 'w': case 'north': case 'south': case 'east': case 'west':
      cmdMove(command, store); break;
    
    case 'l': case 'look':
      cmdLook(args, store); break;
    
    case 'x': case 'examine': case 'check': case 'read': case 'search':
      cmdExamine(args, store); break;
    
    case 'i': case 'inv': case 'inventory':
      cmdInventory(args, store); break;
    
    case 'stats': case 'score': case 'status':
      cmdStats(args, store); break;
    
    case 'skills': case 'spells': case 'abilities':
      cmdSkills(args, store); break;
    
    case 'equip': case 'wear':
      cmdEquip(args, store); break;
    
    case 'unequip': case 'remove':
      cmdUnequip(args, store); break;
    
    case 'open':
      cmdOpen(args, store); break;
    
    case 'h': case 'help':
      cmdHelp(store); break;

    // Combat Commands
    case 'a': case 'attack': case 'kill': case 'hit':
    case 'c': case 'cast': case 'use':
      cmdCombatAction(command, args, store); break;

    default:
      store.addLog("I don't know how to do that.");
  }
};