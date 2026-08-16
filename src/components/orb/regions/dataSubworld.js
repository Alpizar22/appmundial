import dataIllustrationUrl from '../../../assets/data-subworld.png'

const clamp01=value=>Math.max(0,Math.min(1,value))
const smoothstep=value=>{const t=clamp01(value);return t*t*(3-2*t)}
const lerp=(a,b,t)=>a+(b-a)*t
const frac=value=>value-Math.floor(value)
const routes=[
  [[.2,.9],[.34,.78],[.49,.67],[.63,.54],[.82,.43]],
  [[.27,.69],[.4,.73],[.55,.63],[.7,.67],[.88,.57]],
  [[.36,.87],[.47,.75],[.59,.68],[.72,.55]],
  [[.42,.55],[.54,.61],[.66,.52],[.78,.48]],
]
const constellations=[
  [[.1,.18],[.17,.12],[.23,.23],[.31,.15],[.36,.27]],
  [[.57,.11],[.63,.2],[.7,.14],[.77,.25],[.84,.17],[.91,.3]],
  [[.05,.39],[.13,.32],[.22,.4],[.3,.31]],
]

let illustration
const getIllustration=ctx=>{
  if(illustration)return illustration
  illustration=new Image()
  illustration.addEventListener('load',()=>ctx.canvas.dispatchEvent(new Event('orbinvalidate')),{once:true})
  illustration.src=dataIllustrationUrl
  return illustration
}

function pointOnRoute(route,progress) {
  const lengths=[],total=route.slice(1).reduce((sum,point,index)=>{const previous=route[index],length=Math.hypot(point[0]-previous[0],point[1]-previous[1]);lengths.push(length);return sum+length},0)
  let distance=progress*total
  for(let index=0;index<lengths.length;index++){if(distance<=lengths[index]){const local=distance/lengths[index],a=route[index],b=route[index+1];return{x:lerp(a[0],b[0],local),y:lerp(a[1],b[1],local)}}distance-=lengths[index]}
  const end=route.at(-1);return{x:end[0],y:end[1]}
}

export function renderDataSubworld({ctx,camera,time,viewport,focus,intensity,palette}) {
  if(intensity<=.01)return
  const image=getIllustration(ctx)
  if(!image.complete||!image.naturalWidth)return
  const {width,height}=viewport,{gold,pearl,rgba}=palette,aspect=image.naturalWidth/image.naturalHeight,cameraScale=Math.max(.94,Math.min(1.06,camera.zoom/1.92)),drawWidth=Math.max(width*.96,height*aspect)*cameraScale,drawHeight=drawWidth/aspect,drawX=focus.x-drawWidth*.61,drawY=focus.y-drawHeight*.51,reveal=smoothstep(intensity)
  ctx.save();ctx.globalAlpha=reveal*.94;ctx.drawImage(image,drawX,drawY,drawWidth,drawHeight);ctx.restore()
  ctx.save();ctx.globalCompositeOperation='screen'
  for(let pulse=0;pulse<22;pulse++){const routeIndex=(pulse*3)%routes.length,phase=frac(time*(.043+(pulse%4)*.0045)+pulse*.091),envelope=Math.sin(phase*Math.PI)**1.45,point=pointOnRoute(routes[routeIndex],phase),x=drawX+point.x*drawWidth,y=drawY+point.y*drawHeight,alpha=envelope*reveal*(pulse%5===0?.94:.56);ctx.shadowColor=rgba(gold,alpha*.72);ctx.shadowBlur=5+(pulse%3)*1.5;ctx.fillStyle=rgba(gold,alpha);ctx.beginPath();ctx.arc(x,y,.82+(pulse%4)*.2,0,Math.PI*2);ctx.fill()}
  constellations.forEach((group,groupIndex)=>{const points=group.map((point,index)=>({x:drawX+point[0]*drawWidth+Math.sin(time*.09+index*1.7+groupIndex)*3,y:drawY+point[1]*drawHeight+Math.sin(time*.16+index*.8+groupIndex*2.1)*(5+groupIndex*2)}));ctx.strokeStyle=rgba(pearl,(.075+groupIndex*.018)*reveal);ctx.lineWidth=.42;ctx.beginPath();points.forEach((point,index)=>index?ctx.lineTo(point.x,point.y):ctx.moveTo(point.x,point.y));ctx.stroke();points.forEach((point,index)=>{const warm=(index+groupIndex*2)%5===0,breath=.82+Math.sin(time*.14+index*1.9)*.12;ctx.shadowColor=rgba(warm?gold:pearl,.3*reveal);ctx.shadowBlur=warm?5:2;ctx.fillStyle=rgba(warm?gold:pearl,(warm?.58:.28)*breath*reveal);ctx.beginPath();ctx.arc(point.x,point.y,warm?1.35:.72,0,Math.PI*2);ctx.fill()})})
  ctx.restore()
}
