"""Recover the two available Spine path sets without inferring new contours."""
import json
import math
from pathlib import Path

import cv2
import numpy as np
import UnityPy
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SOURCES = [
    ('snake', 'stars-snake', Path('/home/sang/Downloads/1122/assets/aa/Android/duplicateassetisolation_assets_all_dcf2c3f47057e8fb42760721421ef433.bundle')),
    ('polar-bear', 'spine', Path('/home/sang/Downloads/1122/assets/active/android/bundles/stars-polar-bear/stars-polar-bear.bundle')),
]


def matrix(data: dict) -> np.ndarray:
    angle = math.radians(data.get('rotation', 0))
    c, s = math.cos(angle), math.sin(angle)
    sx, sy = data.get('scaleX', 1), data.get('scaleY', 1)
    return np.array([[c*sx, -s*sy, data.get('x', 0)],
                     [s*sx, c*sy, data.get('y', 0)], [0, 0, 1]])


def world_vertices(attachment: dict, bones: list, slot_bone: np.ndarray) -> np.ndarray:
    values = attachment['vertices']
    count = attachment['vertexCount']
    if len(values) == count * 2:
        return (slot_bone @ np.vstack([np.array(values).reshape(-1, 2).T, np.ones(count)]))[:2].T
    result, cursor = [], 0
    for _ in range(count):
        influences = int(values[cursor])
        cursor += 1
        vertex, total = np.zeros(3), 0
        for _ in range(influences):
            bone, x, y, weight = values[cursor:cursor+4]
            cursor += 4
            vertex += (bones[int(bone)] @ [x, y, 1]) * weight
            total += weight
        if abs(total-1) > 0.001:
            raise ValueError('Invalid source bone weights')
        result.append(vertex[:2])
    if cursor != len(values):
        raise ValueError('Unconsumed path vertices')
    return np.array(result)


def sample_curve(vertices: np.ndarray, closed: bool) -> np.ndarray:
    # Spine: incoming handle precedes the first knot. Open paths omit end handles.
    knots = np.concatenate([vertices[1:], vertices[:2]]) if closed else vertices[1:-1]
    if (len(knots)-1) % 3:
        raise ValueError('Invalid cubic path vertex count')
    result = [knots[0]]
    for index in range(0, len(knots)-1, 3):
        a, b, c, d = knots[index:index+4]
        length = np.linalg.norm(np.diff([a, b, c, d], axis=0), axis=1).sum()
        for t in np.linspace(0, 1, max(2, int(math.ceil(length/1.5))))[1:]:
            u = 1-t
            result.append(u*u*u*a + 3*u*u*t*b + 3*u*t*t*c + t*t*t*d)
    return np.array(result)


def atlas_regions(text: str) -> dict:
    result, current = {}, None
    for line in text.splitlines():
        if line and not line.startswith(' ') and ':' not in line and not line.endswith('.png'):
            current = line
            result[current] = {}
        elif line.startswith('  ') and current:
            key, value = line.strip().split(': ', 1)
            result[current][key] = value
    return result


def convert(identifier: str, key: str, source: Path) -> None:
    environment = UnityPy.load(str(source))
    texts = {o.read().m_Name: o.read().m_Script for o in environment.objects if o.type.name == 'TextAsset'}
    skeleton = json.loads(texts[key])
    atlas = next(o.read().image.convert('RGBA') for o in environment.objects
                 if o.type.name == 'Texture2D' and o.read().m_Name == key)
    regions = atlas_regions(texts[key+'.atlas'])
    bones, bone_names = [], {}
    for bone in skeleton['bones']:
        parent = bone_names.get(bone.get('parent'), np.eye(3))
        # Both admitted assets have unit setup scales; noScale is then equivalent.
        if bone.get('scaleX', 1) != 1 or bone.get('scaleY', 1) != 1:
            raise ValueError('Non-unit setup scales need an explicit inheritance decoder')
        world = parent @ matrix(bone)
        bones.append(world)
        bone_names[bone['name']] = world
    slots = {s['name']: s for s in skeleton['slots']}
    attachments = skeleton['skins'][0]['attachments']
    paths = []
    for slot, items in attachments.items():
        for name, data in items.items():
            if data.get('type') != 'path':
                continue
            closed = data.get('closed', False)
            vertices = world_vertices(data, bones, bone_names[slots[slot]['bone']])
            paths.append((int(name.split('-')[1]), closed, sample_curve(vertices, closed)))
    paths.sort()
    combined = np.concatenate([p for _, _, p in paths])
    low, high = combined.min(axis=0), combined.max(axis=0)
    center, scale = (low+high)/2, 460/max(high-low)
    projection = np.array([[scale, 0, 300-center[0]*scale], [0, -scale, 300+center[1]*scale], [0, 0, 1]])
    steps, paper = [], np.full((600, 600, 3), 255, dtype='uint8')
    for index, closed, path in paths:
        transformed = (path-center)*[scale, -scale]+[300, 300]
        points = [transformed[0]]
        for point in transformed[1:]:
            if np.linalg.norm(point-points[-1]) >= 2:
                points.append(point)
        points.append(points[0] if closed else transformed[-1])
        labels = ['머리', '이마 무늬', '얼굴 무늬', '몸통과 꼬리', '목 무늬'] if identifier == 'snake' else [
            '머리', '코', '왼쪽 귀', '오른쪽 귀', '몸통', '왼쪽 발', '오른쪽 발', '왼쪽 팔', '오른쪽 팔']
        steps.append({'name': labels[index], 'sourcePath': f'path-{index}', 'closed': closed,
                      'points': np.round(points, 2).tolist()})
    layering = [3, 0, 1, 2, 4] if identifier == 'snake' else [4, 5, 6, 2, 3, 7, 8, 0, 1]
    for index in layering:
        step = steps[index]
        polygon = np.round(step['points']).astype('int32')
        if step['closed']:
            cv2.fillPoly(paper, [polygon], (255, 255, 255))
        cv2.polylines(paper, [polygon], step['closed'], (40, 40, 40), 4, cv2.LINE_AA)
    for slot, items in attachments.items():
        active = slots[slot].get('attachment')
        if not active or not active.startswith('static-') or active not in regions:
            continue
        data, region = items[active], regions[active]
        if data.get('type', 'region') != 'region' or region.get('rotate') != 'false':
            raise ValueError('Unsupported static atlas attachment')
        x, y = map(int, region['xy'].split(','))
        w, h = map(int, region['size'].split(','))
        image = np.array(atlas.crop((x, y, x+w, y+h)))
        # Static eye assets have cyan editor accents: keep the worksheet monochrome.
        gray = cv2.cvtColor(image[:, :, :3], cv2.COLOR_RGB2GRAY)
        image[:, :, :3] = gray[:, :, None]
        pixels = np.array([[data['width']/w, 0, -data['width']/2], [0, -data['height']/h, data['height']/2], [0, 0, 1]])
        world = projection @ bone_names[slots[slot]['bone']] @ matrix(data) @ pixels
        layer = cv2.warpAffine(image, world[:2], (600, 600))
        alpha = layer[:, :, 3:4]/255
        paper = np.round(paper*(1-alpha)+layer[:, :, :3]*alpha).astype('uint8')
    output = ROOT/'assets'/'recovered-guides'
    output.mkdir(exist_ok=True)
    guide = {'version': 1, 'width': 600, 'height': 600, 'source': f'{identifier}: authored Spine 3.8 path attachments', 'steps': steps}
    (output/f'{identifier}.json').write_text(json.dumps(guide, ensure_ascii=False))
    Image.fromarray(paper).save(output/f'{identifier}.png')
    print(identifier, len(steps), 'steps;', sum(not s['closed'] for s in steps), 'open')


if __name__ == '__main__':
    try:
        for arguments in SOURCES:
            convert(*arguments)
    except Exception as error:
        raise SystemExit(f'Spine path import failed: {error}') from error
