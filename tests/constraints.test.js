'use strict';
// 요구사항 중 "하지 않는 것"을 지키는지 점검한다. 게임 페이지마다 똑같이 확인한다:
// 외부 라이브러리·외부 글꼴·분석 도구 없음, 데이터를 밖으로 보내거나 저장하지 않음.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { readPage, extractBlock } = require('./load-logic');

const ROOT = path.join(__dirname, '..');

// 점검할 페이지. logicBlocks는 화면을 쓰지 않아야 하는 순수 블록들이다.
const PAGES = [
  { label: '오목', file: 'index.html', logicBlocks: ['omok-logic'] },
  { label: '옷입히기', file: 'dress-up/index.html', logicBlocks: ['outfit-logic', 'dress-art'] }
];

// SVG를 만들 때 필요한 이름표(네임스페이스). 인터넷 주소처럼 생겼지만 어디에도 접속하지 않는
// 고정된 식별자라서, 이 한 가지 문자열만 외부 주소 점검에서 뺀다.
const SVG_NAMESPACE = 'http://www.w3.org/2000/svg';

test('저장소 맨 위에 빈 .nojekyll이 있다', () => {
  const p = path.join(ROOT, '.nojekyll');
  assert.ok(fs.existsSync(p), '.nojekyll 없음');
  assert.equal(fs.statSync(p).size, 0, '.nojekyll은 비어 있어야 한다');
});

for (const page of PAGES) {
  const html = readPage(page.file);
  // 주석을 지운 사본. 설명 글에 금지어가 들어 있어도 잡히지 않게 한다.
  const code = html.replace(/<!--[\s\S]*?-->/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
  const codeWithoutNs = code.split(SVG_NAMESPACE).join('');
  const t = (name, fn) => test(`[${page.label}] ${name}`, fn);

  t('외부 파일을 불러오지 않는다 (script src, link, img, iframe, @import, url())', () => {
    assert.doesNotMatch(code, /<script[^>]*\ssrc\s*=/i, '외부 스크립트');
    assert.doesNotMatch(code, /<link\b/i, '<link> (스타일시트·글꼴 포함)');
    assert.doesNotMatch(code, /<(img|iframe|embed|object|audio|video|source|frame)\b/i, '외부 자원 태그');
    assert.doesNotMatch(code, /@import/i, '@import');
    assert.doesNotMatch(code, /@font-face/i, '@font-face');
    assert.doesNotMatch(code, /url\s*\(/i, 'CSS url()');
    assert.doesNotMatch(codeWithoutNs, /\b(src|href|action)\s*=\s*["']?\s*(https?:)?\/\//i, '외부 주소 속성');
  });

  t('외부 주소 문자열이 없다 (SVG 이름표 하나만 예외)', () => {
    assert.doesNotMatch(codeWithoutNs, /https?:\/\//i);
    // 예외로 둔 이름표는 SVG 도형을 만드는 데에만 쓰인다
    const uses = code.split(SVG_NAMESPACE).length - 1;
    if (uses > 0) assert.match(code, /createElementNS\s*\(\s*SVG_NS/);
  });

  t('외부 글꼴은 없고 시스템 글꼴만 쓴다', () => {
    const families = [...code.matchAll(/font-family\s*:\s*([^;}]+)/gi)].map((m) => m[1]);
    assert.ok(families.length > 0, 'font-family 지정이 있어야 한다');
    for (const f of families) {
      assert.match(f, /system-ui|monospace|sans-serif/i, f);
    }
  });

  t('분석 도구·추적 코드가 없다', () => {
    assert.doesNotMatch(code, /google-analytics|googletagmanager|gtag\s*\(|dataLayer|fbq\s*\(|_gaq|mixpanel|segment\.|hotjar|clarity\.ms/i);
  });

  t('데이터를 보내는 API를 쓰지 않는다', () => {
    assert.doesNotMatch(code, /\bfetch\s*\(/);
    assert.doesNotMatch(code, /XMLHttpRequest/);
    assert.doesNotMatch(code, /sendBeacon/);
    assert.doesNotMatch(code, /WebSocket|EventSource/);
    assert.doesNotMatch(code, /new\s+Image\s*\(/);
    assert.doesNotMatch(code, /postMessage/);
    assert.doesNotMatch(code, /window\.open|location\s*(\.href)?\s*=|navigator\.(share|clipboard)/);
    assert.doesNotMatch(code, /<form\b/i, '<form>은 제출될 수 있으므로 쓰지 않는다');
  });

  t('데이터를 저장하는 API를 쓰지 않는다', () => {
    assert.doesNotMatch(code, /localStorage|sessionStorage|indexedDB|openDatabase|document\.cookie|caches\b|serviceWorker|FileSystem|showSaveFilePicker/);
    assert.doesNotMatch(code, /<a\b[^>]*\sdownload\b/i);
    assert.doesNotMatch(code, /Blob\s*\(|createObjectURL/);
  });

  t('eval·동적 코드 실행을 쓰지 않는다', () => {
    assert.doesNotMatch(code, /\beval\s*\(|new\s+Function\s*\(|setTimeout\s*\(\s*["'`]|document\.write/);
  });

  t('화면은 textContent·createElement로만 그린다 (innerHTML 금지)', () => {
    assert.doesNotMatch(code, /innerHTML|outerHTML|insertAdjacentHTML/);
  });

  t('외부 연결을 막는 CSP가 있다', () => {
    const m = html.match(/<meta\s+http-equiv="Content-Security-Policy"\s+content="([^"]*)"/i);
    assert.ok(m, 'CSP meta 없음');
    const csp = m[1];
    assert.match(csp, /default-src\s+'none'/, "default-src 'none'");
    assert.match(csp, /form-action\s+'none'/);
    assert.match(csp, /base-uri\s+'none'/);
    // 연결·글꼴·이미지를 허용하는 지시어를 따로 열어 두지 않았는지
    assert.doesNotMatch(csp, /connect-src|font-src|img-src|frame-src|media-src|object-src/);
    // 허용된 지시어에 외부 출처가 들어 있지 않은지
    assert.doesNotMatch(csp, /https?:|\*|data:|blob:|ws:|wss:/);
  });

  t('순수 블록(규칙·그림 데이터)은 화면·브라우저 요소를 쓰지 않는다', () => {
    for (const id of page.logicBlocks) {
      const block = extractBlock(html, id, page.file)
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/\/\/.*$/gm, '');
      assert.doesNotMatch(block, /\b(document|window|navigator|location|alert|prompt|confirm|console)\b/, id);
      assert.doesNotMatch(block, /\b(addEventListener|getElementById|querySelector|createElement|createElementNS)\b/, id);
    }
  });

  t('한 파일만 쓴다 (script/link로 다른 파일을 부르지 않는다)', () => {
    const scripts = [...code.matchAll(/<script\b([^>]*)>/gi)].map((m) => m[1]);
    assert.ok(scripts.length >= 2);
    for (const attrs of scripts) assert.doesNotMatch(attrs, /\bsrc\b/i);
  });
}
