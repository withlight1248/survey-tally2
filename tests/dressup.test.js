'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadDressUp } = require('./load-dressup');

const { Outfit, DressArt } = loadDressUp();
const { CATEGORIES, ITEMS, emptyOutfit, wear, describe, findItem, itemsOf } = Outfit;

// vm 안에서 만든 배열·객체는 prototype이 달라 deepStrictEqual이 실패하므로 JSON으로 맞춘다.
const plain = (v) => JSON.parse(JSON.stringify(v));

/* ---------- 옷 목록 ---------- */

test('옷 목록: 종류는 드레스·상의·하의 세 가지', () => {
  assert.deepEqual(plain(CATEGORIES.map((c) => c.id)), ['dress', 'top', 'bottom']);
  assert.deepEqual(plain(CATEGORIES.map((c) => c.name)), ['드레스', '상의', '하의']);
});

test('옷 목록: 12벌, 종류마다 4벌, 아이디와 이름이 겹치지 않는다', () => {
  assert.equal(ITEMS.length, 12);
  for (const cat of CATEGORIES) assert.equal(itemsOf(cat.id).length, 4, cat.id);
  assert.equal(new Set(ITEMS.map((i) => i.id)).size, 12);
  assert.equal(new Set(ITEMS.map((i) => i.name)).size, 12);
  for (const item of ITEMS) {
    assert.ok(CATEGORIES.some((c) => c.id === item.category), item.id);
    assert.ok(item.id.startsWith(item.category + '-'), `${item.id}는 종류 이름으로 시작해야 한다`);
    assert.ok(item.name.trim().length > 0);
  }
});

test('findItem: 아이디로 찾고, 없으면 null', () => {
  assert.equal(findItem('top-white').name, '흰 티셔츠');
  assert.equal(findItem('nope'), null);
  assert.equal(findItem(undefined), null);
});

/* ---------- 입기·벗기 규칙 ---------- */

test('기본 상태는 아무것도 안 입은 차림', () => {
  assert.deepEqual(plain(emptyOutfit()), { dress: null, top: null, bottom: null });
  assert.equal(describe(emptyOutfit()), '기본 차림');
});

test('상의와 하의는 함께 입을 수 있다', () => {
  let o = emptyOutfit();
  o = wear(o, 'top-white');
  o = wear(o, 'bottom-jeans');
  assert.deepEqual(plain(o), { dress: null, top: 'top-white', bottom: 'bottom-jeans' });
});

test('드레스를 입으면 상의와 하의가 벗겨진다', () => {
  let o = wear(wear(emptyOutfit(), 'top-pink'), 'bottom-red');
  o = wear(o, 'dress-blue');
  assert.deepEqual(plain(o), { dress: 'dress-blue', top: null, bottom: null });
});

test('상의를 입으면 드레스가 벗겨진다', () => {
  const o = wear(wear(emptyOutfit(), 'dress-pink'), 'top-yellow');
  assert.deepEqual(plain(o), { dress: null, top: 'top-yellow', bottom: null });
});

test('하의를 입으면 드레스가 벗겨진다', () => {
  const o = wear(wear(emptyOutfit(), 'dress-pink'), 'bottom-shorts');
  assert.deepEqual(plain(o), { dress: null, top: null, bottom: 'bottom-shorts' });
});

test('상의를 입은 채 하의를 입어도 상의는 그대로', () => {
  const o = wear(wear(emptyOutfit(), 'top-blue'), 'bottom-pleat');
  assert.equal(o.top, 'top-blue');
  assert.equal(o.bottom, 'bottom-pleat');
});

test('입은 옷을 다시 누르면 벗는다', () => {
  for (const item of ITEMS) {
    const worn = wear(emptyOutfit(), item.id);
    assert.equal(worn[item.category], item.id, item.id);
    const off = wear(worn, item.id);
    assert.deepEqual(plain(off), plain(emptyOutfit()), item.id);
  }
});

test('같은 종류의 다른 옷을 고르면 바뀐다', () => {
  let o = wear(emptyOutfit(), 'top-white');
  o = wear(o, 'top-pink');
  assert.equal(o.top, 'top-pink');
  o = wear(o, 'dress-pink');
  o = wear(o, 'dress-purple');
  assert.equal(o.dress, 'dress-purple');
});

test('상의를 벗어도 하의는 그대로', () => {
  let o = wear(wear(emptyOutfit(), 'top-white'), 'bottom-red');
  o = wear(o, 'top-white');
  assert.deepEqual(plain(o), { dress: null, top: null, bottom: 'bottom-red' });
});

test('모르는 아이디는 무시하고 원래 상태를 돌려준다', () => {
  const o = wear(emptyOutfit(), 'top-white');
  for (const bad of ['nope', '', undefined, null, 5, 'top']) {
    assert.equal(wear(o, bad), o, String(bad));
  }
});

test('입히기는 이전 상태를 바꾸지 않는다', () => {
  const o0 = emptyOutfit();
  const o1 = wear(o0, 'top-white');
  const o2 = wear(o1, 'dress-pink');
  assert.deepEqual(plain(o0), { dress: null, top: null, bottom: null });
  assert.deepEqual(plain(o1), { dress: null, top: 'top-white', bottom: null });
  assert.deepEqual(plain(o2), { dress: 'dress-pink', top: null, bottom: null });
});

test('describe: 입은 옷 이름을 드레스·상의·하의 순으로', () => {
  assert.equal(describe(wear(emptyOutfit(), 'dress-pink')), '분홍 원피스');
  const o = wear(wear(emptyOutfit(), 'bottom-jeans'), 'top-white');
  assert.equal(describe(o), '흰 티셔츠, 청바지');
});

/* ---------- 그림 데이터 ---------- */

const ALLOWED_TAGS = new Set(['path', 'line', 'circle', 'ellipse', 'rect']);
const ALLOWED_ATTRS = new Set([
  'd', 'fill', 'stroke', 'stroke-width', 'stroke-linejoin', 'stroke-linecap',
  'x1', 'y1', 'x2', 'y2', 'cx', 'cy', 'r', 'rx', 'ry', 'x', 'y', 'width', 'height', 'opacity'
]);
const PATH_D = /^[MLHVQZ0-9 .,-]+$/;

function allShapes() {
  const list = [];
  for (const [part, shapes] of Object.entries(DressArt.character)) {
    shapes.forEach((s, i) => list.push([`character.${part}[${i}]`, s]));
  }
  for (const [id, shapes] of Object.entries(DressArt.garments)) {
    shapes.forEach((s, i) => list.push([`${id}[${i}]`, s]));
  }
  return list;
}

test('그림: 모든 옷에 그림이 있고, 옷 목록에 없는 그림은 없다', () => {
  const ids = plain(ITEMS.map((i) => i.id)).sort();
  assert.deepEqual(plain(Object.keys(DressArt.garments)).sort(), ids);
  for (const id of ids) assert.ok(DressArt.garments[id].length > 0, id);
});

test('그림: 캐릭터는 머리카락·몸·속옷·머리·앞머리로 이루어진다', () => {
  assert.deepEqual(
    plain(Object.keys(DressArt.character)),
    ['hairBack', 'body', 'under', 'head', 'hairFront']
  );
});

test('그림: 허용한 도형 태그와 속성만 쓴다', () => {
  for (const [where, shape] of allShapes()) {
    assert.ok(Array.isArray(shape) && shape.length === 2, where);
    const [tag, attrs] = shape;
    assert.ok(ALLOWED_TAGS.has(tag), `${where}: 허용하지 않은 태그 ${tag}`);
    for (const [name, value] of Object.entries(attrs)) {
      assert.ok(ALLOWED_ATTRS.has(name), `${where}: 허용하지 않은 속성 ${name}`);
      assert.doesNotMatch(String(value), /url\s*\(|https?:|javascript:|data:/i, `${where}.${name}`);
    }
  }
});

test('그림: 경로는 직선·곡선 명령과 숫자만 쓴다', () => {
  for (const [where, [tag, attrs]] of allShapes()) {
    if (tag !== 'path') continue;
    assert.match(attrs.d, PATH_D, `${where}: ${attrs.d}`);
  }
});

test('그림: 좌표가 그림판(300×520) 안에 있다', () => {
  const [vbX, vbY, vbW, vbH] = DressArt.viewBox.split(' ').map(Number);
  assert.deepEqual([vbX, vbY, vbW, vbH], [0, 0, 300, 520]);
  for (const [where, [tag, attrs]] of allShapes()) {
    if (tag === 'path') {
      const nums = attrs.d.match(/-?\d+(\.\d+)?/g).map(Number);
      for (const n of nums) assert.ok(n >= 0 && n <= 520, `${where}: 좌표 ${n}`);
    } else if (tag === 'circle' || tag === 'ellipse') {
      const rx = tag === 'circle' ? attrs.r : attrs.rx;
      const ry = tag === 'circle' ? attrs.r : attrs.ry;
      assert.ok(attrs.cx - rx >= 0 && attrs.cx + rx <= 300, `${where}: x 범위`);
      assert.ok(attrs.cy - ry >= 0 && attrs.cy + ry <= 520, `${where}: y 범위`);
    } else if (tag === 'rect') {
      assert.ok(attrs.x >= 0 && attrs.x + attrs.width <= 300, `${where}: x 범위`);
      assert.ok(attrs.y >= 0 && attrs.y + attrs.height <= 520, `${where}: y 범위`);
    } else if (tag === 'line') {
      for (const k of ['x1', 'x2']) assert.ok(attrs[k] >= 0 && attrs[k] <= 300, `${where}: ${k}`);
      for (const k of ['y1', 'y2']) assert.ok(attrs[k] >= 0 && attrs[k] <= 520, `${where}: ${k}`);
    }
  }
});

test('그림: 진열대 미리보기 영역이 종류마다 있다', () => {
  for (const cat of CATEGORIES) {
    const box = DressArt.previewBox[cat.id];
    assert.match(box, /^\d+ \d+ \d+ \d+$/, cat.id);
    const [x, y, w, h] = box.split(' ').map(Number);
    assert.ok(w > 0 && h > 0 && x >= 0 && y >= 0 && x + w <= 300 && y + h <= 520, cat.id);
  }
});
