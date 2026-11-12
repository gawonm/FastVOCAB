# FastVOCAB

Chrome에서 드래그한 단어를 단축키로 조회해서 뜻과 함께 Notion 단어장에 저장하는 확장 프로그램입니다. 빌드 과정이 없고, Windows·macOS의 Chrome(및 Edge, Brave 같은 Chromium 계열)에서 똑같이 동작합니다.

## 사용 흐름
1. 단어를 드래그합니다.
2. `Alt+Shift+S` (macOS는 `Option+Shift+S`)를 누릅니다.
3. 분류를 고릅니다: `1` 일반 / `2` 공학·AI / `3` 한-한 (Enter는 추천 분류)
4. 미리보기를 확인하고 Enter로 저장합니다.

**PDF**: Chrome PDF 뷰어는 확장이 선택 영역을 읽을 수 없습니다. 드래그 후 `Ctrl+C` (macOS `⌘C`)로 복사한 다음 단축키를 누르세요.

## 설치 (Windows / macOS 공통)
1. [Releases](../../releases)에서 최신 `FastVOCAB-vX.Y.Z.zip`을 받아 압축을 풉니다. 풀린 폴더는 지우거나 옮기지 마세요.
2. `chrome://extensions`를 열고 우측 상단 **개발자 모드**를 켭니다.
3. **압축해제된 확장 프로그램을 로드합니다**를 누르고 압축 푼 폴더를 선택합니다.
4. 확장의 **옵션**에서 설정을 입력합니다 (아래).

소스에서 바로 쓰려면 이 레포의 `extension/` 폴더를 로드하면 됩니다.

### 업데이트
새 zip을 받아 같은 폴더에 덮어쓴 뒤 `chrome://extensions`에서 새로고침을 누릅니다. 설정값은 유지됩니다.

## 설정
설정은 브라우저마다 따로 저장되므로 PC마다 한 번씩 입력해야 합니다.

| 항목 | 필수 | 용도 |
|---|---|---|
| Notion Integration 토큰, 단어장 DB ID | 필수 | 저장 |
| Merriam-Webster Learner's 키 | 선택 | 영어 뜻 (없으면 dictionaryapi.dev, Wiktionary) |
| 표준국어대사전 키 | 한-한 사용 시 | 한글 뜻 |
| 온용어 키 | 한글 공학 용어 사용 시 | 한글 전문용어 |

키는 `chrome.storage.local`에만 저장되며 레포나 코드에 포함되지 않습니다.

### Notion DB 속성
DB에 아래 속성이 이름·타입 그대로 있어야 저장됩니다. Integration을 해당 DB에 연결(Connections)하는 것도 잊지 마세요.

| 속성 | 타입 |
|---|---|
| 단어 | 제목 |
| 분류 | 선택 (`일반`, `공학·AI`, `한-한`) |
| 뜻, 영어 뜻, 예문 | 텍스트 |
| 품사 | 선택 |
| 날짜 | 날짜 |
| 복습 여부 | 체크박스 |
| 출처 URL | URL |

## 단축키가 안 먹을 때
다른 앱이나 확장과 충돌할 수 있습니다. `chrome://extensions/shortcuts`에서 MyVocab의 단축키를 바꾸세요. macOS에서 Option 조합은 특수문자 입력과 겹칠 수 있습니다.

## 배포

### 1) GitHub Release (자동)
```bash
# 1. extension/manifest.json 의 "version" 을 올린다 (예: 0.3.0)
# 2. 커밋 후 태그를 푸시한다
git tag v0.3.0
git push origin v0.3.0
```
`.github/workflows/release.yml`이 태그와 manifest 버전이 같은지 확인하고, JS 구문을 검사한 뒤, `FastVOCAB-v0.3.0.zip`을 Release에 올립니다. 버전이 다르면 실패합니다.

### 2) Chrome 웹 스토어 (수동, 선택)
스토어에 올리면 개발자 모드 없이 설치·자동 업데이트가 됩니다. 첫 제출은 웹 대시보드에서 직접 해야 합니다.
1. [Chrome 웹 스토어 개발자 대시보드](https://chrome.google.com/webstore/devconsole)에서 개발자 등록 (일회성 등록비가 있습니다).
2. Release의 zip을 **새 항목**으로 업로드합니다.
3. 필요한 자료: 스크린샷, 설명, 개인정보 처리방침 URL (`PRIVACY.md`의 레포 URL을 쓸 수 있습니다), 권한 사용 사유(`PRIVACY.md`에 정리).
4. 검토에는 시간이 걸리며, `clipboardRead`와 다수의 호스트 권한 때문에 추가 소명을 요구받을 수 있습니다.

## 구조
```
extension/
  manifest.json   MV3, 서비스 워커 기반
  background.js   조회·Notion 저장 (CORS 때문에 모든 외부 호출은 여기서)
  dict.js         사전 응답 파서
  popup.html/js   분류 선택·미리보기
  options.html/js 설정 화면
```
