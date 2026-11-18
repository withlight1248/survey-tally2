'use strict';
// index.html 안의 <script id="tally-logic"> 블록만 꺼내, 화면 요소가 없는
// 빈 환경(vm)에서 실행해 SurveyTally를 돌려준다.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const INDEX_PATH = path.join(__dirname, '..', 'index.html');

function readIndexHtml() {
  return fs.readFileSync(INDEX_PATH, 'utf8');
}

function extractLogicSource(html) {
  const m = html.match(/<script id="tally-logic">([\s\S]*?)<\/script>/);
  if (!m) throw new Error('index.html에서 <script id="tally-logic"> 블록을 찾지 못했다');
  return m[1];
}

function loadLogic() {
  const sandbox = {};
  vm.createContext(sandbox);
  vm.runInContext(extractLogicSource(readIndexHtml()), sandbox, { filename: 'tally-logic' });
  if (!sandbox.SurveyTally) throw new Error('SurveyTally가 만들어지지 않았다');
  return sandbox.SurveyTally;
}

module.exports = { loadLogic, readIndexHtml, extractLogicSource, INDEX_PATH };
