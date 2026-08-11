/**
 * BoardView.ts
 *
 * Pure UI component responsible for:
 * - Rendering an 8x8 board grid.
 * - Displaying pieces as SVG images (Spindrift piece set).
 * - Highlighting selected square, legal moves, and last move.
 * - Emitting square selection events to the outside world.
 *
 * This module does NOT implement chess rules; it is presentation-only.
 */

export type PieceColor = "white" | "black";
export type PromotionPiece = "Q" | "R" | "B" | "N";
export type PieceCode =
  "wP" | "wN" | "wB" | "wR" | "wQ" | "wK" | "bP" | "bN" | "bB" | "bR" | "bQ" | "bK";

export type BoardStateMap = Record<string, string | null>;

export interface LastMove {
  from: string;
  to: string;
}

export interface BoardViewCallbacks {
  onSquareSelected?: (square: string) => void;
  onPromotionPicked?: (piece: PromotionPiece) => void;
  onPromotionCancelled?: () => void;
}

/** Subset of the full i18n map needed by BoardView. */
export interface BoardViewI18n {
  piece: {
    whitePawn: string;
    whiteKnight: string;
    whiteBishop: string;
    whiteRook: string;
    whiteQueen: string;
    whiteKing: string;
    blackPawn: string;
    blackKnight: string;
    blackBishop: string;
    blackRook: string;
    blackQueen: string;
    blackKing: string;
  };
  board: {
    empty: string;
    promotion: string;
  };
}

export interface RenderOptions {
  perspective: PieceColor;
  selected: string | null;
  legalMoves: string[] | Set<string>;
  lastMove: LastMove | null;
  checkedKingSquare?: string | null;
}

export interface HighlightOptions {
  selected: string | null;
  legalMoves: string[] | Set<string>;
  lastMove: LastMove | null;
  checkedKingSquare?: string | null;
}

/**
 * URL prefix for piece SVGs. Under Vite the assets live in `public/pieces/` and
 * are served at `<base>/pieces/`; `import.meta.env.BASE_URL` makes this correct
 * for both dev (`/`) and production at the site root (spindriftchess.online).
 */
export const PIECE_IMAGE_BASE = `${import.meta.env.BASE_URL}pieces/spindrift`;

export function getPieceImageUrl(code: string): string {
  return `${PIECE_IMAGE_BASE}/${code}.svg`;
}

const PIECE_DESCRIPTIONS: Record<PieceCode, string> = {
  wP: "White pawn",
  wN: "White knight",
  wB: "White bishop",
  wR: "White rook",
  wQ: "White queen",
  wK: "White king",
  bP: "Black pawn",
  bN: "Black knight",
  bB: "Black bishop",
  bR: "Black rook",
  bQ: "Black queen",
  bK: "Black king",
};

const PIECE_TO_I18N_KEY: Record<PieceCode, keyof BoardViewI18n["piece"]> = {
  wP: "whitePawn",
  wN: "whiteKnight",
  wB: "whiteBishop",
  wR: "whiteRook",
  wQ: "whiteQueen",
  wK: "whiteKing",
  bP: "blackPawn",
  bN: "blackKnight",
  bB: "blackBishop",
  bR: "blackRook",
  bQ: "blackQueen",
  bK: "blackKing",
};

function pieceLabel(t: BoardViewI18n, code: PieceCode): string {
  const key = PIECE_TO_I18N_KEY[code];
  return key ? t.piece[key] : PIECE_DESCRIPTIONS[code] || code;
}

export class BoardView {
  container: HTMLElement;
  onSquareSelected: (square: string) => void;
  onPromotionPicked: (piece: PromotionPiece) => void;
  onPromotionCancelled: () => void;

  squareEls: Map<string, HTMLElement>;
  fileLabelEls: Map<string, HTMLElement>;
  rankLabelEls: Map<number, HTMLElement>;

  selectedSquare: string | null;
  legalTargets: Set<string>;
  lastMove: LastMove | null;
  checkedKingSquare: string | null;
  currentPerspective: PieceColor;
  promotionPending: boolean;

  private _t: BoardViewI18n;

  private _promotionBackdrop: HTMLElement | null = null;
  private _promotionPicker: HTMLElement | null = null;

  constructor(
    container: HTMLElement,
    {
      onSquareSelected,
      onPromotionPicked,
      onPromotionCancelled,
      t,
    }: BoardViewCallbacks & { t?: BoardViewI18n } = {},
  ) {
    if (!container) {
      throw new Error("BoardView: container element is required.");
    }

    this._t =
      t ??
      ({
        piece: PIECE_DESCRIPTIONS,
        board: { empty: "Empty square", promotion: "Choose promotion piece" },
      } as unknown as BoardViewI18n);
    this.container = container;
    this.onSquareSelected = onSquareSelected || (() => {});
    this.onPromotionPicked = onPromotionPicked || (() => {});
    this.onPromotionCancelled = onPromotionCancelled || (() => {});

    this.squareEls = new Map();
    this.fileLabelEls = new Map();
    this.rankLabelEls = new Map();

    this.selectedSquare = null;
    this.legalTargets = new Set();
    this.lastMove = null;
    this.checkedKingSquare = null;
    this.currentPerspective = "white";
    this.promotionPending = false;

    this.handleSquareClick = this.handleSquareClick.bind(this);
    this._handlePromotionKeydown = this._handlePromotionKeydown.bind(this);

    this.initBoard();
  }

  /** Initialize board DOM once. Default orientation a1 bottom-left. */
  initBoard(): void {
    this.container.innerHTML = "";
    this.squareEls.clear();
    this.fileLabelEls.clear();
    this.rankLabelEls.clear();

    const files = ["a", "b", "c", "d", "e", "f", "g", "h"];

    const boardGrid = document.createElement("div");
    boardGrid.className = "chess-board-grid";

    for (let rank = 8; rank >= 1; rank -= 1) {
      for (let fileIndex = 0; fileIndex < 8; fileIndex += 1) {
        const file = files[fileIndex];
        const square = `${file}${rank}`;

        const squareEl = document.createElement("div");
        squareEl.classList.add("chess-square");
        const isLight = (fileIndex + rank) % 2 === 0;
        squareEl.classList.add(isLight ? "light" : "dark");

        squareEl.dataset.square = square;
        squareEl.setAttribute("aria-label", `Square ${square}`);
        squareEl.addEventListener("click", this.handleSquareClick);

        const pieceEl = document.createElement("div");
        pieceEl.classList.add("chess-piece");
        pieceEl.setAttribute("role", "img");
        squareEl.appendChild(pieceEl);

        boardGrid.appendChild(squareEl);
        this.squareEls.set(square, squareEl);
      }
    }

    const fileLabelsRow = document.createElement("div");
    fileLabelsRow.className = "chess-file-labels";
    for (let i = 0; i < 8; i++) {
      const label = document.createElement("span");
      label.className = "chess-file-label";
      label.textContent = files[i];
      fileLabelsRow.appendChild(label);
      this.fileLabelEls.set(files[i], label);
    }

    const rankLabelsCol = document.createElement("div");
    rankLabelsCol.className = "chess-rank-labels";
    for (let rank = 8; rank >= 1; rank--) {
      const label = document.createElement("span");
      label.className = "chess-rank-label";
      label.textContent = String(rank);
      rankLabelsCol.appendChild(label);
      this.rankLabelEls.set(rank, label);
    }

    this.container.appendChild(rankLabelsCol);
    this.container.appendChild(boardGrid);
    this.container.appendChild(fileLabelsRow);
  }

  render(boardState: BoardStateMap, options: RenderOptions): void {
    const { perspective, selected, legalMoves, lastMove, checkedKingSquare } = options;

    this.selectedSquare = selected || null;
    this.legalTargets = legalMoves instanceof Set ? new Set(legalMoves) : new Set(legalMoves || []);
    this.lastMove = lastMove || null;
    this.checkedKingSquare = checkedKingSquare || null;
    this.currentPerspective = perspective || this.currentPerspective;

    const ranks = perspective === "white" ? [8, 7, 6, 5, 4, 3, 2, 1] : [1, 2, 3, 4, 5, 6, 7, 8];
    const files =
      perspective === "white"
        ? ["a", "b", "c", "d", "e", "f", "g", "h"]
        : ["h", "g", "f", "e", "d", "c", "b", "a"];

    const fileLabelContainer = this.container.querySelector(".chess-file-labels");
    if (fileLabelContainer) {
      const labels = fileLabelContainer.querySelectorAll(".chess-file-label");
      for (let i = 0; i < files.length && i < labels.length; i++) {
        labels[i].textContent = files[i];
      }
    }
    const rankLabelContainer = this.container.querySelector(".chess-rank-labels");
    if (rankLabelContainer) {
      const labels = rankLabelContainer.querySelectorAll(".chess-rank-label");
      for (let i = 0; i < ranks.length && i < labels.length; i++) {
        labels[i].textContent = String(ranks[i]);
      }
    }

    this.squareEls.forEach((squareEl, square) => {
      const code = boardState[square] || null;

      let pieceEl = squareEl.querySelector(".chess-piece") as HTMLElement | null;
      if (!pieceEl) {
        pieceEl = document.createElement("div");
        pieceEl.classList.add("chess-piece");
        pieceEl.setAttribute("role", "img");
        squareEl.appendChild(pieceEl);
      }

      if (code) {
        let img = pieceEl.querySelector("img") as HTMLImageElement | null;
        if (!img) {
          img = document.createElement("img");
          img.classList.add("chess-piece-img");
          img.alt = "";
          img.decoding = "async";
          pieceEl.appendChild(img);
        }
        img.src = getPieceImageUrl(code);
        pieceEl.setAttribute("data-piece", code);
        pieceEl.setAttribute("aria-label", pieceLabel(this._t, code as PieceCode) || code);
        pieceEl.classList.add("has-piece");
      } else {
        const img = pieceEl.querySelector("img");
        if (img) {
          img.remove();
        }
        pieceEl.removeAttribute("data-piece");
        pieceEl.setAttribute("aria-label", this._t.board.empty);
        pieceEl.classList.remove("has-piece");
      }

      squareEl.classList.remove(
        "highlight-selected",
        "highlight-legal",
        "highlight-last-move",
        "highlight-in-check",
      );

      if (this.checkedKingSquare && square === this.checkedKingSquare) {
        squareEl.classList.add("highlight-in-check");
      }

      if (this.selectedSquare === square) {
        squareEl.classList.add("highlight-selected");
      }

      if (this.legalTargets.has(square)) {
        squareEl.classList.add("highlight-legal");
      }

      if (lastMove && (lastMove.from === square || lastMove.to === square)) {
        squareEl.classList.add("highlight-last-move");
      }
    });

    let order = 0;
    for (const rank of ranks) {
      for (const file of files) {
        const coord = `${file}${rank}`;
        const squareEl = this.squareEls.get(coord);
        if (squareEl) {
          squareEl.style.order = String(order);
          order += 1;
        }
      }
    }
  }

  updateHighlights({ selected, legalMoves, lastMove, checkedKingSquare }: HighlightOptions): void {
    this.selectedSquare = selected || null;
    this.legalTargets = legalMoves instanceof Set ? new Set(legalMoves) : new Set(legalMoves || []);
    this.lastMove = lastMove || null;
    this.checkedKingSquare = checkedKingSquare ?? null;

    this.squareEls.forEach((squareEl, square) => {
      squareEl.classList.remove(
        "highlight-selected",
        "highlight-legal",
        "highlight-last-move",
        "highlight-in-check",
      );

      if (this.checkedKingSquare && square === this.checkedKingSquare) {
        squareEl.classList.add("highlight-in-check");
      }

      if (this.selectedSquare === square) {
        squareEl.classList.add("highlight-selected");
      }

      if (this.legalTargets.has(square)) {
        squareEl.classList.add("highlight-legal");
      }

      if (this.lastMove && (this.lastMove.from === square || this.lastMove.to === square)) {
        squareEl.classList.add("highlight-last-move");
      }
    });
  }

  handleSquareClick(event: Event): void {
    if (this.promotionPending) return;
    const squareEl = event.currentTarget as HTMLElement;
    const square = squareEl.dataset.square;
    if (!square) return;
    this.onSquareSelected(square);
  }

  /**
   * Show the promotion piece picker overlay on the board.
   * Displays a column of 4 piece icons (Q, R, B, N) anchored to the
   * promotion square, extending toward the player.
   */
  showPromotionPicker(square: string, color: PieceColor): void {
    this.hidePromotionPicker();
    this.promotionPending = true;

    const boardGrid = this.container.querySelector(".chess-board-grid");
    if (!boardGrid) return;

    const perspective = this.currentPerspective;
    const file = square[0];
    const rank = Number(square[1]);
    const pieces: PromotionPiece[] = ["Q", "R", "B", "N"];
    const prefix = color === "white" ? "w" : "b";

    const files =
      perspective === "white"
        ? ["a", "b", "c", "d", "e", "f", "g", "h"]
        : ["h", "g", "f", "e", "d", "c", "b", "a"];
    const ranks = perspective === "white" ? [8, 7, 6, 5, 4, 3, 2, 1] : [1, 2, 3, 4, 5, 6, 7, 8];

    const colIndex = files.indexOf(file);
    const rowIndex = ranks.indexOf(rank);

    const backdrop = document.createElement("div");
    backdrop.className = "promotion-picker-backdrop";
    backdrop.addEventListener("click", () => this._cancelPromotion());

    const picker = document.createElement("div");
    picker.className = "promotion-picker";
    picker.style.left = `${colIndex * 12.5}%`;
    picker.style.top = `${rowIndex * 12.5}%`;
    picker.setAttribute("role", "listbox");
    picker.setAttribute("aria-label", this._t.board.promotion);

    for (let i = 0; i < pieces.length; i++) {
      const piece = pieces[i];
      const code = `${prefix}${piece}` as PieceCode;

      const option = document.createElement("div");
      option.className = "promotion-picker-option";
      option.setAttribute("role", "option");
      option.setAttribute("aria-label", pieceLabel(this._t, code) || code);
      option.dataset.piece = piece;

      const img = document.createElement("img");
      img.src = getPieceImageUrl(code);
      img.alt = pieceLabel(this._t, code) || code;
      img.classList.add("promotion-picker-img");
      img.draggable = false;
      option.appendChild(img);

      option.addEventListener("click", (e) => {
        e.stopPropagation();
        this.hidePromotionPicker();
        this.onPromotionPicked(piece);
      });

      picker.appendChild(option);
    }

    boardGrid.appendChild(backdrop);
    boardGrid.appendChild(picker);

    this._promotionBackdrop = backdrop;
    this._promotionPicker = picker;

    document.addEventListener("keydown", this._handlePromotionKeydown);
  }

  hidePromotionPicker(): void {
    this.promotionPending = false;
    if (this._promotionBackdrop) {
      this._promotionBackdrop.remove();
      this._promotionBackdrop = null;
    }
    if (this._promotionPicker) {
      this._promotionPicker.remove();
      this._promotionPicker = null;
    }
    document.removeEventListener("keydown", this._handlePromotionKeydown);
  }

  private _cancelPromotion(): void {
    this.hidePromotionPicker();
    this.onPromotionCancelled();
  }

  private _handlePromotionKeydown(e: KeyboardEvent): void {
    if (e.key === "Escape") {
      this._cancelPromotion();
    }
  }
}
