import { parseEntry, parseKterm, parseLearners, parseStdict, parseWiktionary } from './dict.js';

const NOTION = 'https://api.notion.com/v1';

async function notion(path, token, body) {
  const res = await fetch(NOTION + path, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Notion-Version': '2022-06-28',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15000), // 응답 없이 멈추면 팝업이 무한 로딩되므로 모든 요청에 시간 제한
  });
  const json = await res.json();
  if (!res.ok) throw new Error(`Notion: ${json.message}`);
  return json;
}

// 실패(네트워크/4xx/5xx)는 모두 null — 호출 측에서 다음 소스로 넘어간다
async function getJson(url, parse = (j) => j) {
  const u = new URL(url);
  const where = u.origin + u.pathname; // 쿼리에 API 키가 있으므로 로그에는 넣지 않는다
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    const raw = await res.text();
    if (!res.ok) {
      console.warn('getJson HTTP', res.status, where, raw.slice(0, 200));
      return null;
    }
    const parsed = parse(JSON.parse(raw));
    if (parsed == null) console.warn('getJson 결과 없음(파싱은 성공)', where, raw.slice(0, 300));
    return parsed;
  } catch (e) {
    console.warn('getJson 실패', where, e.name, e.message);
    return null;
  }
}

// 일반: 1) Merriam-Webster Learner's(키 있을 때) 2) dictionaryapi.dev 3) Wiktionary
async function lookupGeneral(word, mwKey) {
  const w = encodeURIComponent(word);
  const wk = encodeURIComponent(word.replace(/ /g, '_')); // Wiktionary 문서 제목은 공백 대신 _
  const found =
    (mwKey &&
      (await getJson(
        `https://www.dictionaryapi.com/api/v3/references/learners/json/${w}?key=${encodeURIComponent(mwKey)}`,
        (j) => parseLearners(j, word),
      ))) ||
    (await getJson(`https://api.dictionaryapi.dev/api/v2/entries/en/${w}`, parseEntry)) ||
    (await getJson(`https://en.wiktionary.org/api/rest_v1/page/definition/${wk}`, parseWiktionary)) ||
    null;
  // 여러 단어는 숙어로 분류 (사전이 품사를 'verb' 등으로 주더라도)
  return found && word.includes(' ') ? { ...found, pos: '숙어' } : found;
}

// 번역 실패해도 저장은 되도록 빈 문자열 반환
async function toKorean(word) {
  return (
    (await getJson(
      `https://api.mymemory.translated.net/get?q=${encodeURIComponent(word)}&langpair=en|ko`,
      (j) => j.responseData.translatedText,
    )) ?? ''
  );
}

const wiki = (lang, title) =>
  getJson(`https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`);

// 공학·AI: 영어판 위키 요약 -> Wikidata 항목 ID로 한국어판 문서 연결
// 동음이의 문서("UX may refer to:")는 뜻이 아니므로 근거 자료로 쓰지 않는다.
const usable = (p) => (p?.extract && p.type !== 'disambiguation' ? p : null);

async function lookupTech(term) {
  let en = usable(await wiki('en', term));
  if (!en) {
    const s = await getJson(`https://en.wikipedia.org/w/rest.php/v1/search/title?q=${encodeURIComponent(term)}&limit=1`);
    const title = s?.pages?.[0]?.title;
    en = title ? usable(await wiki('en', title)) : null;
  }
  if (!en) return null;
  let ko = '';
  const id = en.wikibase_item;
  if (id) {
    const d = await getJson(
      `https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${id}&props=sitelinks&sitefilter=kowiki&format=json&origin=*`,
    );
    const koTitle = d?.entities?.[id]?.sitelinks?.kowiki?.title;
    if (koTitle) ko = (await wiki('ko', koTitle))?.extract ?? '';
  }
  return { en: en.extract, ko };
}

const short = (s) => (s.length > 300 ? s.slice(0, 300) + '…' : s);
const text = (s) => ({ rich_text: s ? [{ text: { content: s.slice(0, 2000) } }] : [] });

const VALID = {
  // 단어 또는 숙어(공백으로 구분된 최대 6단어)
  일반: /^[a-z]+(?:['’-][a-z]+)*(?: [a-z]+(?:['’-][a-z]+)*){0,5}$/i,
  '공학·AI': /^[a-z가-힣][a-z0-9가-힣 .+#'-]{0,59}$/i,
  '한-한': /^[가-힣]+$/,
};
const WRONG = { 일반: '영어 단어나 숙어(6단어 이하)를 선택하세요', '공학·AI': '영어 또는 한글 용어를 선택하세요', '한-한': '한글 단어 하나만 선택하세요' };

// 온용어(전문용어): 한글 용어는 정의, 영어 대역어를 돌려준다. 키가 없거나 실패하면 null.
function lookupKterm(word, key) {
  if (!key) return null;
  return getJson(
    `https://kli.korean.go.kr/term/api/search.do?key=${encodeURIComponent(key)}&apiSearchWord=${encodeURIComponent(word)}&num=10`,
    parseKterm,
  );
}

// -> { ko, en, pos, example, found }
async function resolve(category, word, { mwKey, stdictKey, ktermKey }) {
  if (category === '한-한') {
    if (!stdictKey) throw new Error('옵션에서 표준국어대사전 키를 설정하세요');
    if (!/^[0-9a-f]{32}$/i.test(stdictKey)) throw new Error('표준국어대사전 키는 16진수 32자리입니다 (옵션 확인)');
    const res = await fetch(
      `https://stdict.korean.go.kr/api/search.do?key=${encodeURIComponent(stdictKey)}&type_search=search&req_type=json&q=${encodeURIComponent(word)}`,
      { signal: AbortSignal.timeout(10000) },
    );
    const body = await res.text();
    // 잘못된/미승인 키는 HTTP 200 + 빈 본문으로 응답함 — 저장하지 말고 원인을 알린다
    if (!body.trim()) throw new Error('표준국어대사전이 빈 응답: 키가 틀렸거나 아직 승인 전일 수 있음');
    let r = null;
    try {
      r = parseStdict(JSON.parse(body));
    } catch {}
    if (!r) console.error('stdict 응답에서 뜻을 못 찾음:', body.slice(0, 800));
    return { ko: r?.def ?? '', en: '', pos: r?.pos ?? '기타', example: '', found: !!r };
  }
  if (category === '공학·AI') {
    const isKo = /[가-힣]/.test(word);
    // 한글 용어는 온용어 키가 있어야 한다 (위키 영어판은 한글 제목으로 못 찾음)
    if (isKo && !ktermKey) throw new Error('한글 용어는 옵션에서 온용어 키를 설정해야 합니다');

    // 한글은 온용어, 영어는 위키(영/한 요약) -> 없으면 온용어
    let base = null; // { ko, en, example }
    if (!isKo) {
      const t = await lookupTech(word);
      if (t) base = { ko: short(t.ko), en: short(t.en), example: '' };
    }
    if (!base) {
      const k = await lookupKterm(word, ktermKey);
      if (k) base = { ko: short(k.def), en: k.en, example: k.example };
    }
    if (base) return { ...base, ko: base.ko || (await toKorean(word)), pos: '명사', found: true };
    if (isKo) return { ko: '', en: '', pos: '기타', example: '', found: false };
    return { ko: await toKorean(word), en: '', pos: '기타', example: '', found: false };
  }
  // 단어는 사전 조회와 번역을 동시에. 숙어는 번역 메모리가 엉뚱한 항목을 1순위로 주는 일이 많아
  // (예: out of the box -> '수백 대 지원 가능') 구절 대신 영어 뜻풀이를 번역한다. 뜻풀이가 없거나 번역이 비면 구절 번역.
  const isPhrase = word.includes(' ');
  const [found, direct] = await Promise.all([lookupGeneral(word, mwKey), isPhrase ? '' : toKorean(word)]);
  const ko = isPhrase ? (found?.en && (await toKorean(found.en.slice(0, 400)))) || (await toKorean(word)) : direct;
  return { ko, en: found?.en ?? '', pos: found?.pos ?? (word.includes(' ') ? '숙어' : '기타'), example: found?.example ?? '', found: !!found };
}

async function getConfig() {
  const cfg = await chrome.storage.local.get(['token', 'dbId', 'mwKey', 'stdictKey', 'ktermKey']);
  if (!cfg.token || !cfg.dbId) throw new Error('옵션 페이지에서 토큰/DB ID를 먼저 설정하세요');
  return cfg;
}

// 팝업 미리보기용: 뜻 조회 + 중복 여부. 저장은 하지 않는다.
async function lookup({ category, word }) {
  if (!VALID[category]?.test(word)) throw new Error(WRONG[category] ?? '알 수 없는 분류');
  if (category === '일반') word = word.toLowerCase();
  const cfg = await getConfig();
    const [dup, entry] = await Promise.all([
    notion(`/databases/${cfg.dbId}/query`, cfg.token, {
      filter: { property: '단어', title: { equals: word } },
      page_size: 1,
    }),
    resolve(category, word, cfg),
  ]);
  return { word, entry, dup: dup.results.length > 0 };
}

// 미리보기에서 본 entry를 그대로 저장 (재조회 없음)
async function save({ category, word, url, entry: r }) {
  const cfg = await getConfig();
  const properties = {
    단어: { title: [{ text: { content: word } }] },
    분류: { select: { name: category } },
    뜻: text(r.ko),
    '영어 뜻': text(r.en),
    품사: { select: { name: r.pos } },
    예문: text(r.example),
    날짜: { date: { start: new Date().toLocaleDateString('sv') } },
    '복습 여부': { checkbox: false },
  };
  if (/^https?:/.test(url)) properties['출처 URL'] = { url };

  await notion('/pages', cfg.token, { parent: { database_id: cfg.dbId }, properties });
  return r.found ? 'ok' : 'partial';
}

chrome.runtime.onMessage.addListener((msg, _sender, reply) => {
  const job = msg.type === 'lookup' ? lookup(msg) : save(msg).then((status) => ({ status }));
  job.then(
    reply,
    (e) => {
      console.error(e);
      reply({ error: e.message });
    },
  );
  return true; // 비동기 응답
});
