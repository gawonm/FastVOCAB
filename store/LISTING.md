# Chrome 웹 스토어 제출 자료

대시보드 입력칸에 그대로 복사해서 쓰는 문서입니다. 스크린샷은 `store/screenshots/` (1280×800).

## 기본 정보
| 항목 | 값 |
|---|---|
| 이름 | FastVOCAB (manifest의 `name`이 그대로 쓰임) |
| 카테고리 | 생산성 (Productivity) |
| 언어 | 한국어 (영어 설명을 함께 올리면 노출이 넓어짐) |
| 개인정보 처리방침 URL | https://github.com/gawonm/FastVOCAB/blob/main/PRIVACY.md |
| 홈페이지 / 지원 URL | https://github.com/gawonm/FastVOCAB |
| 업로드 파일 | Release의 `FastVOCAB-vX.Y.Z.zip` |

## 요약 (132자 이내)
드래그한 영어·한글 단어를 단축키로 조회해 뜻과 예문을 미리 보고 내 Notion 단어장에 바로 저장합니다.

## 자세한 설명
FastVOCAB는 읽던 페이지를 벗어나지 않고 모르는 단어를 단어장에 쌓는 확장 프로그램입니다.

사용법
1. 단어를 드래그하고 Alt+Shift+S (macOS는 Option+Shift+S)
2. 분류를 고릅니다: 1 일반 / 2 공학·AI / 3 한-한
3. 뜻, 영어 뜻, 예문을 확인하고 Enter로 내 Notion DB에 저장

기능
- 영어 단어와 숙어(최대 6단어): 영영 사전 정의와 한글 뜻, 예문
- 공학·AI 용어: 위키피디아 요약과 전문용어 사전(온용어)
- 한-한: 표준국어대사전
- 이미 저장한 단어는 중복 표시
- PDF: 드래그 후 복사(Ctrl/⌘+C)하고 단축키를 누르면 복사한 텍스트로 조회

준비물
- Notion Integration 토큰과 단어장 DB (템플릿 복제: https://painted-plum-a54.notion.site/41af7cbca87081118028fe9bf5f1b8bf)
- 한-한과 한글 전문용어는 국립국어원 API 키가 추가로 필요 (선택)

데이터
- 별도 서버가 없습니다. 토큰과 키는 내 브라우저에만 저장됩니다.
- 조회할 때만 선택한 단어가 사전·번역 서비스로 전송됩니다.

## 단일 목적 (Single purpose)
선택한 단어의 뜻을 조회해 사용자의 Notion 단어장 데이터베이스에 저장한다.

## 권한 사용 사유
| 권한 | 사유 |
|---|---|
| `activeTab` | 사용자가 단축키를 눌렀을 때 현재 탭에서 선택한 텍스트를 읽기 위해 |
| `scripting` | 현재 탭에서 선택 텍스트를 읽는 코드를 실행하기 위해 |
| `storage` | Notion 토큰, DB ID, 사전 API 키를 사용자의 브라우저에 저장하기 위해 |
| `clipboardRead` | PDF 뷰어처럼 선택 영역을 읽을 수 없는 페이지에서만, 사용자가 복사한 텍스트를 읽기 위해 |
| 호스트 권한 | 아래 서비스에 조회·저장 요청을 보내기 위해 (서비스별 용도는 PRIVACY.md) |

호스트: `api.notion.com`, `api.dictionaryapi.dev`, `en.wiktionary.org`, `www.dictionaryapi.com`, `api.mymemory.translated.net`, `en.wikipedia.org`, `ko.wikipedia.org`, `www.wikidata.org`, `stdict.korean.go.kr`, `kli.korean.go.kr`

## 데이터 사용 공개 (대시보드 체크 항목)
- 원격 코드 사용: 아니오 (모든 코드가 패키지에 포함됨)
- 수집·전송하는 사용자 데이터: 사용자가 직접 입력한 인증 정보(Notion 토큰, API 키)와 사용자가 선택한 텍스트. 개발자 서버로는 전송하지 않고, 위 서비스로만 전송합니다.
- 판매·광고·신용 평가 목적의 사용: 없음

## 제출 전 점검
- [ ] 대시보드의 개인정보 관련 답변이 `PRIVACY.md`와 일치하는가
- [ ] 실제 Chrome에서 설치 후 첫 실행 → 옵션 화면 → 저장까지 한 번 해 보았는가
- [ ] Notion DB 속성 구성을 사용자가 따라 하기 쉬운가 (README의 표)
