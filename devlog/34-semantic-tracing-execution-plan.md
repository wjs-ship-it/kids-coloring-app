# Semantic Tracing Execution Plan

## 목적
- `kids-coloring-app`의 tracing을 `contour fragment` 중심에서 `semantic part` 중심으로 전환하기 위한 단일 실행 문서다.
- 아래 3개 문서의 역할을 하나로 통합한다.
  - `/home/sang/.cli-jaw/uploads/1786524163017_49ce817e_Semantic_Tracing___QA_.md`
  - `/home/sang/.cli-jaw/uploads/1786524162762_7d1be5f1_UX__.md`
  - `/home/sang/.cli-jaw/uploads/1786524162765_1715ad15_UX___Semantic_Part_Tracing__1.md`

## 핵심 결론
- tracing 파트는 좌표/곡률 조각이 아니라 아이가 이름 붙일 수 있는 `의미 파트`여야 한다.
- 순서는 항상 `큰 덩어리 -> 부속 구조 -> 얼굴/장식` 우선으로 간다.
- 좋은 semantic tracing은 엔진의 점/거리 판정보다, 화면에서 보여 주는 `파트 이름`, `파트 순서`, `힌트`, `완료 피드백`의 일관성으로 완성된다.
- QA는 정확도만이 아니라 `첫 파트 시작 시간`, `다음 파트 자가 발견`, `파트 이름 언어화`를 함께 봐야 한다.

## 제품 기준

### semantic tracing이 충족해야 하는 UX 기준
1. 첫 1~2개 파트가 끝나면 아이가 대상을 알아볼 수 있어야 한다.
2. 현재 파트는 하나의 명사로 설명 가능해야 한다.
3. 한 파트 안에서 가능한 연속 선을 유지해야 한다.
4. 다음 파트는 전체 윤곽이 아니라 `시작점 + 이름 + 첫 구간`만 강조한다.
5. 얼굴, 무늬, 장식은 마지막 20~30%에 배치한다.

### contour fragment에서 semantic part로 바꾸는 판단
| 기존 판단 | 새 판단 |
|---|---|
| 곡선 길이가 길다 | 몸통/목/꼬리처럼 의미 단위인가 |
| 점선이 이어진다 | 아이가 한 번에 이해 가능한 파트인가 |
| 조각 수가 적다 | 첫 파트 이후 대상 정체성이 더 선명해지는가 |
| 경로 폭이 안정적이다 | 힌트 문구와 파트 이름이 직관적인가 |

## shape family / taxonomy 기준

### 우선 적용 family
1. `round_character`
2. `longneck_animal`
3. `quadruped_animal`
4. `vehicle`
5. `sticker_object`

### semantic category
| category | 의미 |
|---|---|
| `silhouette` | 큰 외곽, 몸통 중심 실루엣 |
| `limb` | 손, 발, 팔, 다리, 날개, 지느러미 |
| `head_feature` | 눈, 입, 코, 얼굴 특징 |
| `tail_feature` | 꼬리, 뿔, 귀, 후방 돌출 구조 |
| `ornament` | 무늬, 점, 장식, 배경성 디테일 |

### family별 기본 순서
| family | 기본 ordering |
|---|---|
| `round_character` | 몸통 -> 왼손 -> 오른손 -> 왼발 -> 오른발 -> 얼굴 -> 장식 |
| `longneck_animal` | 머리/목 또는 몸통 -> 몸통 -> 앞다리 -> 뒷다리 -> 꼬리 -> 얼굴/무늬 |
| `quadruped_animal` | 몸통 -> 머리 -> 앞다리 -> 뒷다리 -> 꼬리 -> 얼굴 |
| `vehicle` | 주몸통 -> 창문/콕핏 -> 바퀴/날개 -> 궤적/불꽃 -> 장식 |
| `sticker_object` | 외곽 -> 내부 특징 -> 장식 |

## 코드에 바로 넣을 규칙

### TracingPart 데이터 모델 확장
`TracingPart`는 최소 아래 필드를 가져야 한다.

```js
{
  traceStrategy: 'semantic',
  semanticId: 'body_outline',
  semanticCategory: 'silhouette',
  displayName: '몸통',
  hint: '몸통부터 따라 그려봐요! ✏️',
  shapeFamily: 'round_character',
  drawOrder: 1,
  toleranceMultiplier: 1.15,
  expectedMilestones: 4,
  boundaryPos: [...],
  samplePoints: [...]
}
```

### 구현 규칙
1. `displayName` 없는 semantic part는 노출하지 않는다.
2. `drawOrder`는 단순 contour 생성 순서가 아니라 family-aware ordering에서 최종 확정한다.
3. `limb` 파트는 가능하면 `좌/우`, `앞/뒤`를 이름으로 드러낸다.
4. `head_feature`는 `silhouette` 또는 `body` 계열 파트 최소 1개 완료 전에는 열지 않는다.
5. `ornament`는 마지막 파트 후보로만 허용한다.
6. 별씨앗은 3~4 파트, 별탐험가는 5~6 파트, 별조종사는 6~8 파트를 기본 목표로 둔다.
7. 대칭 구조는 좌우를 각각 분리하되, 너무 짧으면 하나의 묶음 파트로 합친다.
8. 첫 파트 시작점은 주변 48px 이상 빈 공간을 우선한다.
9. 종료점과 다음 시작점이 너무 가까우면 하나의 의미 파트로 재합친다.
10. 파트 완료 후에는 해당 부위만 색 변화/스티커/별 보상을 준다.

### 현재 코드 연결 지점
- `/home/sang/Projects/kids-coloring-app/js/trace-path.js`
  - semantic lane 진입/폴백 결정
- `/home/sang/Projects/kids-coloring-app/js/trace-semantic.js`
  - family 감지, part 후보 생성, ordering, displayName/hint 결정
- `/home/sang/Projects/kids-coloring-app/js/trace-shape-family.js`
  - family별 label/preset 규칙
- `/home/sang/Projects/kids-coloring-app/js/app.js`
  - `partLabel`, 힌트, progress, 완료 보상, 다음 파트 강조

## semantic QA 하네스 확장 계획

### 현재 하네스 한계
- `/home/sang/Projects/kids-coloring-app/verify-fill-regions.html`는 현재 lineart/fill 중심 검증이 강하다.
- tracing은 `parts 개수`와 진입 성공 정도만 볼 수 있고, `semantic quality`를 판정하는 게이트가 약하다.

### 추가할 semantic QA 항목
| 항목 | 의미 | 통과 기준 |
|---|---|---|
| `resolved_family` | family 분기 결과 | 기대 family와 일치 |
| `first_part_name` | 첫 파트 표시명 | 비어 있지 않고 의미 명사 |
| `first_two_parts_recognizable` | 첫 2개 파트 뒤 대상 인지 가능성 | family별 기대값 충족 |
| `part_count_in_range` | 난이도별 파트 수 범위 | family/difficulty gate 만족 |
| `ordering_matches_expected` | 실제 순서와 기대 순서의 일치도 | 핵심 파트 순서 역전 없음 |
| `ornament_last` | 장식 파트 배치 | ornament는 마지막 20~30% |
| `head_feature_late` | 얼굴 디테일 배치 | body/silhouette 이후 등장 |
| `part_name_coverage` | 파트 이름 채움률 | 100% |

### 샘플 레코드 확장
verification 하네스용 샘플 메타데이터는 아래 필드를 가져야 한다.

```json
{
  "id": "longneck_cometdino_01",
  "family": "longneck_animal",
  "difficulty": "explorer",
  "expected_parts": ["body", "neck_head", "tail", "legs"],
  "expected_part_count": 4,
  "expected_first_part": "몸통",
  "expected_order": ["몸통", "목", "머리", "앞다리", "뒷다리", "꼬리"],
  "max_points_per_part": 5,
  "tolerance_multiplier": 1.15
}
```

### verification UI 확장 항목
1. `Selected / Resolved / Family` 표시
2. `semantic parts` 표
   - index
   - displayName
   - semanticCategory
   - drawOrder
   - pointCount
3. `semantic gates` 결과 카드
   - first part
   - order
   - ornament-last
   - face-late
4. 실패 시 `verification_failed` payload에 semantic reason 포함

### 실패 reason 표준화
| code | 설명 |
|---|---|
| `semantic_first_part_unknown` | 첫 파트 이름 없음 또는 의미 불명 |
| `semantic_order_regressed` | 핵심 파트 순서 역전 |
| `semantic_face_too_early` | 얼굴/장식이 너무 일찍 등장 |
| `semantic_part_count_out_of_range` | family/difficulty 기준 파트 수 이탈 |
| `semantic_name_missing` | semantic part 중 이름 비어 있음 |

## 50개 샘플셋 운영 기준
- 자체 SVG, 적법 라이선스 자산, 퍼블릭 도메인만 사용한다.
- 각 자산은 `asset_source`, `license`, `creator`, `revision` 메타데이터를 붙인다.
- 샘플셋은 최소 아래 8개 family 분포를 유지한다.
  - `round_character` 8
  - `longneck_animal` 6
  - `quadruped_animal` 8
  - `vehicle` 8
  - `sticker_object` 8
  - `humanoid` 4
  - `scene_object` 4
  - `symbol_path` 4

## 구현 우선순위
1. `TracingPart` 데이터 모델과 family-aware ordering 규칙 고정
2. `displayName / hint / part-label` 완전 semantic화
3. `verify-fill-regions.html`에 semantic gate 추가
4. `quadruped_animal` / `vehicle` family 확장
5. 50개 샘플셋 제작과 QA 스프레드시트 운영
6. 실제 아동/보호자 관찰 세션으로 시작 시간, 다음 파트 발견률, 파트 언어화 기록

## 이번 단계에서 바로 할 일
- `trace-semantic.js`
  - `quadruped_animal`, `vehicle` family 추가
  - `displayName`, `hint`, `toleranceMultiplier` 생성
- `app.js`
  - 현재/다음 파트 강조를 semantic 기반으로 축소
  - 파트 완료 시 부위별 피드백 강화
- `verify-fill-regions.html`
  - semantic gate 카드와 failure reason 추가

## 2026-08-13 진행 메모
- illustration semantic part에 `semanticId`, `displayName`, `hint`, `toleranceMultiplier` 메타데이터를 추가했다.
- `app.js`는 semantic part가 제공한 `hint`와 `displayName`을 직접 사용하도록 연결했다.
- tracing 시작/스냅/완료 판정 반경이 `toleranceMultiplier`를 반영하도록 바꿨다.

## 정리
- UX 조사 노트는 방향성을 준다.
- semantic tracing 설계 문서는 코드 규칙을 준다.
- QA 문서는 통과 기준을 준다.
- 이 문서는 세 가지를 실행 순서와 파일 경계까지 포함한 제품 실행 문서로 합친 버전이다.
