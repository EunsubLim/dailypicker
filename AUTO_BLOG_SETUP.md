# 데일리픽 자동 글쓰기/배포 설정

## 무료 모드

기본 설정은 무료 모드입니다.

- `FREE_AUTO_BLOG=1`
- OpenAI API를 쓰지 않습니다.
- SerpAPI나 Google Custom Search를 쓰지 않습니다.
- 6시간마다 부동산 정보성 주제 풀에서 2,000~4,000자 글을 만들어 배포합니다.
- 무료 모드는 실시간 구글 검색 순위 10개를 가져오지 않습니다. 대신 공공 자료와 체크리스트 기반 글을 안정적으로 발행합니다.

## GitHub 자동 실행

GitHub Actions의 `Auto Blog Publish`가 6시간마다 실행됩니다.

필수 Secret:

- `NETLIFY_AUTH_TOKEN`

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

## 유료 모드로 바꾸고 싶을 때

실시간 검색 결과와 OpenAI 글쓰기를 쓰려면 GitHub Variables에서 `FREE_AUTO_BLOG=0`으로 바꾸고 아래 Secret을 추가합니다.

- `SERPAPI_KEY` 또는 `GOOGLE_API_KEY` + `GOOGLE_CSE_ID`
- `OPENAI_API_KEY`
- `OPENAI_MODEL`

유료 모드는 API 사용량에 따라 비용이 나올 수 있습니다.
