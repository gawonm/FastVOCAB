// Notion 품사 select 옵션(한글)에 맞춘 매핑. 없으면 '기타'.
const POS = {
  noun: '명사',
  verb: '동사',
  adjective: '형용사',
  adverb: '부사',
  preposition: '전치사',
  conjunction: '접속사',
  idiom: '숙어',
  phrase: '숙어',
  proverb: '숙어',
  'phrasal verb': '숙어',
};

const clean = (s = '') => s.replace(/\{[^}]*\}/g, '').replace(/\s+/g, ' ').trim();

// 중첩 구조 어디에 있든 첫 'text'(풀이) 또는 'vis'(예문) 항목을 찾는다
function findDt(node, tag) {
  if (!node || typeof node !== 'object') return '';
  if (Array.isArray(node) && node[0] === tag) {
    const v = tag === 'vis' ? node[1]?.[0]?.t : node[1];
    if (typeof v === 'string' && v) return clean(v);
  }
  for (const n of Object.values(node)) {
    const hit = findDt(n, tag);
    if (hit) return hit;
  }
  return '';
}

// Merriam-Webster Learner's 응답 -> { pos, en, example }. 못 찾으면 문자열 배열(추천어)이 오므로 null.
// 여러 단어(숙어)면 표제어가 아니라 entry의 dros(숙어 항목)에서 찾는다 — 못 찾으면 null로 다음 사전에 넘긴다.
export function parseLearners(json, query = '') {
  if (!Array.isArray(json)) return null;
  const entries = json.filter((x) => x && typeof x === 'object');
  if (query.includes(' ')) {
    const q = query.toLowerCase();
    for (const e of entries) {
      const dro = (e.dros ?? []).find((d) => d.drp?.replace(/\*/g, '').toLowerCase() === q);
      const en = dro && findDt(dro.def, 'text');
      if (en) return { pos: '숙어', en, example: findDt(dro.def, 'vis') };
    }
    const own = entries.find((e) => e.shortdef?.length && e.meta?.id?.split(':')[0].toLowerCase() === q);
    return own ? { pos: '숙어', en: clean(own.shortdef[0]), example: findDt(own.def, 'vis') } : null;
  }
  const e = entries.find((x) => x.shortdef?.length);
  if (!e) return null;
  return { pos: POS[e.fl] ?? '기타', en: clean(e.shortdef[0]), example: findDt(e.def, 'vis') };
}

// dictionaryapi.dev 응답 -> { pos, en, example }
export function parseEntry(json) {
  const meaning = json?.[0]?.meanings?.[0];
  const en = meaning?.definitions?.[0]?.definition;
  if (!en) return null;
  const example = json
    .flatMap((e) => e.meanings.flatMap((m) => m.definitions))
    .find((d) => d.example)?.example ?? '';
  return { pos: POS[meaning.partOfSpeech] ?? '기타', en, example };
}

// 온용어 정의의 &#44; 같은 숫자 엔티티·태그 정리
const decode = (s = '') =>
  s.replace(/&#(\d+);/g, (_, n) => String.fromCharCode(n)).replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();

// 온용어(K-term) 응답 -> { def, en, example }. 결과는 정확도순이므로 첫 번째 정의 있는 항목을 쓴다.
// 정의가 길면 <br> 앞 첫 문단만.
export function parseKterm(json) {
  const items = [].concat(json?.channel?.return_object ?? []).flatMap((o) => o?.resultlist ?? []);
  const item = items.find((i) => i.definition);
  if (!item) return null;
  return {
    def: decode(item.definition.split(/<br\s*\/?>/i)[0]),
    en: item.translation || item.origin || '',
    example: decode(item.use_ex),
  };
}

// 표준국어대사전 응답 -> { pos, def }. 응답 구조는 공식 문서로 미확인 — sense가 객체/배열 어느 쪽이든 받는다.
const KO_POS = ['명사', '동사', '형용사', '부사', '접속사'];
export function parseStdict(json) {
  for (const item of [].concat(json?.channel?.item ?? [])) {
    const def = [].concat(item.sense ?? [])[0]?.definition;
    if (def) return { pos: KO_POS.includes(item.pos) ? item.pos : '기타', def: def.replace(/<[^>]*>/g, '').trim() };
  }
  return null;
}

const strip = (html = '') => html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();

// Wiktionary REST 응답(HTML 포함) -> { pos, en, example }. dictionaryapi.dev 장애 시 폴백.
export function parseWiktionary(json) {
  for (const e of json?.en ?? []) {
    for (const d of e.definitions ?? []) {
      const en = strip(d.definition);
      if (!en) continue;
      return { pos: POS[e.partOfSpeech.toLowerCase()] ?? '기타', en, example: strip(d.examples?.[0]) };
    }
  }
  return null;
}
