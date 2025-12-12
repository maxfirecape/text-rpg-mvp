import { useGameStore as store } from '../store/gameStore';
import type { GameState } from '../store/gameStore';
import classesDataJson from '../data/classes.json';
import roomsDataJson from '../data/rooms.json';
import enemiesDataJson from '../data/enemies.json';
import itemsDataJson from '../data/items.json';
import skillsDataJson from '../data/skills.json';
import type { Character, Enemy, Skill, Item, Room, Class } from '../types';

const roomsData = roomsDataJson as unknown as Room[];
const itemsData = itemsDataJson as unknown as Item[];
const skillsData = skillsDataJson as unknown as Skill[];
const classesData = classesDataJson as unknown as Class[];
const enemiesData = enemiesDataJson as unknown as Enemy[];

const getRoom = (id: string): Room | undefined => roomsData.find(r => r.id === id);
const findItem = (q: string): Item | undefined => itemsData.find(i => i.id === q || i.name.toLowerCase() === q || i.aliases?.includes(q));
const findSkill = (q: string): Skill | undefined => skillsData.find(s => s.id === q || s.name.toLowerCase() === q || s.aliases?.includes(q));

const resolveEnemyIndex = (q: string, enemies: Enemy[]) => {
  if (!q) return enemies.findIndex(e => e.hp > 0);
  const l = q.toLowerCase();
  if (l === 'a') return 0; if (l === 'b') return 1; if (l === 'c') return 2;
  return enemies.findIndex(e => e.name.toLowerCase().includes(l));
};

const resolvePartyIndex = (q: string, party: Character[]) => {
  if (!q) return -1;
  const l = q.toLowerCase();
  if (l === 'hero 1') return 0; if (l === 'hero 2') return 1; if (l === 'hero 3') return 2;
  return party.findIndex(c => c.name.toLowerCase().includes(l));
};

const handleDialogue = (input: string, currentState: GameState) => {
  if (currentState.activeDialogue === "rex_intro") {
    if (["1", "2"].includes(input)) {
      store.getState().setInputLock(true);
      store.getState().setDialogue(null);
      store.getState().addLog(input === "1" ? "> That's right." : "> ...");
      setTimeout(() => {
        store.getState().addLog(`Guards: "Quiet!" | Rex smirks.`);
        store.getState().setInputLock(false);
      }, 2000);
    } else store.getState().addLog("Select 1 or 2.");
    return true;
  }
  return false;
};

const cmdLook = (args: string, currentState: GameState) => {
  const room = getRoom(currentState.currentRoomId);
  if (!room) return;
  if (!args) {
    store.getState().addLog(`[${room.name}]`);
    store.getState().addLog(room.description);
    if (room.interactables) {
      const visible = Object.keys(room.interactables).filter(k => k !== 'door' && !(room.interactables?.[k].loot && currentState.lootedChests.includes(room.id + "_" + k)));
      if (visible.length > 0) store.getState().addLog(`You see: ${visible.join(', ')}`);
    }
  } else {
    cmdExamine(args, currentState);
  }
};

const cmdExamine = (args: string, currentState: GameState) => {
  if (!args) { store.getState().addLog("Examine what?"); return; }
  const room = getRoom(currentState.currentRoomId);
  const target = args.toLowerCase();

  if (room?.interactables) {
    const key = Object.keys(room.interactables).find(k => k.toLowerCase() === target);
    if (key) {
      const obj = room.interactables[key];
      if (key === "prisoner" || key === "rex") {
        store.getState().setDialogue("rex_intro");
        store.getState().setInputLock(true);
        setTimeout(() => {
           store.getState().addLog(`Rex looks up. "Took you long enough..."`); 
           store.getState().addLog("1. That's right");
           store.getState().addLog("2. Stay silent");
           store.getState().setInputLock(false);
        }, 500);
      } else {
        store.getState().addLog(obj.message || "You see nothing special.");
      }
      return;
    }
  }
  
  const item = findItem(target);
  if (item && currentState.inventory.includes(item.id)) {
    store.getState().addLog(`[${item.name}]: ${item.description}`);
    if (item.damage) store.getState().addLog(`Damage: ${item.damage}`);
    if (item.defense) store.getState().addLog(`Defense: ${item.defense.min * 100}% - ${item.defense.max * 100}%`);
    return;
  }
  store.getState().addLog(`You don't see '${args}' here.`);
};

const cmdMove = (dir: string, currentState: GameState) => {
  const room = getRoom(currentState.currentRoomId);
  const directionMap: { [key: string]: string } = { n: 'north', s: 'south', e: 'east', w: 'west', u: 'up', d: 'down' };
  const d = directionMap[dir] || dir;

  if (currentState.currentRoomId === 'room_01_cell' && d === 'west') {
      const doorId = 'room_01_cell_door';
      if (!currentState.lootedChests.includes(doorId)) {
          store.getState().addLog("You try to leave, but the door kicks open!");
          const g = enemiesData.find(e => e.id === 'guard_01');
          if (g) {
              const enemies = ['A', 'B', 'C'].map((l, i) => ({ 
                  ...g, id: `e${Date.now()}_${i}`, name: `${g.name} ${l}`, hp: g.hp, maxHp: g.maxHp, status: [], loot: [...(g.loot||[])] 
              } as Enemy));
              store.getState().startCombat(enemies);
              store.getState().setChestLooted(doorId); 
          }
          return; 
      }
  }
  
  if (room?.exits && room.exits[d]) {
    store.getState().setRoom(room.exits[d]);
    const newRoom = getRoom(room.exits[d]);
    if (newRoom) store.getState().addLog(newRoom.description);
  } else {
    store.getState().addLog("You can't go that way.");
  }
};

const cmdInventory = () => {
  const { credits, inventory } = store.getState();
  store.getState().addLog(`CREDITS: ${credits}`);
  if (inventory.length === 0) store.getState().addLog("Your bag is empty.");
  else {
    const counts: {[key:string]:number} = {};
    inventory.forEach((id: string) => { counts[id] = (counts[id] || 0) + 1; });
    const list = Object.keys(counts).map(id => {
       const i = findItem(id);
       return `${i?.name || id} (x${counts[id]})`;
    });
    store.getState().addLog(`BAG: ${list.join(', ')}`);
  }
};

const cmdStats = (args: string, currentState: GameState) => {
  const targetIdx = resolvePartyIndex(args, currentState.party);
  const target = targetIdx !== -1 ? currentState.party[targetIdx] : null;
  if (target) {
    const derived = store.getState().getDerivedStats(target);
    store.getState().addLog(`--- ${target.name} (${target.classId.toUpperCase()}) ---`);
    store.getState().addLog(`LVL: ${target.level} | XP: ${target.xp}/${target.maxXp}`);
    store.getState().addLog(`HP: ${target.hp}/${target.maxHp} | SP: ${target.mp}/${target.maxMp}`);
    store.getState().addLog(`STR: ${derived.str} | DEX: ${derived.dex}`);
    store.getState().addLog(`CON: ${derived.con} | WIS: ${derived.wis}`);
  } else {
    currentState.party.forEach((c: Character) => {
      store.getState().addLog(`[${c.name}] Lvl ${c.level} ${c.classId} - XP: ${c.xp}/${c.maxXp}`);
    });
  }
};

const cmdSkills = (args: string, currentState: GameState) => {
  const targetIdx = resolvePartyIndex(args, currentState.party);
  const target = targetIdx !== -1 ? currentState.party[targetIdx] : currentState.party[0]; 
  if (target) {
    store.getState().addLog(`--- SKILLS: ${target.name} ---`);
    if (target.unlockedSkills.length === 0) store.getState().addLog("No skills unlocked.");
    target.unlockedSkills.forEach((sid: string) => {
      const s = findSkill(sid);
      if (s) store.getState().addLog(`> ${s.name} (${s.cost} SP): ${s.description}`);
    });
  }
};

const cmdEquip = (args: string, currentState: GameState) => {
  const parts = args.split(" on ");
  const itemName = parts[0];
  const charName = parts[1] || currentState.party[0].name;
  const item = findItem(itemName);
  const charIdx = resolvePartyIndex(charName, currentState.party);
  if (!item) { store.getState().addLog("Unknown item."); return; }
  if (charIdx === -1) { store.getState().addLog("Character not found."); return; }
  store.getState().equipItem(charIdx, item.id);
};

const cmdUnequip = (args: string, currentState: GameState) => {
  const parts = args.split(" on ");
  const slotName = parts[0].toLowerCase();
  const charName = parts[1] || currentState.party[0].name;
  const charIdx = resolvePartyIndex(charName, currentState.party);
  if (charIdx === -1) { store.getState().addLog("Character not found."); return; }
  if (['weapon', 'armor', 'accessory'].includes(slotName)) {
    store.getState().unequipItem(charIdx, slotName as 'weapon' | 'armor' | 'accessory');
  } else {
    store.getState().addLog("Slot must be: weapon, armor, or accessory.");
  }
};

// --- UPDATED: HANDLES ITEMS AND TARGETING ---
const cmdCombatAction = (command: string, args: string, currentState: GameState) => {
  if (!currentState.isCombat) { store.getState().addLog("There is no one to fight."); return; }
  
  const currentActorId = currentState.battleQueue[0];
  if (!currentActorId) {
      store.getState().addLog("Wait for your turn!");
      return;
  }

  const actorIndex = currentState.party.findIndex(c => c.id === currentActorId);
  const actor = currentState.party[actorIndex];

  const potentialName = args.split(" ")[0];
  const namedIndex = resolvePartyIndex(potentialName, currentState.party);
  
  if (namedIndex !== -1 && currentState.party[namedIndex].id !== currentActorId) {
      store.getState().addLog(`It's not ${currentState.party[namedIndex].name}'s turn! It's ${actor.name}'s turn.`);
      return;
  }

  let cleanArgs = args;
  if (namedIndex !== -1) cleanArgs = args.substring(potentialName.length).trim();

  if (['attack', 'a', 'kill', 'hit'].includes(command)) {
    const tIdx = resolveEnemyIndex(cleanArgs, currentState.activeEnemies);
    store.getState().performAction(actorIndex, 'attack', tIdx, 'enemy');
  } 
  else if (['cast', 'c', 'use'].includes(command)) {
    let spellStr = cleanArgs;
    let targetStr = "";
    if (cleanArgs.includes(" on ")) {
      const parts = cleanArgs.split(" on ");
      spellStr = parts[0];
      targetStr = parts[1];
    }

    // 1. Try finding a Skill
    let actionId = "";
    const skill = findSkill(spellStr);
    if (skill) {
        actionId = skill.id;
    } else {
        // 2. Try finding an Item
        const item = findItem(spellStr);
        if (item) actionId = item.id;
    }

    if (!actionId) { store.getState().addLog("Unknown skill or item."); return; }

    // Re-verify the object to determine type (Healing vs Damage) logic
    // (This is a simplified check. The store handles the 'type' field, but we need to know who to target)
    // We assume if targetStr is set, we use it. If not, defaults apply.
    
    // Attempt to resolve as Party Member first
    const partyTargetIdx = resolvePartyIndex(targetStr, currentState.party);
    if (partyTargetIdx !== -1) {
        store.getState().performAction(actorIndex, actionId, partyTargetIdx, 'party');
        return;
    }

    // Attempt to resolve as Enemy
    const enemyTargetIdx = resolveEnemyIndex(targetStr || cleanArgs, currentState.activeEnemies);
    // Note: If no targetStr, resolveEnemyIndex defaults to 0 (first enemy). 
    // This implies we default to Offensive if target not found in party. 
    // For Self-Heal, user must type "use potion on [self]".
    
    // To support "use potion" = self, we'd need more logic here. 
    // For now, let's allow the store to decide or default to enemy for attack skills.
    // Actually, for Items like Potion, if no target is specified, it might be safer to default to SELF (actorIndex).
    
    if (skill && (skill.type === 'heal' || skill.type === 'buff' || skill.type === 'revive')) {
         store.getState().performAction(actorIndex, actionId, actorIndex, 'party');
    } 
    else if (!skill && actionId) {
        // It's an item. Check if it's a potion-like effect string?
        // We can't see 'effect' easily here without findItem again.
        const it = findItem(actionId);
        if (it?.effect?.includes('heal') || it?.effect?.includes('restore')) {
             // Default to self if no target
             const t = targetStr ? resolvePartyIndex(targetStr, currentState.party) : actorIndex;
             const finalT = t === -1 ? actorIndex : t;
             store.getState().performAction(actorIndex, actionId, finalT, 'party');
        } else {
             store.getState().performAction(actorIndex, actionId, enemyTargetIdx, 'enemy');
        }
    }
    else {
        store.getState().performAction(actorIndex, actionId, enemyTargetIdx, 'enemy');
    }
  }
};

const cmdOpen = (args: string, currentState: GameState) => {
  const room = getRoom(currentState.currentRoomId);
  if (!room || !room.interactables) { store.getState().addLog("Nothing to open."); return; }
  const target = args.toLowerCase();

  const interactableKey = Object.keys(room.interactables).find(k => k.toLowerCase() === target);
  
  if (interactableKey) {
    const obj = room.interactables[interactableKey];
    const objectId = room.id + "_" + interactableKey;

    if (currentState.lootedChests.includes(objectId)) {
        store.getState().addLog("It's empty.");
        return;
    }

    if (obj.locked && obj.reqKey) {
        if (!currentState.inventory.includes(obj.reqKey)) {
             const keyItem = findItem(obj.reqKey);
             store.getState().addLog(`It's locked. You need a ${keyItem?.name || 'Key'}.`);
             return;
        }
        store.getState().addLog("You unlock it.");
    } else if (obj.locked) {
        if (!obj.onOpen) {
            store.getState().addLog("It's locked tight.");
            return;
        }
    }

    if (obj.onOpen === 'ambush' && obj.ambushEnemyId) {
        store.getState().addLog(`You open the ${interactableKey}...`);
        const g = enemiesData.find(e => e.id === obj.ambushEnemyId);
        if (g) {
            const enemies = ['A', 'B', 'C'].map((l, i) => ({ 
                ...g, id: `e${Date.now()}_${i}`, name: `${g.name} ${l}`, hp: g.hp, maxHp: g.maxHp, status: [], loot: [...(g.loot||[])] 
            } as Enemy));
            
            store.getState().addLog(`AMBUSH! ${enemies.length} ${g.name}s attack!`);
            store.getState().startCombat(enemies);
            store.getState().setChestLooted(objectId); 
        }
        return;
    }

    if (obj.loot) {
        const item = findItem(obj.loot);
        store.getState().addLog(`You find a ${item?.name || obj.loot}!`);
        store.getState().addToInventory(obj.loot);
        store.getState().setChestLooted(objectId);
        return;
    }
  }
  
  store.getState().addLog("It won't open.");
};

const cmdHelp = () => {
  store.getState().addLog("COMMANDS: look, i, stats, equip [item], attack [target], cast [spell] [target]");
};

export const processCommand = (input: string) => {
  const currentState = store.getState();
  const clean = input.trim();
  if (!clean) return;
  
  if (currentState.isGameOver) return; 

  const parts = clean.split(" ");
  const command = parts[0].toLowerCase();
  const args = parts.slice(1).join(" ");

  store.getState().addLog(`> ${input}`);
  if (handleDialogue(clean, currentState)) return;
  if (currentState.isInputLocked) return;

  if (currentState.party.length < 3) {
    if (!currentState.tempCharacterName) {
      if (clean.length < 2) { store.getState().addLog("Name too short."); return; }
      store.getState().setTempName(clean);
      store.getState().addLog(`Welcome, ${clean}. Choose Class: [rogue], [fighter], [wizard], [cleric]`);
    } else {
      const cls = classesData.find(c => c.id === command || c.name.toLowerCase() === command);
      if (cls) {
        // @ts-ignore
        const startingSkills = cls.startingSkills || [];

        const initEquip = { weapon: null as string|null, armor: null as string|null, accessories: [] as string[] };
        cls.startingEquipment.forEach(id => {
            const item = findItem(id);
            if(item?.type === 'weapon') initEquip.weapon = id;
            else if(item?.type === 'armor') initEquip.armor = id;
            else if(item?.type === 'accessory') initEquip.accessories.push(id);
        });

        const newHero: Character = {
          id: `h${Date.now()}`,
          name: currentState.tempCharacterName,
          classId: cls.id,
          level: 1, xp: 0, maxXp: 100,
          hp: 20 + cls.stats.con, maxHp: 20 + cls.stats.con,
          mp: cls.stats.skillSlots, maxMp: cls.stats.skillSlots,
          stats: cls.stats,
          equipment: initEquip, 
          isPlayerControlled: true,
          status: [],
          unlockedSkills: startingSkills,
          atbTimer: 0
        };

        store.getState().addCharacter(newHero, cls.startingCredits);
        cls.startingItems.forEach(id => store.getState().addToInventory(id));
        
        store.getState().addLog(`Registered ${newHero.name}.`);
        if (store.getState().party.length < 3) store.getState().addLog(`Enter Name for Hero ${store.getState().party.length + 1}:`);
        else {
          store.getState().addLog("INITIALIZATION COMPLETE.");
          setTimeout(() => { const r = getRoom(store.getState().currentRoomId); if(r) store.getState().addLog(r.description); }, 1000);
        }
      } else store.getState().addLog("Invalid Class.");
    }
    return;
  }

  switch (command) {
    case 'n': case 's': case 'e': case 'w': case 'north': case 'south': case 'east': case 'west':
      cmdMove(command, currentState); break;
    case 'l': case 'look':
      cmdLook(args, currentState); break;
    case 'x': case 'examine': case 'check': case 'read': case 'search':
      cmdExamine(args, currentState); break;
    case 'i': case 'inv': case 'inventory':
      cmdInventory(); break;
    case 'stats': case 'score': case 'status':
      cmdStats(args, currentState); break;
    case 'skills': case 'spells': case 'abilities':
      cmdSkills(args, currentState); break;
    case 'equip': case 'wear':
      cmdEquip(args, currentState); break;
    case 'unequip': case 'remove':
      cmdUnequip(args, currentState); break;
    case 'open':
      cmdOpen(args, currentState); break;
    case 'h': case 'help':
      cmdHelp(); break;
    case 'save':
      store.getState().saveGame();
      break;
    case 'load':
      const loaded = store.getState().loadGame();
      if (!loaded) store.getState().addLog("No save file found.");
      break;
    case 'a': case 'attack': case 'kill': case 'hit':
      cmdCombatAction(command, args, currentState); 
      break;
    case 'c': case 'cast': case 'use':
      cmdCombatAction(command, args, currentState); 
      break;
    default:
      store.getState().addLog("I don't know how to do that.");
  }
};