import { useGameStore } from '../store/gameStore';
import classesData from '../data/classes.json';
import roomsData from '../data/rooms.json';
import enemiesData from '../data/enemies.json';
import type { Enemy } from '../types'; // Type-only import

const getRoomById = (id: string) => roomsData.find(r => r.id === id);

export const processCommand = (input: string) => {
  const store = useGameStore.getState();
  const cleanInput = input.trim().toLowerCase();
  const args = cleanInput.split(' ');
  const command = args[0];

  store.addLog(`> ${input}`);

  // 1. CHARACTER CREATION
  if (!store.player) {
    const selectedClass = classesData.find(c => c.id === cleanInput || c.name.toLowerCase() === cleanInput);
    if (selectedClass) {
      store.initializePlayer({
        name: "Jin-Woo", // Solo Leveling ref
        classId: selectedClass.id,
        hp: 20 + selectedClass.stats.con,
        maxHp: 20 + selectedClass.stats.con,
        mp: selectedClass.stats.skillSlots,
        maxMp: selectedClass.stats.skillSlots,
        stats: selectedClass.stats,
        equipment: { weapon: null, armor: null, accessories: [] },
        inventory: [...selectedClass.startingItems], // Give starting items
        credits: 0
      });
      store.addLog(`SYSTEM: Class [${selectedClass.name}] confirmed.`);
      const room = getRoomById(store.currentRoomId);
      if(room) store.addLog(room.description);
    } else {
      store.addLog("SYSTEM: Select Class ID: [rogue], [fighter], [wizard], [cleric]");
    }
    return;
  }

  // 2. COMBAT COMMANDS
  if (store.isCombat) {
    if (command === 'attack' || command === 'a') {
      store.attackEnemy();
      // Simple turn logic: Player hits, then Enemy hits immediately (MVP style)
      setTimeout(() => {
        const currentStore = useGameStore.getState();
        if (currentStore.isCombat) {
          currentStore.enemyTurn();
        }
      }, 500); // Small delay for effect
    } else if (command === 'flee') {
      store.addLog("You cannot escape this dungeon.");
    } else {
      store.addLog("Combat Engaged! Commands: [attack], [flee]");
    }
    return;
  }

  // 3. EXPLORATION COMMANDS
  switch (command) {
    case 'look':
    case 'l':
      const room = getRoomById(store.currentRoomId);
      if (room) store.addLog(room.description);
      break;

    case 'inventory':
    case 'i':
      store.addLog(`INVENTORY: ${store.player.inventory.join(', ') || "Empty"}`);
      break;

    case 'open':
      if (args[1] === 'door' && store.currentRoomId === 'room_01_cell') {
        // MVP Script: Opening the door triggers the Guard
        store.addLog("You try to open the door...");
        store.addLog("The Guard spots you!");
        
        // Load Guard Data
        const guardData = enemiesData.find(e => e.id === 'guard_01');
        if (guardData) {
          // Cast the JSON data to our Enemy Type
          const enemy: Enemy = { 
            ...guardData, 
            loot: guardData.loot || [],
            messages: guardData.messages || { lowHealth: "...", death: "Dies." }
          } as unknown as Enemy; 
          
          store.startCombat(enemy);
        }
      } else {
        store.addLog("You can't open that.");
      }
      break;

    default:
      store.addLog("System: Unknown command.");
  }
};