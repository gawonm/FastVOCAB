# 개인정보 처리방침 (FastVOCAB)

FastVOCAB는 별도 서버를 운영하지 않으며 사용자의 데이터를 수집하지 않습니다.

## 저장되는 정보
- Notion 토큰, DB ID, 각 사전 API 키는 사용자의 브라우저(`chrome.storage.local`)에만 저장됩니다. 개발자에게 전송되지 않습니다.

## 외부로 전송되는 정보
사용자가 단축키로 조회를 요청했을 때만, 선택한 단어(또는 복사한 텍스트)가 아래 서비스로 전송됩니다.

| 서비스 | 용도 |
|---|---|
| Merriam-Webster Learner's, dictionaryapi.dev, Wiktionary | 영어 뜻 조회 |
| MyMemory | 한글 번역 |
| Wikipedia, Wikidata | 공학·AI 용어 조회 |
| 표준국어대사전, 온용어 (국립국어원) | 한글 용어 조회 |
| Notion | 저장하기를 눌렀을 때 단어, 뜻, 예문, 현재 페이지 URL을 사용자의 DB에 기록 |

## 권한을 쓰는 이유
- `activeTab`, `scripting`: 현재 탭에서 드래그한 텍스트를 읽기 위해
- `clipboardRead`: PDF처럼 선택 영역을 읽을 수 없는 페이지에서 복사한 텍스트를 읽기 위해 (선택 영역을 읽을 수 없는 페이지에서만 사용)
- `storage`: 위 설정값을 저장하기 위해
- 호스트 권한: 위 표의 서비스에 요청을 보내기 위해
