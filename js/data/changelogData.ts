export interface ChangelogItem {
  icon: string;
  title: string;
  body: string;
}

export interface ChangelogGroup {
  title: string;
  items: ChangelogItem[];
}

export interface ChangelogColumn {
  title: string;
  groups: ChangelogGroup[];
}

export interface ChangelogEntry {
  version: string;
  date: string;
  latest: boolean;
  columns: ChangelogColumn[];
}

/** Clean Spindrift Chess changelog (no Tomitank / engine-match noise). */
export const CHANGELOG_ENTRIES: ChangelogEntry[] = [
  {
    version: "v3.3.0",
    date: "July 29, 2026",
    latest: true,
    columns: [
      {
        title: "Gameplay",
        groups: [
          {
            title: "Human play",
            items: [
              {
                icon: "ph-arrow-counter-clockwise",
                title: "Undo last move",
                body: "Take back your last move together with the computer's reply and try a different line — even after the game has ended. Disabled while the computer is thinking; remembered with your saved game.",
              },
            ],
          },
        ],
      },
    ],
  },
  {
    version: "v3.2.0",
    date: "July 22, 2026",
    latest: false,
    columns: [
      {
        title: "Engine",
        groups: [
          {
            title: "Spindrift — stronger again",
            items: [
              {
                icon: "ph-sort-ascending",
                title: "Smarter move ordering",
                body: "The search tries the most promising moves first: exchanges are classified by static exchange evaluation, and quiet refutations are remembered per opponent move (countermove heuristic), so deeper lines are reached in the same time.",
              },
              {
                icon: "ph-scissors",
                title: "Tighter pruning",
                body: "Mate-distance pruning trims branches that cannot improve the checkmate score, and the clock is sampled far less often, freeing real time for searching.",
              },
              {
                icon: "ph-database",
                title: "Evaluation cache",
                body: "Repeated positions are evaluated once and remembered, and quiescence search uses the transposition table — more of the budget goes to positions that matter. Levels 1–3 play exactly as before.",
              },
            ],
          },
        ],
      },
    ],
  },
  {
    version: "v3.1.0",
    date: "July 21, 2026",
    latest: false,
    columns: [
      {
        title: "Engine",
        groups: [
          {
            title: "Spindrift — much stronger play",
            items: [
              {
                icon: "ph-bug",
                title: "Fixed evaluation & search bugs",
                body: "Corrected inverted piece-square tables (the engine now advances pawns and keeps its king safe), fixed passed-pawn scoring, and repaired several search bugs (mate-distance handling, aspiration windows, quiescence, and time-out handling). Levels 4–6 are dramatically stronger.",
              },
              {
                icon: "ph-shield-check",
                title: "Draw awareness",
                body: "The search now understands threefold repetition and the fifty-move rule, so it no longer shuffles a won position into a draw — while still preferring the fastest checkmate.",
              },
              {
                icon: "ph-clock",
                title: "Time-managed thinking",
                body: "Levels 4–6 now deepen to fill a per-move time budget instead of stopping at a fixed depth. Levels 1–3 stay light and fast.",
              },
              {
                icon: "ph-lightning",
                title: "Roughly 2× faster search",
                body: "Allocation-free move legality, a capture-only quiescence generator, principal-variation search, and static exchange evaluation roughly doubled search speed.",
              },
            ],
          },
        ],
      },
    ],
  },
  {
    version: "v3.0.0",
    date: "July 12, 2026",
    latest: false,
    columns: [
      {
        title: "UI",
        groups: [
          {
            title: "Vanduo UI (vd3) — Vue 3 rebuild",
            items: [
              {
                icon: "ph-rocket-launch",
                title: "Rebuilt on Vue 3 + Vite",
                body: "The interface was re-platformed from the Vanduo Vanilla engine to Vanduo UI (vd3), a Vue 3 design system, built with Vite. The chess engine, rules, and board rendering are unchanged; the header, control panel, dialogs, and theming are now real vd3 components.",
              },
              {
                icon: "ph-paint-roller",
                title: "Refreshed look + theme customizer",
                body: "A polished pass over the side panel, status, and dialogs, plus the full vd3 theme customizer alongside the light/dark/system switcher — with your preferences persisted across visits.",
              },
              {
                icon: "ph-package",
                title: "Static build",
                body: "The app builds to static assets with Vite for GitHub Pages. The Spindrift search Web Worker is bundled as a discrete chunk.",
              },
            ],
          },
        ],
      },
    ],
  },
  {
    version: "v2.2.0",
    date: "July 4, 2026",
    latest: false,
    columns: [
      {
        title: "UI",
        groups: [
          {
            title: "Vanduo Refresh",
            items: [
              {
                icon: "ph-paint-roller",
                title: "Vanduo v1.7.0",
                body: "Refreshed the Vanduo Vanilla engine from v1.3.8 to v1.7.0 via the npm distribution. Brings upstream fixes and security hardening with no change to the look and feel.",
              },
              {
                icon: "ph-swatches",
                title: "Token namespace shim",
                body: "Vanduo 1.4.1 moved every design token under the strict --vd-* namespace. Added a small styles layer that maps the app's theme onto the new tokens.",
              },
              {
                icon: "ph-shield-check",
                title: "Subresource Integrity",
                body: "Pinned CDN CSS and JavaScript with SHA-384 integrity hashes and crossorigin.",
              },
            ],
          },
        ],
      },
    ],
  },
  {
    version: "v2.1.3",
    date: "May 9, 2026",
    latest: false,
    columns: [
      {
        title: "Engine",
        groups: [
          {
            title: "Spindrift",
            items: [
              {
                icon: "ph-brain",
                title: "Stronger search",
                body: "Hardened Spindrift's search with deterministic hashing, safer transposition-table probes, corrected quiescence scoring, and stronger tactical evaluation.",
              },
              {
                icon: "ph-shield-check",
                title: "Clean-room tuning",
                body: "Added original evaluation terms for loose pieces, king pressure, rook activity, and passed-pawn races without borrowing from external engines.",
              },
              {
                icon: "ph-flag-checkered",
                title: "Baseline gate",
                body: "Added a repeatable baseline check for fixed tactics, timeout behavior, and short self-play.",
              },
            ],
          },
        ],
      },
    ],
  },
  {
    version: "v2.1.2",
    date: "April 11, 2026",
    latest: false,
    columns: [
      {
        title: "Bug Fixes",
        groups: [
          {
            title: "Mobile",
            items: [
              {
                icon: "ph-device-mobile",
                title: "Modal overlay fix",
                body: "Fixed modals being trapped inside the mobile scroll container, causing an unresponsive dark overlay on real device browsers (Safari & Chrome).",
              },
            ],
          },
        ],
      },
    ],
  },
  {
    version: "v2.1.1",
    date: "April 11, 2026",
    latest: false,
    columns: [
      {
        title: "Gameplay",
        groups: [
          {
            title: "Improvements",
            items: [
              {
                icon: "ph-swap",
                title: "Pawn promotion selector",
                body: "Pawn promotions now respect your selected piece choice (queen, rook, bishop, or knight) instead of always auto-queening.",
              },
              {
                icon: "ph-cpu",
                title: "Simplified AI timing",
                body: "Removed the maximum thinking-time control and switched to a unified internal AI timing policy.",
              },
            ],
          },
        ],
      },
      {
        title: "UI & Product",
        groups: [
          {
            title: "Updates",
            items: [
              {
                icon: "ph-list",
                title: "Mobile side menu",
                body: "Narrow-screen header now uses a hamburger side menu that contains non-theme header actions.",
              },
              {
                icon: "ph-article",
                title: "In-app changelog modal",
                body: "Click the version badge to open a structured changelog modal directly in the app.",
              },
            ],
          },
        ],
      },
    ],
  },
  {
    version: "v2.1.0",
    date: "April 10, 2026",
    latest: false,
    columns: [
      {
        title: "Application",
        groups: [
          {
            title: "Release",
            items: [
              {
                icon: "ph-chess-piece",
                title: "Spindrift Chess public build",
                body: "Released browser-based chess gameplay with the built-in Spindrift engine.",
              },
            ],
          },
        ],
      },
    ],
  },
];
