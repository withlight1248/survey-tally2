'use strict';
// dress-up/index.html 안의 규칙 블록(outfit-logic)과 그림 데이터 블록(dress-art)을
// 화면 요소가 없는 빈 환경(vm)에서 실행해 Outfit, DressArt를 돌려준다.
const vm = require('node:vm');
const { readPage, extractBlock } = require('./load-logic');

const PAGE = 'dress-up/index.html';

function loadDressUp() {
  const html = readPage(PAGE);
  const sandbox = {};
  vm.createContext(sandbox);
  vm.runInContext(extractBlock(html, 'outfit-logic', PAGE), sandbox, { filename: 'outfit-logic' });
  vm.runInContext(extractBlock(html, 'dress-art', PAGE), sandbox, { filename: 'dress-art' });
  if (!sandbox.Outfit) throw new Error('Outfit이 만들어지지 않았다');
  if (!sandbox.DressArt) throw new Error('DressArt가 만들어지지 않았다');
  return { Outfit: sandbox.Outfit, DressArt: sandbox.DressArt };
}

module.exports = { loadDressUp, PAGE };
