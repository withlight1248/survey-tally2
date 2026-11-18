'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadLogic } = require('./load-logic');

const { EMPTY, BLACK, WHITE, newGame, place, undo, findWinLine } = loadLogic();

// vm 안에서 만든 배열·객체는 prototype이 달라 deepStrictEqual이 실패하므로 JSON으로 맞춘다.
const plain = (v) => JSON.parse(JSON.stringify(v));

/** 수를 차례로 두고, 하나라도 거부되면 시험을 실패시킨다. */
function play(state, moves) {
  let s = state;
  for (const [r, c] of moves) {
    const res = place(s, r, c);
    assert.equal(res.ok, true, `(${r},${c}) 착수가 거부됨: ${res.reason}`);
    s = res.state;
  }
  return s;
}

/** 흑 수들과 백 수들을 흑, 백, 흑, 백... 순서로 섞어 두고, 마지막은 흑의 수로 끝낸다. */
function playInterleaved(blackMoves, whiteMoves) {
  const moves = [];
  for (let i = 0; i < blackMoves.length; i++) {
    moves.push(blackMoves[i]);
    if (i < blackMoves.length - 1) {
      assert.ok(i < whiteMoves.length, '백의 수가 모자람');
      moves.push(whiteMoves[i]);
    }
  }
  return play(newGame(), moves);
}

// 서로 붙지 않아 절대 오목이 되지 않는 백의 수 (9행에 한 칸씩 띄워서)
const FILLER = [[9, 0], [9, 2], [9, 4], [9, 6], [9, 8]];

test('새 게임: 10×10 빈 판, 흑 선공, 둔 수 없음', () => {
  const g = newGame();
  assert.equal(g.size, 10);
  assert.equal(g.board.length, 10);
  assert.ok(g.board.every((row) => row.length === 10 && row.every((v) => v === EMPTY)));
  assert.equal(g.turn, BLACK);
  assert.equal(g.winner, 0);
  assert.equal(g.winLine, null);
  assert.equal(g.draw, false);
  assert.equal(g.moves.length, 0);
});

test('착수: 흑, 백이 번갈아 두고 판에 기록된다', () => {
  let s = newGame();
  s = play(s, [[4, 4]]);
  assert.equal(s.board[4][4], BLACK);
  assert.equal(s.turn, WHITE);
  s = play(s, [[4, 5]]);
  assert.equal(s.board[4][5], WHITE);
  assert.equal(s.turn, BLACK);
  assert.deepEqual(plain(s.moves), [[4, 4, 1], [4, 5, 2]]);
});

test('착수: 이미 돌이 있는 칸은 거부하고 상태를 바꾸지 않는다', () => {
  const s = play(newGame(), [[3, 3]]);
  const res = place(s, 3, 3);
  assert.equal(res.ok, false);
  assert.equal(res.reason, 'occupied');
  assert.equal(res.state, s);
  assert.equal(s.turn, WHITE);
});

test('착수: 판 밖이거나 정수가 아니면 거부', () => {
  const s = newGame();
  for (const [r, c] of [[-1, 0], [0, -1], [10, 0], [0, 10], [1.5, 2], [2, 0.5], [NaN, 1], ['3', 3], [3, '3'], [undefined, 1]]) {
    const res = place(s, r, c);
    assert.equal(res.ok, false, JSON.stringify([r, c]));
    assert.equal(res.reason, 'out-of-range', JSON.stringify([r, c]));
    assert.equal(res.state, s);
  }
});

test('착수: 이전 상태를 바꾸지 않는다', () => {
  const s0 = newGame();
  const s1 = place(s0, 5, 5).state;
  assert.equal(s0.board[5][5], EMPTY);
  assert.equal(s0.moves.length, 0);
  assert.equal(s0.turn, BLACK);
  assert.equal(s1.board[5][5], BLACK);
  assert.notEqual(s0.board, s1.board);
});

test('승리: 가로 다섯', () => {
  const s = playInterleaved([[2, 1], [2, 2], [2, 3], [2, 4], [2, 5]], FILLER);
  assert.equal(s.winner, BLACK);
  assert.deepEqual(plain(s.winLine), [[2, 1], [2, 2], [2, 3], [2, 4], [2, 5]]);
});

test('승리: 세로 다섯', () => {
  const s = playInterleaved([[1, 7], [2, 7], [3, 7], [4, 7], [5, 7]], FILLER);
  assert.equal(s.winner, BLACK);
  assert.deepEqual(plain(s.winLine), [[1, 7], [2, 7], [3, 7], [4, 7], [5, 7]]);
});

test('승리: 대각선 ↘ 다섯', () => {
  const s = playInterleaved([[1, 1], [2, 2], [3, 3], [4, 4], [5, 5]], FILLER);
  assert.equal(s.winner, BLACK);
  assert.deepEqual(plain(s.winLine), [[1, 1], [2, 2], [3, 3], [4, 4], [5, 5]]);
});

test('승리: 대각선 ↙ 다섯', () => {
  const s = playInterleaved([[1, 6], [2, 5], [3, 4], [4, 3], [5, 2]], FILLER);
  assert.equal(s.winner, BLACK);
  assert.deepEqual(plain(s.winLine), [[1, 6], [2, 5], [3, 4], [4, 3], [5, 2]]);
});

test('승리: 판 가장자리와 모서리', () => {
  const edge = playInterleaved([[0, 0], [0, 1], [0, 2], [0, 3], [0, 4]], FILLER);
  assert.equal(edge.winner, BLACK);
  const corner = playInterleaved([[5, 5], [6, 6], [7, 7], [8, 8], [9, 9]], FILLER);
  assert.equal(corner.winner, BLACK);
  const last = playInterleaved([[4, 9], [5, 9], [6, 9], [7, 9], [8, 9]], [[0, 0], [0, 2], [0, 4], [0, 6]]);
  assert.equal(last.winner, BLACK);
  const anti = playInterleaved([[0, 9], [1, 8], [2, 7], [3, 6], [4, 5]], FILLER);
  assert.equal(anti.winner, BLACK);
});

test('승리: 가운데 빈 칸을 메워 이어지는 경우', () => {
  // 흑: 1,2,4,5열을 먼저 두고 마지막에 3열을 둔다
  const s = playInterleaved([[3, 1], [3, 2], [3, 4], [3, 5], [3, 3]], FILLER);
  assert.equal(s.winner, BLACK);
  assert.deepEqual(plain(s.winLine), [[3, 1], [3, 2], [3, 3], [3, 4], [3, 5]]);
});

test('승리: 여섯 개 이상 이어져도 이긴다(장목 금지 없음)', () => {
  const s = playInterleaved([[3, 0], [3, 1], [3, 2], [3, 4], [3, 5], [3, 3]], FILLER);
  assert.equal(s.winner, BLACK);
  assert.equal(s.winLine.length, 6);
});

test('승리: 백도 이긴다', () => {
  // 흑은 서로 붙지 않게 두고, 백이 다섯을 만든다
  const black = [[0, 0], [0, 2], [0, 4], [0, 6], [0, 8]];
  const white = [[5, 1], [5, 2], [5, 3], [5, 4], [5, 5]];
  let s = newGame();
  for (let i = 0; i < 5; i++) s = play(s, [black[i], white[i]]);
  assert.equal(s.winner, WHITE);
  assert.deepEqual(plain(s.winLine), [[5, 1], [5, 2], [5, 3], [5, 4], [5, 5]]);
});

test('승리가 아닌 경우: 넷만 이어짐', () => {
  const s = playInterleaved([[2, 1], [2, 2], [2, 3], [2, 4]], FILLER);
  assert.equal(s.winner, 0);
  assert.equal(s.winLine, null);
  assert.equal(s.draw, false);
});

test('승리가 아닌 경우: 한 칸 비어 끊어진 다섯 개', () => {
  const s = playInterleaved([[3, 0], [3, 1], [3, 2], [3, 4], [3, 5]], FILLER);
  assert.equal(s.winner, 0);
});

test('승리가 아닌 경우: 흑과 백이 섞여 이어진 줄', () => {
  const s = play(newGame(), [[0, 0], [0, 1], [0, 2], [0, 3], [0, 4], [0, 5]]);
  assert.equal(s.winner, 0);
});

test('승리가 아닌 경우: 줄이 판 끝에서 끊김(반대편으로 이어지지 않음)', () => {
  // 9열 끝과 0열 처음은 이어지지 않는다
  const s = playInterleaved([[3, 7], [3, 8], [3, 9], [3, 0], [3, 1]], FILLER);
  assert.equal(s.winner, 0);
});

test('승부가 난 뒤에는 더 둘 수 없다', () => {
  const s = playInterleaved([[2, 1], [2, 2], [2, 3], [2, 4], [2, 5]], FILLER);
  const res = place(s, 8, 8);
  assert.equal(res.ok, false);
  assert.equal(res.reason, 'finished');
  assert.equal(res.state, s);
});

test('findWinLine: 빈 칸이면 null', () => {
  const g = newGame();
  assert.equal(findWinLine(g.board, 0, 0), null);
});

test('무르기: 마지막 수를 취소하고 차례가 돌아온다', () => {
  const s = play(newGame(), [[1, 1], [2, 2], [3, 3]]);
  const u = undo(s);
  assert.equal(u.moves.length, 2);
  assert.equal(u.board[3][3], EMPTY);
  assert.equal(u.turn, BLACK);
  assert.equal(s.moves.length, 3, '원래 상태는 그대로');
  assert.equal(s.board[3][3], BLACK);
});

test('무르기: 이긴 수를 취소하면 승부가 풀린다', () => {
  const won = playInterleaved([[2, 1], [2, 2], [2, 3], [2, 4], [2, 5]], FILLER);
  assert.equal(won.winner, BLACK);
  const u = undo(won);
  assert.equal(u.winner, 0);
  assert.equal(u.winLine, null);
  assert.equal(u.turn, BLACK);
  assert.equal(u.board[2][5], EMPTY);
  // 풀린 뒤에는 다시 둘 수 있고, 같은 수로 다시 이긴다
  assert.equal(place(u, 2, 5).state.winner, BLACK);
});

test('무르기: 처음까지 되돌릴 수 있고, 빈 판에서는 변화 없음', () => {
  let s = play(newGame(), [[0, 0], [1, 1]]);
  s = undo(undo(s));
  assert.equal(s.moves.length, 0);
  assert.equal(s.turn, BLACK);
  assert.ok(s.board.every((row) => row.every((v) => v === EMPTY)));
  assert.equal(undo(s), s);
});

/** 오목이 어디에도 나오지 않는 가득 찬 판의 수 순서. 칸 색: (열 + 행÷2 내림) 짝수면 흑. */
function drawMoves() {
  const blacks = [];
  const whites = [];
  for (let r = 0; r < 10; r++) {
    for (let c = 0; c < 10; c++) {
      ((c + Math.floor(r / 2)) % 2 === 0 ? blacks : whites).push([r, c]);
    }
  }
  assert.equal(blacks.length, 50);
  assert.equal(whites.length, 50);
  const moves = [];
  for (let i = 0; i < 50; i++) moves.push(blacks[i], whites[i]);
  return moves;
}

test('무승부: 오목 없이 100칸이 가득 차면 무승부', () => {
  const moves = drawMoves();
  let s = newGame();
  for (let i = 0; i < moves.length - 1; i++) {
    s = play(s, [moves[i]]);
    assert.equal(s.winner, 0, `${i + 1}번째 수에서 승부가 남`);
    assert.equal(s.draw, false);
  }
  s = play(s, [moves[moves.length - 1]]);
  assert.equal(s.moves.length, 100);
  assert.equal(s.winner, 0);
  assert.equal(s.draw, true);
  const res = place(s, 0, 0);
  assert.equal(res.ok, false);
  assert.equal(res.reason, 'finished');
  // 마지막 수를 무르면 다시 진행 중
  const u = undo(s);
  assert.equal(u.draw, false);
  assert.equal(u.moves.length, 99);
});
