// A viewport camera only: never resize or resample the working bitmap/history.
export function calculateCanvasView(paper, focus, viewport) {
  const {width,height}=viewport;
  const landscape=width>=640 && width>height;
  if(!landscape && width===paper.width && height===paper.height)
    return {left:0,top:0,width:paper.width,height:paper.height,scale:1};
  const inset=landscape ? {left:20,right:280,top:88,bottom:20}
    : {left:20,right:60,top:100,bottom:160};
  const availableWidth=Math.max(80,width-inset.left-inset.right);
  const availableHeight=Math.max(80,height-inset.top-inset.bottom);
  const scale=Math.min(availableWidth/focus.width,availableHeight/focus.height);
  const centerX=inset.left+availableWidth/2,centerY=inset.top+availableHeight/2;
  return {left:centerX-paper.width*scale/2,top:centerY-paper.height*scale/2,
    width:paper.width*scale,height:paper.height*scale,scale};
}

export function applyCanvasView(canvas,focus,viewport) {
  const view=calculateCanvasView(canvas,focus,viewport);
  Object.assign(canvas.style,{left:`${view.left}px`,top:`${view.top}px`,
    width:`${view.width}px`,height:`${view.height}px`});
  return view;
}

export function clientToCanvas(canvas,rect,point) {
  return {x:(point.x-rect.left)*canvas.width/rect.width,
    y:(point.y-rect.top)*canvas.height/rect.height};
}

export function canvasToClient(canvas,rect,point) {
  return {x:rect.left+point.x*rect.width/canvas.width,
    y:rect.top+point.y*rect.height/canvas.height};
}
