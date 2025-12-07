import { useGameStore } from '../store/gameStore';
import classesData from '../data/classes.json';
import roomsData from '../data/rooms.json';
import enemiesData from '../data/enemies.json';
import itemsData from '../data/items.json';
import skillsData from '../data/skills.json';
import type { Character, Item, Enemy } from '../types';

const getRoomById = (id: string) => roomsData.find(r => r.id === id);

const findItem = (query: string): Item | undefined => {
  const item = itemsData.find(i => i.id === query || i.name.toLowerCase() === query || i.aliases?.includes(query));
  return item as Item | undefined;
};

const findSkill = (query: string) => {
  return skillsData.find(s => s.id === query || s.name.toLowerCase() === query || s.aliases?.includes(query));
};

const resolveTargetIndex = (query: string, enemies: Enemy[]) => {
  if (!query) return 0; // Default to first
  const q = query.toLowerCase();
  if (q.includes(' a') || q === 'a') return 0;
  if (q.includes(' b') || q === 'b') return 1;
  if (q.includes(' c') || q === 'c') return 2;
  return enemies.findIndex(e => e.name.toLowerCase().includes(q));
};

// --- REX DIALOGUE ---
const triggerRexDialogue = (store: any) => {
  store.setInputLock(true);
  store.setDialogue("rex_intro");
  const p1 = store.party[0]?.name || "Hero";
  setTimeout(() => store.addLog(`Rex looks at ${p1}. "Took you long enough..."`), 0);
  setTimeout(() => {
    store.addLog("1. That's right");
    store.addLog("2. Stay silent");
    store.setInputLock(false); 
  }, 2000);
};

const continueRexDialogue = (choice: string, store: any) => {
  store.setInputLock(true);
  store.setDialogue(null); 
  if (choice === "1") store.addLog("> That's right.");
  else store.addLog("> ...");
  setTimeout(() => {
    store.addLog(`Guards: "Quiet!" | Rex smirks.`);
    store.setInputLock(false);
  }, 2000);
};

export const processCommand = (input: string) => {
  const store = useGameStore.getState();
  const cleanInput = input.trim();
  const lowerInput = cleanInput.toLowerCase();
  
  store.addLog(`> ${input}`);

  if (store.activeDialogue === "rex_intro") {
    if (["1", "2"].includes(cleanInput)) continueRexDialogue(cleanInput, store);
    else store.addLog("Select 1 or 2.");
    return;
  }
  if (store.isInputLocked) return;

  // 1. CHARACTER CREATION
  if (store.party.length < 3) {
    if (!store.tempCharacterName) {
      if (lowerInput.length < 2) { store.addLog("Name too short."); return; }
      store.setTempName(cleanInput);
      store.addLog(`Welcome, ${cleanInput}. Choose Class: [rogue], [fighter], [wizard], [cleric]`);
      return;
    }
    const selectedClass = classesData.find(c => c.id === lowerInput || c.name.toLowerCase() === lowerInput);
    if (selectedClass) {
      const newHero: Character = {
        id: `hero_${Date.now()}`,
        name: store.tempCharacterName, 
        classId: selectedClass.id,
        hp: 20 + selectedClass.stats.con,
        maxHp: 20 + selectedClass.stats.con,
        mp: selectedClass.stats.skillSlots,
        maxMp: selectedClass.stats.skillSlots,
        stats: selectedClass.stats,
        equipment: { weapon: null, armor: null, accessories: [] },
        isPlayerControlled: true,
        status: []
      };
      store.addCharacter(newHero);
      selectedClass.startingItems.forEach(item => store.addToInventory(item));
      store.addLog(`SYSTEM: ${newHero.name} registered.`);
      const updatedStore = useGameStore.getState();
      if (updatedStore.party.length < 3) {
        store.addLog(`Enter Name for Hero ${updatedStore.party.length + 1}:`);
      } else {
        store.addLog("--- INITIALIZATION COMPLETE ---");
        setTimeout(() => store.addLog("Welcome to Inertia."), 1000);
        setTimeout(() => { const r = getRoomById(store.currentRoomId); if(r) store.addLog(r.description); }, 2000);
      }
    } else if (lowerInput.startsWith("help")) {
       store.addLog("Classes: Rogue (Dex), Fighter (Str), Wizard (Mag), Cleric (Heal)");
    } else {
       store.addLog(`Invalid class for ${store.tempCharacterName}. Choose: [rogue], [fighter], [wizard], [cleric]`);
    }
    return;
  }

  // --- PARSING ---
  let command = "";
  let args = "";
  if (lowerInput.includes(" on ")) {
    const parts = lowerInput.split(" on ");
    command = parts[0].split(" ")[0]; 
    args = lowerInput; 
  } else {
    const parts = lowerInput.split(" ");
    command = parts[0];
    args = parts.slice(1).join(" ");
  }

  // 2. COMBAT LOGIC
  if (store.isCombat) {
    // Determine WHO is acting. 
    // Logic: Find the first living party member who has NOT acted this turn.
    const actorIndex = store.party.findIndex((c: Character) => c.hp > 0 && !store.actedInTurn.includes(c.id));

    if (actorIndex === -1) {
      store.addLog("Wait for enemy turn...");
      return;
    }

    if (['attack', 'a'].includes(command)) {
      let targetName = args.replace("attack", "").replace("a ", "").trim();
      const targetIndex = resolveTargetIndex(targetName, store.activeEnemies);
      
      store.performCombatAction(actorIndex, 'attack', targetIndex);
    } 
    else if (['cast', 'c', 'use'].includes(command)) {
      let spellName = "";
      let targetName = "";
      if (lowerInput.includes(" on ")) {
        const parts = lowerInput.split(" on ");
        spellName = parts[0].replace("cast", "").replace("use", "").replace("c ", "").trim();
        targetName = parts[1].trim();
      } else {
        spellName = args;
      }

      const skill = findSkill(spellName);
      if (skill) {
        const targetIndex = resolveTargetIndex(targetName, store.activeEnemies);
        store.performCombatAction(actorIndex, skill.id, targetIndex);
      } else {
        store.addLog(`Unknown spell: ${spellName}`);
      }
    } else {
      store.addLog(`It is ${store.party[actorIndex].name}'s turn. Actions: attack, cast [spell]`);
    }
    return;
  }

  // 3. EXPLORATION
  switch (command) {
    case 'look':
    case 'l':
    case 'check':
      const room = getRoomById(store.currentRoomId);
      if (!room) return;
      if (!args) store.addLog(room.description);
      else {
        const target = args.trim().toLowerCase();
        const foundKey = room.interactables ? Object.keys(room.interactables).find(k => k.toLowerCase() === target) : null;
        if (foundKey) {
           const obj = room.interactables![foundKey];
           if (foundKey === "prisoner") triggerRexDialogue(store);
           else if (obj.message) store.addLog(obj.message);
        } else store.addLog("Nothing special.");
      }
      break;

    case 'open':
      if (args.includes('door') && store.currentRoomId === 'room_01_cell') {
        store.addLog("DOOR KICKED! 3 Guards attack!");
        const guardData = enemiesData.find(e => e.id === 'guard_01');
        if (guardData) {
          const guards = ['A', 'B', 'C'].map((letter, i) => ({
            ...guardData, id: `guard_${i}`, name: `Guard ${letter}`, hp: 30, maxHp: 30
          } as unknown as Enemy));
          store.startCombat(guards);
        }
      } else if (args.includes('chest') && store.currentRoomId === 'room_02_corridor') {
         store.addLog("Found Lucky Charm!");
         store.addToInventory("lucky_charm");
      } else store.addLog("Locked or missing.");
      break;
      
    case 'inventory':
    case 'i':
      store.addLog(`BAG: ${store.inventory.join(', ') || "Empty"}`);
      break;

    default:
      store.addLog("Unknown command.");
  }
};