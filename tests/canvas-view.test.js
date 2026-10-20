import test from 'node:test';
import assert from 'node:assert/strict';
import {calculateCanvasView,applyCanvasView,clientToCanvas,canvasToClient} from '../js/canvas-view.js';

test('camera fits artwork in either direction without touching backing dimensions',()=>{
  for(const original of [{width:390,height:844},{width:844,height:390}]) {
    const canvas={...original,style:{}},focus={width:Math.min(original.width-40,original.height-160),height:Math.min(original.width-40,original.height-160)};
    for(const viewport of [{width:390,height:844},{width:844,height:390},{width:1280,height:800}]) {
      const view=applyCanvasView(canvas,focus,viewport);
      assert.equal(canvas.width,original.width);assert.equal(canvas.height,original.height);
      assert.ok(view.scale>0);
      const point={x:canvas.width/2,y:canvas.height/2};
      const rect={left:view.left,top:view.top,width:view.width,height:view.height};
      const back=clientToCanvas(canvas,rect,canvasToClient(canvas,rect,point));
      assert.ok(Math.abs(point.x-back.x)<1e-8 && Math.abs(point.y-back.y)<1e-8);
    }
  }
});
test('return to original portrait view restores exact original camera',()=>{
  assert.deepEqual(calculateCanvasView({width:390,height:844},{width:350,height:350},{width:390,height:844}),
    {left:0,top:0,width:390,height:844,scale:1});
});
