// Frame schedule for the Telegram tutorial composition.
// Extracted into its own module so act components can import it without
// creating a circular dependency against TelegramComposition.tsx.
//
// 30 fps · 900 frames = 30 seconds.
export const TEL_ACTS = {
  hook:       { start: 0,   end: 90  }, // 3.0s — "Just text a bot."
  findBot:    { start: 90,  end: 240 }, // 5.0s — search @BuperacTrialBot, tap Start
  bind:       { start: 240, end: 420 }, // 6.0s — paste the binding code
  apply:      { start: 420, end: 600 }, // 6.0s — /apply walk-through
  photoYield: { start: 600, end: 780 }, // 6.0s — photo + /yield
  cta:        { start: 780, end: 900 }, // 4.0s — Telegram in the truck.
};

export const TEL_DURATION = 900;
export const TEL_FPS = 30;
