'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadDiet } = require('./load-diet');

const Diet = loadDiet();
const {
  FOODS, MEALS, CATEGORIES, findFood, foodsOf, targets, isValidWeight,
  newDay, setWeight, selectMeal, addFood, removeFood, clearMeal, completeMeal, reopenMeal,
  itemCount, mealTotals, dayTotals, compare
} = Diet;

// vm 안에서 만든 배열·객체는 prototype이 달라 deepStrictEqual이 실패하므로 JSON으로 맞춘다.
const plain = (v) => JSON.parse(JSON.stringify(v));

/** 음식을 차례로 담는다. 하나라도 거부되면(상태가 그대로면) 시험을 실패시킨다. */
function addAll(state, mealId, foodIds) {
  let s = state;
  for (const id of foodIds) {
    const next = addFood(s, mealId, id);
    assert.notEqual(next, s, `${id} 담기가 거부됨`);
    s = next;
  }
  return s;
}

/* ---------- 섭취 목표 ---------- */

test('목표: 60kg 기준 1750kcal / 탄수 210g / 단백질 120g / 지방 48g', () => {
  assert.deepEqual(plain(targets(60)), { bmr: 1329, tdee: 2060, kcal: 1750, carb: 210, protein: 120, fat: 48 });
});

test('목표: 다른 체중 (50kg, 70kg, 40kg, 120kg)', () => {
  assert.deepEqual(plain(targets(50)), { bmr: 1229, tdee: 1905, kcal: 1620, carb: 215, protein: 100, fat: 40 });
  assert.deepEqual(plain(targets(70)), { bmr: 1429, tdee: 2215, kcal: 1880, carb: 204, protein: 140, fat: 56 });
  const t40 = targets(40);
  assert.equal(t40.kcal, 1490);
  assert.equal(t40.protein, 80);
  assert.equal(t40.fat, 32);
  assert.equal(t40.carb, 221);
  const t120 = targets(120);
  assert.equal(t120.kcal, 2540);
  assert.equal(t120.protein, 240);
  assert.equal(t120.fat, 96);
  assert.equal(t120.carb, 179);
});

test('목표: 체중이 늘면 열량·단백질·지방도 늘어난다', () => {
  let prev = targets(40);
  for (let w = 41; w <= 120; w++) {
    const t = targets(w);
    assert.ok(t.kcal >= prev.kcal, `${w}kg 열량`);
    assert.ok(t.protein > prev.protein, `${w}kg 단백질`);
    assert.ok(t.fat >= prev.fat, `${w}kg 지방`);
    prev = t;
  }
});

test('목표: 탄수화물은 남는 열량으로 채우고 음수가 되지 않는다', () => {
  for (let w = 40; w <= 120; w += 0.5) {
    const t = targets(w);
    assert.ok(t.carb > 0, `${w}kg 탄수화물`);
    const fromMacros = 4 * t.carb + 4 * t.protein + 9 * t.fat;
    assert.ok(Math.abs(fromMacros - t.kcal) <= 10, `${w}kg: 열량 ${t.kcal} vs 탄단지 ${fromMacros}`);
  }
});

test('목표: 단백질은 체중 1kg당 2.0g, 지방은 0.8g', () => {
  for (const w of [45, 55, 60, 63.5, 80]) {
    const t = targets(w);
    assert.equal(t.protein, Math.round(2 * w));
    assert.equal(t.fat, Math.round(0.8 * w));
  }
});

test('목표: 소비량보다 적게 먹는 목표(감량)이고 소비량의 약 85%', () => {
  const t = targets(60);
  assert.ok(t.kcal < t.tdee);
  assert.ok(Math.abs(t.kcal / t.tdee - 0.85) < 0.01);
});

test('목표: 범위(40~120kg) 밖이거나 숫자가 아니면 null', () => {
  for (const bad of [39.9, 120.1, 0, -5, NaN, Infinity, '60', null, undefined, {}]) {
    assert.equal(targets(bad), null, String(bad));
    assert.equal(isValidWeight(bad), false, String(bad));
  }
  assert.ok(targets(40) && targets(120));
});

/* ---------- 음식 데이터 ---------- */

test('음식: 요청한 음식이 모두 있고 1회 제공량이 맞다', () => {
  const byName = (name) => FOODS.find((f) => f.name === name);
  const expectServing = {
    '구운란': /1개/,
    '구운란 흰자': /./,
    '요거트': /80g/,
    '하루견과': /1봉/,
    '단백질음료': /단백질 20g/,
    '연어초밥': /1피스/,
    '불닭볶음면 소컵': /소컵|1컵/,
    '진라면 소컵': /1컵/,
    '후레쉬베리': /28g/,
    '현미밥': /130g/,
    '삼겹살': /100g/,
    '안심돈가스': /./,
    '쌀국수': /1그릇/,
    '미니단호박(1/4)': /70g/,
    '미니단호박(1/2)': /140g/,
    '맛김': /4g/,
    '귤': /1개/,
    '고단백스트링치즈': /20g/,
    '김치': /./,
    '초코 휘낭시에': /1개/,
    '초콜릿': /1조각/
  };
  for (const [name, serving] of Object.entries(expectServing)) {
    const food = byName(name);
    assert.ok(food, `${name} 없음`);
    assert.match(food.serving, serving, name);
  }
  assert.equal(byName('단백질음료').protein, 20);
});

test('음식: 기본 식재료도 있다 (닭가슴살, 밥, 고구마, 두부 등)', () => {
  for (const name of ['닭가슴살', '현미밥', '고구마', '두부', '브로콜리', '바나나', '오트밀', '우유', '아보카도']) {
    assert.ok(FOODS.some((f) => f.name === name), name);
  }
  assert.ok(FOODS.length >= 15);
});

test('음식: 아이디·이름이 겹치지 않고 모두 종류가 있다', () => {
  assert.equal(new Set(FOODS.map((f) => f.id)).size, FOODS.length);
  assert.equal(new Set(FOODS.map((f) => f.name)).size, FOODS.length);
  const categoryIds = CATEGORIES.map((c) => c.id);
  for (const food of FOODS) {
    assert.ok(categoryIds.includes(food.category), food.id);
    assert.ok(food.emoji.length > 0 && food.name.length > 0 && food.serving.length > 0, food.id);
  }
  for (const cat of CATEGORIES) assert.ok(foodsOf(cat.id).length >= 3, cat.id);
  assert.equal(CATEGORIES.reduce((n, c) => n + foodsOf(c.id).length, 0), FOODS.length);
});

test('음식: 영양값은 0 이상의 숫자이고 열량이 탄단지와 크게 어긋나지 않는다', () => {
  for (const food of FOODS) {
    for (const key of ['kcal', 'carb', 'protein', 'fat']) {
      assert.ok(typeof food[key] === 'number' && isFinite(food[key]) && food[key] >= 0, `${food.id}.${key}`);
    }
    assert.ok(food.kcal > 0, food.id);
    const fromMacros = 4 * food.carb + 4 * food.protein + 9 * food.fat;
    const allowed = Math.max(15, food.kcal * 0.15); // 식이섬유가 많은 채소 등은 여유를 둔다
    assert.ok(Math.abs(fromMacros - food.kcal) <= allowed, `${food.id}: 열량 ${food.kcal} vs 탄단지 환산 ${fromMacros}`);
  }
});

test('음식: 조사한 제품값 (불닭볶음면 소컵 280kcal, 구운란 73kcal, 하루견과 110kcal)', () => {
  assert.deepEqual(plain(findFood('buldak-cup')), plain(FOODS.find((f) => f.id === 'buldak-cup')));
  assert.equal(findFood('buldak-cup').kcal, 280);
  assert.equal(findFood('buldak-cup').carb, 42);
  assert.equal(findFood('egg-baked').kcal, 73);
  assert.equal(findFood('nuts').kcal, 110);
  assert.equal(findFood('nope'), null);
});

/* ---------- 새 하루·체중·볼 선택 ---------- */

test('새 하루: 60kg, 점심이 선택됨, 세 볼 모두 비어 있고 완성 전', () => {
  const s = newDay();
  assert.equal(s.weight, 60);
  assert.equal(s.active, 'lunch');
  assert.deepEqual(plain(MEALS.map((m) => m.id)), ['lunch', 'snack', 'dinner']);
  assert.deepEqual(plain(MEALS.map((m) => m.name)), ['점심', '간식', '저녁']);
  for (const m of MEALS) {
    assert.deepEqual(plain(s.meals[m.id]), { items: {}, done: false });
  }
  assert.equal(newDay(55).weight, 55);
  assert.equal(newDay(999).weight, 60);
  assert.equal(newDay('x').weight, 60);
});

test('체중 바꾸기: 올바른 값만 받는다', () => {
  const s = newDay();
  assert.equal(setWeight(s, 52.5).weight, 52.5);
  for (const bad of [10, 200, NaN, '60', null]) assert.equal(setWeight(s, bad), s, String(bad));
});

test('볼 선택: 점심·간식·저녁만 선택할 수 있다', () => {
  const s = newDay();
  assert.equal(selectMeal(s, 'dinner').active, 'dinner');
  assert.equal(selectMeal(s, 'breakfast'), s);
  assert.equal(selectMeal(s, undefined), s);
});

/* ---------- 담기·빼기·비우기 ---------- */

test('담기: 같은 음식을 여러 번 담으면 개수가 늘어난다(중복 가능)', () => {
  let s = newDay();
  s = addAll(s, 'lunch', ['egg-baked', 'egg-baked', 'rice', 'egg-baked']);
  assert.deepEqual(plain(s.meals.lunch.items), { 'egg-baked': 3, rice: 1 });
  assert.equal(itemCount(s.meals.lunch), 4);
  assert.equal(s.meals.lunch.done, false);
});

test('담기: 모든 음식을 어느 볼에든 담을 수 있다', () => {
  for (const meal of MEALS) {
    let s = newDay();
    for (const food of FOODS) s = addFood(s, meal.id, food.id);
    assert.equal(Object.keys(s.meals[meal.id].items).length, FOODS.length, meal.id);
  }
});

test('담기: 모르는 음식·볼은 무시하고 상태를 그대로 돌려준다', () => {
  const s = newDay();
  assert.equal(addFood(s, 'lunch', 'nope'), s);
  assert.equal(addFood(s, 'lunch', undefined), s);
  assert.equal(addFood(s, 'breakfast', 'rice'), s);
});

test('담기: 한 볼에 담아도 다른 볼은 그대로', () => {
  const s = addFood(newDay(), 'snack', 'nuts');
  assert.deepEqual(plain(s.meals.snack.items), { nuts: 1 });
  assert.deepEqual(plain(s.meals.lunch.items), {});
  assert.deepEqual(plain(s.meals.dinner.items), {});
});

test('담기: 이전 상태를 바꾸지 않는다', () => {
  const s0 = newDay();
  const s1 = addFood(s0, 'lunch', 'rice');
  const s2 = addFood(s1, 'lunch', 'rice');
  assert.deepEqual(plain(s0.meals.lunch.items), {});
  assert.deepEqual(plain(s1.meals.lunch.items), { rice: 1 });
  assert.deepEqual(plain(s2.meals.lunch.items), { rice: 2 });
  assert.notEqual(s1.meals.lunch.items, s2.meals.lunch.items);
});

test('빼기: 1회 제공량씩 빼고 0이 되면 목록에서 없앤다', () => {
  let s = addAll(newDay(), 'dinner', ['tofu', 'tofu', 'salad']);
  s = removeFood(s, 'dinner', 'tofu');
  assert.deepEqual(plain(s.meals.dinner.items), { tofu: 1, salad: 1 });
  s = removeFood(s, 'dinner', 'tofu');
  assert.deepEqual(plain(s.meals.dinner.items), { salad: 1 });
});

test('빼기: 없는 음식이나 모르는 볼은 그대로', () => {
  const s = addFood(newDay(), 'lunch', 'rice');
  assert.equal(removeFood(s, 'lunch', 'tofu'), s);
  assert.equal(removeFood(s, 'breakfast', 'rice'), s);
  assert.equal(removeFood(newDay(), 'lunch', 'rice').meals.lunch.items.rice, undefined);
});

test('비우기: 볼을 비운다. 빈 볼은 그대로', () => {
  const s = addAll(newDay(), 'lunch', ['rice', 'chicken']);
  const cleared = clearMeal(s, 'lunch');
  assert.deepEqual(plain(cleared.meals.lunch), { items: {}, done: false });
  assert.equal(clearMeal(cleared, 'lunch'), cleared);
  assert.equal(clearMeal(s, 'breakfast'), s);
});

/* ---------- 완성·다시 담기 ---------- */

test('완성: 음식이 없으면 완성할 수 없다', () => {
  const s = newDay();
  assert.equal(completeMeal(s, 'lunch'), s);
  assert.equal(completeMeal(s, 'nope'), s);
});

test('완성: 완성하면 볼이 잠기고 더 담거나 빼거나 비울 수 없다', () => {
  let s = addAll(newDay(), 'lunch', ['rice', 'chicken']);
  s = completeMeal(s, 'lunch');
  assert.equal(s.meals.lunch.done, true);
  assert.deepEqual(plain(s.meals.lunch.items), { rice: 1, chicken: 1 });
  assert.equal(addFood(s, 'lunch', 'tofu'), s);
  assert.equal(removeFood(s, 'lunch', 'rice'), s);
  assert.equal(clearMeal(s, 'lunch'), s);
  assert.equal(completeMeal(s, 'lunch'), s, '이미 완성한 볼');
});

test('완성: 선택된 볼이 다음 빈 볼로 넘어간다', () => {
  let s = addAll(newDay(), 'lunch', ['rice']);
  s = completeMeal(s, 'lunch');
  assert.equal(s.active, 'snack');
  s = addAll(s, 'dinner', ['salad']);
  s = completeMeal(s, 'dinner');
  assert.equal(s.active, 'snack', '저녁 다음은 점심(완성됨)을 건너뛰어 간식');
  s = addAll(s, 'snack', ['nuts']);
  s = completeMeal(s, 'snack');
  assert.equal(s.active, 'snack', '빈 볼이 없으면 그대로');
  for (const m of MEALS) assert.equal(s.meals[m.id].done, true);
});

test('다시 담기: 완성한 볼을 다시 열고, 그 볼이 선택된다', () => {
  let s = addAll(newDay(), 'lunch', ['rice', 'chicken']);
  s = completeMeal(s, 'lunch');
  const reopened = reopenMeal(s, 'lunch');
  assert.equal(reopened.meals.lunch.done, false);
  assert.deepEqual(plain(reopened.meals.lunch.items), { rice: 1, chicken: 1 });
  assert.equal(reopened.active, 'lunch');
  assert.equal(addFood(reopened, 'lunch', 'tofu').meals.lunch.items.tofu, 1);
  assert.equal(reopenMeal(reopened, 'lunch'), reopened, '완성 전 볼은 그대로');
  assert.equal(reopenMeal(s, 'nope'), s);
});

test('완성: 이전 상태를 바꾸지 않는다', () => {
  const before = addFood(newDay(), 'lunch', 'rice');
  const after = completeMeal(before, 'lunch');
  assert.equal(before.meals.lunch.done, false);
  assert.equal(before.active, 'lunch');
  assert.equal(after.meals.lunch.done, true);
});

/* ---------- 계산 ---------- */

const LUNCH = ['rice', 'chicken', 'chicken', 'broccoli'];   // 현미밥 + 닭가슴살 ×2 + 브로콜리
const SNACK = ['egg-baked', 'egg-baked', 'nuts'];            // 구운란 ×2 + 하루견과

test('볼 합계: 음식 값의 합 (열량 정수, 탄단지 소수 첫째 자리)', () => {
  const s = addAll(newDay(), 'lunch', LUNCH);
  assert.deepEqual(plain(mealTotals(s.meals.lunch)), { kcal: 559, carb: 50, protein: 68.8, fat: 9 });
  const s2 = addAll(newDay(), 'snack', SNACK);
  assert.deepEqual(plain(mealTotals(s2.meals.snack)), { kcal: 256, carb: 8.8, protein: 15.6, fat: 18 });
});

test('볼 합계: 빈 볼은 모두 0', () => {
  assert.deepEqual(plain(mealTotals(newDay().meals.lunch)), { kcal: 0, carb: 0, protein: 0, fat: 0 });
});

test('볼 합계: 소수 오차가 없다 (0.1g 단위를 여러 번 더해도)', () => {
  let s = newDay();
  for (let i = 0; i < 3; i++) s = addFood(s, 'lunch', 'egg-white');   // 지방 0.1 × 3
  assert.equal(mealTotals(s.meals.lunch).fat, 0.3);
  for (let i = 0; i < 10; i++) s = addFood(s, 'snack', 'chocolate'); // 탄수 4.6 × 10
  assert.deepEqual(plain(mealTotals(s.meals.snack)), { kcal: 600, carb: 46, protein: 8, fat: 43 });
  let t = newDay();
  for (let i = 0; i < 7; i++) t = addFood(t, 'dinner', 'kimchi');    // 탄수 1.7 × 7, 지방 0.1 × 7
  assert.equal(mealTotals(t.meals.dinner).carb, 11.9);
  assert.equal(mealTotals(t.meals.dinner).fat, 0.7);
});

test('볼 합계: 서로 다른 모든 음식을 한 번씩 담으면 음식 값 전체의 합', () => {
  let s = newDay();
  for (const f of FOODS) s = addFood(s, 'lunch', f.id);
  const t = mealTotals(s.meals.lunch);
  const sum = (key) => Math.round(FOODS.reduce((n, f) => n + f[key] * 10, 0)) / 10;
  assert.equal(t.kcal, Math.round(FOODS.reduce((n, f) => n + f.kcal, 0)));
  assert.equal(t.carb, sum('carb'));
  assert.equal(t.protein, sum('protein'));
  assert.equal(t.fat, sum('fat'));
});

test('하루 합계: 완성한 볼만 더한다', () => {
  let s = addAll(newDay(), 'lunch', LUNCH);
  s = addAll(s, 'snack', SNACK);
  assert.deepEqual(plain(dayTotals(s)), { kcal: 0, carb: 0, protein: 0, fat: 0, meals: 0 });
  s = completeMeal(s, 'lunch');
  assert.deepEqual(plain(dayTotals(s)), { kcal: 559, carb: 50, protein: 68.8, fat: 9, meals: 1 });
  s = completeMeal(s, 'snack');
  assert.deepEqual(plain(dayTotals(s)), { kcal: 815, carb: 58.8, protein: 84.4, fat: 27, meals: 2 });
  s = reopenMeal(s, 'lunch');
  assert.deepEqual(plain(dayTotals(s)), { kcal: 256, carb: 8.8, protein: 15.6, fat: 18, meals: 1 });
});

test('목표 비교: 남은 양과 퍼센트 (60kg 목표)', () => {
  let s = addAll(newDay(), 'lunch', LUNCH);
  s = addAll(s, 'snack', SNACK);
  s = completeMeal(completeMeal(s, 'lunch'), 'snack');
  const c = compare(dayTotals(s), targets(60));
  assert.deepEqual(plain(c), {
    kcal: { value: 815, target: 1750, percent: 47, remaining: 935 },
    carb: { value: 58.8, target: 210, percent: 28, remaining: 151.2 },
    protein: { value: 84.4, target: 120, percent: 70, remaining: 35.6 },
    fat: { value: 27, target: 48, percent: 56, remaining: 21 }
  });
});

test('목표 비교: 목표를 넘으면 남은 양이 음수(초과량)', () => {
  let s = newDay();
  for (let i = 0; i < 10; i++) s = addFood(s, 'dinner', 'rice'); // 1950kcal
  s = completeMeal(s, 'dinner');
  const c = compare(dayTotals(s), targets(60));
  assert.equal(c.kcal.value, 1950);
  assert.equal(c.kcal.remaining, -200);
  assert.equal(c.kcal.percent, 111);
  assert.ok(c.carb.remaining < 0);
});

test('목표 비교: 아무것도 완성하지 않았으면 0%', () => {
  const c = compare(dayTotals(newDay()), targets(60));
  assert.equal(c.kcal.percent, 0);
  assert.equal(c.kcal.remaining, 1750);
  assert.equal(c.protein.remaining, 120);
});
