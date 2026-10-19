# 알파벳·숫자 획순 따라쓰기

## 요청과 설계

- 2026-10-20: 알파벳·숫자를 글자에 맞게 따라 그리도록 요청.
- 기존 알파벳 26개와 숫자 1~10은 색칠 전용 이미지였다. 외곽선 추적은 획순 학습과 달라, 자체 제작한 쓰기 도안과 중심선 경로를 같은 원본에서 생성했다.
- A–Z 대문자, 숫자 0~10 총 37개. 기존 항목 ID·분류는 보존하고 0을 추가했다. 숫자는 0부터 10까지 표시한다.
- 선택한 영문 인쇄체 획 구분을 사용한다. 영문 쓰기에는 교육 방식별 변형이 있으므로 유일한 공식 획순이라고 주장하지 않는다. 소문자는 이번 요청 범위에 추가하지 않았다.
- A는 왼쪽 사선→오른쪽 사선→가로선, M/N은 세로획과 사선을 분리한다. 4는 꺾인 획과 세로획, 10은 1과 0을 분리한다. 원형도 순방향의 열린 경로로 기록해 중간 시작·역방향을 방지한다.

## 구현

- /home/sang/Projects/kids-coloring-app/scripts/create-writing-guides.mjs: 직접 작성한 SVG 선·곡선에서 시각 도안과 촘촘한 경로 JSON 생성. 실행 결과 37쌍, 약 1.1MB.
- /home/sang/Projects/kids-coloring-app/assets/writing-guides/: 74개 SVG/JSON. 기존 원본 PNG는 삭제하지 않는다.
- /home/sang/Projects/kids-coloring-app/js/packs/writing-guides.js: 기존 알파벳/숫자 항목을 원본 쓰기 도안·경로에 연결, 0 추가.
- /home/sang/Projects/kids-coloring-app/js/guided-trace.js: directional 옵션이 있는 쓰기 도안만 시작점·순방향을 제한. 손을 떼면 마지막 방문 지점에서 재개하도록 하여 중간 건너뛰기를 막는다. 공룡 등 기존 도안의 양방향 추적은 유지한다.
- /home/sang/Projects/kids-coloring-app/js/app.js: 현재 획 시작점에 파란 점, 획 번호와 안내 문구 표시. 기존 500줄 초과 파일의 소유 함수에 소규모 표시만 추가했으며 광범위한 분리는 수행하지 않았다.
- 앱/갤러리/경로/도안 팩 URL을 writing-1로 갱신. sw.js v13에 생성 도안·경로 및 팩 모듈을 포함했다. 오프라인 설치 전체를 실제 기기에서 재검증하지는 않았다.

## 검증

- 새 도안 연결로 기존 경로 수 6개 고정 테스트가 43 != 6으로 실패했다. 새로운 37개 도안을 반영해 기대 개수를 43으로 갱신했으며, 경로 파일 보유와 기존 색칠 전용 도안 검증은 유지했다.
- /home/sang/Projects/kids-coloring-app/tests/writing-guides.test.js: 37개 글자 매칭, 280/350/600px 경로 연속성과 완주, 틀린 시작·순간이동·역방향·손 뗀 후 건너뛰기 거부 확인. 숫자 정렬도 검증한다.
- node --test tests/*.test.js: 58개 통과.
- 390×844 실제 브라우저 터치: A 3획, 8 1획, 10 2획 완주 및 선 커버리지 100% 확인. 10은 해당 실행의 새 완료/색칠 이벤트까지 검증했다.
- 브라우저 검사에서 누적 이벤트의 과거 성공을 재사용하지 않도록 guided-browser-smoke.js를 현재 실행 전후 이벤트 개수 비교로 강화했다.
- 갤러리 검사가 숫자 필터 상태에서 전체 목록을 기대해 한 번 실패했다. 검사 시작 시 모두 필터를 선택하도록 수정 후 전체 142개(0 추가)의 바깥 배경 색칠 픽셀 검증 통과.
- 숫자 11개 모두 경로 보유 표시, 알파벳 갤러리 및 A의 획 안내 스크린샷 검수. 브라우저 콘솔 entries 없음.
- 스크린샷: /home/sang/.cli-jaw/screenshots/screenshot_1792446846231.png (A 시작점/1획), /home/sang/.cli-jaw/screenshots/screenshot_1792446894270.png (숫자 도안), /home/sang/.cli-jaw/screenshots/screenshot_1792446897579.png (알파벳).
- 로컬 변경·검증·커밋까지 수행. 공개 배포는 하지 않는다.
