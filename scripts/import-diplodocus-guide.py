"""Convert the reference's ten authored mask rings into continuous web paths."""
import argparse
import json
import math
from pathlib import Path

import cv2
import numpy as np
import UnityPy
from PIL import Image
from skimage.morphology import skeletonize


def transform(x=0, y=0, rotation=0, sx=1, sy=1):
    angle = math.radians(rotation)
    c, s = math.cos(angle), math.sin(angle)
    return np.array([[c * sx, -s * sy, x], [s * sx, c * sy, y], [0, 0, 1]])


def read_bundle(source):
    texts, image = {}, None
    for obj in UnityPy.load(str(source)).objects:
        if obj.type.name == 'Texture2D':
            image = obj.read().image.convert('RGBA')
        elif obj.type.name == 'TextAsset':
            data = obj.read()
            texts[data.m_Name] = data.m_Script
    return image, json.loads(texts['diplodocus']), texts['diplodocus.atlas']


def read_regions(text):
    regions, name = {}, None
    for line in text.splitlines():
        if line and not line.startswith(' ') and ':' not in line and line != 'diplodocus.png':
            name = line
            regions[name] = {}
        elif line.startswith('  ') and name:
            key, value = line.strip().split(': ', 1)
            regions[name][key] = value
    return regions


def ordered_ring(mask):
    skeleton = skeletonize(mask).astype('uint8')
    height, width = mask.shape
    pixels = {tuple(point) for point in np.argwhere(skeleton)}

    def neighbors(point):
        y, x = point
        found = []
        for dy in [-1, 0, 1]:
            for dx in [-1, 0, 1]:
                if not dx and not dy:
                    continue
                target = (y + dy, x + dx)
                if not (0 <= x + dx < width and 0 <= y + dy < height) or target not in pixels:
                    continue
                if dx and dy and ((y, x + dx) in pixels or (y + dy, x) in pixels):
                    continue
                found.append(target)
        return found

    if not pixels or any(len(neighbors(point)) != 2 for point in pixels):
        raise ValueError('Authored mask is not a single closed centerline')
    start = min(pixels)
    previous, current, ordered = None, start, []
    while not ordered or current != start:
        ordered.append(current)
        current, previous = next(point for point in neighbors(current) if point != previous), current
        if len(ordered) > len(pixels):
            raise ValueError('Centerline traversal did not close')
    if len(ordered) != len(pixels):
        raise ValueError('Mask has more than one separate ring')
    return np.array([[x, y, 1] for y, x in ordered]).T


def mesh_points(data, pixels, width, height, bones):
    uv = np.array(data['uvs']).reshape(-1, 2)
    encoded, cursor, vertices = data['vertices'], 0, []
    if len(encoded) == len(data['uvs']):
        raise ValueError('Unweighted mesh needs a declared slot transform')
    for _ in uv:
        count = int(encoded[cursor])
        cursor += 1
        point = np.zeros(3)
        for _ in range(count):
            bone, x, y, weight = encoded[cursor:cursor + 4]
            cursor += 4
            point += (bones[int(bone)] @ [x, y, 1]) * weight
        vertices.append(point[:2])
    targets = pixels[:2].T / [width, height]
    world = np.full((len(targets), 2), np.nan)
    vertices = np.array(vertices)
    for triangle in np.array(data['triangles']).reshape(-1, 3):
        origin, second, third = uv[triangle]
        basis = np.column_stack([second - origin, third - origin])
        if abs(np.linalg.det(basis)) < 1e-10:
            continue
        relative = (np.linalg.inv(basis) @ (targets - origin).T).T
        weights = np.column_stack([1 - relative.sum(axis=1), relative])
        inside = (weights.min(axis=1) >= -0.005) & np.isnan(world[:, 0])
        world[inside] = weights[inside] @ vertices[triangle]
    if np.isnan(world).any():
        raise ValueError('Authored centerline escapes the Spine mesh UV hull')
    return world


def convert(source, output):
    atlas, skeleton, atlas_text = read_bundle(source)
    regions = read_regions(atlas_text)
    bones = {}
    for bone in skeleton['bones']:
        local = transform(bone.get('x', 0), bone.get('y', 0), bone.get('rotation', 0),
                          bone.get('scaleX', 1), bone.get('scaleY', 1))
        bones[bone['name']] = bones.get(bone.get('parent'), np.eye(3)) @ local
    slots = {slot['name']: slot['bone'] for slot in skeleton['slots']}
    attachments = skeleton['skins'][0]['attachments']

    def attachment(name):
        slot, data = next((slot, values[name]) for slot, values in attachments.items() if name in values)
        region = regions[name]
        if region['rotate'] != 'false':
            raise ValueError('Rotated atlas regions need an explicit decoder')
        x, y = map(int, region['xy'].split(','))
        width, height = map(int, region['size'].split(','))
        image = np.array(atlas.crop((x, y, x + width, y + height)))
        local = transform(data.get('x', 0), data.get('y', 0), data.get('rotation', 0))
        pixels = np.array([[data['width'] / width, 0, -data['width'] / 2],
                           [0, -data['height'] / height, data['height'] / 2], [0, 0, 1]])
        return image, bones[slots[slot]] @ local @ pixels, data

    rings = []
    for index in range(10):
        image, matrix, data = attachment(f'mask_{index}_0')
        red = (image[:, :, 0] > 100) & (image[:, :, 0] > image[:, :, 1] * 1.3) & (image[:, :, 3] > 128)
        centerline = ordered_ring(red)
        if data.get('type') == 'mesh':
            rings.append(mesh_points(data, centerline, image.shape[1], image.shape[0], list(bones.values())))
        else:
            rings.append((matrix @ centerline)[:2].T)
    all_points = np.concatenate(rings)
    low, high = all_points.min(axis=0), all_points.max(axis=0)
    center = (low + high) / 2
    scale = 500 / max(high - low)
    canvas_transform = np.array([[scale, 0, 300 - center[0] * scale],
                                 [0, -scale, 300 + center[1] * scale], [0, 0, 1]])
    names = ['머리', '목과 몸통, 꼬리', '다리 1', '다리 2', '다리 3', '다리 4',
             '무늬 1', '무늬 2', '무늬 3', '무늬 4']
    guide = {'version': 1, 'width': 600, 'height': 600, 'source': 'diplodocus Spine mask_0_0 through mask_9_0', 'steps': []}
    paper = np.full((600, 600, 3), 255, dtype='uint8')
    for index, ring in enumerate(rings):
        points = (ring - center) * [scale, -scale] + [300, 300]
        sampled, last = [points[0]], points[0]
        for point in points[1:]:
            if np.linalg.norm(point - last) >= 2:
                sampled.append(point)
                last = point
        sampled.append(sampled[0])
        guide['steps'].append({'name': names[index], 'points': np.round(sampled, 2).tolist()})
    for index in [3, 2, 1, 5, 4, 9, 8, 7, 6, 0]:
        polygon = np.round(guide['steps'][index]['points']).astype('int32')
        cv2.fillPoly(paper, [polygon], (255, 255, 255))
        cv2.polylines(paper, [polygon], True, (40, 40, 40), 4, cv2.LINE_AA)
    for index in range(4):
        image, matrix, _ = attachment(f'static_0_{index}')
        layer = cv2.warpAffine(image, (canvas_transform @ matrix)[:2], (600, 600))
        alpha = layer[:, :, 3:4] / 255
        paper = np.round(paper * (1 - alpha) + layer[:, :, :3] * alpha).astype('uint8')
    output.mkdir(parents=True, exist_ok=True)
    Image.fromarray(paper).save(output / 'diplodocus-guided-v1.png')
    lines = [json.dumps({key: value for key, value in guide.items() if key != 'steps'})[:-1] + ',"steps":[']
    lines += [json.dumps(step, ensure_ascii=False, separators=(',', ':')) + (',' if i < 9 else '') for i, step in enumerate(guide['steps'])]
    (output / 'diplodocus-guided-v1.json').write_text('\n'.join(lines) + '\n]}\n')
    print('Exported ten verified single-ring paths, original atlas transforms and static face details')


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('source', type=Path)
    parser.add_argument('output', type=Path)
    args = parser.parse_args()
    try:
        convert(args.source, args.output)
    except Exception as error:
        raise SystemExit(f'Diplodocus import failed: {error}') from error
