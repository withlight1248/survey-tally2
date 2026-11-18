'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadLogic } = require('./load-logic');

const { parseTsv, classifyCell, formatAverage, tally } = loadLogic();

// vm 안에서 만든 배열·객체는 prototype이 달라 deepStrictEqual이 실패하므로 JSON으로 맞춘다.
const plain = (v) => JSON.parse(JSON.stringify(v));

test('classifyCell: 앞뒤 공백을 지운 값이 1~5면 유효', () => {
  for (const v of ['1', '2', '3', '4', '5', ' 3 ', '\t4', '5  ', ' 2 ']) {
    assert.equal(classifyCell(v), 'valid', JSON.stringify(v));
  }
});

test('classifyCell: 비었거나 공백뿐이면 빈 응답', () => {
  for (const v of ['', ' ', '   ', '\t', ' ', undefined, null]) {
    assert.equal(classifyCell(v), 'blank', JSON.stringify(v));
  }
});

test('classifyCell: 그 밖의 값은 제외', () => {
  for (const v of ['0', '6', '10', '-1', '3.0', '3.5', '03', '1,2', '1 2', 'abc', 'N/A', '３', '五', '+3']) {
    assert.equal(classifyCell(v), 'excluded', JSON.stringify(v));
  }
});

test('formatAverage: 유효 응답이 0이면 "-"', () => {
  assert.equal(formatAverage(0, 0), '-');
});

test('formatAverage: 둘째 자리까지, 셋째 자리에서 반올림', () => {
  assert.equal(formatAverage(10, 3), '3.33'); // 3.333...
  assert.equal(formatAverage(2, 3), '0.67'); // 0.666...
  assert.equal(formatAverage(7, 3), '2.33');
  assert.equal(formatAverage(11, 3), '3.67');
});

test('formatAverage: 정확히 떨어지는 값도 둘째 자리까지 표시', () => {
  assert.equal(formatAverage(3, 1), '3.00');
  assert.equal(formatAverage(15, 3), '5.00');
  assert.equal(formatAverage(3, 2), '1.50');
  assert.equal(formatAverage(7, 2), '3.50');
});

test('formatAverage: 셋째 자리가 정확히 5면 올림 (부동소수점 오차 없음)', () => {
  assert.equal(formatAverage(1, 8), '0.13'); // 0.125
  assert.equal(formatAverage(201, 200), '1.01'); // 1.005 (toFixed는 1.00이 됨)
  assert.equal(formatAverage(401, 400), '1.00'); // 1.0025 → 1.00
  assert.equal(formatAverage(1003, 400), '2.51'); // 2.5075
  assert.equal(formatAverage(9, 8), '1.13'); // 1.125
});

test('parseTsv: 탭·줄바꿈으로 나누고 \\r\\n, 끝의 빈 줄을 처리', () => {
  assert.deepEqual(plain(parseTsv('a\tb\tc\n1\t2\t3')), [['a', 'b', 'c'], ['1', '2', '3']]);
  assert.deepEqual(plain(parseTsv('a\tb\r\n1\t2\r\n')), [['a', 'b'], ['1', '2']]);
  assert.deepEqual(plain(parseTsv('a\tb\n1\t\n')), [['a', 'b'], ['1', '']]);
  assert.deepEqual(plain(parseTsv('')), []);
});

test('parseTsv: 맨 앞 BOM 제거', () => {
  assert.deepEqual(plain(parseTsv('﻿a\tb')), [['a', 'b']]);
});

test('parseTsv: 따옴표로 감싼 칸 (줄바꿈·탭·따옴표 포함)', () => {
  assert.deepEqual(
    plain(parseTsv('"문항 1\n(복수)"\t"say ""hi"""\t"a\tb"\nx\ty\tz')),
    [['문항 1\n(복수)', 'say "hi"', 'a\tb'], ['x', 'y', 'z']]
  );
});

test('parseTsv: 칸 중간의 따옴표는 그대로 둔다', () => {
  assert.deepEqual(plain(parseTsv('5" 화면\t3')), [['5" 화면', '3']]);
});

test('tally: 기본 예 — 첫 열은 집계하지 않는다', () => {
  const text = [
    '응답번호\t만족도\t추천',
    '1\t5\t4',
    '2\t4\t3',
    '3\t3\t5'
  ].join('\n');
  assert.deepEqual(plain(tally(text)), {
    respondents: 3,
    questions: [
      { name: '만족도', valid: 3, average: '4.00', blank: 0, excluded: 0 },
      { name: '추천', valid: 3, average: '4.00', blank: 0, excluded: 0 }
    ]
  });
});

test('tally: 응답번호가 1~5여도 집계에 들어가지 않는다', () => {
  const r = tally('번호\tQ1\n1\t5\n2\t5\n3\t5\n4\t5\n5\t5');
  assert.equal(r.questions.length, 1);
  assert.equal(r.questions[0].valid, 5);
  assert.equal(r.questions[0].average, '5.00');
});

test('tally: 유효 / 빈 응답 / 제외 구분', () => {
  const text = [
    '번호\tQ1',
    '1\t5',
    '2\t 3 ',
    '3\t',
    '4\t   ',
    '5\t0',
    '6\t6',
    '7\tabc',
    '8\t3.5'
  ].join('\n');
  assert.deepEqual(plain(tally(text).questions), [
    { name: 'Q1', valid: 2, average: '4.00', blank: 2, excluded: 4 }
  ]);
});

test('tally: 칸이 모자란 줄은 모자란 칸을 빈 응답으로 센다', () => {
  const text = [
    '번호\tQ1\tQ2\tQ3',
    '1\t5\t4\t3',
    '2\t2',
    '3',
    '4\t1\t\t'
  ].join('\n');
  assert.deepEqual(plain(tally(text)), {
    respondents: 4,
    questions: [
      { name: 'Q1', valid: 3, average: '2.67', blank: 1, excluded: 0 },
      { name: 'Q2', valid: 1, average: '4.00', blank: 3, excluded: 0 },
      { name: 'Q3', valid: 1, average: '3.00', blank: 3, excluded: 0 }
    ]
  });
});

test('tally: 머리글보다 넘치는 칸은 무시한다', () => {
  const r = tally('번호\tQ1\n1\t5\t1\t1\t1\n2\t3');
  assert.equal(r.questions.length, 1);
  assert.deepEqual(plain(r.questions[0]), { name: 'Q1', valid: 2, average: '4.00', blank: 0, excluded: 0 });
});

test('tally: 유효 응답이 없는 문항의 평균은 "-"', () => {
  const r = tally('번호\tQ1\tQ2\n1\t\tx\n2\t \t9');
  assert.deepEqual(plain(r.questions), [
    { name: 'Q1', valid: 0, average: '-', blank: 2, excluded: 0 },
    { name: 'Q2', valid: 0, average: '-', blank: 0, excluded: 2 }
  ]);
});

test('tally: 머리글만 있으면 응답자 0명, 문항마다 모두 0', () => {
  assert.deepEqual(plain(tally('번호\tQ1\tQ2')), {
    respondents: 0,
    questions: [
      { name: 'Q1', valid: 0, average: '-', blank: 0, excluded: 0 },
      { name: 'Q2', valid: 0, average: '-', blank: 0, excluded: 0 }
    ]
  });
});

test('tally: 모든 칸이 빈 줄은 건너뛰고, 응답번호만 있는 줄은 응답자로 센다', () => {
  const text = '번호\tQ1\n1\t5\n\n\t\n  \t  \n2\n';
  const r = tally(text);
  assert.equal(r.respondents, 2);
  assert.deepEqual(plain(r.questions[0]), { name: 'Q1', valid: 1, average: '5.00', blank: 1, excluded: 0 });
});

test('tally: 비어 있거나 문항 열이 없으면 문항 0개', () => {
  assert.deepEqual(plain(tally('')), { respondents: 0, questions: [] });
  assert.deepEqual(plain(tally('   \n\n')), { respondents: 0, questions: [] });
  assert.deepEqual(plain(tally('번호\n1\n2')), { respondents: 2, questions: [] });
});

test('tally: 엑셀 복사 형식(\\r\\n, 끝 줄바꿈, 따옴표 머리글)', () => {
  const text = '번호\t"문항 1\n(복수)"\t문항 2\r\n1\t5\t4\r\n2\t3\t\r\n';
  const r = tally(text);
  assert.equal(r.respondents, 2);
  assert.deepEqual(plain(r.questions), [
    { name: '문항 1\n(복수)', valid: 2, average: '4.00', blank: 0, excluded: 0 },
    { name: '문항 2', valid: 1, average: '4.00', blank: 1, excluded: 0 }
  ]);
});

test('tally: 머리글 이름의 앞뒤 공백은 지운다', () => {
  assert.equal(tally('번호\t  Q1  \n1\t3').questions[0].name, 'Q1');
});
