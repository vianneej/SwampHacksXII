import { NPC_PHASES } from './npc-schedule.js';

const DIALOGUE = {
  shelby: {
    about: 'Shelby has tended the flower shop for as long as anyone can remember. She knows every bloom by name and every neighbor by their favorite bouquet.',
    chat: [
      "Hello, dear! Take a deep breath in here. Fresh petals fix almost anything.",
      "Careful near the tulips, they bruise if you look at them too hard.",
      "A cup of coffee and a quiet morning with the flowers. Can't ask for more.",
    ],
    busy: {
      [NPC_PHASES.FLOWER_SHOP]: "I'm minding the shop, watering and arranging. There's always something that needs trimming.",
      [NPC_PHASES.LIBRARY]: "Shop's closed, so I'm browsing the library. I'm hunting for a good gardening book.",
      [NPC_PHASES.OVERNIGHT]: "Just enjoying the night air out on the road. The stars are lovely tonight.",
    },
  },
  frank: {
    about: 'Frank is a retired fellow who likes a good walk, a good book and a better cup of coffee. He keeps an eye on the whole neighborhood.',
    chat: [
      "Ah, hello there! Fine day for a stroll, isn't it?",
      "Back in my day, a coin could buy you a whole pastry. Hold on to yours!",
      "I've walked this shop a hundred times and the flowers still surprise me.",
    ],
    busy: {
      [NPC_PHASES.FLOWER_SHOP]: "Just pacing around the flower shop. Good for the knees, and good for the nose.",
      [NPC_PHASES.LIBRARY]: "Off to read at the library. I'm halfway through a mystery and I refuse to guess the ending.",
      [NPC_PHASES.OVERNIGHT]: "Night walk. The town is so peaceful when everyone's asleep.",
    },
  },
};

const ORDERS = {
  remo: "The usual! A large iced americano, two shots, no sugar. I'm a creature of habit, what can I say.",
  shelby: 'A lavender latte with oat milk, please, dear. Warm, not hot. It goes nicely with the flowers.',
  frank: "Plain black coffee, nothing fancy. If it doesn't wake the whole neighborhood up, it's too weak.",
  carl: "Caramel macchiato, extra caramel. And a cinnamon roll on the side if you're feeling generous.",
  jennifer: "A cappuccino with a dusting of cinnamon. Make it a double, it's been a long day.",
  stephen: "Cold brew, no ice. Don't ask, I just like it that way.",
};

const FALLBACK = {
  about: 'A friendly neighbor.',
  chat: ['Hello there!'],
  busy: {},
};

export function hasCoffeeOrder(npc) {
  return npc.id in ORDERS;
}

export function getNpcDialogue(npc, choice, phase) {
  const data = DIALOGUE[npc.id] || FALLBACK;
  if (choice === 'order') return ORDERS[npc.id];
  if (choice === 'about') return data.about;
  if (choice === 'busy') return data.busy[phase] || 'Just taking it easy today.';
  return data.chat[Math.floor(Math.random() * data.chat.length)];
}
