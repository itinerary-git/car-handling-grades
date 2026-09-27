# 무스 테스트 등급표 (car-handling-grades)

휠베이스 6단계 × 지상고 6단계, 36개 등급별로 KM77 무스 테스트(maniobra de esquiva) 1위 차량을 보여주는 정적 웹페이지. Vercel에 `public/`을 배포한다.

## 규칙 (사용자가 정한 것)
- 순위 기준: KM77 무스 테스트 통과 속도. **77km/h 이하는 제외** (`scripts/build_page.mjs`의 `MIN_KMH = 78`).
- 등급 경계: 아래 값 포함. 휠베이스 <2600 / 2600–2699 / … / ≥3000, 지상고 <150 / 150–159 / … / ≥190.
- 보라색: Consumer Reports · Quattroruote · 오토뷰가 그 등급 1위와 비교해 "비슷하다 / 더 좋다"고 한 차 → `data/peer_mentions.json`. 직접 인용 금지, 검색 결과 요약만. 방향이 반대(1위가 더 좋음)거나 세대가 다르거나 출처가 세 사이트가 아니면 넣지 않는다.
- 호박색: KM77 값은 없지만 Quattroruote 공개 YouTube 안정성 시험(재생목록 "Prove di stabilità")에서 평가가 좋아 비슷하거나 나을 것으로 예상한 차 → `data/qr_expected.json` (차 자신의 제원 등급 칸, `confidence` 필수). 같은 세대를 KM77이 77km/h 이하로 측정했으면 KM77 값을 우선해 넣지 않는다. 기준점: Opel Astra L = Quattroruote 젖은 노면 88km/h·4성 ↔ KM77 76km/h.
- 지상고: KM77 제원 값 우선, 없으면 `data/gc_manual.json`(출처 표기). 등급 경계 ±6mm 안의 추정치는 웹 검색으로 검증하고 `gc_source`를 `verified (...)`로.
- 템플릿의 `<!--PRIVATE-->…<!--/PRIVATE-->` 구간(어떻게 뽑았나 · 읽을 때 주의할 점 · 7개 사이트 활용 범위)은 사용자만 보는 내용이라 공개 페이지(public/)에서는 빌드 때 빠진다. 방법·출처 설명을 새로 쓸 땐 이 구간 안에 넣는다.
- 답변은 한국어. 사용자는 Claude를 "클아"라고 부른다.

## "등급표 갱신해줘" 절차
1. `node scripts/update.mjs` — `data/state.json`의 `lastUpdated` 이후에 생긴 것만 수집:
   KM77 매거진 새 글(링크된 차량 페이지), 최근 연식 새 세대 페이지(이미 확인한 404는 `state.km77.probed`로 건너뜀), Quattroruote 재생목록의 새 영상(`state.qr.seenVideoIds`에 없는 것).
   `--recheck`를 붙이면 최근 3년 페이지 중 무스 값이 비어 있던 것도 다시 읽는다.
2. `data/pending_review.md`를 읽고 처리:
   - 78km/h 이상 새 차 중 지상고가 없는 차 → `data/gc_manual.json`에 값 추가(경계값이면 검색으로 검증).
   - 새 Quattroruote 영상 → 설명과 검색 결과로 판단해 `data/qr_expected.json`에 추가할지 결정.
   - 새 1위가 생긴 등급 → Consumer Reports / 오토뷰 / Quattroruote 비교 평가를 검색해 `data/peer_mentions.json` 갱신.
   - 새 차 이름이 칸에 길게 나오면 `scripts/build_page.mjs`의 `SHORT` 목록에 짧은 이름 추가.
3. `node scripts/build_all.mjs` — 중복 제거 → 등급 계산 → `public/index.html` 생성, `data/changelog.json`에 변경 기록, `lastUpdated`를 오늘로. (`--dry`는 기록 없이 빌드만)
4. 사용자에게 변경 내용(추가/제외 차량, 새 표시)을 보여주고 배포 확인을 받은 뒤 배포 (아래).
5. `git add -A && git commit` (커밋 메시지 영어).

## 배포
- Vercel 프로젝트는 `public/`을 정적 파일로 서빙한다 (`vercel.json`).
- 방식: Vercel CLI 직접 배포 (GitHub 연동 없음). 계정 itinerary-git, 프로젝트 moose-grade, 주소 https://moose-grade.vercel.app
- 명령: `npx vercel deploy --prod --yes` (프로젝트 폴더에서). `.vercelignore`로 public/과 vercel.json만 업로드된다.
- 배포 후 `curl -s https://moose-grade.vercel.app/ | grep 마지막`으로 갱신일 반영 확인.

## 수집 주의
- KM77: robots.txt가 막은 `/buscador/*`, `/coches/mediciones-propias/` 목록 경로는 쓰지 않는다. 차량별 페이지만, 요청 간 250–400ms 간격.
- Git Bash에서 `/coches/...` 인자를 넘길 땐 `MSYS_NO_PATHCONV=1` (update.mjs가 알아서 설정).
- Teknikens Värld는 약관상 데이터 수집 금지. Consumer Reports / Quattroruote / 오토뷰 / MotorTrend 사이트는 AI 크롤러를 막으므로 직접 가져오지 않고 검색 결과 요약만 쓴다. YouTube는 `/watch` 페이지 메타데이터(제목·설명)만, 자막(`/timedtext`)은 쓰지 않는다.

## 파일
- `data/km77_measurements.json` 수집 원본, `data/km77_cars.json` 제원 추가, `data/km77_dedup.json` 버전별 1건, `data/grades.json` 등급 계산 결과
- `data/state.json` 증분 갱신 상태, `data/changelog.json` 갱신 기록, `data/published.json` 직전 공개 스냅샷
- `report/template.html` 페이지 템플릿 → `public/index.html`(Vercel), `report/index.html`(claude.ai Artifact용)
