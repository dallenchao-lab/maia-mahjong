// Game State Machine for 16-Tile Taiwanese Mahjong
// Handles deck generation and initialization

// Standard suits: 1-9
const SUITS = ['Man', 'Pin', 'Sou'];
// Honors: Winds and Dragons
const WINDS = ['Ton', 'Nan', 'Shaa', 'Pei']; // East, South, West, North
const DRAGONS = ['Haku', 'Hatsu', 'Chun']; // White, Green, Red
const FLOWERS = ['Flower1', 'Flower2', 'Flower3', 'Flower4', 'Season1', 'Season2', 'Season3', 'Season4'];

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

  // Deal 16 to everyone
  for (let i = 0; i < 16; i++) {
    hands.dealer.push(shuffled.pop());
    hands.player1.push(shuffled.pop());
    hands.player2.push(shuffled.pop());
    hands.player3.push(shuffled.pop());
  }

  // Dealer gets 17th tile
  hands.dealer.push(shuffled.pop());

  // In a real implementation, we would extract flowers and draw replacements here
  return { hands, remainingDeck: shuffled };
}
