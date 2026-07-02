# 데일리픽 자동 글쓰기/배포 설정

## 로컬에서 실행

1. `.env.example` 파일을 `.env`로 복사합니다.
2. `.env`에 아래 값을 넣습니다.
   - `SERPAPI_KEY`: 구글 검색 결과 확인용
   - `OPENAI_API_KEY`: 글 자동 작성용
   - `OPENAI_MODEL`: 사용할 글쓰기 모델
   - `NETLIFY_AUTH_TOKEN`: Netlify 개인 토큰
   - `NETLIFY_SITE_ID`: 기본값 `6bb4af2f-7707-45cb-9c15-4848c3017c34`
3. `run-publish-once.bat`을 실행하면 글 작성, GitHub 저장, Netlify 배포를 한 번 실행합니다.
4. `run-publish-every-6h.bat`을 실행하면 6시간마다 반복 실행합니다.

## GitHub에서 자동 실행

GitHub 저장소의 `Settings > Secrets and variables > Actions`에 아래 값을 등록합니다.

Secrets:
- `SERPAPI_KEY`
- `OPENAI_API_KEY`
- `OPENAI_MODEL`
- `NETLIFY_AUTH_TOKEN`
- `NETLIFY_SITE_ID`는 선택입니다. 비워두면 `6bb4af2f-7707-45cb-9c15-4848c3017c34`로 배포합니다.

Variables:
- `SEARCH_KEYWORD`: 기본값 `부동산`
- `POST_CATEGORY`: 기본값 `부동산`
- `MAX_REFERENCE_RESULTS`: 기본값 `10`
- `SMARTSTORE_URL`: 스마트스토어 주소

등록 후 `.github/workflows/auto-blog.yml`이 6시간마다 자동으로 실행됩니다.
