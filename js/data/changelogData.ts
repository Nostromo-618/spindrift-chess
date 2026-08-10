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

/** Spindrift Chess release notes. */
export const CHANGELOG_ENTRIES: ChangelogEntry[] = [
  {
    version: "v1.0.0",
    date: "August 10, 2026",
    latest: true,
    columns: [
      {
        title: "Spindrift Chess",
        groups: [
          {
            title: "1.0.0",
            items: [
              {
                icon: "ph-horse",
                title: "Human vs Spindrift Engine",
                body: "Play chess in the browser against the Spindrift Engine. Six difficulty levels: 1–3 stay light on the CPU; 4–6 think within a per-move time budget.",
              },
              {
                icon: "ph-arrow-counter-clockwise",
                title: "Undo and saved games",
                body: "Undo takes back your move and the engine’s reply. Games and preferences are stored locally under sdc-* keys.",
              },
              {
                icon: "ph-paint-roller",
                title: "Themes and pieces",
                body: "Light, dark, and system themes via vd3, plus the theme customizer. Original Spindrift piece SVGs on the board.",
              },
            ],
          },
        ],
      },
    ],
  },
];
