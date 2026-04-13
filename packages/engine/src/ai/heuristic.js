// "The Dallen" Heuristic Engine
// Inside-Out Strategy Evaluator

/**
 * Calculates the weight of a single tile based on the heuristic rules:
 * - Terminals (1, 9) & Honors: Weight 0.8
 * - Simples (2, 8): Weight 1.0
 * - Center Tiles (3, 4, 5, 6, 7): Weight 1.4
 */
export function getTileWeight(tileName) {
  // Check Honors/Flowers
  const honors = ['Ton', 'Nan', 'Shaa', 'Pei', 'Haku', 'Hatsu', 'Chun'];
  if (honors.includes(tileName) || tileName.includes('Flower') || tileName.includes('Season')) {
      return 0.8;
  }

  // If it's a number tile, parse the number
  // Format is "Man1", "Pin5", "Sou9"
  const numberStr = tileName.replace(/[^0-9]/g, '');
  if (!numberStr) return 0.8; // Fallback

  const num = parseInt(numberStr, 10);
  
  if (num === 1 || num === 9) {
      return 0.8; // Terminals
  } else if (num === 2 || num === 8) {
      return 1.0; // Simples
  } else if (num >= 3 && num <= 7) {
      return 1.4; // Center
  }

  return 1.0; 
}

/**
 * Evaluates hand to see what the lowest value tile to discard is,
 * applying "The Sacrifice" rule if necessary.
 * 
 * @param {Array} hand - Array of tile strings
 * @param {boolean} isOpponentTingPai - Is an opponent close to winning?
 * @param {Array} safeTiles - Array of already discarded tiles known to be safe
 */
export function evaluateDiscard(hand, isOpponentTingPai = false, safeTiles = []) {
   if (isOpponentTingPai) {
      // THE SACRIFICE MODE
      // We must only discard a safe tile even if it breaks our hand.
      let safeOptions = hand.filter(tile => safeTiles.includes(tile));
      if (safeOptions.length > 0) {
          return { recommendedDiscard: safeOptions[0], reason: "(The Sacrifice) Discarding 100% safe tile because an opponent is Tīng Pái." };
      } else {
          return { recommendedDiscard: hand[0], reason: "(The Sacrifice) No completely safe tiles found! Discarding the first tile as a defensive measure." };
      }
   }

   // Standard Inside-Out Strategy
   // Map tiles to their weights
   let weightedHand = hand.map(tile => ({
       tile,
       weight: getTileWeight(tile)
       // NOTE: A more advanced heuristic would look at sequential/pair connectivity here.
       // This baseline uses raw weight mapping.
   }));

   // Sort by lowest weight first
   weightedHand.sort((a, b) => a.weight - b.weight);
   
   return {
       recommendedDiscard: weightedHand[0].tile,
       reason: `Discarding ${weightedHand[0].tile} based on lowest heuristic weight (${weightedHand[0].weight}). Center tiles prioritized over terminals.`
   };
}
