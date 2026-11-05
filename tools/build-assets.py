"""Export the exact shared vector shapes for Photoshop/Illustrator and p5.
Run from any directory: python tools/build-assets.py. Uses the Python standard library.
"""
import json
from pathlib import Path
from xml.sax.saxutils import escape

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'public/assets'
TOKENS = json.loads((OUT / 'design-tokens.json').read_text())
COLORS = TOKENS['colors']


def shape(kind, a, fill='none', stroke='ink', sw=2):
    return {'type': kind, 'a': a, 'fill': fill, 'stroke': stroke, 'sw': sw}


def rect(x, y, w, h, fill, radius=0, stroke='ink', sw=2):
    return shape('rect', [x, y, w, h, radius], fill, stroke, sw)


def ellipse(x, y, w, h, fill, stroke='ink', sw=2):
    return shape('ellipse', [x, y, w, h], fill, stroke, sw)


def line(x1, y1, x2, y2, stroke='ink', sw=2):
    return shape('line', [x1, y1, x2, y2], stroke=stroke, sw=sw)


def poly(a, fill, stroke='ink', sw=2):
    return shape('poly', a, fill, stroke, sw)


def bezier(a, stroke='ink', sw=2):
    return shape('bezier', a, stroke=stroke, sw=sw)


room = [
    rect(42, 62, 1116, 535, 'wall', 2, 'ink', 1.6),
    poly([42, 597, 1158, 597, 1158, 720, 42, 720], 'floor', 'ink', 1.6),
    poly([1039, 62, 1158, 62, 1158, 720, 1039, 598], '#d7d2c6', 'ink', 1.2),
    line(42, 601, 1039, 601, '#827f76', 1),
    line(217, 600, 110, 720, '#a69789', 1), line(488, 600, 462, 720, '#a69789', 1),
    line(794, 600, 860, 720, '#a69789', 1),
    ellipse(587, 650, 745, 84, '#b6b3a0', 'none'),
    ellipse(587, 650, 708, 65, 'none', '#989c88', 1),
    rect(143, 100, 239, 308, '#cbc7b9', 1),
    rect(155, 113, 214, 281, 'night', 0, 'ink', 1.4),
    ellipse(313, 158, 29, 29, '#eee3c7', 'none'),
    poly([157, 320, 186, 320, 186, 290, 212, 290, 212, 343, 237, 343, 237, 280, 269, 280, 269, 328, 293, 328, 293, 303, 330, 303, 330, 338, 369, 338, 369, 394, 155, 394], '#41535b', 'none'),
    rect(194, 304, 4, 8, '#c3b98a', 0, 'none'), rect(250, 301, 5, 8, '#c3b98a', 0, 'none'),
    rect(307, 319, 4, 8, '#c3b98a', 0, 'none'),
    line(262, 114, 262, 395, '#cbc7b9', 7), line(156, 250, 368, 250, '#cbc7b9', 7),
    rect(136, 408, 253, 13, '#a6a998', 1, 'ink', 1.5),
    rect(464, 134, 115, 137, '#c3b9a6', 0, 'ink', 1.4),
    rect(472, 142, 99, 121, 'paper', 0, '#9b9b8e', 1),
    ellipse(523, 195, 38, 41, 'none', '#8d9a90', 1.5),
    bezier([492, 242, 507, 221, 537, 219, 552, 241], '#8d9a90', 1.5),
    rect(883, 173, 131, 150, '#c8c1b2', 1, 'ink', 1.4),
    line(885, 250, 1012, 250, '#7c8076', 1.4),
    rect(903, 198, 12, 49, '#8a9c91', 0, 'ink', 1),
    rect(920, 205, 14, 42, '#b99173', 0, 'ink', 1),
    rect(938, 194, 8, 53, '#bbb9a0', 0, 'ink', 1),
    poly([955, 204, 969, 200, 981, 245, 967, 249], '#9f8a79', 'ink', 1),
    ellipse(944, 302, 43, 14, '#a0aa96', 'ink', 1),
    line(945, 295, 945, 269, '#8a9b8c', 2),
    ellipse(934, 277, 18, 9, '#9aaa96', 'none'), ellipse(953, 270, 17, 8, '#9aaa96', 'none'),
    line(83, 570, 294, 570, '#b9b4a7', 1),
    line(90, 577, 289, 577, '#b9b4a7', 1)
]
assets = {
    'room': {'width': 1200, 'height': 760, 'shapes': room},
    'chair': {'width': 190, 'height': 285, 'shapes': [
        rect(0, 5, 89, 188, '#9ca494', 20),
        poly([3, 171, 130, 171, 146, 195, 10, 195], '#8e9789'),
        line(22, 195, 9, 285, 'ink', 5), line(120, 194, 143, 285, 'ink', 5),
        line(46, 19, 46, 158, '#818a7b', 1)]},
    'person': {'width': 220, 'height': 355, 'shapes': [
        poly([45, 240, 123, 239, 142, 294, 201, 309, 197, 322, 114, 315, 92, 270, 53, 270], '#565d58'),
        poly([46, 241, 93, 249, 80, 333, 107, 340, 104, 351, 51, 351, 42, 337], '#65706b'),
        poly([166, 308, 202, 308, 213, 320, 209, 325, 165, 321], '#535a55', 'ink', 1.5),
        ellipse(92, 54, 75, 85, 'skin'),
        poly([55, 65, 54, 30, 70, 12, 102, 9, 126, 25, 128, 46, 104, 42, 90, 34, 84, 57, 72, 61, 70, 82], '#595b51'),
        rect(76, 88, 28, 31, 'skin', 4, 'ink', 1.3),
        poly([68, 108, 108, 106, 133, 137, 130, 233, 44, 236, 42, 156, 49, 123], 'cloth'),
        poly([111, 126, 128, 132, 149, 182, 186, 190, 185, 207, 130, 201, 104, 159], 'cloth'),
        ellipse(188, 199, 26, 16, 'skin', 'ink', 1.5),
        bezier([66, 138, 56, 171, 60, 204, 108, 218], '#61746c', 1.4),
        line(110, 58, 116, 58, 'ink', 2),
        line(119, 61, 123, 69, 'ink', 1.3), line(111, 79, 118, 78, 'ink', 1.3)]},
    'robot-shell': {'width': 220, 'height': 355, 'shapes': [
        rect(50, 5, 87, 94, 'shell', 13),
        rect(83, 39, 55, 30, '#4f6766', 5, 'ink', 1.5),
        ellipse(105, 54, 8, 5, '#c6d9c8', 'none'), ellipse(124, 54, 8, 5, '#c6d9c8', 'none'),
        line(54, 24, 40, 24, 'ink', 2), rect(35, 21, 11, 26, 'shell', 3, 'ink', 1.4),
        poly([65, 107, 108, 107, 132, 132, 126, 235, 43, 235, 43, 142], 'shell'),
        rect(62, 146, 47, 44, '#94aaa0', 5, 'ink', 1.5),
        line(72, 164, 96, 164, '#d9e1cd', 2), line(72, 173, 89, 173, '#d9e1cd', 2),
        poly([114, 126, 130, 134, 149, 181, 181, 190, 177, 204, 130, 199, 105, 153], '#a4b6ad'),
        ellipse(130, 157, 16, 16, '#a4b6ad', 'ink', 1.3),
        line(49, 215, 120, 215, '#8a9d94', 1.2),
        rect(72, 112, 24, 10, '#879c93', 2, 'ink', 1)]},
    'desk': {'width': 1200, 'height': 760, 'shapes': [
        poly([294, 485, 922, 485, 938, 508, 285, 508], 'wood'),
        rect(285, 508, 653, 17, '#8f7864', 1),
        poly([319, 525, 344, 525, 338, 668, 315, 668], '#a78b74'),
        poly([874, 525, 899, 525, 907, 668, 884, 668], '#a78b74'),
        line(344, 561, 875, 561, '#a8907a', 5)]},
    'lamp': {'width': 100, 'height': 170, 'shapes': [
        ellipse(49, 157, 75, 13, '#9caa95'), line(49, 44, 49, 152, 'ink', 4),
        poly([24, 7, 73, 7, 90, 62, 7, 62], '#e5d5ab'),
        ellipse(48, 62, 83, 12, '#eadaad', 'ink', 1.5)]},
    'phone': {'width': 65, 'height': 91, 'shapes': [
        poly([7, 0, 49, 9, 57, 86, 0, 76], '#4f605b', 'ink', 2),
        poly([12, 10, 43, 16, 48, 69, 7, 62], 'screen', '#9cafa4', 1),
        line(19, 33, 34, 36, '#d6e0ce', 2), line(18, 42, 37, 45, '#d6e0ce', 2),
        ellipse(29, 73, 4, 4, '#a7b4a1', 'none')]},
    'mug': {'width': 70, 'height': 49, 'shapes': [
        ellipse(49, 23, 26, 29, 'none', 'ink', 2),
        rect(5, 5, 39, 36, '#c7cdb5', 5, 'ink', 1.5),
        ellipse(25, 6, 39, 9, '#e3e3cb', 'ink', 1.5),
        bezier([21, -3, 11, -15, 31, -17, 22, -27], '#a5ad9c', 1)]},
    'plant': {'width': 140, 'height': 175, 'shapes': [
        line(64, 142, 71, 12, '#738774', 3),
        line(66, 106, 32, 69, '#738774', 2), line(67, 80, 105, 48, '#738774', 2),
        ellipse(45, 58, 42, 23, '#8e9d80', '#637b68', 1.4),
        ellipse(91, 43, 42, 23, '#829679', '#637b68', 1.4),
        ellipse(72, 14, 19, 43, '#9daa8b', '#637b68', 1.4),
        ellipse(42, 105, 45, 19, '#9ca787', '#637b68', 1.4),
        ellipse(90, 83, 42, 19, '#9ca787', '#637b68', 1.4),
        poly([37, 130, 95, 130, 86, 172, 46, 172], '#b58d75'),
        rect(34, 126, 64, 9, '#c09b80', 2, 'ink', 1.5)]},
    'door': {'width': 170, 'height': 330, 'shapes': [
        rect(8, 5, 154, 322, '#a69c8c', 2), rect(18, 15, 134, 311, '#d0c9b7', 0),
        ellipse(129, 174, 7, 7, '#707b70', 'ink', 1), line(131, 173, 144, 173, 'ink', 2)]}
}
payload = {'version': TOKENS['version'], 'assets': assets}
OUT.mkdir(parents=True, exist_ok=True)
(OUT / 'vector-assets.json').write_text(json.dumps(payload, indent=2) + '\n')


def element(s):
    a = s['a']
    c = lambda v: COLORS.get(v, v)
    attrs = f'fill="{c(s["fill"])}" stroke="{c(s["stroke"])}" stroke-width="{s["sw"]}" stroke-linecap="round" stroke-linejoin="round"'
    kind = s['type']
    if kind == 'rect':
        return f'<rect x="{a[0]}" y="{a[1]}" width="{a[2]}" height="{a[3]}" rx="{a[4]}" {attrs}/>'
    if kind == 'ellipse':
        return f'<ellipse cx="{a[0]}" cy="{a[1]}" rx="{a[2]/2}" ry="{a[3]/2}" {attrs}/>'
    if kind == 'line':
        return f'<line x1="{a[0]}" y1="{a[1]}" x2="{a[2]}" y2="{a[3]}" {attrs}/>'
    if kind == 'bezier':
        return f'<path d="M {a[0]} {a[1]} C {a[2]} {a[3]} {a[4]} {a[5]} {a[6]} {a[7]}" {attrs}/>'
    points = ' '.join(f'{a[i]},{a[i+1]}' for i in range(0, len(a), 2))
    return f'<polygon points="{points}" {attrs}/>'


SVG = OUT / 'svg'
SVG.mkdir(exist_ok=True)
for name, asset in assets.items():
    content = ''.join(element(s) for s in asset['shapes'])
    (SVG / f'{name}.svg').write_text(f'<svg xmlns="http://www.w3.org/2000/svg" width="{asset["width"]}" height="{asset["height"]}" viewBox="0 0 {asset["width"]} {asset["height"]}"><title>{escape(name)}</title>{content}</svg>\n')
(OUT / 'icon.svg').write_text('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="6" fill="#eee9df"/><circle cx="11" cy="16" r="6" fill="none" stroke="#b87f62"/><circle cx="21" cy="16" r="6" fill="none" stroke="#819994"/></svg>\n')
print(f'Exported {len(assets)} shared assets as JSON and SVG.')
