// Large-format Nasus renderer adapted from the MIT-licensed Thinking Orbs
// primitives: Fibonacci sphere, value-noise drift, depth projection, proximity
// web and travelling signals. See THIRD_PARTY_NOTICES.md.

const GOLD = '#d6a64b'
const PEARL = '#e8e6e3'
const SMOKE = '#8d9199'
const camera = [
  { zoom:.72, yaw:0, pitch:-.08, x:0, y:0 }, { zoom:1.08, yaw:.75, pitch:.18, x:-.13, y:.05 },
  { zoom:1.34, yaw:1.6, pitch:-.3, x:.18, y:-.05 }, { zoom:1.58, yaw:2.45, pitch:.22, x:-.22, y:.12 },
  { zoom:1.92, yaw:3.25, pitch:-.16, x:.2, y:-.14 },
]
const regionProfiles = [
  { threshold:.38, neighbours:5, wander:.16, signals:7, structure:0 },
  { threshold:.34, neighbours:3, wander:.11, signals:9, structure:0 },
  { threshold:.36, neighbours:4, wander:.13, signals:12, structure:0 },
  { threshold:.33, neighbours:4, wander:.08, signals:6, structure:.3 },
  { threshold:.35, neighbours:5, wander:.09, signals:7, structure:.18 },
]

const lerp=(a,b,t)=>a+(b-a)*t
const frac=x=>x-Math.floor(x)
const hash=(a,b)=>frac(Math.sin(a*12.9898+b*78.233)*43758.5453)
const noise=(x,y)=>{const xi=Math.floor(x),yi=Math.floor(y);let fx=x-xi,fy=y-yi;fx=fx*fx*(3-2*fx);fy=fy*fy*(3-2*fy);const a=hash(xi,yi),b=hash(xi+1,yi),c=hash(xi,yi+1),d=hash(xi+1,yi+1);return a+(b-a)*fx+(c-a)*fy+(a-b-c+d)*fx*fy}
const fib=(i,n)=>{const y=1-(2*(i+.5))/n,r=Math.sqrt(1-y*y),a=i*Math.PI*(3-Math.sqrt(5));return[r*Math.cos(a),y,r*Math.sin(a)]}
const rgba=(hex,a)=>{const n=parseInt(hex.slice(1),16);return`rgba(${n>>16},${n>>8&255},${n&255},${Math.max(0,Math.min(1,a))})`}
const cameraAt=p=>{const lo=Math.floor(p),hi=Math.min(4,lo+1),t=p-lo,a=camera[lo],b=camera[hi];return{zoom:lerp(a.zoom,b.zoom,t),yaw:lerp(a.yaw,b.yaw,t),pitch:lerp(a.pitch,b.pitch,t),x:lerp(a.x,b.x,t),y:lerp(a.y,b.y,t)}}

export function createOrbModel(count) {
  return Array.from({length:count},(_,i)=>{const [x,y,z]=fib(i,count);return{x,y,z,seed:hash(i,4.7),phase:hash(i,9.3)*Math.PI*2,principal:i%9===0||i%13===0}})
}

function transformNodes(model,time,profile,region,voiceEnergy,view,base,cx,cy) {
  const sy=Math.sin(view.yaw+time*.018),cyw=Math.cos(view.yaw+time*.018),st=Math.sin(view.pitch),ct=Math.cos(view.pitch)
  return model.map((node,i)=>{
    const drift=profile.wander*(1+voiceEnergy*1.8),speed=.055+voiceEnergy*.12
    let x=node.x+drift*(noise(i*.31+9,time*speed)-.5)*2
    let y=node.y+drift*(noise(i*.53+27,time*speed*.88)-.5)*2
    let z=node.z+drift*(noise(i*.77+55,time*speed*1.08)-.5)*2
    if(region===3&&profile.structure){x=lerp(x,Math.round(x*5)/5,profile.structure);y=lerp(y,Math.round(y*5)/5,profile.structure)}
    if(region===4){const group=i%6,anchor=(group/6)*Math.PI*2;x+=Math.cos(anchor)*.055;y+=((group%3)-1)*.035;z+=Math.sin(anchor)*.055}
    const length=Math.hypot(x,y,z)||1;x/=length;y/=length;z/=length
    const x1=x*cyw+z*sy,z1=-x*sy+z*cyw,y1=y*ct-z1*st,z2=y*st+z1*ct
    return{...node,x3:x,y3:y,z3:z,x:cx+x1*base,y:cy-y1*base,z:z2}
  })
}

function proximityEdges(nodes,threshold,maxNeighbours,time,activity) {
  const cells=new Map(),key=(x,y,z)=>`${Math.floor((x+1)/threshold)}:${Math.floor((y+1)/threshold)}:${Math.floor((z+1)/threshold)}`
  nodes.forEach((node,i)=>{const k=key(node.x3,node.y3,node.z3);if(!cells.has(k))cells.set(k,[]);cells.get(k).push(i)})
  const degrees=new Uint8Array(nodes.length),edges=[]
  nodes.forEach((a,i)=>{const gx=Math.floor((a.x3+1)/threshold),gy=Math.floor((a.y3+1)/threshold),gz=Math.floor((a.z3+1)/threshold),candidates=[]
    for(let dx=-1;dx<=1;dx++)for(let dy=-1;dy<=1;dy++)for(let dz=-1;dz<=1;dz++){const bucket=cells.get(`${gx+dx}:${gy+dy}:${gz+dz}`);if(!bucket)continue;bucket.forEach(j=>{if(j<=i)return;const b=nodes[j],distance=Math.hypot(a.x3-b.x3,a.y3-b.y3,a.z3-b.z3);if(distance<threshold)candidates.push({j,distance})})}
    candidates.sort((a,b)=>a.distance-b.distance).slice(0,maxNeighbours).forEach(({j,distance})=>{if(degrees[i]>=maxNeighbours||degrees[j]>=maxNeighbours)return;degrees[i]++;degrees[j]++;const pulse=.66+.34*Math.sin(time*(.42+activity*.45)+i*.73+j*.31);edges.push({a:i,b:j,distance,alpha:(1-distance/threshold)*pulse})})
  })
  return edges
}

function paintLine(ctx,a,b,alpha,color=PEARL,width=.55){if(a.z<-.48&&b.z<-.48)return;const depth=Math.max(.12,((a.z+b.z)*.5+1)/2);ctx.strokeStyle=rgba(color,alpha*depth);ctx.lineWidth=width;ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke()}

export function renderNasusOrb(ctx,model,{width,height,time,progress,mode,reduced}) {
  const region=Math.round(progress),profile=regionProfiles[region],view=cameraAt(progress)
  const activity=mode==='thinking'?1:mode==='speaking'?.85:mode==='listening'?.55:0
  const signal=mode==='speaking'?Math.sin(time*7.2)*.08:0,base=Math.min(width,height)*.49*view.zoom*(1+signal)
  const cx=width*(.5+view.x),cy=height*(.5+view.y),t=reduced?.65:time*(1+activity*.55)
  const nodes=transformNodes(model,t,profile,region,activity,view,base,cx,cy)
  const edges=proximityEdges(nodes,profile.threshold+(activity*.018),profile.neighbours+(mode==='thinking'?1:0),t,activity)

  const halo=ctx.createRadialGradient(cx,cy,base*.12,cx,cy,base*1.08);halo.addColorStop(0,'rgba(23,26,32,.08)');halo.addColorStop(.78,'rgba(11,13,17,.025)');halo.addColorStop(1,'transparent');ctx.fillStyle=halo;ctx.fillRect(0,0,width,height)
  edges.forEach(edge=>paintLine(ctx,nodes[edge.a],nodes[edge.b],edge.alpha*(.46+activity*.18),SMOKE,.42))

  const principals=nodes.map((node,i)=>({node,i})).filter(({node})=>node.principal)
  principals.forEach(({node:a},i)=>{const {node:b}=principals[(i+2+(region%3))%principals.length];const fade=.22+.2*(.5+.5*Math.sin(t*.31+i*1.7));paintLine(ctx,a,b,fade*(a.principal&&b.principal?1:.5),i%7===region?GOLD:PEARL,.62)})

  const signalCount=profile.signals+(mode==='listening'?4:mode==='speaking'?7:0)
  for(let s=0;s<signalCount;s++){if(!edges.length)break;const edge=edges[(s*17+region*7)%edges.length],a=nodes[edge.a],b=nodes[edge.b],f=frac(t*(.075+activity*.08)+s*.173),x=lerp(a.x,b.x,f),y=lerp(a.y,b.y,f),z=lerp(a.z,b.z,f),depth=Math.max(.2,(z+1)/2);ctx.fillStyle=rgba(s%5===0?GOLD:PEARL,.4+depth*.42);ctx.beginPath();ctx.arc(x,y,.65+depth*1.1+activity*.45,0,Math.PI*2);ctx.fill();if(region===2||mode==='listening'){ctx.strokeStyle=rgba(s%5===0?GOLD:PEARL,(1-f)*.07);ctx.lineWidth=.45;ctx.beginPath();ctx.arc(x,y,3+f*13,0,Math.PI*2);ctx.stroke()}}

  nodes.sort((a,b)=>a.z-b.z).forEach((node,i)=>{const depth=(node.z+1)/2,pulse=1+.16*Math.sin(t*1.15+node.phase),important=node.principal,r=(important?1.35:Math.max(.32,.42+depth*.7))*pulse*(width<700?.82:1);ctx.fillStyle=rgba(important&&i%6===region?GOLD:PEARL,(important?.72:.2)+depth*(important?.24:.5));ctx.beginPath();ctx.arc(node.x,node.y,r+(activity*(important?.7:.12)),0,Math.PI*2);ctx.fill()})
}
