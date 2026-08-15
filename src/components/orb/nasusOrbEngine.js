// Large-format Nasus renderer adapted from the MIT-licensed Thinking Orbs
// primitives: Fibonacci sphere, value-noise drift, depth projection, proximity
// web and travelling signals. See THIRD_PARTY_NOTICES.md.

const GOLD = '#d6a64b'
const PEARL = '#e8e6e3'
const SMOKE = '#8d9199'
const WORLD_SPIN = .014
const camera = [
  { zoom:.72, yaw:0, pitch:-.08, x:0, y:0 }, { zoom:1.08, yaw:.75, pitch:.18, x:-.13, y:.05 },
  { zoom:1.34, yaw:1.6, pitch:-.3, x:.18, y:-.05 }, { zoom:1.58, yaw:2.45, pitch:.22, x:-.22, y:.12 },
  { zoom:1.92, yaw:3.25, pitch:-.16, x:.2, y:-.14 },
]
const regionProfiles = [
  { threshold:.38, neighbours:3, wander:.16, structure:0 },
  { threshold:.34, neighbours:2, wander:.11, structure:0 },
  { threshold:.36, neighbours:3, wander:.13, structure:0 },
  { threshold:.33, neighbours:3, wander:.08, structure:.3 },
  { threshold:.35, neighbours:3, wander:.09, structure:.18 },
]

const lerp=(a,b,t)=>a+(b-a)*t
const frac=x=>x-Math.floor(x)
const hash=(a,b)=>frac(Math.sin(a*12.9898+b*78.233)*43758.5453)
const noise=(x,y)=>{const xi=Math.floor(x),yi=Math.floor(y);let fx=x-xi,fy=y-yi;fx=fx*fx*(3-2*fx);fy=fy*fy*(3-2*fy);const a=hash(xi,yi),b=hash(xi+1,yi),c=hash(xi,yi+1),d=hash(xi+1,yi+1);return a+(b-a)*fx+(c-a)*fy+(a-b-c+d)*fx*fy}
const fib=(i,n)=>{const y=1-(2*(i+.5))/n,r=Math.sqrt(1-y*y),a=i*Math.PI*(3-Math.sqrt(5));return[r*Math.cos(a),y,r*Math.sin(a)]}
const rgba=(hex,a)=>{const n=parseInt(hex.slice(1),16);return`rgba(${n>>16},${n>>8&255},${n&255},${Math.max(0,Math.min(1,a))})`}
const cameraAt=p=>{const lo=Math.floor(p),hi=Math.min(4,lo+1),t=p-lo,a=camera[lo],b=camera[hi];return{zoom:lerp(a.zoom,b.zoom,t),yaw:lerp(a.yaw,b.yaw,t),pitch:lerp(a.pitch,b.pitch,t),x:lerp(a.x,b.x,t),y:lerp(a.y,b.y,t)}}
const regionMix=p=>{const lo=Math.floor(p),hi=Math.min(4,lo+1),t=p-lo,weights=[0,0,0,0,0];weights[lo]=1-t;weights[hi]+=t;return weights}
const profileAt=p=>{const lo=Math.floor(p),hi=Math.min(4,lo+1),t=p-lo,a=regionProfiles[lo],b=regionProfiles[hi],weights=regionMix(p);return{threshold:lerp(a.threshold,b.threshold,t),neighbours:Math.round(lerp(a.neighbours,b.neighbours,t)),wander:lerp(a.wander,b.wander,t),structure:lerp(a.structure,b.structure,t),communication:weights[2]}}

export function createOrbModel(count) {
  const transientCount=Math.ceil(count/17)
  let transientIndex=0
  const anchors=Array.from({length:7},(_,i)=>{const y=hash(i,52.4)*1.7-.85,a=hash(i,63.8)*Math.PI*2,r=Math.sqrt(1-y*y);return{x:Math.cos(a)*r,y,z:Math.sin(a)*r,strength:.01+hash(i,74.2)*.011}})
  const nodes=Array.from({length:count},(_,i)=>{let [x,y,z]=fib(i,count);const transient=i%17===0,life=34+hash(i,8.1)*18,slot=transient?transientIndex++:0,seed=hash(i,4.7),importance=.12+Math.pow(hash(i,26.4),5)*.88,cluster=Math.floor(hash(i,18.6)*7),anchor=anchors[cluster],pull=.14+hash(i,38.7)*.3;x=lerp(x,anchor.x,pull);y=lerp(y,anchor.y,pull);z=lerp(z,anchor.z,pull);const length=Math.hypot(x,y,z);return{x:x/length,y:y/length,z:z/length,vx:(hash(i,2.1)-.5)*.07,vy:(hash(i,3.7)-.5)*.07,vz:(hash(i,6.4)-.5)*.07,seed,importance,phase:hash(i,9.3)*Math.PI*2,principal:i%9===0||i%13===0,hub:importance>.64,cluster,transient,alpha:1,age:transient?(slot/transientCount)*34:0,life,generation:0,state:'alive'}})
  nodes.anchors=anchors
  const communicationView=camera[2]
  nodes.communicationIndex=nodes.reduce((best,node,i)=>{const sy=Math.sin(communicationView.yaw),cy=Math.cos(communicationView.yaw),z=-node.x*sy+node.z*cy;return z>best.z&&node.importance>.35?{i,z}:best},{i:0,z:-Infinity}).i
  const keys=new Set(),springs=[]
  nodes.forEach((node,i)=>{const nearest=nodes.map((other,j)=>({j,d:Math.hypot(node.x-other.x,node.y-other.y,node.z-other.z)})).filter(({j})=>j!==i).sort((a,b)=>a.d-b.d),choices=[nearest[0],nearest[2+Math.floor(hash(i,14.2)*Math.min(4,nearest.length-2))]];choices.forEach(({j,d})=>{const a=Math.min(i,j),b=Math.max(i,j),key=`${a}:${b}`;if(keys.has(key))return;keys.add(key);springs.push({a,b,rest:d})})})
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

function hubEdges(nodes,time,automation=0) {
  const epoch=Math.floor(time/16),keys=new Set(),edges=[]
  nodes.forEach((node,a)=>{if(!node.hub||node.alpha<.2)return;const limit=hash(a,epoch+93)>.72-automation*.35?2:1,maxDistance=1.48+automation*.1;nodes.map((other,b)=>({b,distance:Math.hypot(node.x-other.x,node.y-other.y,node.z-other.z),score:hash(a+b*3,epoch+81)})).filter(({b,distance})=>b!==a&&distance>.62&&distance<maxDistance&&nodes[b].alpha>.2).sort((x,y)=>y.score-x.score).slice(0,limit).forEach(({b,distance})=>{const low=Math.min(a,b),high=Math.max(a,b),key=`${low}:${high}`;if(keys.has(key))return;keys.add(key);edges.push({a:low,b:high,distance,alpha:.16+hash(low,high+epoch)*.12})})})
  return edges
}

function stepSimulation(model,time,profile,region,activity,reduced,pointer,view,base,cx,cy) {
  if(reduced)return
  const dt=model.lastTime?Math.min(.032,Math.max(.008,time-model.lastTime)):.016
  model.lastTime=time
  model.frameDt=dt
  const ax=new Float32Array(model.length),ay=new Float32Array(model.length),az=new Float32Array(model.length)
  const dynamic=spatialPairs(model,profile.threshold+.08,6)
  const longRange=hubEdges(model,time)
  const applySpring=(edge,strength,rest)=>{const a=model[edge.a],b=model[edge.b],dx=b.x-a.x,dy=b.y-a.y,dz=b.z-a.z,d=Math.hypot(dx,dy,dz)||.001,force=(d-rest)*strength/d,fx=dx*force,fy=dy*force,fz=dz*force;ax[edge.a]+=fx;ay[edge.a]+=fy;az[edge.a]+=fz;ax[edge.b]-=fx;ay[edge.b]-=fy;az[edge.b]-=fz}
  model.springs.forEach(edge=>{const visibility=Math.min(model[edge.a].alpha,model[edge.b].alpha);if(visibility>.15)applySpring(edge,(.5+activity*.18)*visibility,edge.rest)})
  dynamic.forEach(edge=>{const visibility=Math.min(model[edge.a].alpha,model[edge.b].alpha);if(visibility<.12)return;applySpring(edge,(.24+activity*.1)*visibility,profile.threshold*.7);if(edge.distance<.29){const a=model[edge.a],b=model[edge.b],d=edge.distance||.001,force=(.29-d)*.5/d,fx=(a.x-b.x)*force,fy=(a.y-b.y)*force,fz=(a.z-b.z)*force;ax[edge.a]+=fx;ay[edge.a]+=fy;az[edge.a]+=fz;ax[edge.b]-=fx;ay[edge.b]-=fy;az[edge.b]-=fz}})
  if(profile.communication>.01){const hubIndex=model.communicationIndex,hub=model[hubIndex];model.map((node,index)=>({index,distance:index===hubIndex?Infinity:Math.hypot(hub.x-node.x,hub.y-node.y,hub.z-node.z)})).sort((a,b)=>a.distance-b.distance).slice(0,9).forEach(({index,distance})=>applySpring({a:hubIndex,b:index},.13*profile.communication,Math.min(.62,Math.max(.3,distance*.82))))}
  longRange.forEach(edge=>applySpring(edge,.035,.9+hash(edge.a,edge.b)*.28))
  model.forEach((node,i)=>{if(node.transient){node.age+=dt;if(node.state==='alive'&&node.age>node.life)node.state='dying';if(node.state==='dying'){node.alpha=Math.max(0,node.alpha-dt/4);if(node.alpha===0){node.generation++;node.cluster=Math.floor(hash(i,node.generation+91)*7);const anchor=model.anchors[node.cluster],u=hash(i+node.generation*17,21.3)*Math.PI*2,spread=.28+hash(i+node.generation*23,31.7)*.5;node.x=anchor.x+Math.cos(u)*spread;node.y=anchor.y+(hash(i,node.generation+29)-.5)*spread;node.z=anchor.z+Math.sin(u)*spread;const bornLength=Math.hypot(node.x,node.y,node.z);node.x/=bornLength;node.y/=bornLength;node.z/=bornLength;node.importance=.12+Math.pow(hash(i,node.generation+101),5)*.88;node.hub=node.importance>.64;node.vx=(hash(i,node.generation+41)-.5)*.08;node.vy=(hash(i,node.generation+53)-.5)*.08;node.vz=(hash(i,node.generation+67)-.5)*.08;node.age=0;node.life=34+hash(i,node.generation+79)*18;node.state='born'}}else if(node.state==='born'){node.alpha=Math.min(1,node.alpha+dt/4.5);if(node.alpha===1)node.state='alive'}}let length=Math.hypot(node.x,node.y,node.z)||1,nx=node.x/length,ny=node.y/length,nz=node.z/length;const drive=(profile.wander*.78)*(1+activity*.65),anchor=model.anchors[node.cluster];ax[i]+=(noise(i*.31+9,time*.23)-.5)*drive+(anchor.x-node.x)*anchor.strength;ay[i]+=(noise(i*.53+27,time*.2)-.5)*drive+(anchor.y-node.y)*anchor.strength;az[i]+=(noise(i*.77+55,time*.25)-.5)*drive+(anchor.z-node.z)*anchor.strength;if(region===1)ax[i]+=.012*Math.sin(node.phase);if(region===3){ax[i]+=(Math.round(node.x*4)/4-node.x)*.018;ay[i]+=(Math.round(node.y*4)/4-node.y)*.018}if(region===4){const angle=(i%6)/6*Math.PI*2;ax[i]+=(Math.cos(angle)*.82-node.x)*.014;az[i]+=(Math.sin(angle)*.82-node.z)*.014}if(pointer?.active){const sy=Math.sin(view.yaw+time*WORLD_SPIN),cyw=Math.cos(view.yaw+time*WORLD_SPIN),st=Math.sin(view.pitch),ct=Math.cos(view.pitch),x1=node.x*cyw+node.z*sy,z1=-node.x*sy+node.z*cyw,y1=node.y*ct-z1*st,z2=node.y*st+z1*ct,perspective=1+z2*.055,px=cx+x1*base*perspective,py=cy-y1*base*perspective,dx=px-pointer.x,dy=py-pointer.y,distance=Math.hypot(dx,dy),radius=Math.min(base*.34,180);if(distance<radius&&distance>1){const strength=(1-distance/radius)*.28,fx=dx/distance*strength,fy=dy/distance*strength;ax[i]+=cyw*fx+(-sy*st)*fy;ay[i]+=-ct*fy;az[i]+=sy*fx+(cyw*st)*fy}}const forceNormal=ax[i]*nx+ay[i]*ny+az[i]*nz;ax[i]-=forceNormal*nx;ay[i]-=forceNormal*ny;az[i]-=forceNormal*nz;const velocityNormal=node.vx*nx+node.vy*ny+node.vz*nz;node.vx-=velocityNormal*nx;node.vy-=velocityNormal*ny;node.vz-=velocityNormal*nz;const damping=Math.exp(-(1.05-activity*.12)*dt);node.vx=(node.vx+ax[i]*dt)*damping;node.vy=(node.vy+ay[i]*dt)*damping;node.vz=(node.vz+az[i]*dt)*damping;const speed=Math.hypot(node.vx,node.vy,node.vz),maxSpeed=.14+activity*.025+(pointer?.active?.008:0);if(speed>maxSpeed){const limit=maxSpeed/speed;node.vx*=limit;node.vy*=limit;node.vz*=limit}node.x+=node.vx*dt;node.y+=node.vy*dt;node.z+=node.vz*dt;length=Math.hypot(node.x,node.y,node.z)||1;node.x/=length;node.y/=length;node.z/=length;nx=node.x;ny=node.y;nz=node.z;const transportedNormal=node.vx*nx+node.vy*ny+node.vz*nz;node.vx-=transportedNormal*nx;node.vy-=transportedNormal*ny;node.vz-=transportedNormal*nz})
}

function projectNodes(model,time,view,base,cx,cy) {
  const sy=Math.sin(view.yaw+time*WORLD_SPIN),cyw=Math.cos(view.yaw+time*WORLD_SPIN),st=Math.sin(view.pitch),ct=Math.cos(view.pitch)
  return model.map((node,index)=>{
    const x1=node.x*cyw+node.z*sy,z1=-node.x*sy+node.z*cyw,y1=node.y*ct-z1*st,z2=node.y*st+z1*ct
    const perspective=1+z2*.055
    return{...node,index,x3:node.x,y3:node.y,z3:node.z,x:cx+x1*base*perspective,y:cy-y1*base*perspective,z:z2}
  })
}

function proximityEdges(nodes,threshold,maxNeighbours,time) {
  const cells=new Map(),key=(x,y,z)=>`${Math.floor((x+1)/threshold)}:${Math.floor((y+1)/threshold)}:${Math.floor((z+1)/threshold)}`
  nodes.forEach((node,i)=>{const k=key(node.x3,node.y3,node.z3);if(!cells.has(k))cells.set(k,[]);cells.get(k).push(i)})
  const degrees=new Uint8Array(nodes.length),edges=[]
  nodes.forEach((a,i)=>{const gx=Math.floor((a.x3+1)/threshold),gy=Math.floor((a.y3+1)/threshold),gz=Math.floor((a.z3+1)/threshold),candidates=[]
    for(let dx=-1;dx<=1;dx++)for(let dy=-1;dy<=1;dy++)for(let dz=-1;dz<=1;dz++){const bucket=cells.get(`${gx+dx}:${gy+dy}:${gz+dz}`);if(!bucket)continue;bucket.forEach(j=>{if(j<=i)return;const b=nodes[j],distance=Math.hypot(a.x3-b.x3,a.y3-b.y3,a.z3-b.z3);if(distance<threshold)candidates.push({j,distance})})}
    const epoch=Math.floor(time/9),nodeLimit=Math.max(2,maxNeighbours-(hash(i,epoch+33)>.58?1:0)+(a.importance>.64?2:0));candidates.sort((a,b)=>a.distance*(.76+hash(i+a.j,epoch+17)*.52)-b.distance*(.76+hash(i+b.j,epoch+17)*.52)).slice(0,nodeLimit).forEach(({j,distance})=>{const peerLimit=Math.max(2,maxNeighbours-(hash(j,epoch+33)>.58?1:0)+(nodes[j].importance>.64?2:0));if(degrees[i]>=nodeLimit||degrees[j]>=peerLimit)return;degrees[i]++;degrees[j]++;edges.push({a:i,b:j,distance,alpha:1-distance/threshold})})
  })
  return edges
}

function smoothEdges(model,targets) {
  const dt=model.frameDt||.016,targetMap=new Map(targets.map(edge=>[`${edge.a}:${edge.b}`,edge]))
  targetMap.forEach((edge,key)=>{const state=model.edgeStates.get(key)||{...edge,opacity:0,pulseOffset:hash(edge.a,edge.b+41),pulsePeriod:9+hash(edge.a+17,edge.b+53)*11};state.a=edge.a;state.b=edge.b;state.distance=edge.distance;state.alpha=edge.alpha;state.opacity+=((edge.alpha)-state.opacity)*Math.min(1,dt*2.8);model.edgeStates.set(key,state)})
  model.edgeStates.forEach((state,key)=>{if(targetMap.has(key))return;state.opacity+=(0-state.opacity)*Math.min(1,dt*1.45);if(state.opacity<.008)model.edgeStates.delete(key)})
  return [...model.edgeStates.values()]
}

function paintLine(ctx,a,b,alpha,color=PEARL,width=.55){if(a.z<-.58&&b.z<-.58)return;const raw=Math.max(0,Math.min(1,((a.z+b.z)*.5+1)/2)),depth=.025+.975*raw**1.7;ctx.strokeStyle=rgba(color,alpha*depth);ctx.lineWidth=width;ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke()}

function paintRegionStructures(ctx,nodes,model,weights,time) {
  const ia=weights[0],whatsapp=weights[2],web=weights[3],data=weights[4]
  if(ia>.01){const hubs=nodes.filter(node=>node.hub&&node.z>-.35);hubs.forEach((hub,index)=>nodes.filter(node=>node.index!==hub.index).sort((a,b)=>Math.hypot(a.x-hub.x,a.y-hub.y)-Math.hypot(b.x-hub.x,b.y-hub.y)).slice(0,2+(index%2)).forEach(node=>paintLine(ctx,hub,node,.11*ia,hub.importance>.75?GOLD:PEARL,.38)))}
  if(web>.01)nodes.filter(node=>node.z>.02&&node.seed>.72).forEach(node=>{const depth=(node.z+1)/2,height=(8+node.importance*32+node.seed*10)*depth*web;ctx.strokeStyle=rgba(node.importance>.65?GOLD:PEARL,(.035+depth*.11)*web*node.alpha);ctx.lineWidth=.45;ctx.beginPath();ctx.moveTo(node.x,node.y);ctx.lineTo(node.x,node.y-height);ctx.stroke();ctx.fillStyle=rgba(PEARL,.08*web*depth*node.alpha);ctx.fillRect(node.x-1.5,node.y-height-1.5,3,3)})
  if(data>.01)nodes.filter(node=>node.z>-.05&&node.seed>.67).forEach(node=>{const depth=(node.z+1)/2,size=(2+node.importance*5)*depth;ctx.strokeStyle=rgba(node.importance>.7?GOLD:PEARL,(.045+depth*.1)*data*node.alpha);ctx.lineWidth=.4;ctx.strokeRect(node.x-size/2,node.y-size/2,size,size);if(node.seed>.88)ctx.strokeRect(node.x-size*.32,node.y-size*1.25,size*.64,size*.64)})
  if(whatsapp>.01){const hub=nodes.find(node=>node.index===model.communicationIndex);if(hub){const depth=Math.max(.15,(hub.z+1)/2),strength=whatsapp*depth*hub.alpha,neighbours=nodes.filter(node=>node.index!==hub.index).sort((a,b)=>Math.hypot(a.x-hub.x,a.y-hub.y)-Math.hypot(b.x-hub.x,b.y-hub.y)).slice(0,9);neighbours.forEach((node,index)=>paintLine(ctx,hub,node,(index<5?.22:.12)*whatsapp,node.importance>.6?GOLD:PEARL,index<5?.58:.42));for(let ring=0;ring<5;ring++){const phase=frac(time*.065+ring/5),radius=12+phase*44;ctx.strokeStyle=rgba(ring===0?GOLD:PEARL,Math.sin(phase*Math.PI)*.17*strength);ctx.lineWidth=.55;ctx.beginPath();ctx.arc(hub.x,hub.y,radius,0,Math.PI*2);ctx.stroke()}for(let packet=0;packet<7;packet++){const node=neighbours[(packet*3)%neighbours.length],phase=frac(time*(.09+(packet%3)*.012)+packet*.137),progress=packet%2?1-phase:phase,envelope=Math.sin(phase*Math.PI),x=lerp(hub.x,node.x,progress),y=lerp(hub.y,node.y,progress),z=lerp(hub.z,node.z,progress),packetDepth=.08+.92*Math.max(0,(z+1)/2)**1.6;ctx.fillStyle=rgba(packet%3===0?GOLD:PEARL,envelope*packetDepth*strength*.9);ctx.beginPath();ctx.arc(x,y,.85+packetDepth*.7,0,Math.PI*2);ctx.fill()}const glow=ctx.createRadialGradient(hub.x,hub.y,1,hub.x,hub.y,24);glow.addColorStop(0,rgba(GOLD,.16*strength));glow.addColorStop(1,'transparent');ctx.fillStyle=glow;ctx.beginPath();ctx.arc(hub.x,hub.y,24,0,Math.PI*2);ctx.fill();ctx.strokeStyle=rgba(GOLD,.86*strength);ctx.lineWidth=1.15;ctx.beginPath();ctx.arc(hub.x,hub.y,13,0,Math.PI*2);ctx.stroke();ctx.beginPath();ctx.moveTo(hub.x-7,hub.y+10);ctx.lineTo(hub.x-9.5,hub.y+15);ctx.lineTo(hub.x-3.5,hub.y+12);ctx.stroke();ctx.beginPath();ctx.arc(hub.x-1.2,hub.y-1.2,5.2,-.75,2.15);ctx.stroke();ctx.beginPath();ctx.moveTo(hub.x+2.4,hub.y+3);ctx.lineTo(hub.x+6.2,hub.y+6.5);ctx.stroke()}}
}

export function renderNasusOrb(ctx,model,{width,height,time,progress,mode,reduced,pointer}) {
  const region=Math.round(progress),weights=regionMix(progress),profile=profileAt(progress),view=cameraAt(progress)
  const activity=mode==='thinking'?1:mode==='speaking'?.85:mode==='listening'?.55:0
  const signal=mode==='speaking'?Math.sin(time*7.2)*.08:0,base=Math.min(width,height)*.49*view.zoom*(1+signal)*(1+weights[2]*.1)
  const cx=width*(.5+view.x),cy=height*(.5+view.y),t=reduced?.65:time*(1+activity*.55)
  stepSimulation(model,t,profile,region,activity,reduced,pointer,view,base,cx,cy)
  const nodes=projectNodes(model,t,view,base,cx,cy)
  const localEdges=proximityEdges(nodes,profile.threshold+.025+(activity*.018),profile.neighbours+(mode==='thinking'?1:0),t)
  const edges=smoothEdges(model,[...localEdges,...hubEdges(model,t,weights[1])])

  const halo=ctx.createRadialGradient(cx,cy,base*.12,cx,cy,base*1.08);halo.addColorStop(0,'rgba(23,26,32,.08)');halo.addColorStop(.78,'rgba(11,13,17,.025)');halo.addColorStop(1,'transparent');ctx.fillStyle=halo;ctx.fillRect(0,0,width,height)
  edges.forEach(edge=>{const visibility=Math.min(nodes[edge.a].alpha,nodes[edge.b].alpha),long=edge.distance>.6;paintLine(ctx,nodes[edge.a],nodes[edge.b],edge.opacity*(long?.84:.78+activity*.18)*visibility,long?PEARL:SMOKE,long?.54:.49)})

  const pulseWindow=.18+weights[1]*.08,pulses=[]
  edges.forEach(edge=>{const cycle=frac(t/edge.pulsePeriod+edge.pulseOffset);if(cycle>=pulseWindow||edge.opacity<.08)return;const a=nodes[edge.a],b=nodes[edge.b],progress=cycle/pulseWindow,envelope=Math.sin(progress*Math.PI)**1.5,importance=Math.max(a.importance,b.importance),long=edge.distance>.6;pulses.push({a,b,progress,envelope,importance,long,score:importance+(long?.45:0)})})
  pulses.sort((a,b)=>b.score-a.score).slice(0,(width<700?4:7)+Math.round(weights[1]*3)).forEach(pulse=>{const x=lerp(pulse.a.x,pulse.b.x,pulse.progress),y=lerp(pulse.a.y,pulse.b.y,pulse.progress),z=lerp(pulse.a.z,pulse.b.z,pulse.progress),raw=Math.max(0,Math.min(1,(z+1)/2)),depth=.04+.96*raw**1.7,visibility=Math.min(pulse.a.alpha,pulse.b.alpha),alpha=pulse.envelope*depth*visibility*(.48+pulse.importance*.24);ctx.fillStyle=rgba(pulse.long||pulse.importance>.64?GOLD:PEARL,alpha);ctx.beginPath();ctx.arc(x,y,.65+pulse.importance*.75+raw*.35,0,Math.PI*2);ctx.fill()})

  nodes.sort((a,b)=>a.z-b.z).forEach(node=>{const depth=(node.z+1)/2,important=node.importance>.58,weight=.68+node.importance*1.65,r=Math.max(.22,.31+depth*.86)*weight*(width<700?.86:1),opacity=(.08+depth*.72)*(.62+node.importance*.5);ctx.fillStyle=rgba(important&&node.index%6===region?GOLD:PEARL,opacity*node.alpha);ctx.beginPath();ctx.arc(node.x,node.y,r+(activity*(important?.65:.1)),0,Math.PI*2);ctx.fill()})
  paintRegionStructures(ctx,nodes,model,weights,t)
}
