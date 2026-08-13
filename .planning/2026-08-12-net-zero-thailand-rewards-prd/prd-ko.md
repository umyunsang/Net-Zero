# 태국 Net-Zero Rewards Functional MVP

제품 요구사항 문서(PRD) · 한국어

문서 상태: 구현 전 기준 명세 / 심층 인터뷰 기반

## 1. 요약

Net-Zero Rewards는 태국 사용자가 버스 이용, 재활용품 전달, 나무 심기라는 세 가지 친환경 활동을 증거와 함께 제출하고, 검증된 활동만 탄소 영향 추정치와 포인트로 전환해 보상으로 연결하는 Functional MVP다.

핵심 검증 상태 머신, 탄소·포인트 원장, voucher 발급·사용, dashboard와 leaderboard는 실제로 동작해야 한다. 교통 경로 데이터, AI 이미지 판독, QR 수거함 등록부, 참여 매장 스캐너처럼 외부에서 제공되는 서비스만 명확히 표시된 stub 또는 demo data로 대체할 수 있다.

모든 탄소 값은 TGO 방법론을 참고한 소비자용 추정치다. carbon credit, offset 또는 TGO 인증 결과로 표현하지 않는다. 버스·재활용의 `estimated_avoided_co2e`와 나무의 `projected_sequestration_co2e`는 저장, API, 화면, 집계 전 과정에서 분리한다.

## 2. 문제와 기회

- 친환경 행동은 참여를 유도하기 어렵고, 실제 행동 여부와 중복 참여를 검증하기도 어렵다.
- 탄소 영향 수치를 단일 숫자로 보여주면 회피배출과 미래 예상 흡수량의 차이가 사라져 과장된 인상을 줄 수 있다.
- 보상이 단순 화면 시연에 그치면 해커톤 이후 산업·공공 적용 가능성을 입증하기 어렵다.
- 태국의 배출계수와 지역 운영 맥락을 사용하면서도, MVP 단계의 휴리스틱과 proxy 한계를 투명하게 공개할 필요가 있다.

제품 기회는 증거 제출, 보수적 검증, 재현 가능한 탄소 계산, 포인트, 일회용 voucher를 하나의 추적 가능한 순환으로 연결하는 데 있다.

## 3. 제품 목표와 성공 정의

### 3.1 목표

- 세 가지 친환경 활동에 대해 증거와 검증 결과를 보존한다.
- 검증된 활동만 versioned factor와 formula를 사용해 탄소 영향으로 환산한다.
- 회피배출과 1년 예상 흡수량을 명확히 분리하면서, 결정론적 공식으로 포인트를 부여한다.
- 포인트 차감부터 voucher 사용까지 일회성·원자적·멱등적인 보상 흐름을 제공한다.
- 사용자 dashboard와 opt-in 주간 leaderboard에서 개인·커뮤니티 영향을 투명하게 보여준다.
- raw evidence를 필요한 기간만 보존하고, 계정 삭제와 opt-out 권리를 반영한다.

### 3.2 MVP 성공 정의

MVP의 성공은 사용자 수나 매출 목표가 아니라 본 문서의 기능·데이터·상태 전이·수용 기준 통과로 판단한다. 채택률, 재방문율, 상용 매장 전환율 등 사업 KPI는 현장 pilot에서 기준선을 확보한 뒤 별도 승인한다.

### 3.3 제품 원칙

- Verified first: 검증 전에는 CO2e와 포인트를 발행하지 않는다.
- Conservative claims: 증거가 실제로 입증하는 범위보다 강한 문구를 사용하지 않는다.
- Separation by impact type: 회피배출과 예상 흡수량을 합쳐서 무표식 단일 총량으로 표시하지 않는다.
- Reproducibility: 각 원장 기록은 당시 입력·공식·단위·factor 버전만으로 같은 결과를 재현할 수 있어야 한다.
- Idempotency: retry, replay, 동시 요청이 중복 claim, credit, refund 또는 redemption을 만들지 않아야 한다.
- Privacy by retention: raw evidence를 기본적으로 영구 보존하지 않는다.

## 4. MVP 범위

### 4.1 포함 범위

- 버스 이동 검증: GPS coverage, 속도 구간, 정류장 간격, 노선 일치도, 중복 여행 판정
- 재활용품 전달 검증: one-time QR session, 인앱 사진, 중복 차단, user/bin/day 제한, authorized review
- 나무 심기 검증: 인앱 사진, GPS·시간, AI 결과, manual review, 계정 간 중복 판정
- 탄소·포인트 원장: versioned factor와 proxy, 공식·단위·가정·impact type 기록, 1회성 credit
- 보상: 일회용 voucher 발급·차감·사용·취소·만료
- 영향·커뮤니티: 개인 dashboard, 익명 community totals, opt-in 주간 leaderboard

### 4.2 외부 mock 허용 범위

- 교통 노선·정류장 데이터 provider
- AI 이미지 검증 provider
- 신뢰된 재활용 수거 지점 QR registry
- demo merchant scanner 및 demo reward catalog
- 명확히 demo로 표시된 synthetic user/action data

외부 mock은 core business rule을 우회해서는 안 된다. verification state machine, carbon/points ledger, voucher lifecycle, leaderboard projection은 실제로 실행되어야 한다.

## 5. 사용자와 역할

### 5.1 일반 사용자

- 친환경 활동 증거를 제출한다.
- claim 상태와 거절·보류 사유를 확인한다.
- 검증된 탄소 영향과 포인트를 확인한다.
- 포인트로 voucher를 발급받고 사용 상태를 확인한다.
- leaderboard 참여 여부와 pseudonym을 관리한다.
- 계정 삭제를 요청할 수 있다.

### 5.2 Authorized reviewer

- 재활용 사진에서 보이는 재료 종류와 수량을 승인하거나 하향 조정한다.
- AI confidence가 애매하거나 provider 장애로 보류된 나무 claim을 판정한다.
- 권한 범위 내에서 raw evidence에 접근한다.
- 모든 판정은 actor, timestamp, reason code와 함께 audit metadata로 남긴다.

### 5.3 Demo merchant

- 발급된 voucher token을 스캔한다.
- 유효한 `issued` voucher를 한 번만 `redeemed`로 전환한다.
- 이미 사용·만료·취소된 voucher에 부가 효과를 만들지 않는다.
- 결제 처리나 정산은 수행하지 않는다.

### 5.4 운영 관리자

- factor/methodology, route corridor, stop geofence, AI threshold, QR registry의 버전을 관리한다.
- 권한 부여와 보존 정책 실행을 감독한다.
- demo account와 real-user aggregate의 분리를 확인한다.

## 6. 핵심 사용자 흐름

### 6.1 버스 이용 claim

1. 사용자가 버스 이동 기록을 시작하면 시스템은 30초 간격을 목표로 GPS를 수집한다.
2. 이동 종료 후 coverage, non-stop speed windows, stop-pair spacing, route match를 평가한다.
3. 데이터 또는 dependency가 부족하면 동일 claim을 `pending`으로 유지하고 점수를 주지 않는다.
4. 평가 가능한 metric 하나라도 실패하면 `rejected` 처리한다.
5. 모든 metric과 중복 검사를 통과하면 `verified` 처리한다.
6. 표준 승용차 대비 버스의 회피배출을 추정하고 한 번만 탄소·포인트 원장에 기록한다.

### 6.2 재활용품 전달 claim

1. 사용자가 신뢰된 수거 지점 QR을 스캔해 one-time claim session을 연다.
2. 재료 종류와 수량을 선택하고 인앱 사진을 촬영한다.
3. 시스템이 QR 유효성, session 재사용, 사진 중복, user/bin/day 제한을 확인한다.
4. 자동 검사를 통과한 claim은 `pending review`가 된다.
5. authorized reviewer가 사진에서 보이는 종류와 수량을 승인하거나 하향 조정한다.
6. 승인된 값만 `verified` claim의 회피배출과 포인트 계산에 사용한다.

### 6.3 나무 심기 claim

1. 사용자가 앱에서 새로 심은 묘목 사진을 촬영한다. GPS와 captured_at을 함께 기록한다.
2. AI provider가 묘목 여부, confidence, 이미지 중복 신호를 반환한다.
3. versioned threshold를 통과하고 중복이 아니면 `verified` 처리한다.
4. 명확한 오분류 또는 중복이면 `rejected` 처리한다.
5. confidence가 애매하거나 provider가 실패하면 `pending review`로 보내고 authorized reviewer가 결정한다.
6. verified claim은 1년 9.5 kgCO2e/나무 proxy를 한 번만 기록하고, survival이나 carbon credit을 주장하지 않는다.

### 6.4 Voucher 발급과 사용

1. 사용자가 reward를 선택하면 시스템이 포인트 잔액과 비용을 검증한다.
2. voucher 발급과 포인트 차감을 하나의 atomic transaction으로 처리한다.
3. 발급된 voucher는 7일 동안 `issued` 상태로 유효하다.
4. demo merchant scan은 한 요청만 `redeemed`로 전환한다.
5. 동일 scan을 재시도하면 기존 결과를 반환하고 추가 상태 변화는 만들지 않는다.
6. 사용 전 `cancelled` 처리되면 포인트를 한 번만 돌려주고, `expired`는 환불하지 않는다.

### 6.5 Dashboard와 leaderboard

1. Dashboard는 verified impact와 points balance를 표시한다.
2. avoided CO2e와 projected sequestration을 별도 항목으로 표시한다.
3. Leaderboard는 opt-in 사용자만 pseudonym으로 표시한다.
4. 주간 경계는 Asia/Bangkok 기준 월요일 00:00이며 verified weekly points만 집계한다.
5. Demo account는 실제 순위에서 제외한다.
6. Opt-out 즉시 현재·미래 순위에서 pseudonym을 제거하되 익명 community totals는 유지한다.

## 7. 상세 기능 요구사항

### 7.1 버스 검증

- FR-BUS-01: GPS 수집 목표 간격은 30초다.
- FR-BUS-02: 유효 GPS sample은 예상 sample의 80% 이상이어야 한다.
- FR-BUS-03: stop geofence 밖 속도 window의 80% 이상이 20–40 km/h여야 한다.
- FR-BUS-04: 감지된 stop pair의 80% 이상이 300–500 m 간격이어야 한다.
- FR-BUS-05: 유효 지점의 80% 이상이 versioned route corridor 안에 있어야 한다.
- FR-BUS-06: 네 metric을 모두 통과해야 `verified`다. 데이터 부족 또는 dependency 미준비는 `pending`, 평가된 metric 실패는 `rejected`다.
- FR-BUS-07: retry/replay는 원 claim을 재사용하며 ledger credit은 한 번만 생성한다.
- FR-BUS-08: 같은 사용자의 시간이 겹치는 새 claim에서 normalized trace similarity가 80% 이상이면 non-reversible trip fingerprint를 근거로 duplicate 처리한다.
- FR-BUS-09: verified claim은 versioned 승용차 baseline과 버스 factor 차이를 사용해 `estimated_avoided_co2e`를 계산한다.

### 7.2 재활용 검증

- FR-REC-01: QR은 신뢰된 수거 지점과 연결되고 one-time session만 생성한다.
- FR-REC-02: 사용자는 재료 종류·수량을 선언하고 앱 안에서 사진을 촬영해야 한다.
- FR-REC-03: 시스템은 동일 사진 재사용과 session replay를 차단한다.
- FR-REC-04: 한 사용자에게 같은 수거 지점에서 하루 한 claim까지만 credit을 허용한다.
- FR-REC-05: 자동 검사 통과만으로 verified가 되지 않으며 `pending review`로 이동한다.
- FR-REC-06: authorized reviewer는 보이는 증거 범위에서 종류·수량을 승인하거나 하향 조정할 수 있다.
- FR-REC-07: 사진이 불충분하면 `pending`을 유지하거나 reason code와 함께 `rejected` 처리한다.
- FR-REC-08: carbon/points ledger는 승인된 종류·수량만 사용한다.
- FR-REC-09: UI와 API는 결과를 “재활용품 전달 증거”로 표현하며 “재활용 완료”로 표현하지 않는다.

### 7.3 나무 검증

- FR-TREE-01: 제출은 인앱 사진, GPS, captured_at을 포함한다.
- FR-TREE-02: AI 판정은 provider, model/threshold version, confidence, result를 기록한다.
- FR-TREE-03: versioned threshold 통과와 non-duplicate를 모두 만족해야 `verified`다.
- FR-TREE-04: 명확한 오분류 또는 duplicate는 `rejected`다.
- FR-TREE-05: confidence 경계 또는 provider 장애는 `pending review`이며 점수를 주지 않는다.
- FR-TREE-06: authorized reviewer가 pending claim을 verified 또는 rejected로 결정할 수 있다.
- FR-TREE-07: 모든 계정에서 GPS 거리 5 m 이하이면서 visual similarity 90% 이상이면 duplicate/rejected다.
- FR-TREE-08: 위치 또는 visual signal 하나만 일치하면 `pending review`다.
- FR-TREE-09: verified claim은 versioned 1년 proxy 9.5 kgCO2e/나무를 `projected_sequestration_co2e`로 한 번만 기록한다.

### 7.4 탄소·포인트 원장

- FR-CARB-01: 버스·재활용은 `estimated_avoided_co2e`, 나무는 `projected_sequestration_co2e`로 기록한다.
- FR-CARB-02: 두 impact type을 storage, API, dashboard, aggregates에서 분리한다.
- FR-CARB-03: calculation record는 input, formula, unit, source URL, methodology code, version/effective date, proxy assumptions, impact type, disclaimer를 포함한다.
- FR-CARB-04: factor version 변경은 과거 ledger record를 소급 수정하지 않는다.
- FR-CARB-05: 같은 calculation record를 재실행하면 같은 결과가 나와야 한다.
- FR-PTS-01: avoided points는 `min(100, floor(kgCO2e / 0.1))`다.
- FR-PTS-02: projected points는 `min(100, floor((kgCO2e / 0.1) × 0.25))`다.
- FR-PTS-03: claim별 최대 포인트는 100이며 소수점 이하는 버린다.
- FR-PTS-04: verified claim만 한 번 credit할 수 있다.

### 7.5 Rewards

- FR-REW-01: voucher 발급과 포인트 차감은 함께 성공하거나 함께 실패해야 한다.
- FR-REW-02: voucher 상태는 `issued`, `redeemed`, `expired`, `cancelled`다.
- FR-REW-03: voucher는 발급 시점부터 7일 뒤 만료된다.
- FR-REW-04: redemption은 atomic하고 idempotent해야 한다.
- FR-REW-05: 동시 scan 중 하나만 성공할 수 있다.
- FR-REW-06: 이미 redeemed, expired, cancelled인 voucher scan은 상태나 포인트를 바꾸지 않는다.
- FR-REW-07: 사용 전 cancellation은 포인트를 한 번 환불하고 expiration은 환불하지 않는다.
- FR-REW-08: MVP에는 실제 결제 처리와 merchant settlement가 없다.

### 7.6 영향·커뮤니티·개인정보

- FR-COM-01: leaderboard는 opt-in과 pseudonym을 기본 조건으로 한다.
- FR-COM-02: 순위는 Asia/Bangkok 주간의 verified points만 사용한다.
- FR-COM-03: demo account를 실제 순위와 real-user aggregate에서 제외한다.
- FR-COM-04: avoided CO2e와 projected sequestration을 분리해 표시한다.
- FR-COM-05: opt-out 즉시 pseudonym을 현재·미래 순위에서 제거한다.
- FR-COM-06: opt-out 뒤에도 비식별 community totals는 유지할 수 있다.
- FR-PRIV-01: raw GPS와 사진은 claim 결정 후 30일간 보존한 뒤 자동 삭제한다.
- FR-PRIV-02: 데이터 주체와 authorized reviewer만 raw evidence에 접근할 수 있다.
- FR-PRIV-03: 계정 삭제 시 raw evidence를 즉시 삭제한다.
- FR-PRIV-04: 삭제 후에는 non-reversible fingerprints, formula/ledger, audit metadata, anonymized aggregates만 유지한다.

## 8. 데이터와 감사 모델

### 8.1 핵심 record

- User: points balance, 분리된 carbon totals, leaderboard opt-in, pseudonym, demo flag
- Claim: type, actor, evidence reference, status, reason codes, timestamps, idempotency key
- Verification Result: check별 input/result, configuration version, reviewer decision, evaluated_at
- Carbon Estimate: impact type, kgCO2e, baseline, factor reference, formula, assumptions, disclaimer
- Points Ledger Entry: source claim, conversion version, amount, balance delta, created_at
- Voucher: token, reward, points cost, state, issued/redeemed/expired/cancelled timestamps
- Redemption: voucher, merchant, request idempotency key, result, redeemed_at
- Retention Record: evidence deletion due date, deletion result, retained fingerprint class

### 8.2 불변 조건

- claim 하나는 carbon ledger entry와 points credit을 각각 한 번만 만들 수 있다.
- ledger record는 생성 당시 factor와 formula를 immutable reference로 보존한다.
- voucher state transition과 points balance change는 원자적으로 연결된다.
- raw evidence 삭제는 원장 재현성과 익명 집계의 정합성을 깨뜨리지 않아야 한다.
- demo data는 모든 aggregate와 화면에서 식별 가능해야 한다.

## 9. 외부 연동과 mock 경계

- TGO factor/methodology source: 공식 URL, code/version, effective date, unit을 pin한다. 실시간 registry 연동은 하지 않는다.
- Transit data: route, stop, corridor fixture와 dependency failure fixture를 제공한다. 실제 BTS/MRT production 연동은 제외한다.
- QR bin registry: 신뢰된 demo location과 one-time session issuance를 제공한다.
- AI photo check: verified, rejected, ambiguous, provider failure, duplicate fixture를 제공한다.
- Merchant scanner: demo account가 voucher 상태를 조회하고 idempotent redemption을 요청한다.

모든 외부 응답은 fixture version과 provider type을 기록해야 한다. Mock 성공 응답만 제공해서는 안 되며, 보류·거절·장애 흐름을 시연할 수 있어야 한다.

## 10. 제품 화면

- Action submission: 버스, 재활용, 나무별 증거 수집과 제출
- Claim status: pending/verified/rejected, 검사 결과, reason code, 다음 행동
- Impact dashboard: 분리된 CO2e, claim history, points balance, estimate disclaimer
- Rewards catalog: reward 설명, points cost, voucher validity
- Voucher detail: token/QR, state, issued_at, expires_at, redemption result
- Leaderboard: opt-in, pseudonym, 주간 points, 분리된 impact, demo 제외 안내
- Reviewer queue: pending recycling/tree claim, evidence, 조정·승인·거절 action
- Demo merchant scanner: scan result와 idempotent replay 상태

## 11. 비기능 요구사항

- 일관성: points, voucher, redemption은 transaction 또는 동등한 원자성 보장을 사용한다.
- 멱등성: 제출, 재평가, credit, voucher 발급, redemption, cancellation에 idempotency key를 적용한다.
- 재현성: factor와 configuration이 같으면 동일 입력은 동일 결과를 반환한다.
- 시간: leaderboard와 voucher 시간 계산은 Asia/Bangkok을 기준으로 명시적으로 처리한다.
- 권한: raw evidence와 review action은 역할 기반 접근 제어를 적용한다.
- 개인정보: raw evidence를 log, analytics, demo export에 복제하지 않는다.
- 감사성: 상태 전이와 manual decision은 actor, before/after, reason, timestamp를 남긴다.
- 장애 처리: 외부 dependency가 실패하면 core record를 잃지 않고 재시도 가능한 pending 상태를 사용한다.
- 표시 정확성: estimate, proxy, demo, non-certified 문구를 관련 화면과 pitch에 일관되게 표시한다.
- 접근성: 상태는 색상만으로 구분하지 않고 텍스트 label과 reason을 함께 제공한다.

## 12. 수용 기준

1. 외부 stub을 사용하더라도 verification state machine, carbon/points ledger, voucher lifecycle, leaderboard projection이 실제로 동작한다.
2. Bus golden fixture는 GPS coverage 80%, speed ratio 80%의 20·40 km/h 경계, stop-spacing ratio 80%의 300·500 m 경계, route match 80%를 포함한다.
3. Bus 데이터 부족은 무점수 pending, metric 실패는 rejected, 전부 통과는 verified와 1회 credit으로 이어진다.
4. Bus retry/replay는 claim이나 credit을 늘리지 않으며, 시간이 겹치고 trace similarity 80% 이상인 새 claim은 duplicate다.
5. Recycling QR session은 한 번만 사용되고 한 사용자·지점·일자당 credit claim은 최대 하나다.
6. Recycling claim은 reviewer 승인 전 carbon/points를 만들지 않으며, 승인값보다 높은 수량을 원장에 기록하지 않는다.
7. Recycling UI/API는 “전달 증거”와 “추정 CO2e”라는 한계를 표시한다.
8. Tree fixture는 verified, rejected, ambiguous confidence, provider failure, exact duplicate, manual decision을 포함한다.
9. 계정 간 tree claim이 GPS 5 m 이하와 visual similarity 90% 이상을 모두 만족하면 rejected이며, 신호 하나만 맞으면 pending review다.
10. Verified tree claim은 1년 9.5 kgCO2e 예상 흡수량을 한 번만 만들고 survival/credit disclaimer를 표시한다.
11. Carbon ledger는 factor/methodology source, version, unit, formula, assumptions, impact type을 보존하며 같은 record에서 같은 결과를 재현한다.
12. Dashboard와 API는 회피배출과 예상 흡수량을 무표식 단일 합계로 합치지 않는다.
13. Points는 잠긴 공식, 내림, claim당 100점 cap을 적용하고 verified claim당 한 번만 부여한다.
14. Voucher issuance와 point deduction은 함께 성공하거나 함께 실패한다.
15. 동시 voucher scan은 한 번만 redeem되고 retry는 같은 결과를 반환하며 종결 상태 scan은 부가 효과가 없다.
16. Redeem 전 cancellation은 한 번 환불하고 7일 expiration은 환불하지 않는다.
17. Leaderboard는 Asia/Bangkok 주간 verified points만 집계하고 demo account를 제외하며 opt-in 사용자만 표시한다.
18. Opt-out은 pseudonym을 즉시 제거하지만 anonymized community totals를 바꾸지 않는다.
19. Raw GPS·사진은 결정 후 30일에 자동 삭제되고 계정 삭제 시 즉시 삭제되며, 비가역 fingerprint와 익명 audit/ledger만 유지된다.
20. 사용자 문구와 pitch는 탄소 값이 TGO-informed estimate이며 certified credit이 아니고 bus 검증이 MVP heuristic임을 밝힌다.
21. 데모는 세 claim flow, carbon/points update, one-time voucher redemption, dashboard, leaderboard를 보여주며 demo data와 real-user aggregate를 분리한다.

## 13. 해커톤 데모 시나리오

1. 버스 fixture를 재생해 네 metric을 통과시키고 avoided CO2e와 points가 한 번만 증가하는 것을 보여준다.
2. 동일 여행 replay가 중복 credit을 만들지 않는 것을 보여준다.
3. 재활용 QR과 사진을 제출한 뒤 pending review가 생성되고, reviewer가 수량을 하향 승인한 값만 원장에 반영되는 것을 보여준다.
4. 나무 사진 fixture에서 verified, pending review, duplicate/rejected 중 최소 두 경로를 보여준다.
5. Dashboard에서 avoided와 projected impact가 분리되어 보이는 것을 확인한다.
6. Points로 voucher를 발급하고 demo merchant가 한 번 redeem한 뒤 재스캔이 같은 종결 결과를 반환하는 것을 보여준다.
7. Leaderboard opt-in/opt-out과 demo account 제외를 보여준다.

## 14. 제외 범위

- Carbon credit 또는 offset 발급
- TGO registry production 연동 또는 TGO 인증 주장
- Bus heuristic의 과학적 검증 완료 또는 fraud-proof 주장
- 나무 생존 보장과 1년을 넘는 예상 흡수량 적립
- 전달된 재료가 실제로 재활용되었다는 결과 보장
- 실제 결제, merchant settlement, production discount
- BTS/MRT, 실제 supermarket·merchant, national-scale 운영 연동
- 동남아시아 확장과 production hardening 전체

## 15. Roadmap

- 현장 데이터로 bus heuristic, route corridor, stop geofence, AI threshold를 calibration하고 정확도를 검증한다.
- TGO factor와 proxy의 적용 범위를 전문가와 검토하고 version governance를 정식화한다.
- BTS/MRT, 재활용 수거 사업자, supermarket, 참여 매장과 pilot integration을 수행한다.
- 사용성·참여·보상 경제성 KPI를 pilot에서 측정하고 points conversion과 reward catalog를 조정한다.
- 법률·개인정보 영향평가와 production security review를 거친다.
- 태국에서 검증된 운영 모델을 기준으로 동남아시아 확장 가능성을 평가한다.

## 16. 주요 위험과 완화

- Bus 오판정: 속도만으로 교통수단을 확정하지 않고 네 metric, pending 상태, duplicate fingerprint, estimate disclaimer를 함께 사용한다.
- 재활용 과대신고: reviewer가 사진에서 보이는 값만 승인하고 선언값을 상향할 수 없게 한다.
- 나무 중복·생존 과장: 계정 간 fingerprint와 1년 1회 proxy를 사용하고 survival claim을 금지한다.
- Factor 오용: source, version, effective date, unit, assumptions를 원장에 pin하고 과거 기록을 소급 수정하지 않는다.
- 보상 이중 사용: atomic/idempotent state transition과 동시성 test를 적용한다.
- 개인정보 과보존: 30일 deletion job, 계정 삭제 즉시 삭제, 최소 권한 접근을 적용한다.
- Demo와 실제 성과 혼동: 모든 demo account와 fixture를 표시하고 실제 aggregate에서 제외한다.

## 17. 구현 계획에서 결정할 항목

다음 항목은 제품 요구사항의 미해결 ambiguity가 아니라 구현 계획 단계의 선택 사항이다. 어떤 선택도 본 문서의 검증·감사·개인정보 불변 조건을 약화할 수 없다.

- Frontend, backend, database, hosting 기술 스택
- Authentication과 role-based access control 구현 방식
- Transit, AI, QR registry provider 또는 fixture 형식
- Bus·recycling 계산에 적용할 정확한 factor 값과 승인 절차
- Route corridor, stop geofence, AI threshold의 초기 versioned configuration
- Reviewer 운영 주체와 escalation SLA
- Reward catalog, voucher token 형식, demo merchant UX
- Observability, deletion job, audit export의 구현 방식

## 18. 근거와 용어

### 18.1 기준 자료

- T-VER-S-METH-03-01 — Modal Shift in Passenger Transportation
- T-VER-S-TOOL-01-01 — Calculation for Carbon Sequestration in Tree
- T-VER-S-METH-09-06 — Recovery and Recycling of Plastic from Solid Waste
- TGO project credit issuance process

위 자료는 계산과 표현의 근거를 검토하기 위한 출발점이다. MVP의 개별 값은 source URL, methodology code/version, effective date, unit과 함께 고정해야 하며, 이 문서는 TGO 인증이나 credit issuance를 주장하지 않는다.

### 18.2 용어

- Claim: 사용자가 한 친환경 활동에 대해 제출한 증거와 처리 단위
- Verified: 모든 필수 검증과 중복 검사를 통과한 상태
- Pending review: 데이터·dependency·confidence·수동 확인이 부족해 credit을 보류한 상태
- Estimated avoided CO2e: baseline 대비 배출 회피를 추정한 값
- Projected sequestration CO2e: 나무 한 그루의 향후 1년 흡수량을 proxy로 추정한 값
- Non-reversible fingerprint: 원본 증거를 복원할 수 없으면서 중복 비교에 사용하는 파생 식별자
- Voucher: 포인트 차감 후 발급되는 7일 유효 일회용 할인 권리

기준 인터뷰 ID: 9b268646-d65a-439e-8129-7d48e7e83bdb
