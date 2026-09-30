import { describe, expect, it } from "vitest";
import { clearPawnHash, evaluate } from "../../../js/engine/Evaluator.js";
import type { Board, Color, Piece } from "../../../js/engine/types.js";

// Frozen scores from aeadf99473d20e8c83f469dfcefd67eb856d7257, sampled every
// 73 plies from 30 legal random games (xorshift32 seed 0x3acbc987, 160-ply cap).
// Board strings run a1..h8, uppercase is white, lowercase black, '.' is empty.
// Keeping the positions themselves makes these independent of move ordering.
const REFERENCES: readonly (readonly [string, Color, number, number])[] = [
  ["RNBQKBNR.PPPPPPPP...............................pppppppprnbqkbnr", "black", -2, 12],
  ["R....BK..PP........PpPN......p..PNnp..P...bpq..ppk.....r.r......", "white", -1165, 1175],
  ["....nb....k....K..P..P...P...p.....P....p.Qp...n................", "black", 95, -85],
  [".....BN..q......RQP...KR.BpP.P....p.Pb.P.r.p.......npppp...k.b.r", "white", -385, 395],
  ["........R.........P.......p..K..r.p..p.P..kpN..p.....p..........", "black", -136, 146],
  [".....RK..qP.PP.P.......N..Q...bp.p.pp...pnP..p.B......r.r...kb..", "white", -1152, 1162],
  ["..............K......P...r.b.p.Pp.P.p...............P.......k...", "black", -573, 583],
  ["RN..K.N....P.PPRB.P....P.PB.P..pp...ppp..Q.......p.pn..rrnb.kb..", "white", 977, -967],
  ["b..K..N.N..P...R.B.p...P....nP.PB........p.......k..............", "black", 1323, -1313],
  ["RNBQK....P.PPPR...P..bPBP......P.........pn....pp.ppppprr..qkbn.", "white", -378, 388],
  [".....BKbN.....R.........p.pP....P..p...Pp..B..rp...r.pb..q..k...", "black", -1348, 1358],
  ["RNBQKBNRPPP.PP.P...........P..P.......p........npppppp.prnbqkb.r", "white", 64, -54],
  ["...K..R......P.PP.....B.p....n...P..PB.....p.....k..pp.QrqR.....", "black", 1309, -1299],
  ["........r..RK........P.....p.p.B....p..P................k...B.n.", "white", 323, -312],
  ["RN.K.B.....P....B.P.PppN.p.....R.pp..PbQ...p...p.........r..r..k", "black", 1295, -1285],
  [".........R.......N.KP....P....k...pp...p..b...N.................", "white", 647, -637],
  ["R..QK.R.....NP.P..NP....P..r...pP.p.........q.P..p.nBpP.....kbr.", "black", 811, -801],
  ["B.....N..RRKNP.P...P...pP.......p.............k..........n...B..", "white", 2405, -2395],
  [".....BN..BPN......QK..PR....P..PPRb....pp..npp.....p..p.r.b.k..r", "white", 904, -894],
  [".....KN..........n....PBN..R...P..B....p....r..R............k...", "black", 1612, -1602],
  [".Q..KBB.R.P.P...P.NP...R.....pP.p.p...N.n..p.ppPPpb....p..q.bknr", "white", 570, -560],
  ["R....BR.p...K.............PP.........Prn...N...P.pb..........k..", "black", 838, -828],
  [".RB..B.RP.....PP.P.QK..N..P.Pn........p...pp.k..pp..pp.prnb..b.r", "white", 311, -301],
  [".K....NRR.......P...p.PP..Pp...BpPp....k..B....b..r...rp........", "black", 622, -612],
  ["RN.QKBNRPPP...P........P....P..B...P.P..p.p.n..n.p.pppppr.bqkb.r", "white", 117, -107],
  [".....R..P.PK.........B.p.Pp...P..N......pbb.np...r.....p..qk...r", "black", -2005, 2015],
  ["RNBQKBNRP.PPPPPP.........P........p.............pp.ppppprnbqkbnr", "white", 12, -2],
  ["......N..qRN..PRP..K.......PPPpP...P.p.p.r.....k...bp....Q...bnr", "black", -112, 122],
  ["..K...........p....r...........P....Q......P....P..........r.k..", "white", 255, -245],
  ["R.B...........K.NP.....P.pPP.P..P...P..Pn.Q.pp..p.p.nk.pr....b.r", "black", 353, -343],
  [".......K...n....N...r...ppP...........k....B.......PP..p........", "white", 100, -90],
  [".NB.QR..R.Pb.PP..q....N.P.B.K..Pp.k...p...P.p..nrp...p.p..b....r", "black", 140, -130],
  ["..........p...........P...b..P...k...NnQ.p.K...B......rr..N.....", "white", -70, 80],
  ["RN.....R.PPKNPP........P...P....Pp......B.p.pqppp..b.p.nrB..kr..", "black", -179, 189],
  [".....R.......PP.....K.N..PRP..p.Pp.B.q.pp....p........k......r..", "white", 358, -348],
  [".RBQK.NRP.PP.P.P....P......N....P....P..B.npqn...pp.pppp.r..kbr.", "black", 351, -341],
  [".NR.......P..N.p.BK.PQ...........ppppPrp.....p..q.....r.....kb..", "white", -616, 626],
  ["RNBQKBN.PPP.PPPR...P...........P..........p.p...pp.p.ppprnbqkbnr", "black", 8, 2],
  ["R.B..K..P.....B..P....PR..nP.......p..pN..p.pqrP.b..k..pN.......", "white", 270, -260],
  [".R.........K..........P.q.p......P....r.P......P..n....p..B.Nk..", "black", -212, 223],
  ["RQ.....R...K...PN.Pn.N..pP.bP..P...p..p.bP..BP.......p.rrn.k....", "white", 830, -820],
  ["....K........Q...p..n..P..Pp...p..P.P.......k.b.....Q...B..r..N.", "black", 1284, -1274],
  ["....QR..RPP..P.NP.pBPK.pp.Np.....p..P..pq....P...r...p......kr..", "black", 857, -847],
  ["N...R.....R.....pNP....p..B.PP.......r.p.P...K...k...p..r.......", "white", 970, -960],
  ["..R....R.PQ.P.....K...PNP.P.pPnP..pP.prppp..p......k.....rb..b..", "black", 335, -325],
  ["........RK..........Q.PbP.P.pP.Pp.....rp.......r.........k...n..", "white", 8, 2],
  [".R.Q.....PP.......BK.NPRPb..P...p..np...Bpn..kr...pp.p.pr.b.....", "black", 381, -371],
  ["...R......P..K..........Pp..pn..p......pn.........r.kp.Rb.......", "white", -957, 967],
  ["..BQ.BR..PPK..PPR.N.P..N...PbP..pP.pqpp.r.........pnp..p....kbnr", "black", 174, -164],
  ["..B..K....P..nPP...nP......b.......p.pNp..B.Pp...........k......", "white", 297, -287],
  ["R.BQK.NRP..P...PN.PP..PB.....P...P.....p...p.n..ppp.pppr.rbqkb..", "black", 177, -167],
  [".........B.P..KRNQP..........P.p.p.p......R.....p...kp..r.....nr", "white", 1010, -1000],
  ["RNBQKBNRP.PPPPP..........P.....P....p...........pppp.ppprnbqkbnr", "black", -76, 86],
  [".........R..B..K.....Q..ppPn...Rp..Ppn.......p..r.....pp..kr....", "white", -327, 337],
  ["................p.....n.p..r...............n.K.p............k..r", "black", -2315, 2325],
  [".R.....R.......PBn..PK.PpPPP.P.p.pp.N.......ppN..........rq.k..b", "white", 108, -98],
  [".RK..........B.P.....R.PpP.pq..p.....p.....n.....N.k..b.........", "black", -244, 254],
  ["R...K.....PPNP......q.NBPP..P.RPp...B....pk...prn.np.p..r.b..b..", "white", -365, 375],
  [".N.R...N..K..B.....P....P.p.....pP.....Prp...nq...........k.....", "black", -106, 116],
  ["RNQ.KB..P.P.P..R..B...P..P.bpP.q...p......n.b...pppk.pnp..r....r", "white", -576, 586],
  ["............K...P.........pN.PPpPR......p.k..r...rp...n.B.......", "black", -74, 84],
  ["RN.Q..NRP.P.BK.P...P.PP..P..P....p...pBpp.pp...n....p.p.rnbqkb.r", "white", 80, -70],
  ["....R.KR..N....P...P...p.Pp.BP...p...P..n..bQ.prr.n..........k.B", "black", 1159, -1149],
  ["RNBQKBNR..PPPPPP.P......P..........p...........nppp.pppprnbqkb.r", "white", -78, 88],
  ["....KB...R....RP.P...pP...N.P....p...np...p.....Pp....Bp.nkb.r..", "black", 536, -526],
];

function decodeBoard(encoded: string): Board {
  return Array.from(encoded, (piece) => {
    if (piece === ".") return null;
    return `${piece === piece.toUpperCase() ? "w" : "b"}${piece.toUpperCase()}` as Piece;
  });
}

describe("Evaluator efficiency reference scores", () => {
  it.each(REFERENCES)(
    "preserves both perspectives for %s",
    (encoded, activeColor, white, black) => {
      const board = decodeBoard(encoded);
      const state = { board, activeColor };
      expect(evaluate(state, "white")).toBe(white);
      expect(evaluate(state, "black")).toBe(black);

      // Cold and warm pawn-cache paths must preserve the same score. Clearing
      // avoids intentionally changing the existing board-dependent cache terms.
      clearPawnHash();
      expect(evaluate(state, "white", 1n)).toBe(white);
      expect(evaluate(state, "black", 1n)).toBe(black);
      expect(evaluate(state, "white", 1n)).toBe(white);
      expect(board).toEqual(decodeBoard(encoded));
      clearPawnHash();
    },
  );
});
