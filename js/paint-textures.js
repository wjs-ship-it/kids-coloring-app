// Procedural paint tiles. Stable coordinates keep patterns continuous across strokes.
const RAINBOW = ['#ef4444','#fb923c','#facc15','#22c55e','#38bdf8','#8b5cf6','#ec4899'];
const rgb = color => [1,3,5].map(i=>parseInt(color.slice(i,i+2),16));
const blend = (color, amount) => color.map(c=>Math.round(amount>=0 ? c+(255-c)*amount : c*(1+amount)));
const bases = ['#ef4444','#f97316','#facc15','#22c55e','#06b6d4','#3b82f6','#8b5cf6','#ec4899'];
export const PAINT_COLORS = [0,.9,.75,.6,.4,.2,-.25].flatMap(amount=>bases.map(color=>
  '#'+blend(rgb(color),amount).map(c=>c.toString(16).padStart(2,'0')).join(''))).concat(['#a16207','#1e293b','#ffffff']);

export function texturePixel(color, tool, x, y) {
  let base = rgb(color);
  const hash = ((Math.imul(x+1,374761393)^Math.imul(y+1,668265263))>>>0)%101;
  if (tool==='rainbow' || tool==='rainbow-glitter') {
    const stripe = Math.floor((x+8*Math.sin(y*Math.PI/32))/16);
    base = rgb(RAINBOW[((stripe%7)+7)%7]);
  }
  if (tool==='glitter' || tool==='rainbow-glitter') {
    const sx=x%32-16, sy=y%32-16;
    if ((Math.abs(sx)<1 && Math.abs(sy)<4) || (Math.abs(sy)<1 && Math.abs(sx)<4)) return [255,255,255,255];
    if (hash>94) return [255,255,255,255];
    return [...blend(base,(hash%7-3)*.08),255];
  }
  if (tool==='crayon') return [...blend(base,hash>65 ? .8 : hash/400),255];
  if (tool==='pencil') return [...blend(base,(x*3+y*2)%7===0 ? .08 : .58),255];
  if (tool==='marker') return [...blend(base,((x+y)%6)<2 ? .18 : 0),255];
  const px=((x%32)+32)%32-16, py=((y%32)+32)%32-16;
  let mark=false;
  if(tool==='dots') mark=px*px+py*py<25;
  if(tool==='hearts') {
    const hx=px/9,hy=-py/9, a=hx*hx+hy*hy-1;
    mark=a*a*a-hx*hx*hy*hy*hy<=0;
  }
  if(tool==='stars') {
    const angle=Math.atan2(py,px)+Math.PI/2;
    mark=Math.hypot(px,py)<(Math.cos(angle*5)>.15 ? 11 : 5);
  }
  if (['dots','hearts','stars'].includes(tool)) return [...blend(base,mark ? -.2 : .72),255];
  return [...base,255];
}

const styles = new WeakMap();
export function getPaintStyle(ctx,color,tool='solid') {
  if (tool==='solid') return color;
  let cache=styles.get(ctx);
  if(!cache) {cache=new Map();styles.set(ctx,cache);}
  const key=`${color}:${tool}`;
  if(cache.has(key)) return cache.get(key);
  const tile=document.createElement('canvas'); tile.width=128; tile.height=128;
  const tc=tile.getContext('2d'), data=tc.createImageData(128,128);
  for(let y=0;y<128;y++) for(let x=0;x<128;x++) data.data.set(texturePixel(color,tool,x,y),(y*128+x)*4);
  tc.putImageData(data,0,0);
  const pattern=ctx.createPattern(tile,'repeat');
  if(!pattern) throw new Error('Paint texture unavailable');
  if(cache.size>=24) cache.delete(cache.keys().next().value);
  cache.set(key,pattern);
  return pattern;
}
