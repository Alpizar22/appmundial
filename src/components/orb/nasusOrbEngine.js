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
  const nodes=Array.from({length:count},(_,i)=>{const [x,y,z]=fib(i,count),life=11+hash(i,8.1)*12;return{x,y,z,vx:(hash(i,2.1)-.5)*.04,vy:(hash(i,3.7)-.5)*.04,vz:(hash(i,6.4)-.5)*.04,seed:hash(i,4.7),phase:hash(i,9.3)*Math.PI*2,principal:i%9===0||i%13===0,alpha:1,age:hash(i,11.7)*life,life,generation:0,state:'alive'}})
  const keys=new Set(),springs=[]
  nodes.forEach((node,i)=>nodes.map((other,j)=>({j,d:Math.hypot(node.x-other.x,node.y-other.y,node.z-other.z)})).filter(({j})=>j!==i).sort((a,b)=>a.d-b.d).slice(0,2).forEach(({j,d})=>{const a=Math.min(i,j),b=Math.max(i,j),key=`${a}:${b}`;if(keys.has(key))return;keys.add(key);springs.push({a,b,rest:d})}))
  nodes.springs=springs
  nodes.edgeStates=new Map()
  nodes.lastTime=0
  return nodes
}

function spatialPairs(nodes,threshold,maxNeighbours=6) {
  const cells=new Map(),cell=threshold,key=(x,y,z)=>`${Math.floor((x+1.3)/cell)}:${Math.floor((y+1.3)/cell)}:${Math.floor((z+1.3)/cell)}`
  nodes.forEach((node,i)=>{const k=key(node.x,node.y,node.z);if(!cells.has(k))cells.set(k,[]);cells.get(k).push(i)})
  const degree=new Uint8Array(nodes.length),pairs=[]
  nodes.forEach((a,i)=>{const gx=Math.floor((a.x+1.3)/cell),gy=Math.floor((a.y+1.3)/cell),gz=Math.floor((a.z+1.3)/cell),near=[];for(let dx=-1;dx<=1;dx++)for(let dy=-1;dy<=1;dy++)for(let dz=-1;dz<=1;dz++){const bucket=cells.get(`${gx+dx}:${gy+dy}:${gz+dz}`);if(!bucket)continue;bucket.forEach(j=>{if(j<=i)return;const b=nodes[j],distance=Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z);if(distance<threshold)near.push({j,distance})})}near.sort((a,b)=>a.distance-b.distance).forEach(({j,distance})=>{if(degree[i]>=maxNeighbours||degree[j]>=maxNeighbours)return;degree[i]++;degree[j]++;pairs.push({a:i,b:j,distance})})})
  return pairs
}

function stepSimulation(model,time,profile,region,activity,reduced) {
  if(reduced)return
  const dt=model.lastTime?Math.min(.032,Math.max(.008,time-model.lastTime)):.016
  model.lastTime=time
  model.frameDt=dt
  const ax=new Float32Array(model.length),ay=new Float32Array(model.length),az=new Float32Array(model.length)
  const dynamic=spatialPairs(model,profile.threshold+.08,6)
  const applySpring=(edge,strength,rest)=>{const a=model[edge.a],b=model[edge.b],dx=b.x-a.x,dy=b.y-a.y,dz=b.z-a.z,d=Math.hypot(dx,dy,dz)||.001,force=(d-rest)*strength/d,fx=dx*force,fy=dy*force,fz=dz*force;ax[edge.a]+=fx;ay[edge.a]+=fy;az[edge.a]+=fz;ax[edge.b]-=fx;ay[edge.b]-=fy;az[edge.b]-=fz}
  model.springs.forEach(edge=>{const visibility=Math.min(model[edge.a].alpha,model[edge.b].alpha);if(visibility>.15)applySpring(edge,(.5+activity*.18)*visibility,edge.rest)})
  dynamic.forEach(edge=>{const visibility=Math.min(model[edge.a].alpha,model[edge.b].alpha);if(visibility<.12)return;applySpring(edge,(.24+activity*.1)*visibility,profile.threshold*.7);if(edge.distance<.29){const a=model[edge.a],b=model[edge.b],d=edge.distance||.001,force=(.29-d)*.5/d,fx=(a.x-b.x)*force,fy=(a.y-b.y)*force,fz=(a.z-b.z)*force;ax[edge.a]+=fx;ay[edge.a]+=fy;az[edge.a]+=fz;ax[edge.b]-=fx;ay[edge.b]-=fy;az[edge.b]-=fz}})
  model.forEach((node,i)=>{node.age+=dt;if(node.state==='alive'&&node.age>node.life)node.state='dying';if(node.state==='dying'){node.alpha=Math.max(0,node.alpha-dt/.95);if(node.alpha===0){node.generation++;const u=hash(i+node.generation*17,21.3),v=hash(i+node.generation*23,31.7),theta=u*Math.PI*2,yy=v*1.7-.85,rr=Math.sqrt(1-yy*yy);node.x=Math.cos(theta)*rr;node.y=yy;node.z=Math.sin(theta)*rr;node.vx=(hash(i,node.generation+41)-.5)*.055;node.vy=(hash(i,node.generation+53)-.5)*.055;node.vz=(hash(i,node.generation+67)-.5)*.055;node.age=0;node.life=11+hash(i,node.generation+79)*12;node.state='born'}}else if(node.state==='born'){node.alpha=Math.min(1,node.alpha+dt/1.25);if(node.alpha===1)node.state='alive'}const length=Math.hypot(node.x,node.y,node.z)||1,radial=(1-length)*1.25;ax[i]+=node.x/length*radial;ay[i]+=node.y/length*radial;az[i]+=node.z/length*radial;const drive=(profile.wander*.42)*(1+activity*.65);ax[i]+=(noise(i*.31+9,time*.17)-.5)*drive;ay[i]+=(noise(i*.53+27,time*.145)-.5)*drive;az[i]+=(noise(i*.77+55,time*.19)-.5)*drive;if(region===1)ax[i]+=.012*Math.sin(node.phase);if(region===3){ax[i]+=(Math.round(node.x*4)/4-node.x)*.024;ay[i]+=(Math.round(node.y*4)/4-node.y)*.024}if(region===4){const angle=(i%6)/6*Math.PI*2;ax[i]+=(Math.cos(angle)*.82-node.x)*.018;az[i]+=(Math.sin(angle)*.82-node.z)*.018}const damping=Math.exp(-(1.55-activity*.18)*dt);node.vx=(node.vx+ax[i]*dt)*damping;node.vy=(node.vy+ay[i]*dt)*damping;node.vz=(node.vz+az[i]*dt)*damping;const speed=Math.hypot(node.vx,node.vy,node.vz),maxSpeed=.085+activity*.025;if(speed>maxSpeed){const limit=maxSpeed/speed;node.vx*=limit;node.vy*=limit;node.vz*=limit}node.x+=node.vx*dt;node.y+=node.vy*dt;node.z+=node.vz*dt})
}

function projectNodes(model,time,view,base,cx,cy) {
  const sy=Math.sin(view.yaw+time*.018),cyw=Math.cos(view.yaw+time*.018),st=Math.sin(view.pitch),ct=Math.cos(view.pitch)
  return model.map((node,index)=>{
    const x1=node.x*cyw+node.z*sy,z1=-node.x*sy+node.z*cyw,y1=node.y*ct-z1*st,z2=node.y*st+z1*ct
    return{...node,index,x3:node.x,y3:node.y,z3:node.z,x:cx+x1*base,y:cy-y1*base,z:z2}
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

function smoothEdges(model,targets) {
  const dt=model.frameDt||.016,targetMap=new Map(targets.map(edge=>[`${edge.a}:${edge.b}`,edge]))
  targetMap.forEach((edge,key)=>{const state=model.edgeStates.get(key)||{...edge,opacity:0};state.a=edge.a;state.b=edge.b;state.distance=edge.distance;state.alpha=edge.alpha;state.opacity+=((edge.alpha)-state.opacity)*Math.min(1,dt*2.8);model.edgeStates.set(key,state)})
  model.edgeStates.forEach((state,key)=>{if(targetMap.has(key))return;state.opacity+=(0-state.opacity)*Math.min(1,dt*1.45);if(state.opacity<.008)model.edgeStates.delete(key)})
  return [...model.edgeStates.values()]
}

function paintLine(ctx,a,b,alpha,color=PEARL,width=.55){if(a.z<-.48&&b.z<-.48)return;const depth=Math.max(.12,((a.z+b.z)*.5+1)/2);ctx.strokeStyle=rgba(color,alpha*depth);ctx.lineWidth=width;ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke()}

export function renderNasusOrb(ctx,model,{width,height,time,progress,mode,reduced}) {
  const region=Math.round(progress),profile=regionProfiles[region],view=cameraAt(progress)
  const activity=mode==='thinking'?1:mode==='speaking'?.85:mode==='listening'?.55:0
  const signal=mode==='speaking'?Math.sin(time*7.2)*.08:0,base=Math.min(width,height)*.49*view.zoom*(1+signal)
  const cx=width*(.5+view.x),cy=height*(.5+view.y),t=reduced?.65:time*(1+activity*.55)
  stepSimulation(model,t,profile,region,activity,reduced)
  const nodes=projectNodes(model,t,view,base,cx,cy)
  const edges=smoothEdges(model,proximityEdges(nodes,profile.threshold+(activity*.018),profile.neighbours+(mode==='thinking'?1:0),t,activity))

  const halo=ctx.createRadialGradient(cx,cy,base*.12,cx,cy,base*1.08);halo.addColorStop(0,'rgba(23,26,32,.08)');halo.addColorStop(.78,'rgba(11,13,17,.025)');halo.addColorStop(1,'transparent');ctx.fillStyle=halo;ctx.fillRect(0,0,width,height)
  edges.forEach(edge=>{const visibility=Math.min(nodes[edge.a].alpha,nodes[edge.b].alpha);paintLine(ctx,nodes[edge.a],nodes[edge.b],edge.opacity*(.48+activity*.18)*visibility,SMOKE,.42)})

  const signalCount=profile.signals+(mode==='listening'?4:mode==='speaking'?7:0)
  for(let s=0;s<signalCount;s++){if(!edges.length)break;const edge=edges[(s*17+region*7)%edges.length],a=nodes[edge.a],b=nodes[edge.b],f=frac(t*(.075+activity*.08)+s*.173),x=lerp(a.x,b.x,f),y=lerp(a.y,b.y,f),z=lerp(a.z,b.z,f),depth=Math.max(.2,(z+1)/2);ctx.fillStyle=rgba(s%5===0?GOLD:PEARL,.4+depth*.42);ctx.beginPath();ctx.arc(x,y,.65+depth*1.1+activity*.45,0,Math.PI*2);ctx.fill();if(region===2||mode==='listening'){ctx.strokeStyle=rgba(s%5===0?GOLD:PEARL,(1-f)*.07);ctx.lineWidth=.45;ctx.beginPath();ctx.arc(x,y,3+f*13,0,Math.PI*2);ctx.stroke()}}

  nodes.sort((a,b)=>a.z-b.z).forEach((node,i)=>{const depth=(node.z+1)/2,pulse=1+.16*Math.sin(t*1.15+node.phase),important=node.principal,r=(important?1.35:Math.max(.32,.42+depth*.7))*pulse*(width<700?.82:1);ctx.fillStyle=rgba(important&&i%6===region?GOLD:PEARL,((important?.72:.2)+depth*(important?.24:.5))*node.alpha);ctx.beginPath();ctx.arc(node.x,node.y,r+(activity*(important?.7:.12)),0,Math.PI*2);ctx.fill()})
}
