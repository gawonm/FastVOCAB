import { parseEntry, parseLearners, parseStdict, parseWiktionary } from './dict.js';

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
async function getJson(url, parse = (j) => j, headers = {}) {
  const u = new URL(url);
  const where = u.origin + u.pathname; // 쿼리에 API 키가 있으므로 로그에는 넣지 않는다
  try {
    const res = await fetch(url, { headers, signal: AbortSignal.timeout(8000) });
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

// 공학·AI: 위키백과 검색 한 번으로 후보 20개의 제목·짧은 설명·첫 문단·다른 언어판 제목을 받아
// AI·컴퓨팅 분야 문서를 고른다. 예) '트랜스포머' -> 영화·변압기가 아니라 '트랜스포머 (기계 학습)'.
// 위키미디어는 브라우저 클라이언트에 Api-User-Agent로 출처를 밝히도록 권한다.
const WIKI_HEADERS = { 'Api-User-Agent': 'FastVOCAB (https://github.com/gawonm/FastVOCAB)' };
const AI_RE =
  /machine learning|deep learning|artificial intelligence|neural|language model|natural language|기계 ?학습|머신 ?러닝|딥 ?러닝|인공 ?지능|신경망|언어 ?모델|자연어/i;
const TECH_RE =
  /comput|software|programming|algorithm|data|network|protocol|cryptograph|operating system|engineering|electronic|semiconductor|statistic|mathemat|컴퓨터|컴퓨팅|소프트웨어|프로그래밍|알고리즘|데이터|네트워크|프로토콜|암호|운영 ?체제|공학|전자|반도체|통계|수학|정보/i;
const INTRO = 'exintro=1&explaintext=1&exsentences=3';

const wikiApi = (lang, params) =>
  getJson(
    `https://${lang}.wikipedia.org/w/api.php?action=query&format=json&formatversion=2&origin=*&${params}`,
    undefined,
    WIKI_HEADERS,
  );

// 관련도: 제목이 용어와 같으면 +3, 제목이나 짧은 설명에 용어가 들어 있으면 +1.
// 분야: 제목 괄호·짧은 설명이 AI면 +5, 그 밖의 공학·컴퓨팅이면 +3, 본문 첫머리만 AI면 +2.
// 용어와 무관한 문서, 동음이의 문서, 본문 없는 문서는 버린다. 동점이면 검색 순위가 앞선 것.
export function pickTech(pages, term) {
  const q = term.toLowerCase().replace(/\s+/g, ' ');
  let best = null;
  for (const p of pages ?? []) {
    if (!p.extract || (p.pageprops && 'disambiguation' in p.pageprops)) continue;
    const base = p.title.toLowerCase().replace(/\s*\(.*\)$/, '');
    const desc = p.description ?? '';
    const titleScore = base === q ? 3 : base.includes(q) || desc.toLowerCase().includes(q) ? 1 : 0;
    if (!titleScore) continue;
    const about = `${p.title} ${desc}`;
    const topic = AI_RE.test(about) ? 5 : TECH_RE.test(about) ? 3 : AI_RE.test(p.extract.slice(0, 150)) ? 2 : 0;
    const c = { page: p, score: titleScore + topic, topic, index: p.index ?? 99 };
    if (!best || c.score > best.score || (c.score === best.score && c.index < best.index)) best = c;
  }
  return best;
}

// -> { ko, en, title } | null. lang은 검색어의 언어, 나머지 언어 뜻은 언어 간 링크로 가져온다.
async function lookupTech(term, lang) {
  const other = lang === 'ko' ? 'en' : 'ko';
  const search = async (q) =>
    pickTech(
      (
        await wikiApi(
          lang,
          `generator=search&gsrlimit=20&gsrsearch=${encodeURIComponent(q)}` +
            `&prop=extracts|description|pageprops|langlinks&${INTRO}&exlimit=20&ppprop=disambiguation&lllang=${other}&lllimit=max`,
        )
      )?.query?.pages,
      term,
    );
  let best = await search(term);
  // 분야가 맞는 후보가 없으면 분야어를 붙여 한 번 더 찾는다 (요청 수를 아끼려고 필요할 때만)
  if (!best?.topic) {
    const again = await search(`${term} ${lang === 'ko' ? '컴퓨터' : 'computing'}`);
    if (again?.topic) best = again;
  }
  if (!best) return null;
  const p = best.page;
  const otherTitle = p.langlinks?.[0]?.title;
  const otherText = otherTitle
    ? ((await wikiApi(other, `titles=${encodeURIComponent(otherTitle)}&prop=extracts&${INTRO}&redirects=1`))?.query
        ?.pages?.[0]?.extract ?? '')
    : '';
  return lang === 'ko' ? { ko: p.extract, en: otherText, title: p.title } : { en: p.extract, ko: otherText, title: p.title };
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

// -> { ko, en, pos, example, found }
async function resolve(category, word, { mwKey, stdictKey }) {
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
    // 한글·영어 모두 위키백과에서 AI·컴퓨팅 분야 문서를 찾는다 (키 불필요)
    const isKo = /[가-힣]/.test(word);
    const t = await lookupTech(word, isKo ? 'ko' : 'en');
    if (t) {
      console.log('공학·AI 문서:', t.title);
      return { ko: short(t.ko) || (isKo ? '' : await toKorean(word)), en: short(t.en), pos: '명사', example: '', found: true };
    }
    return { ko: isKo ? '' : await toKorean(word), en: '', pos: '기타', example: '', found: false };
  }
  // 단어는 사전 조회와 번역을 동시에. 숙어는 번역 메모리가 엉뚱한 항목을 1순위로 주는 일이 많아
  // (예: out of the box -> '수백 대 지원 가능') 구절 대신 영어 뜻풀이를 번역한다. 뜻풀이가 없거나 번역이 비면 구절 번역.
  const isPhrase = word.includes(' ');
  const [found, direct] = await Promise.all([lookupGeneral(word, mwKey), isPhrase ? '' : toKorean(word)]);
  const ko = isPhrase ? (found?.en && (await toKorean(found.en.slice(0, 400)))) || (await toKorean(word)) : direct;
  return { ko, en: found?.en ?? '', pos: found?.pos ?? (word.includes(' ') ? '숙어' : '기타'), example: found?.example ?? '', found: !!found };
}

async function getConfig() {
  const cfg = await chrome.storage.local.get(['token', 'dbId', 'mwKey', 'stdictKey']);
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

// 처음 설치하면 설정(토큰/DB ID)부터 하도록 옵션 페이지를 연다
chrome.runtime.onInstalled.addListener(({ reason }) => {
  if (reason === 'install') chrome.runtime.openOptionsPage();
});
