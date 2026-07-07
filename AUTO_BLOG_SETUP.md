# 데일리픽 자동 글쓰기/배포 설정

## 무료 모드만 사용

이 프로젝트는 무료 모드로만 사용합니다.

- `FREE_AUTO_BLOG=1`
- OpenAI API를 쓰지 않습니다.
- SerpAPI나 Google Custom Search를 쓰지 않습니다.
- 부동산 정보성 주제 풀에서 2,000~4,000자 글을 만듭니다.
- 실시간 구글 검색 순위 10개를 가져오지 않습니다. 대신 공공 자료와 체크리스트 기반 글을 발행합니다.

## GitHub 자동 실행

GitHub Actions의 `Auto Blog Publish`는 예약 실행을 꺼두었습니다.
필요할 때만 GitHub Actions 화면에서 `Run workflow` 버튼으로 수동 실행합니다.

선택 Secret:

- `NETLIFY_SITE_ID`: 비워두면 `6bb4af2f-7707-45cb-9c15-4848c3017c34`로 배포합니다.

선택 Variables:

- `FREE_AUTO_BLOG`: 기본값 `1`
- `SEARCH_KEYWORD`: 기본값 `부동산`
- `POST_CATEGORY`: 기본값 `부동산`
- `MAX_REFERENCE_RESULTS`: 기본값 `10`
- `POST_MIN_CHARS`: 기본값 `2000`
- `POST_MAX_CHARS`: 기본값 `4000`
- `SMARTSTORE_URL`: 스마트스토어 주소
