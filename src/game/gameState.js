// Game State Machine for 16-Tile Taiwanese Mahjong
// Handles deck generation and initialization

// Standard suits: 1-9
const SUITS = ['Man', 'Pin', 'Sou'];
// Honors: Winds and Dragons
const WINDS = ['Ton', 'Nan', 'Shaa', 'Pei']; // East, South, West, North
const DRAGONS = ['Haku', 'Hatsu', 'Chun']; // White, Green, Red
const FLOWERS = ['Flower1', 'Flower2', 'Flower3', 'Flower4', 'Season1', 'Season2', 'Season3', 'Season4'];

// Base numerical weights for sorting Mahjong tiles standardly
const SORT_ORDER = {
  Man: 100,
  Pin: 200,
  Sou: 300,
  Ton: 410,
  Nan: 420,
  Shaa: 430,
  Pei: 440,
  Haku: 510,
  Hatsu: 520,
  Chun: 530,
  Flower: 600,
  Season: 700,
  Blank: 800
};

export function getTileSortValue(tile) {
  for (const [key, baseValue] of Object.entries(SORT_ORDER)) {
    if (tile.startsWith(key)) {
      const match = tile.match(/\d+/);
      if (match) {
        return baseValue + parseInt(match[0], 10);
      }
      return baseValue;
    }
  }
  return 999;
}

export function sortHand(hand) {
  return [...hand].sort((a, b) => getTileSortValue(a) - getTileSortValue(b));
}

export function generateDeck(includeFlowers = true) {
  let deck = [];

  // Add standard suits (4 of each)
  SUITS.forEach(suit => {
    for (let i = 1; i <= 9; i++) {
        for (let j = 0; j < 4; j++) {
            deck.push(`${suit}${i}`);
        }
    }
  });

  // Add winds (4 of each)
  WINDS.forEach(wind => {
      for (let j = 0; j < 4; j++) {
          deck.push(wind);
      }
  });

  // Add dragons (4 of each)
  DRAGONS.forEach(dragon => {
    for (let j = 0; j < 4; j++) {
        deck.push(dragon);
    }
  });

  // Add flowers (1 of each) if necessary
  if (includeFlowers) {
    FLOWERS.forEach(flower => {
        deck.push(flower);
    });
  }

  return deck;
}

export function shuffle(deck) {
  let currentIndex = deck.length, randomIndex;
  while (currentIndex !== 0) {
    randomIndex = Math.floor(Math.random() * currentIndex);
    currentIndex--;
    [deck[currentIndex], deck[randomIndex]] = [deck[randomIndex], deck[currentIndex]];
  }
  return deck;
}

export function dealInitialHands(deck) {
  let shuffled = shuffle([...deck]);
  
  // 16-tile Taiwanese style: Dealer gets 17, others get 16
  const hands = {
    dealer: [], // Player 0 (Usually East/Dealer)
    player1: [], // South
    player2: [], // West
    player3: []  // North
  };
  
  const flowers = {
    dealer: [],
    player1: [],
    player2: [],
    player3: []
  };

  // Deal 16 to everyone
  for (let i = 0; i < 16; i++) {
    hands.dealer.push(shuffled.pop());
    hands.player1.push(shuffled.pop());
    hands.player2.push(shuffled.pop());
    hands.player3.push(shuffled.pop());
  }

  // Dealer gets 17th tile
  hands.dealer.push(shuffled.pop());

  // Extract flowers and recursively draw replacements 
  const players = ['dealer', 'player1', 'player2', 'player3'];
  for (let player of players) {
     let hasFlower = true;
     while (hasFlower && shuffled.length > 0) {
        hasFlower = false;
        // Loop backwards so splicing doesn't skip indices
        for (let i = hands[player].length - 1; i >= 0; i--) {
           const tile = hands[player][i];
           if (tile.startsWith('Flower') || tile.startsWith('Season')) {
               flowers[player].push(tile);
               hands[player].splice(i, 1);
               // Pull replacement from back of wall (end of shuffled array)
               const replacement = shuffled.pop();
               if (replacement) {
                   hands[player].push(replacement);
                   hasFlower = true; // Force another check in case new draw is a flower
               }
           }
        }
     }
  }

  // Sort the final resolved standard hands via Mahjong heuristics
  for (let player of players) {
      hands[player] = sortHand(hands[player]);
  }

  return { hands, flowers, remainingDeck: shuffled };
}
