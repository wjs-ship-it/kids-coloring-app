import test from 'node:test';
import assert from 'node:assert/strict';
import { texturePixel, PAINT_COLORS } from '../js/paint-textures.js';
import { FILL_TOOLS } from '../js/color-fill-tools.js';

test('palette supplies vivid, pastel and dark colors with valid channels',()=>{
  assert.equal(PAINT_COLORS.length,59);
  assert.equal(new Set(PAINT_COLORS).size,59);
  assert.ok(PAINT_COLORS.every(color=>/^#[0-9a-f]{6}$/.test(color)));
  assert.ok(PAINT_COLORS.includes('#ffffff'));
});

for(const tool of FILL_TOOLS) test(`${tool.id}: reproducible, bounded texture pixels`,()=>{
  const colors=new Set();
  for(let y=0;y<64;y++) for(let x=0;x<128;x++) {
    const pixel=texturePixel('#ef4444',tool.id,x,y);
    assert.equal(pixel.length,4);
    assert.ok(pixel.every(value=>Number.isInteger(value)&&value>=0&&value<=255));
    assert.deepEqual(pixel,texturePixel('#ef4444',tool.id,x,y));
    colors.add(pixel.join(','));
  }
  if(tool.id==='solid') assert.equal(colors.size,1);
  else assert.ok(colors.size>1);
});

test('rainbow ignores color while other materials follow the selected color',()=>{
  assert.deepEqual(texturePixel('#ef4444','rainbow',10,10),texturePixel('#3b82f6','rainbow',10,10));
  for(const tool of ['solid','crayon','glitter','hearts','stars','dots'])
    assert.notDeepEqual(texturePixel('#ef4444',tool,0,0),texturePixel('#3b82f6',tool,0,0));
});
