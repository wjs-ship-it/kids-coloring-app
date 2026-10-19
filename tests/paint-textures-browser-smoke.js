import { buildFillRegions } from '../js/edge-detect.js?v=background-color-2';
import { FILL_TOOLS } from '../js/color-fill-tools.js?v=textures-1';

function assert(value,message) { if(!value) throw new Error(message); }
async function until(check) {
  const end=performance.now()+15000;
  while(!check()) {assert(performance.now()<end,'Color screen timeout');await new Promise(r=>requestAnimationFrame(r));}
}

export async function runPaintTextureSmoke() {
  document.getElementById('btn-presets').click();
  [...document.querySelectorAll('.preset-filter')].find(b=>b.textContent==='모두').click();
  document.querySelector('.preset-card[data-guided="false"]').click();
  await until(()=>document.querySelector('.screen.active')?.id==='canvas-screen'
    && !document.getElementById('side-palette').classList.contains('hidden'));
  const canvas=document.getElementById('drawing-canvas'),ctx=canvas.getContext('2d');
  const {width,height}=canvas, initial=ctx.getImageData(0,0,width,height);
  const {regionMap}=buildFillRegions(initial,width,height);
  const start={x:30,y:170}, allowed=regionMap[start.y*width+start.x];
  assert(allowed>0,'Brush starts inside background region');
  const rect=canvas.getBoundingClientRect();
  function send(type,x,y) {
    const touch=new Touch({identifier:1,target:canvas,clientX:rect.left+x,clientY:rect.top+y});
    canvas.dispatchEvent(new TouchEvent(type,{bubbles:true,cancelable:true,
      touches:type==='touchend'?[]:[touch],changedTouches:[touch]}));
  }
  const results=[];
  send('touchstart',start.x,start.y);send('touchend',start.x,start.y);
  assert(ctx.getImageData(start.x,start.y,1,1).data[1]<200,'A tap paints a dot');
  document.getElementById('btn-undo').click();
  for(const tool of FILL_TOOLS) {
    document.querySelector(`[data-paint-tool="${tool.id}"]`).click();
    send('touchstart',start.x,start.y);
    // Cross the drawing as well as the starting background: the mask must clip it.
    for(let i=1;i<=45;i++) send('touchmove',30+(width-60)*i/45,170+(height/2-170)*i/45);
    send('touchend',width-30,height/2);
    const painted=ctx.getImageData(0,0,width,height), colors=new Set();
    let changed=0;
    for(let i=0;i<regionMap.length;i++) {
      const k=i*4;
      if(painted.data[k]===initial.data[k] && painted.data[k+1]===initial.data[k+1]
        && painted.data[k+2]===initial.data[k+2]) continue;
      assert(regionMap[i]===allowed,`${tool.id} escaped its region`);
      colors.add([...painted.data.slice(k,k+3)].join(',')); changed++;
    }
    assert(changed>50,`${tool.id} painted no visible stroke`);
    if(tool.id!=='solid') assert(colors.size>1,`${tool.id} lost texture`);
    const image=new Image(); image.src=canvas.toDataURL('image/png'); await image.decode();
    const saved=document.createElement('canvas');saved.width=width;saved.height=height;
    saved.getContext('2d').drawImage(image,0,0);
    const restored=saved.getContext('2d').getImageData(0,0,width,height).data;
    assert(restored.every((v,i)=>v===painted.data[i]),`${tool.id} PNG differs`);
    document.getElementById('btn-undo').click();
    const undone=ctx.getImageData(0,0,width,height).data;
    assert(undone.every((v,i)=>v===initial.data[i]),`${tool.id} undo differs`);
    results.push({tool:tool.id,changed,colors:colors.size,clipped:true,undo:true,png:true});
  }
  document.querySelector('.palette-toggle').click();
  document.querySelector('.palette-close').click();
  assert(!document.getElementById('side-palette').classList.contains('expanded'),'Close color palette');
  document.querySelector('.palette-toggle').click();
  assert(document.querySelectorAll('.cdot').length===59,'Full color palette');
  const pastel=document.querySelectorAll('.cdot')[9];pastel.click();
  assert(!document.getElementById('side-palette').classList.contains('expanded'),'Palette closes on selection');
  assert(document.querySelector('[aria-pressed="true"][data-paint-tool]'),'Selected texture retained after color choice');
  return {tools:results.length,colors:59,results};
}
