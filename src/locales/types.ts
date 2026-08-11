export interface TranslationMap {
  app: {
    title: string;
    ready: string;
    initError: string;
    moveError: string;
  };
  header: {
    about: string;
    aboutAria: string;
    github: string;
    githubAria: string;
    customize: string;
    customizeAria: string;
    menuOpen: string;
    menuAria: string;
    localeSwitchEn: string;
    localeSwitchLt: string;
    localeGroup: string;
  };
  disclaimer: {
    title: string;
    intro: string;
    entertainmentTitle: string;
    entertainmentBody: string;
    storageTitle: string;
    storageBody: string;
    opensourceTitle: string;
    opensourceBody: string;
    artworkTitle: string;
    artworkBody: string;
    supportTitle: string;
    supportBody: string;
    footnote: string;
    accept: string;
  };
  changelog: {
    title: string;
    subtitle: string;
    latest: string;
  };
  game: {
    newGame: string;
    undo: string;
    undoTitle: string;
    settings: string;
    playAs: string;
    uncapped: string;
    uncappedNote: string;
    thinkTime: (opts: { sec: number }) => string;
    strengthChangeNote: string;
  };
  gameEnd: {
    close: string;
    newGame: string;
    checkmateTitle: (opts: { winner: string }) => string;
    checkmateMessage: (opts: { winner: string }) => string;
    stalemateTitle: string;
    stalemateMessage: string;
    drawTitle: string;
    drawMessage: (opts: { reason: string }) => string;
    gameOverTitle: string;
    gameOverMessage: string;
  };
  status: {
    label: string;
    thinking: string;
    thinkingDepth: (opts: { depth: number }) => string;
    thinkingNodes: (opts: { nodes: string }) => string;
    yourMove: string;
    computerMove: string;
    checkmate: (opts: { winner: string }) => string;
    stalemate: string;
    draw: (opts: { reason: string }) => string;
    turnStatus: (opts: { color: string; perspective: string }) => string;
  };
  history: {
    label: string;
    title: string;
    empty: string;
  };
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
    label: string;
    empty: string;
    promotion: string;
    controls: string;
    size: string;
  };
  engine: {
    name: string;
    strength: string;
    level: (opts: { level: number }) => string;
  };
  sidePanelFooter: {
    changelogAria: (opts: { version: string }) => string;
    attribution: string;
  };
  theme: {
    customize: string;
    customizeAria: string;
    close: string;
    reset: string;
    primary: string;
    neutral: string;
    radius: string;
    font: string;
    colorNames: Record<string, string>;
    fontNames: Record<string, string>;
  };
  color: {
    white: string;
    black: string;
    random: string;
    /** Genitive forms (Lithuanian "Juodųjų ėjimas"), identical in English. */
    whiteGen: string;
    blackGen: string;
  };
}
