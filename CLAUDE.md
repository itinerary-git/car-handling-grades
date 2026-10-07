# 무스 테스트 등급표 (car-handling-grades)

휠베이스 6단계 × 지상고 5단계, 30개 등급별로 KM77 무스 테스트(maniobra de esquiva) 1위 차량을 보여주는 정적 웹페이지. Vercel에 `public/`을 배포한다.

## 규칙 (사용자가 정한 것)
- 순위 기준: KM77 무스 테스트 통과 속도. **77km/h 이하는 제외** (`scripts/build_page.mjs`의 `MIN_KMH = 78`).
- 등급 경계: 아래 값 포함. 휠베이스 <2600 / 2600–2699 / … / ≥3000, 지상고 <150 / 150–164 / 165–184 / 185–199 / ≥200 (6단계에서 5단계로 줄여 칸을 넓히고, 경계를 160·170·180·190처럼 추정값이 몰리는 둥근 수에서 5mm 떨어뜨렸다).
- 보라색: Consumer Reports · Quattroruote · 오토뷰가 그 등급 1위와 비교해 "비슷하다 / 더 좋다"고 한 차 → `data/peer_mentions.json`. 직접 인용 금지, 검색 결과 요약만. 방향이 반대(1위가 더 좋음)거나 세대가 다르거나 출처가 세 사이트가 아니면 넣지 않는다.
- 호박색: KM77 값은 없지만 Quattroruote 공개 YouTube 안정성 시험(재생목록 "Prove di stabilità")에서 평가가 좋아 비슷하거나 나을 것으로 예상한 차 → `data/qr_expected.json` (차 자신의 제원 등급 칸, `confidence` 필수). 같은 세대를 KM77이 77km/h 이하로 측정했으면 KM77 값을 우선해 넣지 않는다. 기준점: Opel Astra L = Quattroruote 젖은 노면 88km/h·4성 ↔ KM77 76km/h.
- 파란색: 오토뷰 YouTube 로드테스트의 핸들링·기본 안정성(긴급 회피) 등급(나쁨 < 부족 < 보통 < 좋음 < 훌륭함, 사이 값 포함 9단계)으로 비교. 등급은 화면에만 나와서 사용자가 사이트의 입력 페이지 `/autoview`에 입력한다 (아래 "오토뷰 입력"). 판정은 `scripts/autoview_compare.mjs`: 기준차(오토뷰도 평가했고 KM77도 측정한 같은 모델·세대, `data/autoview_cars.json`의 `anchor: true`) 중 KM77 속도가 그 칸 1위 이상인 차가 있고, 대상 차의 두 등급이 그 기준차 이상이면 파란색. 같은 세대 KM77 기록이 있는 차(`km77` 지정)는 KM77 값을 우선해 비교하지 않는다. 칸 상세에는 핸들링 또는 기본 안정성이 좋음 이상인 차만 판정 문구와 함께 보여준다. 칸 상세 화면(`report/template.html`)은 KM77 목록을 1위 속도와 그 바로 아래 속도 단계만, 오토뷰는 핸들링 최고 차와 기본 안정성 최고 차(동률은 모두)만 보여준다. 오토뷰 기록은 2024-05-18(2024 혼다 어코드 하이브리드 영상)부터만 쓰고 그 이전은 지운다(`autoview_list.mjs`의 `MIN_DATE`). 표시 차량의 제원 등급은 KM77 제원 또는 제조사 값(`wb`/`gc`/`src`)으로 정한다. 영상 목록: `scripts/autoview_list.mjs` → `data/autoview_videos.json`.
- 오토뷰 영상 제목에 `&`가 있으면 차 두 대로 나눈다 (`scripts/autoview_lib.mjs` `splitTitle`): 뒤 차에 연식이 없으면 앞 차 연식, 브랜드가 없으면 앞 차 브랜드를 붙인다 (`2025 마세라티 그란투리스모 & 그란카브리오` → `2025 마세라티 그란카브리오`). `vs`는 뒤가 브랜드로 시작할 때만 나눈다. 타이어 비교 영상은 뺀다. 나뉜 차의 입력 키는 `<영상id>.1`, `<영상id>.2`.
- 지상고: KM77 제원 값 우선, 없으면 `data/gc_manual.json`(출처 표기). 등급 경계 ±10mm 안의 추정치는 웹 검색으로 검증하고 `gc_source`를 `verified (...)`로.
- 템플릿의 `<!--PRIVATE-->…<!--/PRIVATE-->` 구간(어떻게 뽑았나 · 읽을 때 주의할 점 · 7개 사이트 활용 범위)은 사용자만 보는 내용이라 공개 페이지(public/)에서는 빌드 때 빠진다. 방법·출처 설명을 새로 쓸 땐 이 구간 안에 넣는다.
- 칸 상세 정보의 출처 링크와 `추정`·`검증` 지상고 표시는 공개 페이지에도 남긴다 (사용자 결정).
- 답변은 한국어. 사용자는 Claude를 "클아"라고 부른다.

## "등급표 갱신해줘" 절차
1. `node scripts/update.mjs` — `data/state.json`의 `lastUpdated` 이후에 생긴 것만 수집:
   KM77 매거진 새 글(링크된 차량 페이지), 최근 연식 새 세대 페이지(이미 확인한 404는 `state.km77.probed`로 건너뜀), Quattroruote 재생목록의 새 영상(`state.qr.seenVideoIds`에 없는 것).
   세대 페이지는 시험한 버전 하나만 보여 주므로, 비교표(detalle)의 버전 ID를 따라 다른 시험 버전도 읽는다(`crawl_versions.mjs` → `merge_versions.mjs`, 읽은 비교표는 `data/km77_detalle_done.json`에 기록돼 다음엔 건너뜀).
   KM77 데이터 표에 없고 기사·영상에만 있는 기록은 `data/extra_cars.json`에 수동 추가(출처 필수). `scripts/find_article_moose.mjs`로 시승기 본문에서 찾을 수 있다.
   `--recheck`를 붙이면 최근 3년 페이지 중 무스 값이 비어 있던 것도 다시 읽는다.
   그다음 `node scripts/autoview_list.mjs`(새 오토뷰 영상)와 `node scripts/autoview_sync.mjs`(사이트에 입력한 등급 ↔ `data/autoview_ratings.json`)를 돌린다.
2. `data/pending_review.md`를 읽고 처리:
   - 78km/h 이상 새 차 중 지상고가 없는 차 → `data/gc_manual.json`에 값 추가(경계값이면 검색으로 검증).
   - 새 Quattroruote 영상 → 설명과 검색 결과로 판단해 `data/qr_expected.json`에 추가할지 결정.
   - 새 1위가 생긴 등급 → Consumer Reports / 오토뷰 / Quattroruote 비교 평가를 검색해 `data/peer_mentions.json` 갱신.
   - 오토뷰: 빌드 출력의 `autoview: no specs …`에 나온 차는 `data/autoview_cars.json`에 `km77`(같은 세대 KM77 차 이름) 또는 `wb`/`gc`/`src`를 넣는다. 같은 모델·세대를 KM77이 측정했으면 `anchor: true`로 기준차가 된다.
   - 새 차 이름이 칸에 길게 나오면 `scripts/build_page.mjs`의 `SHORT` 목록에 짧은 이름 추가.
3. `node scripts/build_all.mjs` — 중복 제거 → 등급 계산 → `public/index.html` 생성, `data/changelog.json`에 변경 기록, `lastUpdated`를 오늘로. (`--dry`는 기록 없이 빌드만)
4. 사용자에게 변경 내용(추가/제외 차량, 새 표시)을 보여주고 배포 확인을 받은 뒤 배포 (아래).
5. `git add -A && git commit` (커밋 메시지 영어).

## 배포
- Vercel 프로젝트는 `public/`을 정적 파일로 서빙한다 (`vercel.json`).
- 방식: Vercel CLI 직접 배포 (GitHub 연동 없음). 계정 itinerary-git, 프로젝트 moose-grade, 주소 https://moose-grade.vercel.app
- 명령: `npx vercel deploy --prod --yes` (프로젝트 폴더에서). `.vercelignore`가 public/, api/, package*.json, scripts/autoview_lib.mjs만 올린다.
- 배포 후 `curl -s https://moose-grade.vercel.app/ | grep 마지막`으로 갱신일 반영 확인.

## 오토뷰 입력 (사용자 전용)
- 페이지 `/autoview` (`report/autoview_template.html` → 빌드 때 `public/autoview.html`). 메인 페이지 하단 "오토뷰 등급 입력" 버튼은 localhost에서 열었거나, 그 브라우저에 관리자 키가 저장돼 있을 때만 보인다.
- 운영: `api/ratings.js`(Vercel 함수)가 비공개 Vercel Blob 스토어 `moose-grade-autoview`에 저장. 헤더 `x-admin-key` = 환경 변수 `ADMIN_KEY`(production, 값은 `.env.local`에도 있음). 키 저장 링크: `https://moose-grade.vercel.app/autoview#key=<ADMIN_KEY>` (한 번 열면 그 브라우저에 저장되고 주소에서 지워짐).
- 로컬: `node scripts/serve.mjs` → http://localhost:5177/autoview , 입력값은 `data/autoview_ratings.json`에 바로 저장(키 불필요).
- 두 저장소는 `node scripts/autoview_sync.mjs`로 맞춘다(나중에 고친 값이 이김). 예전 claude.ai 입력 페이지(artifact 2nAeipTFhLagQpdZTRMdtL)의 값 20건은 2026-10-06에 옮겼고 더 쓰지 않는다.

## 수집 주의
- KM77: robots.txt가 막은 `/buscador/*`, `/coches/mediciones-propias/` 목록 경로는 쓰지 않는다. 차량별 페이지만, 요청 간 250–400ms 간격.
- Git Bash에서 `/coches/...` 인자를 넘길 땐 `MSYS_NO_PATHCONV=1` (update.mjs가 알아서 설정).
- Teknikens Värld는 약관상 데이터 수집 금지. Consumer Reports / Quattroruote / 오토뷰 / MotorTrend 사이트는 AI 크롤러를 막으므로 직접 가져오지 않고 검색 결과 요약만 쓴다. YouTube는 `/watch` 페이지 메타데이터(제목·설명)만, 자막(`/timedtext`)은 쓰지 않는다.

## 파일
- `data/km77_measurements.json` 수집 원본, `data/km77_cars.json` 제원 추가, `data/km77_dedup.json` 버전별 1건, `data/grades.json` 등급 계산 결과
- `data/state.json` 증분 갱신 상태, `data/changelog.json` 갱신 기록, `data/published.json` 직전 공개 스냅샷
- `report/template.html` 페이지 템플릿 → `public/index.html`(Vercel), `report/index.html`(claude.ai Artifact용)
