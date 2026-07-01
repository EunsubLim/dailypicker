# 데일리픽 배포 체크리스트

## Netlify에 올리기

1. https://app.netlify.com/drop 접속
2. `dailypicker-site.zip` 파일을 업로드
3. 배포가 끝나면 Netlify에서 임시 주소가 생성됨
4. Site settings > Domain management에서 `dailypicker.kr` 추가
5. 도메인 구매처 DNS에서 Netlify가 안내하는 값을 설정

## 연결 후 확인할 주소

- https://dailypicker.kr
- https://dailypicker.kr/robots.txt
- https://dailypicker.kr/sitemap.xml
- https://dailypicker.kr/ads.txt

## AdSense 신청 전 확인

- 글을 10개 이상으로 늘리기
- 개인정보처리방침과 문의 페이지가 열리는지 확인
- 스마트스토어 링크를 실제 주소로 교체
- `ca-pub-0000000000000000`을 실제 게시자 ID로 교체
- `ads.txt`의 `pub-0000000000000000`을 실제 게시자 ID로 교체
