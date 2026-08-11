/**
 * useGameStore — reactive orchestration for Spindrift Chess.
 *
 * Owns the framework-agnostic `Game` instance and exposes reactive state for
 * the vd3 chrome (status, history, settings) plus imperative hooks into the
 * `BoardView` island. Module-scope singleton shared by every component.
 */
import { reactive, ref, computed, type Ref, type ComputedRef } from "vue";
import { Game, type ColorChoice, type GameSnapshot, type PromotionPiece } from "../../js/Game.js";
import {
  getDisclaimerAccepted,
  getDifficulty,
  setDifficulty,
  getUncapped,
  setUncapped as persistUncapped,
  getThinkTimeMs,
  setThinkTimeMs as persistThinkTimeMs,
  DEFAULT_THINK_TIME_MS,
  MIN_THINK_TIME_MS,
  MAX_THINK_TIME_MS,
  getGame,
  setGame,
  clearGame,
  getBoardSize,
  setBoardSize,
  getColorChoice,
  setColorChoice,
  type SerializedGame,
} from "../../js/storage.js";
import type { SearchInfo } from "../../js/engineAdapter.js";
import type { BoardView } from "../../js/ui/BoardView.js";
import { getT } from "./useI18n";

const MIN_THINK_TIME_SEC = Math.round(MIN_THINK_TIME_MS / 1000);
const MAX_THINK_TIME_SEC = Math.round(MAX_THINK_TIME_MS / 1000);

const BOARD_SIZE_MIN_PX = 400;
const BOARD_SIZE_MAX_PX = 800;
/** First visit: max board width (slider 100 -> 800px). */
const BOARD_SIZE_SLIDER_DEFAULT = 100;

const boardSliderToMaxWidthPx = (slider: number): number => {
  const s = Math.max(0, Math.min(100, Number(slider)));
  return BOARD_SIZE_MIN_PX + ((BOARD_SIZE_MAX_PX - BOARD_SIZE_MIN_PX) * s) / 100;
};

const applyBoardMaxWidthCss = (slider: number): void => {
  const px = Math.round(boardSliderToMaxWidthPx(slider));
  document.documentElement.style.setProperty("--board-max-width", `${px}px`);
};

export interface StatusState {
  text: string;
  turn: string;
  lastMove: string;
  busy: boolean;
}

export interface SettingsState {
  color: ColorChoice;
  difficulty: number;
  uncapped: boolean;
  /** Thinking time in seconds for uncapped mode (1–60). */
  thinkTimeSec: number;
}

export interface GameEndPayload {
  result: NonNullable<GameSnapshot["result"]>;
  playerColor: GameSnapshot["playerColor"];
}

export interface GameStore {
  status: StatusState;
  history: Ref<string[]>;
  settings: SettingsState;
  boardSizeSlider: Ref<number>;
  gameEndResult: Ref<GameEndPayload | null>;
  canUndo: ComputedRef<boolean>;
  attachBoard: (instance: BoardView) => void;
  detachBoard: () => void;
  restore: () => Promise<void>;
  newGame: () => Promise<void>;
  handleSquareSelected: (square: string) => void;
  handlePromotionPicked: (piece: PromotionPiece) => void;
  handlePromotionCancelled: () => void;
  undoLastMove: () => void;
  setColor: (color: ColorChoice) => void;
  setDifficultyChoice: (level: number) => void;
  setUncapped: (on: boolean) => void;
  setThinkTimeSec: (sec: number) => void;
  setBoardSizeSlider: (v: number) => void;
  getDisclaimerAccepted: typeof getDisclaimerAccepted;
  /** Re-translate status text when locale changes. */
  resyncStatus: () => void;
}

function createGameStore(): GameStore {
  const status = reactive<StatusState>({
    text: getT().app.ready,
    turn: "",
    lastMove: "",
    busy: false,
  });
  const history = ref<string[]>([]);

  const settings = reactive<SettingsState>({
    color: getColorChoice() || "random",
    difficulty: getDifficulty() ?? 3,
    uncapped: getUncapped(),
    thinkTimeSec: Math.round((getThinkTimeMs() ?? DEFAULT_THINK_TIME_MS) / 1000),
  });

  const boardSizeSlider = ref(getBoardSize() ?? BOARD_SIZE_SLIDER_DEFAULT);

  const gameEndResult = ref<GameEndPayload | null>(null);

  let game: Game | null = null;
  let boardView: BoardView | null = null;
  let latestGameSnapshot: GameSnapshot | null = null;
  let isProcessingMove = false;
  let gameSaveThrottle: ReturnType<typeof setTimeout> | null = null;
  let pendingPromotion: { from: string; to: string } | null = null;
  let previousGameOver = false;
  let thinkingStartedAt: number | null = null;
  let thinkingTimer: ReturnType<typeof setInterval> | null = null;
  let lastSearchInfo: SearchInfo | null = null;

  function formatElapsed(ms: number): string {
    const sec = Math.max(0, ms) / 1000;
    return sec < 10 ? `${sec.toFixed(1)}s` : `${Math.round(sec)}s`;
  }

  function formatNodes(n: number): string {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 10_000) return `${Math.round(n / 1000)}k`;
    if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
    return String(n);
  }

  function formatThinkingStatus(info: SearchInfo | null, elapsedMs: number): string {
    const t = getT();
    const details: string[] = [];
    if (info && info.depthCompleted > 0)
      details.push(t.status.thinkingDepth({ depth: info.depthCompleted }));
    if (info && info.nodes > 0)
      details.push(t.status.thinkingNodes({ nodes: formatNodes(info.nodes) }));
    details.push(formatElapsed(elapsedMs));
    return `${t.status.thinking}… ${details.join(" · ")}`;
  }

  function updateThinkingStatus(): void {
    if (!status.busy || thinkingStartedAt === null) return;
    status.text = formatThinkingStatus(lastSearchInfo, performance.now() - thinkingStartedAt);
  }

  function attachBoard(instance: BoardView): void {
    boardView = instance;
    if (game) renderCurrentBoard();
  }

  function detachBoard(): void {
    boardView = null;
  }

  function renderCurrentBoard(): void {
    if (!game || !boardView) return;
    const snapshot = game.getSnapshot();
    boardView.render(game.getBoard(), {
      perspective: game.getPlayerColor(),
      selected: null,
      legalMoves: [],
      lastMove: snapshot.lastMove,
      checkedKingSquare: game.getCheckedKingSquare(),
    });
  }

  function syncUIWithGame(snapshot: GameSnapshot): void {
    if (!snapshot) return;

    latestGameSnapshot = snapshot;
    const t = getT();

    // Build translated status text from snapshot data
    if (snapshot.result && snapshot.result.outcome !== "ongoing") {
      switch (snapshot.result.outcome) {
        case "checkmate": {
          const winner = snapshot.result.winner === "white" ? t.color.white : t.color.black;
          status.text = t.status.checkmate({ winner });
          break;
        }
        case "stalemate":
          status.text = t.status.stalemate;
          break;
        case "draw":
          status.text = t.status.draw({ reason: snapshot.result.reason || "by agreement" });
          break;
        default:
          status.text = "";
      }
    } else if (snapshot.activeColor) {
      const color = snapshot.activeColor === "white" ? t.color.whiteGen : t.color.blackGen;
      const perspective =
        snapshot.activeColor === snapshot.playerColor ? t.status.yourMove : t.status.computerMove;
      status.text = t.status.turnStatus({ color, perspective });
    } else {
      status.text = "";
    }

    status.turn =
      snapshot.gameOver || !snapshot.activeColor
        ? ""
        : snapshot.activeColor === snapshot.playerColor
          ? t.status.yourMove
          : t.status.computerMove;
    status.lastMove = snapshot.lastMoveText || "";
    history.value = (snapshot.history || []).slice();

    if (game && !game.isGameOver()) {
      if (gameSaveThrottle) clearTimeout(gameSaveThrottle);
      gameSaveThrottle = setTimeout(() => {
        try {
          setGame(game!.getGameState() as unknown as SerializedGame);
        } catch {
          /* non-critical */
        }
        gameSaveThrottle = null;
      }, 500);
    }

    const isGameOver = snapshot.gameOver || false;
    if (isGameOver && !previousGameOver && snapshot.result) {
      clearGame();
      gameEndResult.value = {
        result: snapshot.result,
        playerColor: snapshot.playerColor,
      };
    }
    previousGameOver = isGameOver;
  }

  function syncBusyState(isBusy: boolean): void {
    if (isBusy) {
      status.busy = true;
      lastSearchInfo = null;
      thinkingStartedAt = performance.now();
      status.text = formatThinkingStatus(null, 0);
      if (thinkingTimer) clearInterval(thinkingTimer);
      thinkingTimer = setInterval(updateThinkingStatus, 200);
    } else {
      status.busy = false;
      if (thinkingTimer) {
        clearInterval(thinkingTimer);
        thinkingTimer = null;
      }
      thinkingStartedAt = null;
      lastSearchInfo = null;
      if (game) {
        syncUIWithGame(game.getSnapshot());
      }
    }
  }

  async function initializeGame(): Promise<void> {
    clearGame();
    setDifficulty(settings.difficulty);
    persistUncapped(settings.uncapped);
    persistThinkTimeMs(settings.thinkTimeSec * 1000);

    gameEndResult.value = null;
    previousGameOver = false;

    const playerColor = settings.color;
    const { difficulty, uncapped, thinkTimeSec } = settings;

    try {
      game = new Game({
        playerColor,
        difficulty,
        uncapped,
        thinkTimeMs: thinkTimeSec * 1000,
        onUpdate: syncUIWithGame,
      });

      const snapshot = game.getSnapshot();
      renderCurrentBoard();
      syncUIWithGame(snapshot);

      if (game.getCurrentTurn() !== game.getPlayerColor() && !game.isGameOver()) {
        requestAnimationFrame(() => {
          if (!game || game.isGameOver()) return;
          if (game.getCurrentTurn() !== game.getPlayerColor()) void triggerAIMove();
        });
      }
    } catch (error) {
      console.error("Game initialization error:", error);
      status.text = getT().app.initError;
    }
  }

  async function restoreGame(savedState: SerializedGame): Promise<void> {
    previousGameOver = false;
    gameEndResult.value = null;

    const savedDifficulty = getDifficulty();

    try {
      game = Game.fromSaved(savedState as Parameters<typeof Game.fromSaved>[0], {
        difficulty: savedDifficulty ?? 3,
        uncapped: getUncapped(),
        thinkTimeMs: getThinkTimeMs() ?? DEFAULT_THINK_TIME_MS,
        onUpdate: syncUIWithGame,
      });

      const snapshot = game.getSnapshot();
      renderCurrentBoard();
      syncUIWithGame(snapshot);

      if (!game.isGameOver() && game.getCurrentTurn() !== game.getPlayerColor()) {
        requestAnimationFrame(() => {
          if (!game || game.isGameOver()) return;
          if (game.getCurrentTurn() !== game.getPlayerColor()) void triggerAIMove();
        });
      }
    } catch (error) {
      console.error("Game restore error:", error);
      clearGame();
      status.text = getT().app.ready;
    }
  }

  async function newGame(): Promise<void> {
    if (isProcessingMove) return;
    await initializeGame();
  }

  function handleSquareSelected(square: string): void {
    if (isProcessingMove) return;
    if (!game) return;
    if (game.getCurrentTurn() !== game.getPlayerColor()) return;
    if (game.isGameOver()) return;

    const selectedFrom = game.state.selectedSquare;
    if (selectedFrom && game.isPromotionMove(selectedFrom, square)) {
      pendingPromotion = { from: selectedFrom, to: square };
      boardView?.showPromotionPicker(square, game.getPlayerColor());
      return;
    }

    const result = game.handlePlayerSquareSelection(square, "Q");
    if (!result.changed) {
      boardView?.updateHighlights({
        selected: result.selected,
        legalMoves: result.legalTargets,
        lastMove: result.lastMove,
        checkedKingSquare: game.getCheckedKingSquare(),
      });
      return;
    }
    completePlayerMove();
  }

  function handlePromotionPicked(piece: PromotionPiece): void {
    if (!game || !pendingPromotion) return;
    const { to } = pendingPromotion;
    pendingPromotion = null;
    const result = game.handlePlayerSquareSelection(to, piece);
    if (!result.changed) return;
    completePlayerMove();
  }

  function handlePromotionCancelled(): void {
    pendingPromotion = null;
  }

  function completePlayerMove(): void {
    if (!game) return;
    const snapshot = game.getSnapshot();
    syncUIWithGame(snapshot);
    if (boardView) {
      boardView.render(game.getBoard(), {
        perspective: game.getPlayerColor(),
        selected: null,
        legalMoves: [],
        lastMove: snapshot.lastMove,
        checkedKingSquare: game.getCheckedKingSquare(),
      });
    }
    if (!game.isGameOver()) {
      requestAnimationFrame(() => {
        if (!game || game.isGameOver()) return;
        if (game.getCurrentTurn() !== game.getPlayerColor()) void triggerAIMove();
      });
    }
  }

  async function triggerAIMove(): Promise<void> {
    if (!game || game.isGameOver()) return;
    if (game.getCurrentTurn() === game.getPlayerColor()) return;

    isProcessingMove = true;
    syncBusyState(true);
    try {
      const aiMove = await game.computeAIMove({
        onInfo: (info) => {
          lastSearchInfo = info;
          updateThinkingStatus();
        },
      });
      if (!aiMove) {
        syncUIWithGame(game.getSnapshot());
        return;
      }
      game.applyAIMove(aiMove);
      const snapshot = game.getSnapshot();
      syncUIWithGame(snapshot);
      if (boardView) {
        boardView.render(game.getBoard(), {
          perspective: game.getPlayerColor(),
          selected: null,
          legalMoves: [],
          lastMove: snapshot.lastMove,
          checkedKingSquare: game.getCheckedKingSquare(),
        });
      }
    } catch (error) {
      console.error("AI move error:", error);
      status.text = getT().app.moveError;
    } finally {
      isProcessingMove = false;
      syncBusyState(false);
    }
  }

  /**
   * Reactive availability for the Undo button. `game` is non-reactive, so the
   * computed reads `history`/`gameEndResult` to re-evaluate whenever the
   * position, busy flag, or end-modal changes.
   */
  const canUndo = computed(() => {
    const busy = status.busy;
    void history.value;
    void gameEndResult.value;
    if (busy || !game) return false;
    return game.canUndo();
  });

  function undoLastMove(): void {
    if (!game || !canUndo.value) return;
    pendingPromotion = null;
    const undone = game.undoToPlayerTurn();
    if (!undone) return;
    gameEndResult.value = null;
    previousGameOver = false;
    renderCurrentBoard();
    syncUIWithGame(game.getSnapshot());
  }

  function setColor(color: ColorChoice): void {
    if (!["white", "black", "random"].includes(color)) return;
    settings.color = color;
    setColorChoice(color);
  }

  function setDifficultyChoice(level: number): void {
    const clamped = Math.max(1, Math.min(6, Number(level) || 3));
    settings.difficulty = clamped;
    setDifficulty(clamped);
    if (game) game.setDifficulty(clamped);
  }

  function setUncapped(on: boolean): void {
    settings.uncapped = Boolean(on);
    persistUncapped(settings.uncapped);
    if (game) game.setUncapped(settings.uncapped);
  }

  function setThinkTimeSec(sec: number): void {
    const clamped = Math.max(
      MIN_THINK_TIME_SEC,
      Math.min(MAX_THINK_TIME_SEC, Math.round(Number(sec) || 10)),
    );
    settings.thinkTimeSec = clamped;
    persistThinkTimeMs(clamped * 1000);
    if (game) game.setThinkTimeMs(clamped * 1000);
  }

  function setBoardSizeSlider(v: number): void {
    const value = Math.max(0, Math.min(100, Number(v) || 0));
    boardSizeSlider.value = value;
    applyBoardMaxWidthCss(value);
    setBoardSize(value);
  }

  async function restore(): Promise<void> {
    applyBoardMaxWidthCss(boardSizeSlider.value);
    if (getBoardSize() === null) setBoardSize(boardSizeSlider.value);

    const savedGame = getGame();
    if (savedGame) {
      await restoreGame(savedGame);
    } else {
      status.text = getT().app.ready;
    }
  }

  function resyncStatus(): void {
    if (status.busy && thinkingStartedAt !== null) {
      updateThinkingStatus();
      return;
    }
    if (latestGameSnapshot) {
      syncUIWithGame(latestGameSnapshot);
    } else {
      status.text = getT().app.ready;
    }
  }

  return {
    status,
    history,
    settings,
    boardSizeSlider,
    gameEndResult,
    canUndo,
    attachBoard,
    detachBoard,
    restore,
    newGame,
    handleSquareSelected,
    handlePromotionPicked,
    handlePromotionCancelled,
    undoLastMove,
    setColor,
    setDifficultyChoice,
    setUncapped,
    setThinkTimeSec,
    setBoardSizeSlider,
    getDisclaimerAccepted,
    resyncStatus,
  };
}

let store: GameStore | null = null;

/** Shared singleton game store. */
export function useGameStore(): GameStore {
  if (!store) store = createGameStore();
  return store;
}
