# Kids Coloring App — Full-Spec Upgrade Plan

## Objective
Bimi Boo 레퍼런스 기반 유아용 그림그리기/색칠 앱 풀스펙 업그레이드.
핵심 차별화: 내 사진 → 선화 → 트레이싱 → 색칠.

## Constraints
- 웹앱 (Canvas), 순수 JS, API 키 없이 동작
- AI 연동 코드는 준비하되 키 없이도 완전 동작
- mukja.co.kr 배포, 이후 앱스토어 예정
- 기존 프로토타입 확장 (3커밋, index.html 560줄)

## Work-Phase Map (dependency-ordered)

| Phase | 범위 | PABCD Cycle | Decade |
|-------|------|-------------|--------|
| 1 | 아키텍처 분리 + Canny 엣지 개선 + AI placeholder | Cycle 1 | 10-range |
| 2 | 창의적 모드 3종 + 모드 선택 UI | Cycle 2 | 20-range |
| 3 | 프리셋 템플릿 5종 + UI 폴리싱 + PWA + 배포 | Cycle 3 | 30-range |

## Success Criteria (7 items)
1. 사진 → 선화 변환 (Canny 클라이언트)
2. 점선 따라그리기 → 완성 판정
3. 색칠 모드 → 영역 내 색칠
4. 창의적 모드 3종 (자유 스케치, 만화경, 네온)
5. 프리셋 템플릿 5종 이상
6. 모바일 터치 UX 매끄러움
7. mukja.co.kr 배포 가능

## Loop-spec
- Archetype: spec-satisfaction (verifier = 7 criteria pass/fail)
- Stop condition: all 7 criteria pass
- Memory artifact: this devlog
