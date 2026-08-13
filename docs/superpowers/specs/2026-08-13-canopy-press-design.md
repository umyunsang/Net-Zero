# Canopy Press — Net Zero 소비자 앱 디자인 고도화 (DS@v2)

- 날짜: 2026-08-13 · 승인: 사용자 3방향 육안 비교 후 "A(Canopy Press)로 진행" 지시
- 범위: 소비자 앱 전체(웰컴·홈·활동·인증·히스토리·지갑·바우처·리더보드·프로필). 운영 콘솔은 토큰 상속만.
- WebGL 강도: 시그니처 3D(홈 히어로 잉크 도시) + 앰비언트(종이 그레인·마이크로 모션) + 포인트 파티클.
- 이전 DS@v1의 비주얼 권위는 본 문서로 대체된다. 비즈니스 카피·플로·API·E2E 단언 텍스트는 변경하지 않는다.

## 콘셉트 — "현장 기록장 (Field Ledger)"

이 앱은 검증된 기후 행동의 장부다. 자연주의자의 현장 노트/식물 표본 대장에서 시각 언어를 가져온다:
장부 괘선(hairline rules), 검증 스탬프, 도트 리더(label…value), 세리프 장부 숫자, 잉크 드로잉.

## 토큰

| 역할 | 값 |
|---|---|
| paper (bg) | `#F5F1E6` |
| paper-raised (card) | `#FCF9F1` |
| paper-shade (inset) | `#EBE5D4` |
| ink (text) | `#1C2A21` (식물성 잉크 — 순검정 아님) |
| ink-soft (muted) | `#5C6459` |
| hairline | `#D8D0BB` |
| forest (brand) | `#1E5B41` |
| terracotta (accent/CTA 강조) | `#B4541F` / deep `#8F3E12` |
| ochre (pending) | `#8A6100` · danger `#A83224` |

타이포: 표시체 = Fraunces(변수, EN·숫자) / Noto Serif Thai(태국어) / Noto Serif KR(한국어 제목).
본문 = Sarabun(태국어·영어), Apple SD Gothic Neo(한국어). 숫자는 어디서나 Fraunces lining + tabular.

## 시그니처 — 잉크 도시 (three.js)

홈 히어로의 3D 도시. 종이 위 잉크 선화(엣지 라인 + 종이색 면)로 렌더된 로우폴리 블록 도시가
포인트에 비례해 건물·나무가 자란다. 드래그로 회전, 평소엔 저속 자동 회전.
- OrthographicCamera 아이소메트릭, DPR≤2, 오프스크린/탭 숨김 시 정지
- prefers-reduced-motion: 자동 회전 없음 · WebGL 실패 시 기존 SVG 도시 모티프 폴백
- 포인트 획득(성공 화면): 잉크 낙엽 파티클 버스트(canvas 2D)

## 구조 장치 (내용을 encode)

- 장부 괘선: 리스트 행 상하 hairline — 실제 장부 항목이므로
- 도트 리더: 순위·필드의 label↔value 연결 — 대장 표기법
- 검증 스탬프: 상태 칩을 스탬프풍(1.5px 보더·자간)으로 — 실제 검증 상태이므로 (verified=forest, pending=ochre, rejected=terracotta)
- 눈썹(eyebrow) 라벨 + 룰: 섹션 제목 위 소형 대문자 라벨

## 모션 (절제, 오케스트레이션)

화면 전환 시 1회의 stagger 리빌(행 40ms 간격 fade-up), 포인트 숫자 count-up(600ms),
진행바 스프링, 버튼 프레스, 잉크 언더라인 호버. 산발적 장식 애니메이션 금지. reduced-motion 전부 무효화.

## 불변 조건

- 모든 사용자 노출 카피(태국어/영어/한국어)와 aria 라벨은 기존 그대로 — E2E 카피 단언 유지
- DOM 역할·내비 구조 유지(클래스명 보존), 스타일과 히어로 비주얼만 교체
- 접근성: 포커스 링 유지, 대비 AA(잉크/종이 12.9:1), 44px 터치 타깃 유지
