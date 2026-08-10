# Next Feature Design — Color Magic Layer

## Why
- `line constraint`와 `trace feedback`은 완료됐다.
- 다음 차별점은 색칠 모드에서 `탭 직전 예측 가능성`과 `탭 직후 보상감`을 동시에 올리는 것이다.

## Scope
- `hover/touch preview`: 현재 구현한 영역 프리뷰를 기준 UX로 고정
- `fill burst`: 영역 채우기 성공 시 해당 영역 중심에 컬러 파티클 버스트
- `smart mission`: 큰 영역부터 추천하거나 아직 안 칠한 영역을 힌트로 제안

## UX Flow
1. 아이가 손가락/마우스를 올리면 칠해질 영역이 먼저 반짝인다.
2. 탭하면 즉시 채워지고 작은 버스트가 터진다.
3. 오래 멈추면 “다음은 여기!” 식의 부드러운 힌트를 준다.

## Technical Notes
- `regionMap`/`regions`를 그대로 재사용한다.
- `fill burst`는 기존 particle system에 `region.center` 또는 `region.bounds` 중심 좌표만 추가하면 된다.
- `smart mission`은 `paintByRegion`에서 비어 있는 큰 영역을 찾는 가벼운 정렬 로직으로 시작한다.

## Acceptance
- 색칠 모드에서 탭 전 하이라이트가 항상 현재 영역과 일치할 것
- 탭 성공 시 시각적 보상이 150ms 안에 보일 것
- 힌트는 과도하게 깜빡이지 않고, 이미 칠한 영역을 다시 추천하지 않을 것

## Implemented on 2026-08-10
- `fill burst`를 기존 `spawnParticles()` 기반으로 구현했다.
- 탭 지점에 즉시 작은 버스트, 영역 중심에 더 큰 버스트를 한 번 더 터뜨린다.
- 입자 수와 크기는 `region.area`에 비례해 커지도록 조정했다.
