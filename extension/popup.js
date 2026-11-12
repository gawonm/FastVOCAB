const $ = (id) => document.getElementById(id);
const tabs = [...document.querySelectorAll('#tabs button')];
let word = '';
let url = '';
let current = null; // { category, word, entry } — 저장 가능한 미리보기
let seq = 0; // 분류를 빨리 바꿀 때 늦게 온 응답 무시
let saving = false;
let chosen = false; // 분류를 한 번이라도 골랐는지

function esc(s) {
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}

function render(r) {
  const e = r.entry;
  const rows = [
    e.ko && `<div class="lbl">뜻</div>${esc(e.ko)}`,
    e.en && `<div class="lbl">영어 뜻</div>${esc(e.en)}`,
    e.example && `<div class="lbl">예문</div><span class="ex">${esc(e.example)}</span>`,
  ].filter(Boolean);
  $('card').innerHTML =
    `<span class="pos">${esc(e.pos)}</span> <b>${esc(r.word)}</b>` +
    (rows.join('') || '<div class="lbl">사전에서 뜻을 찾지 못했습니다</div>') +
    (r.dup ? '<div class="lbl">⚠ 이미 단어장에 있는 단어입니다</div>' : '') +
    (r.warn ? `<div class="lbl">⚠ ${esc(r.warn)}</div>` : '');
}

async function select(category) {
  const mine = ++seq;
  chosen = true;
  tabs.forEach((b) => b.classList.toggle('on', b.dataset.cat === category));
  current = null;
  $('save').disabled = true;
  $('msg').textContent = '';
  $('card').textContent = '조회 중…';
  // 서비스 워커가 응답을 못 주는 경우에도 무한 로딩이 되지 않게 상한을 둔다
  const r = await Promise.race([
    chrome.runtime.sendMessage({ type: 'lookup', category, word }).catch((e) => ({ error: e.message })),
    new Promise((res) => setTimeout(() => res({ error: '응답 시간 초과 — 확장을 새로고침하고 다시 시도하세요' }), 45000)),
  ]);
  if (mine !== seq) return;
  if (r.error) {
    $('card').textContent = `✗ ${r.error}`;
    return;
  }
  render(r);
  current = { category, word: r.word, entry: r.entry };
  $('save').disabled = r.dup;
}

async function save() {
  if (!current || saving || $('save').disabled) return;
  saving = true;
  $('save').disabled = true;
  $('msg').textContent = '저장 중…';
  const r = await chrome.runtime
    .sendMessage({ type: 'save', url, ...current })
    .catch((e) => ({ error: e.message }));
  if (r.error) {
    $('msg').textContent = `✗ ${r.error}`;
    $('save').disabled = false;
    saving = false;
    return;
  }
  $('msg').textContent = r.status === 'partial' ? '△ 뜻 없이 저장됨' : '✓ 저장됨';
  setTimeout(window.close, 1000);
}

tabs.forEach((b) => (b.onclick = () => select(b.dataset.cat)));
$('save').onclick = save;

(async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  url = tab.url ?? '';
  // 양끝 공백·따옴표·구두점 제거 (PDF 복사본의 soft hyphen·줄바꿈도 정리)
  // NFKC로 합자(ﬁ→fi)를 풀고, 줄 끝 하이픈은 이어 붙이고, 유니코드 하이픈은 '-'로 통일한다
  const clean = (s = '') =>
    s
      .normalize('NFKC')
      .replace(/\u00ad/g, '')
      .replace(/[\u2010\u2011\u2012\u2013]/g, '-')
      .replace(/(\w)-\s*\n\s*(?=\w)/g, '$1')
      .trim()
      .replace(/\s+/g, ' ')
      .replace(/^[^a-zA-Z가-힣]+|[^a-zA-Z가-힣0-9]+$/g, '');
  let blocked = false; // PDF 뷰어·chrome:// 등 스크립트를 넣을 수 없는 페이지
  let viaClipboard = false;
  try {
    const [{ result }] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => getSelection().toString(),
    });
    word = clean(result);
  } catch {
    blocked = true;
  }
  if (blocked) {
    // 선택 영역을 읽을 수 없는 페이지(PDF 등)는 복사해 둔 텍스트를 쓴다.
    // 일반 페이지에서는 쓰지 않는다 (예전 클립보드 내용이 섞이는 것을 막기 위해).
    try {
      word = clean(await navigator.clipboard.readText());
      viaClipboard = !!word;
    } catch {}
    if (!word) {
      $('word').textContent = '이 페이지에서는 드래그를 읽을 수 없어요';
      $('card').textContent = 'PDF라면 단어를 드래그해 복사(Ctrl+C / ⌘C)한 뒤 다시 눌러 주세요';
      return;
    }
  }
  if (!word) {
    $('word').textContent = '(선택된 단어 없음)';
    $('card').textContent = '단어를 드래그한 뒤 다시 눌러 주세요';
    return;
  }
  $('word').textContent = viaClipboard ? `${word}  (복사한 텍스트)` : word;
  // 분류를 고른 뒤에야 조회한다. 힌트(한글이면 한-한, 아니면 일반)는 표시만 하고 Enter로 확정.
  const hint = tabs[/[가-힣]/.test(word) ? 2 : 0];
  hint.classList.add('hint');
  $('card').textContent = `분류를 선택하세요 (1·2·3, Enter = ${hint.dataset.cat})`;
  document.onkeydown = (e) => {
    if (e.key === 'Enter') chosen ? save() : select(hint.dataset.cat); // 조회 중 Enter는 save()가 무시
    else if (/^[123]$/.test(e.key)) select(tabs[e.key - 1].dataset.cat);
  };
})();
