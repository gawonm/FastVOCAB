const $ = (id) => document.getElementById(id);
const KEYS = ['token', 'dbId', 'mwKey', 'stdictKey', 'ktermKey'];

chrome.storage.local.get(KEYS).then((v) => KEYS.forEach((k) => ($(k).value = v[k] ?? '')));

// DB 주소를 통째로 붙여넣어도 32자리 ID만 뽑는다 (하이픈 포함 UUID 형식도 허용).
// 주소의 첫 ID가 DB이고 ?v= 뒤는 뷰 ID다. 'FastVOCAB-41af…'처럼 제목 끝 글자가 16진수일 수 있어 경계를 확인한다.
function toDbId(s) {
  const uuid = s.match(/(?<![0-9a-f])[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}(?![0-9a-f])/i);
  const hex = s.match(/(?<![0-9a-f])[0-9a-f]{32}(?![0-9a-f])/i);
  const pick = [uuid, hex].filter(Boolean).sort((a, b) => a.index - b.index)[0];
  return pick ? pick[0].replace(/-/g, '').toLowerCase() : s;
}

$('save').onclick = async () => {
  const v = Object.fromEntries(KEYS.map((k) => [k, $(k).value.trim()]));
  v.dbId = toDbId(v.dbId);
  $('dbId').value = v.dbId;
  await chrome.storage.local.set(v);
  const missing = !v.token || !v.dbId;
  $('msg').className = missing ? 'err' : '';
  $('msg').textContent = missing ? '저장됨 — Notion 토큰과 DB ID는 필수입니다' : '저장됨';
};
