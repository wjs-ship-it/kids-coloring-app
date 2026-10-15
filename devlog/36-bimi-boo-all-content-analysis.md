# Bimi Boo 전체 콘텐츠 분석

- 분석 대상: 로컬 base.apk, SHA-256 `053a238b6ddb6be62930de6f03044b30b483b549831297d3ad20a62f56f429ce`.
- 근거: Unity data.unity3d의 TextAsset `bundles.structure`, `bundles.names` 및 APK의 콘텐츠 번들 직접 파싱.
- 고유 콘텐츠 1,070개. 메뉴 등록 1,086건에서 무료/학기 시작 모음의 중복 16건 제거.
- APK 내 콘텐츠 28개, 나머지 1,042개는 목록만 존재하며 이미지와 세부 단계는 확인되지 않음.
- 이미지 장수는 콘텐츠 단위로 집계. 썸네일·UI·배경·레이어·텍스처를 별도 그림으로 중복 집계하지 않음.

## 모드별 집계

| 모드 ID | 고유 콘텐츠 |
|---|---:|
| drawing-coloring | 503 |
| dot-to-dot | 25 |
| coloring | 103 |
| scratch-coloring | 25 |
| color-by-number | 12 |
| mandala | 32 |
| free-drawing | 137 |
| stars-drawing | 95 |
| drawing-letters | 26 |
| drawing-numbers | 10 |
| pixel-drawing | 30 |
| free-pixel-drawing | 12 |
| pixel-numbers | 30 |
| pixel-circles | 30 |

## 따라 그리기 및 색칠: 26개 분류, 539개

| 분류 | 수 | 전체 콘텐츠 ID |
|---|---:|---|
| 공룡 | 15 | diplodocus, tirex, beipiaosaurus, kelenken, spinosaurus, triceratops, oviraptor, telaruruz, pterodactyl, parasaurolophus, stegosaurus, longisquama, anteosaurus, edmontonia, achillobator |
| 문자 | 26 | a, b, c, d, e, f, g, h, i, j, k, l, m, n, o, p, q, r, s, t, u, v, w, x, y, z |
| 마법의 세계 | 24 | unicorn, fairy, dragon, st-patrick-leprechaun-boy, robin-hood, thumbelina, phoenix, snow-queen, cinderella, genie, rapunzel, pirate, elf, mermaid, dwarf, king, st-patrick-leprechaun, malvina, pinoccio, mowgli, giant, carnival-mask-1, st-patrick-leprechaun-hat, st-patrick-rainbow-cauldron |
| 숫자 | 10 | one, two, three, four, five, six, seven, eight, nine, ten |
| 농장 | 27 | pig, dog, bull, horse, cavy, easter-chick, easter-duckling, rabbit, duck, turkey, mouse, goat, lama, cow, goose, pheasant, easter-basket, dove, mill, cat, hen, sheep, donkey, mole, rooster, chinchilla, stork |
| 교통수단 | 14 | police, fire, concrete, dump-truck, car, garbage, ambulance, elevator, postal-machine, truck, excavator, hydraulic-hammer, road-roller, helicopter |
| 바다 | 19 | dolphin, turtle, octopus, nemo, crab, jellyfish, seahorse, shrimp, crampfish, shark, whale, axolotl, piranha, fish-sword, squid, sea-urchin, pufferfish, cuttlefish, morayeel |
| 모양 | 23 | circle2, square2, triangle2, rhombus2, star2, cross, shamrock, parallelogram, quatrefoil, crescent, heart2, trapezoid2, oval2, rectangle2, semicircle2, pentagon, hexagon, octogon, arrow, star-2, st-patrick-clover, easter-egg-1, easter-egg-2 |
| 정글 | 24 | st-patrick-parrot, carnival-toucan, colibri, bongo, peacock, tiger, gorilla, sloth, chameleon, koala, monkey, anteater, boa, toucan, tapir, lemur, tarantula, capybara, lori, ara-parrot, duiker, jaguar, panther, okapi |
| 로봇 | 21 | robot22, robot21, robot2, robot-18, robot1, robot7, robot9, robot6, robot5, robot8, robot4, robot10, robot3, robot11, robot12, robot13, robot15, robot-16, robot-17, robot-19, robot-20 |
| 직업 | 19 | policeman, firefighter, cook, carnival-girl-peacock, carnival-girl, carnival-boy-capoeiro, carnival-boy-jaguar, rockstar, ballerina, skateboarder, clown, magician, farmer, gardener, scientist, detective, builder, snowboarder, racer |
| 숲 | 24 | hedgehog, desman, badger, otter, woodpecker, skunk, puma, moose, hedgehog-house, owl, raccoon, bear, squirrel, deer, hare, beaver, squirrel-house, wolf, snake, frog, hare-house, fox, bat, crab-house |
| 가정용품 | 25 | scales, camera, microscope, lamp, blender, vacuumcleaner, mixer, sewingmashine, tv, boombox, washer, oven, toaster, kettle, alarm, iron, watering-can, cup, computer, coffee-pot, fan, multicooker, phone, drawing_coloring_household_calculator_bts, drawing_coloring_toys_clock_bts |
| 곤충 | 23 | mahon, cockroach, bumblebee, cicada, moth, bee, ant, mosquito, snail, dragonfly, spider, butterfly, caterpillar, ladybug, worm, snail-house, fly, grasshopper, centipede, caterpillar-house, rhinoceros-beetle, glowworm, leaf-beetle |
| 우주 | 21 | rocket, dog-astronaut, alien-5, comet, flying_ship, astronaut, space_locator, alien_1, alien_2, moon_rover_1, satellite, moon_rover_2, spaceship, astronaut-2, alien-3, telescope, rocket-2, cat-astronaut, spaceship-2, alien-house, alien-4 |
| 괴물 | 21 | st-patrick-leprechaun-girl, monster-4, monster-8, monster-10, monster-7, monster-2, monster-3, monster-1, monster-6, monster-9, monster-5, monster-11, monster-13, monster-14, monster-12, monster-16, monster-15, monster-20, monster-18, monster-17, monster-19 |
| 크리스마스 | 20 | christmas_santa, christmas_deer, christmas_elf, christmas_snowman, snow-maiden, christmas-penguin, christmas-sock, christmas-bauble, christmas-watch, christmas_santa_sleigh, christmas_girl, christmas_tree, christmas_present, christmas_man, christmas_nutcracker, christmas-cocoa, gingerbread-house, elf-girl, gingerbread-girl, bunny-boy |
| 사바나 | 23 | lion, jackal, hornbill, porcupine, caracal, echidna, theraphosidae, parrot, hippo, ostrich, rhinoceros, crocodile, zebra, giraffe, elephant, leopard, antelope, warthog, baboon, flamingo, genetta, wombat, egyptian-cobra |
| 장난감 | 24 | whistle-bird, frog-rattle, soap-gun, whirligig, roly_poly_toy, doll, train, robot, pyramid, constructor, rocking_horse, rattle, teddy_bear, boat, cartoy, hare-toy, ball, stroller-toy, elephant-toy, duck-toy, tin-soldier, nesting-doll, wind-spinner, camera-toy |
| 디저트 | 20 | camel, meerkat, fenech, scorpio, armadillo, kangaroo, jerboa, gazelle, hyena, spalax, scarab, locusts, stenocara, varan, cheetah, vulture, mendes, long-eared-hedgehog, neophron, cayote |
| 자연 | 22 | chamomile, peanut, cloud, volcano, sun, sprout, moon, cactus, snowflake, tree, mashroom, easter-tulip, flower, birdhouse, stump, leaf, bonfire, acorn, spruce, cone, rainbow, dandelion |
| 북극 | 19 | penguin2, walrus, lemming, puffin_bird, wolverine, sea_elephant, ermine, seal, reindeer, muskox, partridge, snow-ram, arctic-fox, cormorant, snow-goat, lynx, albatross, arctic-dog, arctic-gull |
| 음식 | 21 | broccoli, burger, easter-cake, donut, hot_dog, cake, cookie, cupcake, porridge, ice_cream, viennese_waffle, roll, taco, pizza, croissant, milk, strawberry, apple, french-fries, noodles, carrot |
| 친구들 | 14 | cat2, easter-bunny-boy, easter-rabbit-basket, easter-duck-girl, carnival-peacock, penguin, piglet, lion2, monkey2, hen2, bear2, puppy, bunny, hedgehog2 |
| 음악 | 21 | drum, accordion, harp, maracas, guitar, gramophone, tamtam, saxophone, harmonica, balalaika, st-patrick-harp, bagpipes, tambourine, violin, synthesizer, gusli, french-horn, xylophone, organ, spoon, clarinet |
| 할로윈 | 19 | pumpkin, ghost, vampire, mummy, spider1, witch, house_with_ghost, vat_of_potion, fillin, frankenstein, skeleton-boy, pumpkin-girl, witch-cat, broom, hat, ghost-2, crow, werewolf, devil |

## APK에 포함된 모든 콘텐츠의 구조

| 콘텐츠 | 텍스처 | Sprite | 단계/배경/마스크 atlas region 수 |
|---|---:|---:|---:|
| cbn-wild-animals-3 | 56 | 56 | 0 |
| coloring-princesses-11-(princess-1) | 11 | 11 | 0 |
| diplodocus | 1 | 0 | 30 |
| dtd-18-(moon-bear) | 11 | 11 | 0 |
| finish-picture-5-(diplodocus) | 1 | 1 | 0 |
| free-drawing-1 | 1 | 1 | 0 |
| free-drawing-10 | 1 | 1 | 0 |
| free-drawing-2 | 1 | 1 | 0 |
| free-drawing-3 | 1 | 1 | 0 |
| free-drawing-4 | 1 | 1 | 0 |
| free-drawing-5 | 1 | 1 | 0 |
| free-drawing-6 | 1 | 1 | 0 |
| free-drawing-7 | 1 | 1 | 0 |
| free-drawing-8 | 1 | 1 | 0 |
| free-drawing-9 | 1 | 1 | 0 |
| mandala-2-5 | 1 | 1 | 0 |
| mandala-8-1 | 1 | 1 | 0 |
| mandala-8-2 | 1 | 1 | 0 |
| mandala-8-3 | 1 | 1 | 0 |
| mandala-8-4 | 1 | 1 | 0 |
| mandala-8-5 | 1 | 1 | 0 |
| mandala-8-6 | 1 | 1 | 0 |
| mandala-8-7 | 1 | 1 | 0 |
| mandala-8-8 | 1 | 1 | 0 |
| pixel-shapes-4(deer) | 2 | 2 | 0 |
| scratch-2-(excavator) | 14 | 14 | 0 |
| scratch_coloring_bimi_scholar_25_bts | 18 | 18 | 0 |
| stars-polar-bear | 1 | 0 | 9 |

## 분석 결과와 적용 방향

- 일반 따라 그리기: 그림 503개 + 영문자 26개 + 숫자 10개. 공룡 15개 외 동물, 차량, 사람, 로봇, 물건, 자연 등으로 구성된다.
- 공룡: Spine/atlas 안에 step, mask, back 레이어가 있다. 다른 502개 일반 그림도 동일한 세부 순서라고 단정할 근거는 없다.
- 별 따라 그리기 북극곰: 별도 Spine JSON/atlas와 음원이 있다. 일반 따라 그리기와 별도의 표현 체계를 사용한다.
- 공주 색칠: Sprite 11개로 윤곽선·배경·영역 레이어를 분리한다.
- 굴착기 스크래치: Sprite 14개. 학기 시작 Bimi 스크래치: 18개. stroke, image-progress, 배경 및 조각 레이어가 있다.
- 숫자 색칠: Sprite 56개와 export_data 배치 정보가 있다.
- 점 잇기 달곰: Sprite 11개와 InformationAboutLine 좌표 정보가 있다.
- 사슴 픽셀: 픽셀 이미지와 아이콘, 5색 palette JSON이 있다.
- 자유 그림 11개 및 만다라 9개는 각 stroke 텍스처/Sprite 1개를 포함한다.
- 제품 설계: 모든 모드에 머리/몸통/다리 추론을 적용할 수 없다. 동물·사람·기계·물건·도형·문자별 파트 규칙과 모드별 진행 모델이 필요하다.

## 한계와 남은 작업

- 전체 1,070개 목록·분류 분석은 완료. 실제 이미지 분석은 APK에 포함된 28개로 제한된다.
- 1,042개의 누락 콘텐츠를 분석하려면 해당 버전의 내려받은 콘텐츠 번들/앱 데이터 또는 콘텐츠 서버의 배포 메타데이터가 필요하다. 현재 Addressables catalog의 InternalIds에는 http URL이 없다.
- 로컬 APK 정적 분석이며 실제 실행 순서·유료 해제 상태·최신 서버 콘텐츠 수는 검증하지 않았다.
- content-inventory.csv: 전체 고유 콘텐츠와 중복 없는 모드, 모든 메뉴/분류 소속, APK 포함 여부.
- bundled-content-analysis.json: 포함 콘텐츠의 객체 수, 텍스처 크기 및 atlas region 이름.
