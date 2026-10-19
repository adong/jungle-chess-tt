/* The keys the ? panel shows. Press ? (Shift + /) in the game, or tap the round ? button.
   The panel and the freeze live in the shared kit: kit/help.js (Kit.help). */
Kit.help.setup({
  title: window.JC_TITLE, // the name lives in js/title.js
  keys: [
    ['pick up your animal by its number (1 rat … 8 elephant)', '1 – 8'],
    ['move round the board · pick up or put down', '← ↑ → ↓ · Enter or Space'],
    ['put the animal back', 'Esc'],
    ['undo your last move', 'U or Backspace'],
    ['call your brother (2 players: high five)', 'T'],
    ['who beats who? (the rules)', 'R'],
    ['new game', 'N'],
    ['pause · sound', 'P or Esc · M'],
    ['menu: play · Teddy or Tommy · 1 or 2 players', 'Enter · ← → · ↑ ↓'],
    ['menu: level · undo on or off', 'L · U'],
  ],
  note: 'Bigger number bonks smaller, and the same number bonks too. 🐭 beats 🐘! Walk into their den to win.',
  touch: 'Tap an animal, then tap a glowing square. Tap your brother\'s face (bottom right) to call him.',
});
