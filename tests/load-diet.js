'use strict';
// diet-bowl/index.html 안의 규칙 블록(diet-logic)을 화면 요소가 없는
// 빈 환경(vm)에서 실행해 Diet를 돌려준다.
const vm = require('node:vm');
const { readPage, extractBlock } = require('./load-logic');

const PAGE = 'diet-bowl/index.html';

function loadDiet() {
  const html = readPage(PAGE);
  const sandbox = {};
  vm.createContext(sandbox);
  vm.runInContext(extractBlock(html, 'diet-logic', PAGE), sandbox, { filename: 'diet-logic' });
  if (!sandbox.Diet) throw new Error('Diet가 만들어지지 않았다');
  return sandbox.Diet;
}

module.exports = { loadDiet, PAGE };
