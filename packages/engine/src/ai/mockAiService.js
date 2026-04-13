// Mock AI Service returning a simulated Claude/Gemini analysis
import { evaluateDiscard } from './heuristic.js';

export async function askMockCoach(currentHand, isOpponentTingPai) {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 1200));

    // Get the logical analysis from our offline engine
    const analysis = evaluateDiscard(currentHand, isOpponentTingPai);

    return `*Analyzing your 16-Tile Hand*\n\nBased on your "Inside-Out Strategy" heuristic, I recommend: **${analysis.reason}**\n\nIf you prefer to maintain maximum probability to form sequences, try avoiding discarding the 3s, 4s, 5s, 6s, and 7s as they hold the high-value 1.4 weighting!`;
}
