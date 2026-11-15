# 무스 테스트 등급표 (car-handling-grades)

휠베이스 6단계 × 지상고 4단계, 24개 등급별로 KM77 무스 테스트(maniobra de esquiva) 1위 차량을 보여주는 정적 웹페이지. Vercel에 `public/`을 배포한다.

## 규칙 (사용자가 정한 것)
- 순위 기준: KM77 무스 테스트 통과 속도. **77km/h 이하는 제외** (`scripts/build_page.mjs`의 `MIN_KMH = 78`).
- 등급 경계: 아래 값 포함. 휠베이스 <2600 / 2600–2699 / … / ≥3000, 지상고 <150 / 150–174 / 175–199 / ≥200 (공식 자료가 적어 5단계에서 4단계로 줄였다: ~149와 200~은 유지하고 그 사이 3칸을 2칸으로 합침, 2026-11-01).
- 보라색: Consumer Reports · Quattroruote · 오토뷰가 그 등급 1위와 비교해 "비슷하다 / 더 좋다"고 한 차 → `data/peer_mentions.json`. 직접 인용 금지, 검색 결과 요약만. 방향이 반대(1위가 더 좋음)거나 세대가 다르거나 출처가 세 사이트가 아니면 넣지 않는다.
- 호박색: KM77 값은 없지만 Quattroruote 공개 YouTube 안정성 시험(재생목록 "Prove di stabilità")에서 평가가 좋아 비슷하거나 나을 것으로 예상한 차 → `data/qr_expected.json` (차 자신의 제원 등급 칸, `confidence` 필수). 같은 세대를 KM77이 77km/h 이하로 측정했으면 KM77 값을 우선해 넣지 않는다. 기준점: Opel Astra L = Quattroruote 젖은 노면 88km/h·4성 ↔ KM77 76km/h.
- 호박색 실선(측정값): Quattroruote 영상 결과 화면의 **통과 속도만**(마른 노면 선회 중 차선 변경 / 젖은 노면 이중 차선 변경, 별점은 넣지 않음 — 사용자 지시). 속도는 사용자가 로컬 입력 페이지 `/quattroruote`에서 넣거나(아래 "Quattroruote 입력"), 사용자가 지정한 영상만 Claude가 Chrome으로 읽는다(77개 전부 하지 않음, 2026-11-15). 속도 `data/qr_ratings.json`(영상 ID별, `by: user|claude`) + 제원 `data/qr_cars.json`(Claude가 채움: `car`, `short`, `wb`, `gc`, `gc_label`(공식 값 없을 때 범위 표시), `gc_source`, `km77`(같은 세대 KM77 값 문구), `extra`) → `scripts/qr_lib.mjs`가 합쳐 두 속도와 제원이 다 있는 차만 차 자신의 제원 칸에 칩 `4R 이름 마른/젖은`과 칸 상세 목록으로 표시. 순위·색에는 쓰지 않고, KM77 값이 77km/h 이하여도 측정값은 보여준다. 마른 노면 96km/h 이상 그리고 젖은 노면 72km/h 이상인 차만 표시하고(둘 중 하나라도 못 미치면 제외, 사용자 지시 2026-11-15), 같은 칸에서 두 속도(마른·젖은)가 모두 다른 차보다 낮은 차는 표시하지 않는다(`build_page.mjs`, 사용자 지시 2026-11-15). Claude가 영상을 읽을 때: canvas로 프레임을 모아 한 장으로 보기(유튜브 `/watch` 영상 화면만, 자막 아님). 2025년 이후 영상은 결과 카드 "Stabilità su asciutto/sul bagnato", 그 전은 화면 왼쪽 아래 `NN km/h` 또는 큰 숫자 `NN km/h VOTO`. 새 형식의 '마른 노면 직선 이중 차선 변경'은 `extra`에 적는다.
- 파란색: 오토뷰 YouTube 로드테스트의 핸들링·기본 안정성(긴급 회피) 등급(나쁨 < 부족 < 보통 < 좋음 < 훌륭함, 사이 값 포함 9단계)으로 비교. 등급은 화면에만 나와서 사용자가 사이트의 입력 페이지 `/autoview`에 입력한다 (아래 "오토뷰 입력"). 판정은 `scripts/autoview_compare.mjs`: 기준차(오토뷰도 평가했고 KM77도 측정한 같은 모델·세대, `data/autoview_cars.json`의 `anchor: true`) 중 **대상 차와 같은 칸(휠베이스×지상고 등급)에 속한 차만** 기준차가 되고(2026-11-01 사용자 지시), 그중 KM77 속도가 그 칸 1위 이상인 차가 있고, 대상 차의 두 등급이 그 기준차 이상이면 파란색. 같은 세대 KM77 기록이 있는 차(`km77` 지정)는 KM77 값을 우선해 비교하지 않는다. 칸 상세에는 핸들링 또는 기본 안정성이 좋음 이상인 차만 판정 문구와 함께 보여준다. 칸 상세 화면(`report/template.html`)은 KM77 목록을 1위 속도와 그 바로 아래 속도 단계만, 오토뷰는 핸들링이 좋음 이상인 차 중 핸들링 최고 차, 동률이면 기본 안정성 최고 차, 둘 다 같으면 모두 보여준다. 오토뷰 기록은 2024-05-18(2024 혼다 어코드 하이브리드 영상)부터만 쓰고 그 이전은 지운다(`autoview_list.mjs`의 `MIN_DATE`). 표시 차량의 제원 등급은 KM77 제원 또는 제조사 값(`wb`/`gc`/`src`)으로 정한다. 영상 목록: `scripts/autoview_list.mjs` → `data/autoview_videos.json`.
- 오토뷰 영상 제목에 `&`가 있으면 차 두 대로 나눈다 (`scripts/autoview_lib.mjs` `splitTitle`): 뒤 차에 연식이 없으면 앞 차 연식, 브랜드가 없으면 앞 차 브랜드를 붙인다 (`2025 마세라티 그란투리스모 & 그란카브리오` → `2025 마세라티 그란카브리오`). `vs`는 뒤가 브랜드로 시작할 때만 나눈다. 타이어 비교 영상은 뺀다. 나뉜 차의 입력 키는 `<영상id>.1`, `<영상id>.2`.
- 지상고: KM77 제원 값 우선, 없으면 `data/gc_manual.json`(출처 표기). 제조사 제원표 기준인 **빈 차(무적재) 지상고**를 쓴다. 출처가 적재 값과 빈 차 값을 함께 주면 빈 차 값을 쓴다(사용자 지시 2026-11-15). Mercedes(-AMG)는 총중량(최대 적재) 기준 값만 공개하므로 그 값을 빈 차 값으로 쓰지 않고, CarExpert·CarsGuide의 "unladen" 값을 쓴다. KM77 값이 빈 차 기준이 아니라고 확인되면 `gc_manual.json` 항목에 `"override": true`를 넣어 KM77 값 대신 쓴다(`grade.mjs`). 등급 경계 ±10mm 안의 추정치는 웹 검색으로 검증하고 `gc_source`를 `verified (...)`로.
- 템플릿의 `<!--PRIVATE-->…<!--/PRIVATE-->` 구간(어떻게 뽑았나 · 읽을 때 주의할 점 · 7개 사이트 활용 범위)은 사용자만 보는 내용이라 공개 페이지(public/)에서는 빌드 때 빠진다. 방법·출처 설명을 새로 쓸 땐 이 구간 안에 넣는다.
- 칸 상세 정보의 출처 링크와 `추정`·`검증` 지상고 표시는 공개 페이지에도 남긴다 (사용자 결정).
- 답변은 한국어. 사용자는 Claude를 "클아"라고 부른다.

## "등급표 갱신해줘" 절차
1. `node scripts/update.mjs` — `data/state.json`의 `lastUpdated` 이후에 생긴 것만 수집:
   KM77 매거진 새 글(링크된 차량 페이지), 최근 연식 새 세대 페이지(이미 확인한 404는 `state.km77.probed`로 건너뜀), Quattroruote 재생목록의 새 영상(`state.qr.seenVideoIds`에 없는 것).
   세대 페이지는 시험한 버전 하나만 보여 주므로, 비교표(detalle)의 버전 ID를 따라 다른 시험 버전도 읽는다(`crawl_versions.mjs` → `merge_versions.mjs`, 읽은 비교표는 `data/km77_detalle_done.json`에 기록돼 다음엔 건너뜀).
   KM77 데이터 표에 없고 기사·영상에만 있는 기록은 `data/extra_cars.json`에 수동 추가(출처 필수). `scripts/find_article_moose.mjs`로 시승기 본문에서 찾을 수 있다.
   `--recheck`를 붙이면 최근 3년 페이지 중 무스 값이 비어 있던 것도 다시 읽는다.
   Quattroruote 새 시험 영상은 `scripts/qr_list.mjs`(update.mjs가 호출)가 재생목록 + 채널 검색 페이지(`/@QuattroruoteIt/search`, robots.txt 허용) + 최신 업로드에서 찾는다. **Claude는 여기에 더해 웹 검색으로 최근 Quattroruote 안정성 시험("Quattroruote prova di stabilità", "test strumentali stabilità" + 최근 차 이름)을 찾아**, 목록에 없는 영상이 있으면 `node scripts/yt_meta.mjs <id> >> data/qr_stab_meta.jsonl`로 넣고(state.qr.seenVideoIds에도 추가) 사용자에게 새 시험 영상 목록을 알려 입력 페이지에서 속도를 넣게 한다 (사용자 지시, 2026-11-15).
   그다음 `node scripts/autoview_list.mjs`(새 오토뷰 영상)와 `node scripts/autoview_sync.mjs`(사이트에 입력한 등급 ↔ `data/autoview_ratings.json`)를 돌린다.
2. `data/pending_review.md`를 읽고 처리:
   - 78km/h 이상 새 차 중 지상고가 없는 차 → `data/gc_manual.json`에 값 추가(경계값이면 검색으로 검증).
   - 새 Quattroruote 영상 → 사용자에게 알려 `/quattroruote`에서 속도 입력. 설명이 뚜렷하면 `data/qr_expected.json`(호박색 점선 예상) 후보로도 검토하되, 측정값이 들어오면 예상보다 측정값을 우선.
   - 빌드 출력 `quattroruote: no specs …`(또는 pending의 "제원이 없는 차")에 나온 영상은 `data/qr_cars.json`에 제원을 넣는다(KM77 제원 우선, 경계 ±10mm는 검색으로 검증).
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

## Teknikens Värld 입력 (사용자 전용, 내 PC에서만)
- 출처: 공개 YouTube 재생목록 `PLubnNYiL3c4A-eHxarmLZHfszMp7lXaxC`("Moose test videos", `state.tv.playlist`). 기록은 **콘을 쓰러뜨리지 않은 최고 속도** 하나(km/h). 2023년 이후 "Moose test of the week" 영상은 설명의 `Achieved max speed`를 그대로 쓰고(`by: claude`), 그 전 비교 영상은 속도가 말로만 나와 화면 프레임으로 읽을 수 없어서 사용자가 넣는다. Chrome으로 영상을 볼 때 광고가 나오면 건너뛰기 버튼이 뜰 때 누른다(사용자 지시).
- `node scripts/serve.mjs` → http://localhost:5177/teknikens (`report/tv_input_template.html`, 배포 안 됨). 메인 페이지 하단 "Teknikens Värld 속도 입력" 버튼(Quattroruote 버튼과 함께)은 localhost에서는 상대 링크로, 배포 사이트에서는 관리자 키가 저장된 내 브라우저에서만 `http://localhost:5177/...` 링크로 보인다(사용자 지시 2026-11-15). 저장 `/api/tv` → `data/tv_ratings.json` `{ "<videoId>[.<n>]": { kmh, car?, by, updatedAt } }`. 비교 영상은 "차 추가"로 `<videoId>.2` 같은 키를 만든다.
- 제원 `data/tv_cars.json`(Claude가 채움, 형식은 `qr_cars.json`과 같고 키는 위 키) → `scripts/tv_lib.mjs` → `build_page.mjs`가 차 자신의 제원 칸에 넣고 **73km/h 이상인 차 중 칸마다 가장 빠른 차만**(동률은 모두, 73km/h 기준은 사용자 지시 2026-11-15) 분홍색 칩 `TV 이름 속도`와 칸 상세로 보여 준다(사용자 지시 2026-11-15: 한 등급에서 속도가 낮은 차는 무시). 순위·색에는 쓰지 않는다.
- 새 영상: `scripts/tv_list.mjs`(update.mjs가 호출)가 재생목록에서 `state.tv.seenVideoIds`에 없는 영상을 `data/tv_meta.jsonl`에 넣고 pending_review.md에 적는다. 갱신 때 Claude가 설명의 속도를 넣고 제원을 채운다.

## Quattroruote 입력 (사용자 전용, 내 PC에서만)
- `node scripts/serve.mjs` → http://localhost:5177/quattroruote . 페이지는 `report/qr_input_template.html`을 serve.mjs가 요청 때 그려서 **배포되지 않는다**(public/에 없음). 저장은 `/api/qr`(로컬) → `data/qr_ratings.json`. 메인 페이지의 "Quattroruote 속도 입력" 버튼은 localhost에서만 보인다.
- 영상 목록은 `data/qr_stab_meta.jsonl` + 입력 페이지에서 주소로 추가한 영상(제목은 다음 갱신 때 `yt_meta.mjs`로 채움).
- 오토뷰 입력(사이트+로컬, Blob 동기화)은 사용자가 만족하고 있으므로 바꾸지 않는다.

## 수집 주의
- KM77: robots.txt가 막은 `/buscador/*`, `/coches/mediciones-propias/` 목록 경로는 쓰지 않는다. 차량별 페이지만, 요청 간 250–400ms 간격.
- Git Bash에서 `/coches/...` 인자를 넘길 땐 `MSYS_NO_PATHCONV=1` (update.mjs가 알아서 설정).
- Teknikens Värld는 약관상 데이터 수집 금지로 적어 두었지만, 2026-11-15 사용자가 이를 알고도 예외로 YouTube 재생목록 "Moose test videos" 영상 결과를 등록하라고 지시했다(아래 "Teknikens Värld 입력"). teknikensvarld.se 사이트 자체는 여전히 수집하지 않는다. Consumer Reports / Quattroruote / 오토뷰 / MotorTrend 사이트는 AI 크롤러를 막으므로 직접 가져오지 않고 검색 결과 요약만 쓴다. YouTube는 `/watch` 페이지 메타데이터(제목·설명)만, 자막(`/timedtext`)은 쓰지 않는다.

## 파일
- `data/km77_measurements.json` 수집 원본, `data/km77_cars.json` 제원 추가, `data/km77_dedup.json` 버전별 1건, `data/grades.json` 등급 계산 결과
- `data/state.json` 증분 갱신 상태, `data/changelog.json` 갱신 기록, `data/published.json` 직전 공개 스냅샷
- `data/tv_meta.jsonl` Teknikens Värld 영상 메타, `data/tv_ratings.json` 속도, `data/tv_cars.json` 제원, `scripts/tv_lib.mjs` 합치기, `scripts/tv_list.mjs` 새 영상 찾기
- `data/qr_stab_meta.jsonl` Quattroruote 시험 영상 메타, `data/qr_ratings.json` 입력한 속도, `data/qr_cars.json` 그 차 제원, `scripts/qr_lib.mjs` 합치기, `scripts/qr_list.mjs` 새 영상 찾기
- `report/template.html` 페이지 템플릿 → `public/index.html`(Vercel), `report/index.html`(claude.ai Artifact용)
