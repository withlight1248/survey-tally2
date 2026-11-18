'use strict';
// index.html 안의 <script id="omok-logic"> 블록만 꺼내, 화면 요소가 없는
// 빈 환경(vm)에서 실행해 Omok을 돌려준다.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const INDEX_PATH = path.join(__dirname, '..', 'index.html');

function readIndexHtml() {
  return fs.readFileSync(INDEX_PATH, 'utf8');
}

function extractLogicSource(html) {
  const m = html.match(/<script id="omok-logic">([\s\S]*?)<\/script>/);
  if (!m) throw new Error('index.html에서 <script id="omok-logic"> 블록을 찾지 못했다');
  return m[1];
}

function loadLogic() {
  const sandbox = {};
  vm.createContext(sandbox);
  vm.runInContext(extractLogicSource(readIndexHtml()), sandbox, { filename: 'omok-logic' });
  if (!sandbox.Omok) throw new Error('Omok이 만들어지지 않았다');
  return sandbox.Omok;
}

module.exports = { loadLogic, readIndexHtml, extractLogicSource, INDEX_PATH };
