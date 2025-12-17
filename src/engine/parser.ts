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

// ... (Helpers: getRoom, findItem, findSkill, resolveEnemyIndex, resolvePartyIndex, handleDialogue - SAME AS BEFORE)
const getRoom = (id: string): Room | undefined => roomsData.find(r => r.id === id);
const findItem = (q: string): Item | undefined => itemsData.find(i => i.id === q || i.name.toLowerCase() === q || i.aliases?.includes(q));
const findSkill = (q: string): Skill | undefined => skillsData.find(s => s.id === q || s.name.toLowerCase() === q || s.aliases?.includes(q));

const resolveEnemyIndex = (q: string, enemies: Enemy[]) => {
  if (!q) return enemies.findIndex(e => e.hp > 0);
  const l = q.toLowerCase();
  if (l === 'a' || l === '1') return 0; 
  if (l === 'b' || l === '2') return 1; 
  if (l === 'c' || l === '3') return 2;
  return enemies.findIndex(e => e.name.toLowerCase().includes(l));
};

const resolvePartyIndex = (q: string, party: Character[]) => {
  if (!q) return -1;
  const l = q.toLowerCase();
  if (l === '1') return 0; if (l === '2') return 1; if (l === '3') return 2;
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

// ... (cmdLook, cmdExamine, etc. - SAME)
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
      
      if (obj.onOpen === 'battle' && obj.ambushEnemyId) {
          store.getState().addLog(obj.message);
          const g = enemiesData.find(e => e.id === obj.ambushEnemyId);
          if (g) {
              const enemies = [{ ...g, id: `e${Date.now()}`, name: g.name, hp: g.hp, maxHp: g.maxHp, status: [], moves: g.moves } as Enemy];
              store.getState().startCombat(enemies);
          }
          return;
      }
      
      if (obj.onOpen === 'heal') {
          store.getState().addLog(obj.message);
          store.getState().addLog("You rest and recover your strength.");
          store.getState().fullRestore();
          return;
      }

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

  if (currentState.currentRoomId === 'room_01_cell' && d === 'north') {
      const doorId = 'room_01_cell_door';
      if (!currentState.lootedChests.includes(doorId)) {
          store.getState().addLog("You try to leave, but the door kicks open!");
          const g = enemiesData.find(e => e.id === 'warden_01'); 
          if (g) {
              const enemies = [{ 
                  ...g, 
                  id: `e${Date.now()}`, 
                  name: g.name, 
                  hp: g.hp, 
                  maxHp: g.maxHp, 
                  status: [], 
                  moves: g.moves || [],
                  loot: [...(g.loot||[])],
                  state: 'idle',
                  atbTimer: 3,
                  phases: []
              } as Enemy];
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

const cmdEquipment = (args: string, currentState: GameState) => {
  const targetIdx = resolvePartyIndex(args, currentState.party);
  const targets = targetIdx !== -1 ? [currentState.party[targetIdx]] : currentState.party;

  targets.forEach(c => {
      const w = c.equipment.weapon ? (findItem(c.equipment.weapon)?.name || c.equipment.weapon) : "None";
      const a = c.equipment.armor ? (findItem(c.equipment.armor)?.name || c.equipment.armor) : "None";
      const acc = c.equipment.accessories.length > 0
          ? c.equipment.accessories.map(id => findItem(id)?.name || id).join(", ")
          : "None";

      store.getState().addLog(`[${c.name}]`);
      store.getState().addLog(`  Weapon: ${w}`);
      store.getState().addLog(`  Armor:  ${a}`);
      store.getState().addLog(`  Acc:    ${acc}`);
  });
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
  
  const potentialSkill = findSkill(potentialName);
  const potentialItem = findItem(potentialName);
  const isAmbiguousAlias = !!potentialSkill || !!potentialItem;

  let intendedActorChange = false;
  if (namedIndex !== -1 && currentState.party[namedIndex].id !== currentActorId) {
      if (isAmbiguousAlias) {
          intendedActorChange = false; 
      } else {
          intendedActorChange = true;
      }
  }

  if (intendedActorChange) {
      store.getState().addLog(`It's not ${currentState.party[namedIndex].name}'s turn! It's ${actor.name}'s turn.`);
      return;
  }

  let cleanArgs = args;
  if (namedIndex !== -1 && !isAmbiguousAlias) {
      cleanArgs = args.substring(potentialName.length).trim();
  }

  // Attack
  if (['attack', 'a', 'kill', 'hit'].includes(command)) {
    const tIdx = resolveEnemyIndex(cleanArgs, currentState.activeEnemies);
    store.getState().performAction(actorIndex, 'attack', tIdx, 'enemy');
  } 
  // Cast / Use Skill
  else if (['cast', 'c', 'use'].includes(command)) {
    let spellStr = cleanArgs;
    let targetStr = "";

    if (cleanArgs.includes(" on ")) {
      const parts = cleanArgs.split(" on ");
      spellStr = parts[0];
      targetStr = parts[1];
    } 
    else if (cleanArgs.includes(" from ")) {
      const parts = cleanArgs.split(" from ");
      spellStr = parts[0];
      targetStr = parts[1];
    }
    else {
      const parts = cleanArgs.split(" ");
      if (parts.length > 1) {
          const last = parts[parts.length - 1].toLowerCase();
          if (/^[a-c1-3]$/.test(last) || last.startsWith('hero') || last.startsWith('guard')) {
              targetStr = parts.pop()!;
              spellStr = parts.join(" ");
          } else {
              if (resolveEnemyIndex(last, currentState.activeEnemies) !== -1 || resolvePartyIndex(last, currentState.party) !== -1) {
                  targetStr = parts.pop()!;
                  spellStr = parts.join(" ");
              }
          }
      }
    }

    let actionId = "";
    const skill = findSkill(spellStr);
    if (skill) {
        actionId = skill.id;
    } else {
        const item = findItem(spellStr);
        if (item) actionId = item.id;
    }

    if (!actionId) { store.getState().addLog("Unknown skill or item."); return; }

    let isFriendly = false;
    if (skill) {
        isFriendly = ['heal', 'buff', 'revive', 'restore_mp'].includes(skill.type);
    } else if (actionId) {
        const it = findItem(actionId);
        if (it && it.effect) {
            isFriendly = it.effect.startsWith('heal_') || 
                         it.effect.startsWith('restore_') || 
                         it.effect === 'revive' || 
                         it.effect.startsWith('buff_');
        }
    }
    
    if (isFriendly) {
        let tIdx = resolvePartyIndex(targetStr, currentState.party);
        if (tIdx === -1 && !targetStr) tIdx = actorIndex;
        
        if (tIdx !== -1) {
            store.getState().performAction(actorIndex, actionId, tIdx, 'party');
            return;
        }
    }

    const enemyTargetIdx = resolveEnemyIndex(targetStr || "", currentState.activeEnemies);
    store.getState().performAction(actorIndex, actionId, enemyTargetIdx, 'enemy');
  }
};

const cmdUse = (args: string, currentState: GameState) => {
    if (currentState.isCombat) {
        cmdCombatAction('use', args, currentState);
        return;
    }

    const parts = args.split(" on ");
    const itemName = parts[0];
    const targetName = parts[1];

    const item = findItem(itemName);
    if (!item) { store.getState().addLog("Unknown item."); return; }

    let tIdx = 0;
    if (targetName) {
        tIdx = resolvePartyIndex(targetName, currentState.party);
        if (tIdx === -1) { store.getState().addLog("Target not found."); return; }
    }

    store.getState().useItem(item.id, tIdx);
};

// ... (cmdOpen, cmdHelp - SAME)
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
                ...g, id: `e${Date.now()}_${i}`, name: `${g.name} ${l}`, hp: g.hp, maxHp: g.maxHp, status: [], moves: g.moves || [], loot: [...(g.loot||[])] 
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

const cmdHelp = (args: string, currentState: GameState) => {
  const lowerArg = args.toLowerCase();

  // 1. Character Creation Context
  if (currentState.party.length < 3) {
      if (!args) {
          store.getState().addLog("You can choose 3 characters to guide you throughout your quests; they will all remain in your party through the adventure. Characters vary in starting stats, skills, equipment, and starting items. Each of your 3 characters will be assigned a number id that can be used with items and abilities, where commands such as \"cast heal on Fighter\" or \"use skills potion on Cleric\" can be reduced to \"c h 1\". or \"u sp 2\".");
          return;
      }

      // Helper to format class info
      const getClassHelp = (id: string, desc: string) => {
          const cls = classesData.find(c => c.id === id);
          if (!cls) return desc;
          
          const skillNames = cls.startingSkills?.map(sid => findSkill(sid)?.name || sid).join(', ') || "None";
          
          const itemCounts: {[key:string]: number} = {};
          cls.startingItems.forEach(iid => { itemCounts[iid] = (itemCounts[iid] || 0) + 1; });
          const itemStr = Object.entries(itemCounts).map(([iid, count]) => `${findItem(iid)?.name || iid} x${count}`).join(', ');

          return `${desc} ${cls.name}s start with: ${skillNames} and ${itemStr}.`;
      };

      if (lowerArg === 'fighter' || lowerArg === 'f') {
          store.getState().addLog(getClassHelp('fighter', "Fighters use heavy physical attacks to deal massive enemy damage in a single turn, and can buff himself."));
          return;
      }
      if (lowerArg === 'rogue' || lowerArg === 'r') {
          store.getState().addLog(getClassHelp('rogue', "Rogues can unlock doors and steal from enemies."));
          return;
      }
      if (lowerArg === 'wizard' || lowerArg === 'w') {
          store.getState().addLog(getClassHelp('wizard', "Wizards can ignite enemies, freeze them, or stun them with lightning. What else can they learn?"));
          return;
      }
      if (lowerArg === 'cleric' || lowerArg === 'c') {
          store.getState().addLog(getClassHelp('cleric', "Clerics have high HP and the strongest healing spells - no adventurer should journey without one!"));
          return;
      }
      return;
  }

  // 2. Exploration / Combat Context
  store.getState().addLog("--- COMMANDS ---");
  store.getState().addLog("look (l), examine (x) [thing]");
  store.getState().addLog("move (n, s, e, w)");
  store.getState().addLog("open [thing], use (u) [item]");
  store.getState().addLog("inventory (i), equipment (eq)");
  store.getState().addLog("stats, skills");
  store.getState().addLog("equip [item], unequip [slot]");
  store.getState().addLog("attack (a), cast (c)");
  store.getState().addLog("save, load, reset");
};

export const processCommand = (input: string) => {
  const currentState = store.getState();
  const clean = input.trim();
  if (!clean) return;
  
  if (currentState.isGameOver) return; 

  const parts = clean.split(" ");
  const command = parts[0].toLowerCase();
  const args = parts.slice(1).join(" ");

  // --- SYSTEM COMMANDS (Always available) ---
  if (command === 'save') {
      store.getState().saveGame();
      store.getState().addLog(`> ${input}`);
      return;
  }
  if (command === 'load') {
      const loaded = store.getState().loadGame();
      if (!loaded) store.getState().addLog("No save file found.");
      else store.getState().addLog("Game Loaded.");
      return;
  }
  if (command === 'reset') {
      store.getState().resetGame();
      store.getState().addLog("Game Reset.");
      return;
  }
  // ------------------------------------------

  // Check pending choice before input lock
  if (currentState.pendingChoice) {
      if (currentState.pendingChoice.type === 'equip_replace') {
          const choice = parseInt(clean);
          if ([1, 2, 3].includes(choice)) {
              const { charIdx, itemId } = currentState.pendingChoice.data;
              store.getState().equipItem(charIdx, itemId, choice - 1); 
          } else {
              store.getState().addLog("Invalid choice. Cancelled.");
              store.getState().setPendingChoice(null);
          }
          return;
      }
  }

  // Log user input
  store.getState().addLog(`> ${input}`);

  // Checks that block gameplay commands
  if (handleDialogue(clean, currentState)) return;
  if (currentState.isInputLocked) return;

  if (currentState.party.length < 3) {
    if (!currentState.tempCharacterName) {
      if (clean.length < 2) { store.getState().addLog("Name too short."); return; }
      
      if (command === 'help' || command === 'h') {
          cmdHelp(args, currentState);
          return;
      }

      if (currentState.party.some(c => c.name.toLowerCase() === clean.toLowerCase())) {
          store.getState().addLog("Name already taken."); 
          return;
      }

      store.getState().setTempName(clean);
      store.getState().addLog(`Welcome, ${clean}. Choose Class: [rogue (r)], [fighter (f)], [wizard (w)], [cleric (c)]`);
    } else {
      if (command === 'help' || command === 'h') {
          cmdHelp(args, currentState);
          return;
      }

      const aliasMap: {[key: string]: string} = { 'f': 'fighter', 'r': 'rogue', 'w': 'wizard', 'c': 'cleric' };
      const resolvedClass = aliasMap[command] || command;
      
      const cls = classesData.find(c => c.id === resolvedClass || c.name.toLowerCase() === resolvedClass);

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
    case 'eq': case 'gear': case 'equipment':
      cmdEquipment(args, currentState); break;
    case 'skills': case 'spells': case 'abilities':
      cmdSkills(args, currentState); break;
    case 'equip': case 'wear':
      cmdEquip(args, currentState); break;
    case 'unequip': case 'remove':
      cmdUnequip(args, currentState); break;
    case 'open':
      cmdOpen(args, currentState); break;
    case 'h': case 'help':
      cmdHelp(args, currentState); break;
    case 'a': case 'attack': case 'kill': case 'hit':
      cmdCombatAction(command, args, currentState); 
      break;
    case 'c': case 'cast': 
      cmdCombatAction(command, args, currentState); 
      break;
    case 'u': case 'use': 
      cmdUse(args, currentState);
      break;
    default:
      store.getState().addLog("I don't know how to do that.");
  }
};