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

export type ChangelogLocale = "en" | "lt";

/** Spindrift Chess release notes (English). */
export const EN_CHANGELOG_ENTRIES: ChangelogEntry[] = [
  {
    version: "v1.1.0",
    date: "August 11, 2026",
    latest: true,
    columns: [
      {
        title: "Engine Optimizations",
        groups: [
          {
            title: "1.1.0",
            items: [
              {
                icon: "ph-lightning",
                title: "Engine Speed & Efficiency",
                body: "Pre-computed LMR lookup table, in-place null-move search, zero-allocation insertion move ordering, power-of-2 bitmask TT indexing, and 8K-entry pawn structure cache yield ~21% faster deep searches.",
              },
              {
                icon: "ph-brain",
                title: "Enhanced Engine Strength",
                body: "Singular Extensions, Reverse Futility Pruning expansion, Late Move Pruning, quiet history malus, history-adjusted LMR, and enhanced evaluation (safe mobility, backward pawns, king tropism).",
              },
            ],
          },
        ],
      },
    ],
  },
  {
    version: "v1.0.0",
    date: "August 10, 2026",
    latest: false,
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

/** Spindrift Chess release notes (Lithuanian). */
export const LT_CHANGELOG_ENTRIES: ChangelogEntry[] = [
  {
    version: "v1.1.0",
    date: "2026 m. rugpjūčio 11 d.",
    latest: true,
    columns: [
      {
        title: "Variklio optimizavimai",
        groups: [
          {
            title: "1.1.0",
            items: [
              {
                icon: "ph-lightning",
                title: "Variklio greitis ir efektyvumas",
                body: "Iš anksto apskaičiuota LMR paieškos lentelė, vietinė nulinio ėjimo paieška, ėjimų rikiavimas be atminties paskyrimų, 2 laipsnio bitmask TT indeksavimas ir 8K įrašų pėstininkų struktūros talpykla pagreitina giliąją paiešką ~21 %.",
              },
              {
                icon: "ph-brain",
                title: "Padidintas variklio stiprumas",
                body: "Singuliariosios plėtros, atvirkštinio beprasmiškumo apkarpymo plėtra, vėlyvojo ėjimo apkarpymas, ramios istorijos įvertis, istorija pakoreguota LMR ir patobulintas vertinimas (saugus mobilumas, atsilikę pėstininkai, karaliaus tropizmas).",
              },
            ],
          },
        ],
      },
    ],
  },
  {
    version: "v1.0.0",
    date: "2026 m. rugpjūčio 10 d.",
    latest: false,
    columns: [
      {
        title: "Spindrift Šachmatai",
        groups: [
          {
            title: "1.0.0",
            items: [
              {
                icon: "ph-horse",
                title: "Žmogus prieš Spindrift variklį",
                body: "Žaiskite šachmatais naršyklėje prieš Spindrift variklį. Šeši sunkumo lygiai: 1–3 mažai apkrauna procesorių; 4–6 mąsto per ėjimo laiko biudžetą.",
              },
              {
                icon: "ph-arrow-counter-clockwise",
                title: "Atšaukimas ir išsaugoti žaidimai",
                body: "Atšaukimas grąžina jūsų ėjimą ir variklio atsakymą. Žaidimai ir nuostatos saugomi vietoje po sdc-* raktais.",
              },
              {
                icon: "ph-paint-roller",
                title: "Temos ir figūros",
                body: "Šviesios, tamsios ir sistemos temos per vd3, taip pat temos tinkintuvas. Originalūs Spindrift figūrų SVG failai lentoje.",
              },
            ],
          },
        ],
      },
    ],
  },
];

/** Locale-keyed changelog datasets. */
export const CHANGELOG_ENTRIES: Record<ChangelogLocale, ChangelogEntry[]> = {
  en: EN_CHANGELOG_ENTRIES,
  lt: LT_CHANGELOG_ENTRIES,
};
