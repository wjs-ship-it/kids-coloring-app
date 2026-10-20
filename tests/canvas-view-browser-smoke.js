import {buildGuidedParts} from '../js/guided-trace.js?v=writing-1';
import {canvasToClient} from '../js/canvas-view.js?v=rotation-1';
let baseline;
const canvas=()=>document.getElementById('drawing-canvas');
function assert(value,message){if(!value)throw new Error(message);}
async function until(check){const end=performance.now()+15000;while(!check()){assert(performance.now()<end,'Rotation test timed out');await new Promise(r=>requestAnimationFrame(r));}}
function send(type,point){
  const c=canvas(),p=canvasToClient(c,c.getBoundingClientRect(),point);
  const touch=new Touch({identifier:1,target:c,clientX:p.x,clientY:p.y});
  c.dispatchEvent(new TouchEvent(type,{bubbles:true,cancelable:true,touches:type==='touchend'?[]:[touch],changedTouches:[touch]}));
}
function save(){return {png:canvas().toDataURL(),width:canvas().width,height:canvas().height,
  label:document.getElementById('part-label').textContent,progress:document.getElementById('progress-fill').style.width};}
export async function prepareTraceRotation(){
  document.getElementById('btn-presets').click();
  document.querySelector('[data-content-id="finish-picture-5-(diplodocus)"]').click();
  await until(()=>document.querySelector('.screen.active')?.id==='mode-screen');
  document.querySelector('[data-mode=trace]').click();
  await until(()=>document.getElementById('part-label').textContent.startsWith('1/10'));
  const guide=await fetch('./assets/family-content/diplodocus-guided-v1.json').then(r=>r.json());
  const c=canvas(),size=Math.min(600,c.width-40,c.height-160);
  const points=buildGuidedParts(guide,size,size)[0].guided.points.map(p=>({x:p.x+(c.width-size)/2,y:p.y+(c.height-size)/2}));
  send('touchstart',points[0]);for(let i=1;i<40;i++)send('touchmove',points[i]);send('touchend',points[39]);
  baseline=save();assert(parseFloat(baseline.progress)>0,'Partial tracing exists');
  return {progress:baseline.progress,label:baseline.label};
}
export function verifyTraceRotation(){
  const after=save();assert(after.png===baseline.png,'Rotation altered bitmap');
  assert(after.width===baseline.width&&after.height===baseline.height,'Rotation changed backing resolution');
  assert(after.progress===baseline.progress&&after.label===baseline.label,'Rotation lost tracing state');
  return {bitmapPreserved:true,progress:after.progress,label:after.label};
}
export function prepareColorRotation(){
  assert(!document.getElementById('side-palette').classList.contains('hidden'),'Color mode ready');
  document.querySelector('[data-paint-tool=rainbow-glitter]').click();
  const c=canvas(),ctx=c.getContext('2d');
  let point;
  for(let y=350;y<480&&!point;y+=10)for(let x=120;x<250;x+=10){
    if(ctx.getImageData(x,y,1,1).data[0]>240){point={x,y};break;}
  }
  assert(point,'Visible paint point');
  send('touchstart',point);send('touchmove',{x:point.x+30,y:point.y});send('touchend',point);
  baseline=save();baseline.point={x:point.x+40,y:point.y+15};
  return {painted:true,backing:[c.width,c.height]};
}
export function verifyColorRotation(){
  assert(save().png===baseline.png,'Rotation lost colors or texture');
  send('touchstart',baseline.point);send('touchmove',{x:baseline.point.x+20,y:baseline.point.y});send('touchend',baseline.point);
  assert(save().png!==baseline.png,'Painting after rotation failed');
  document.getElementById('btn-undo').click();
  assert(save().png===baseline.png,'Undo after rotation failed');
  return {texturePreserved:true,paintAfterRotate:true,undoPreserved:true};
}
