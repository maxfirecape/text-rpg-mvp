import { useGameStore } from '../store/gameStore';
import classesData from '../data/classes.json';
import roomsData from '../data/rooms.json';
import enemiesData from '../data/enemies.json';
import itemsData from '../data/items.json';
import type { Enemy, Character, Item } from '../types';

const getRoomById = (id: string) => roomsData.find(r => r.id === id);

// HELPER: Find item by Name, ID, or Alias
const findItem = (query: string): Item | undefined => {
  return itemsData.find(i => 
    i.id === query || 
    i.name.toLowerCase() === query || 
    (i.aliases && i.aliases.includes(query))
  );
};

export const processCommand = (input: string) => {
  const store = useGameStore.getState();
  const cleanInput = input.trim().toLowerCase();
  
  // Log the user's command
  store.addLog(`> ${input}`);

  // 0. CHECK INPUT LOCK
  if (store.isInputLocked) return;

  // 1. CHARACTER CREATION HANDLER
  if (store.party.length === 0) {
    const selectedClass = classesData.find(c => c.id === cleanInput || c.name.toLowerCase() === cleanInput);
    if (selectedClass) {
      const newHero: Character = {
        id: `hero_${Date.now()}`,
        name: "Hero", 
        classId: selectedClass.id,
        hp: 20 + selectedClass.stats.con,
        maxHp: 20 + selectedClass.stats.con,
        mp: selectedClass.stats.skillSlots,
        maxMp: selectedClass.stats.skillSlots,
        stats: selectedClass.stats,
        equipment: { weapon: null, armor: null, accessories: [] },
        isPlayerControlled: true
      };
      
      store.addCharacter(newHero);
      selectedClass.startingItems.forEach(item => store.addToInventory(item));

      store.addLog(`SYSTEM: ${selectedClass.name} registered.`);
      store.addLog("SYSTEM: Sequence Start...");
      const room = getRoomById(store.currentRoomId);
      if(room) store.addLog(room.description);
    } else {
      store.addLog("SYSTEM: Initialization Required.");
      store.addLog("Select Class ID: [rogue], [fighter], [wizard], [cleric]");
    }
    return;
  }

  // --- PARSE ARGUMENTS (NLP) ---
  let command = "";
  let args = "";
  let targetName = "";

  if (cleanInput.includes(" on ")) {
    const parts = cleanInput.split(" on ");
    const leftSide = parts[0].split(" ");
    command = leftSide[0]; 
    args = leftSide.slice(1).join(" "); 
    targetName = parts[1]; 
  } else {
    const parts = cleanInput.split(" ");
    command = parts[0];
    args = parts.slice(1).join(" ");
  }

  // 2. COMBAT COMMANDS
  if (store.isCombat) {
    if (['attack', 'a', 'fight'].includes(command)) {
      // Player attacks first enemy (MVP Logic)
      store.dealDamageToEnemy(0, 5); 
      store.addLog("You attack the enemy!");
      // Note: Enemy turn is now triggered automatically by the store
    } else if (['flee', 'run'].includes(command)) {
      store.addLog("You cannot escape.");
    } else {
      store.addLog("Combat Active! Valid: [attack]");
    }
    return;
  }

  // 3. EXPLORATION & INTERACTION
  switch (command) {
    // --- LOOK / CHECK / SCAN ---
    case 'look':
    case 'l':
    case 'check':
    case 'scan':
      const room = getRoomById(store.currentRoomId);
      if (!room) return;

      if (!args) {
        // Just "look" -> Room Description
        store.addLog(room.description);
      } else {
        // FUZZY CHECK LOGIC:
        // 1. Clean the argument
        const target = args.trim().toLowerCase();
        
        // 2. Find matching key in interactables (Case Insensitive)
        let foundKey = null;
        if (room.interactables) {
          foundKey = Object.keys(room.interactables).find(k => k.toLowerCase() === target);
        }

        if (foundKey) {
          const interactable = room.interactables[foundKey];
          if (interactable.message) {
            store.addLog(interactable.message);
          } else {
            store.addLog(`You check the ${target}.`);
          }
        } else {
          store.addLog(`You don't see anything special about the ${target}.`);
        }
      }
      break;

    // --- NAVIGATION ---
    case 'n':
    case 'north':
      store.addLog("You cannot go North.");
      break;
    case 's':
    case 'south':
      store.addLog("You cannot go South yet.");
      break;

    // --- INVENTORY ---
    case 'inventory':
    case 'i':
    case 'inv':
      store.addLog(`INVENTORY: ${store.inventory.map(id => {
        const item = findItem(id);
        return item ? item.name : id;
      }).join(', ') || "Empty"}`);
      break;

    // --- USE ITEM ---
    case 'use':
      if (!args) {
        store.addLog("Use what?");
        return;
      }
      
      const itemToUse = findItem(args);
      if (!itemToUse) {
        store.addLog(`Unknown item: "${args}"`);
        return;
      }

      if (!store.inventory.includes(itemToUse.id)) {
        store.addLog(`You don't have a ${itemToUse.name}.`);
        return;
      }

      // Default target: First party member
      let targetChar = store.party[0]; 
      if (targetName) {
        const found = store.party.find(c => c.name.toLowerCase() === targetName);
        if (found) targetChar = found;
        else {
          store.addLog(`Target "${targetName}" not found.`);
          return;
        }
      }

      if (itemToUse.effect === "heal_2d6") {
        store.updateCharacter(targetChar.id, { hp: Math.min(targetChar.maxHp, targetChar.hp + 8) });
        store.addLog(`Used ${itemToUse.name} on ${targetChar.name}. (+8 HP)`);
      } else {
        store.addLog(`You use the ${itemToUse.name}. Nothing happens.`);
      }
      break;

    // --- OPEN ---
    case 'open':
      if (args === 'door' && store.currentRoomId === 'room_01_cell') {
        store.addLog("You kick the door open!");
        
        const guardData = enemiesData.find(e => e.id === 'guard_01');
        if (guardData) {
          // Create 3 Guards (A, B, C)
          const guards = ['A', 'B', 'C'].map((letter, i) => ({
            ...guardData,
            id: `guard_${i}`,
            name: `Guard ${letter}`,
            loot: guardData.loot || [],
            messages: guardData.messages || { lowHealth: "...", death: "Dies." }
          } as unknown as Enemy));
          
          store.startCombat(guards);
        }
      } else {
        store.addLog("You can't open that.");
      }
      break;

    // --- HELP ---
    case 'help':
    case 'h':
      store.addLog("COMMANDS:");
      store.addLog("- look / check [thing]");
      store.addLog("- use [item] on [target]");
      store.addLog("- open [door/chest]");
      store.addLog("- inventory / i");
      store.addLog("- attack (in combat)");
      break;

    default:
      store.addLog("System: Command not recognized.");
  }
};