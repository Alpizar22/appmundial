import { renderIaSubworld } from './regions/iaSubworld'
import { renderAutomationSubworld } from './regions/automationSubworld'
import { renderDataSubworld } from './regions/dataSubworld'
import { REGION_ANCHORS, cameraTargetForAnchor, projectAnchor, selectNodesAroundAnchor } from './regions/regionAnchors'

// Large-format Nasus renderer adapted from the MIT-licensed Thinking Orbs
// primitives: Fibonacci sphere, value-noise drift, depth projection, proximity
// web and travelling signals. See THIRD_PARTY_NOTICES.md.

const GOLD = '#d6a64b'
const PEARL = '#e8e6e3'
const SMOKE = '#8d9199'
const WORLD_SPIN = .018
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
const GLOBAL_PROFILE = { threshold:.35, neighbours:3, wander:.15, structure:0, communication:0 }

const lerp=(a,b,t)=>a+(b-a)*t
const frac=x=>x-Math.floor(x)
const clamp01=value=>Math.max(0,Math.min(1,value))
const hash=(a,b)=>frac(Math.sin(a*12.9898+b*78.233)*43758.5453)
const noise=(x,y)=>{const xi=Math.floor(x),yi=Math.floor(y);let fx=x-xi,fy=y-yi;fx=fx*fx*(3-2*fx);fy=fy*fy*(3-2*fy);const a=hash(xi,yi),b=hash(xi+1,yi),c=hash(xi,yi+1),d=hash(xi+1,yi+1);return a+(b-a)*fx+(c-a)*fy+(a-b-c+d)*fx*fy}
const fib=(i,n)=>{const y=1-(2*(i+.5))/n,r=Math.sqrt(1-y*y),a=i*Math.PI*(3-Math.sqrt(5));return[r*Math.cos(a),y,r*Math.sin(a)]}
const rgba=(hex,a)=>{const n=parseInt(hex.slice(1),16);return`rgba(${n>>16},${n>>8&255},${n&255},${Math.max(0,Math.min(1,a))})`}
const smoothstep=t=>t*t*(3-2*t)
const cinematicTravel=weight=>1-Math.pow(1-clamp01(weight),2.25)
const cinematicReveal=weight=>smoothstep(clamp01((weight-.3)/.7))
const cinematicIsolation=weight=>smoothstep(clamp01((weight-.7)/.3))
const regionalWeightAt=(progress,index)=>1-smoothstep(Math.max(0,Math.min(1,(Math.abs(progress-index)-.12)/.32)))
const regionalStateAt=p=>{const index=Math.max(0,Math.min(4,Math.round(p))),weights=Array.from({length:5},(_,regionIndex)=>regionalWeightAt(p,regionIndex)),focus=weights[index];return{index,focus,weights}}
const cameraAt=(p,state)=>{const lo=Math.floor(p),hi=Math.min(4,lo+1),t=p-lo,a=camera[lo],b=camera[hi],regional=camera[state.index],travel=cinematicTravel(state.focus);return{zoom:lerp(.86,regional.zoom,travel),yaw:lerp(a.yaw,b.yaw,t),pitch:lerp(0,regional.pitch,travel),x:regional.x*travel,y:regional.y*travel}}
const profileAt=state=>{const regional=regionProfiles[state.index],focus=state.focus;return{threshold:lerp(GLOBAL_PROFILE.threshold,regional.threshold,focus),neighbours:Math.round(lerp(GLOBAL_PROFILE.neighbours,regional.neighbours,focus)),wander:lerp(GLOBAL_PROFILE.wander,regional.wander,focus),structure:lerp(GLOBAL_PROFILE.structure,regional.structure,focus),communication:state.index===2?focus:0}}

export function createOrbModel(count) {
  const transientCount=Math.ceil(count/17)
  let transientIndex=0
  const anchors=Array.from({length:7},(_,i)=>{const y=hash(i,52.4)*1.7-.85,a=hash(i,63.8)*Math.PI*2,r=Math.sqrt(1-y*y);return{x:Math.cos(a)*r,y,z:Math.sin(a)*r,strength:.01+hash(i,74.2)*.011}})
  const nodes=Array.from({length:count},(_,i)=>{let [x,y,z]=fib(i,count);const transient=i%17===0,life=34+hash(i,8.1)*18,slot=transient?transientIndex++:0,seed=hash(i,4.7),importance=.12+Math.pow(hash(i,26.4),5)*.88,cluster=Math.floor(hash(i,18.6)*7),anchor=anchors[cluster],pull=.14+hash(i,38.7)*.3;x=lerp(x,anchor.x,pull);y=lerp(y,anchor.y,pull);z=lerp(z,anchor.z,pull);const length=Math.hypot(x,y,z);return{x:x/length,y:y/length,z:z/length,vx:(hash(i,2.1)-.5)*.07,vy:(hash(i,3.7)-.5)*.07,vz:(hash(i,6.4)-.5)*.07,seed,importance,phase:hash(i,9.3)*Math.PI*2,principal:i%9===0||i%13===0,hub:importance>.64,cluster,transient,alpha:1,age:transient?(slot/transientCount)*34:0,life,generation:0,state:'alive'}})
  nodes.anchors=anchors
  nodes.webDistrictIndices=[]
  const keys=new Set(),springs=[]
  nodes.forEach((node,i)=>{const nearest=nodes.map((other,j)=>({j,d:Math.hypot(node.x-other.x,node.y-other.y,node.z-other.z)})).filter(({j})=>j!==i).sort((a,b)=>a.d-b.d),choices=[nearest[0],nearest[2+Math.floor(hash(i,14.2)*Math.min(4,nearest.length-2))]];choices.forEach(({j,d})=>{const a=Math.min(i,j),b=Math.max(i,j),key=`${a}:${b}`;if(keys.has(key))return;keys.add(key);springs.push({a,b,rest:d})})})
  nodes.springs=springs
  nodes.edgeStates=new Map()
  nodes.webBuildStates=new Map()
  nodes.webDistrictMembers=null
  nodes.webDistrictLayouts=null
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

function stepSimulation(model,time,profile,region,regionFocus,activity,reduced,pointer,view,base,cx,cy) {
  if(reduced)return
  const dt=model.lastTime?Math.min(.032,Math.max(.008,time-model.lastTime)):.016
  model.lastTime=time
  model.frameDt=dt
  const ax=new Float32Array(model.length),ay=new Float32Array(model.length),az=new Float32Array(model.length)
  const dynamic=spatialPairs(model,GLOBAL_PROFILE.threshold+.08,6)
  const longRange=hubEdges(model,time)
  const applySpring=(edge,strength,rest)=>{const a=model[edge.a],b=model[edge.b],dx=b.x-a.x,dy=b.y-a.y,dz=b.z-a.z,d=Math.hypot(dx,dy,dz)||.001,force=(d-rest)*strength/d,fx=dx*force,fy=dy*force,fz=dz*force;ax[edge.a]+=fx;ay[edge.a]+=fy;az[edge.a]+=fz;ax[edge.b]-=fx;ay[edge.b]-=fy;az[edge.b]-=fz}
  model.springs.forEach(edge=>{const visibility=Math.min(model[edge.a].alpha,model[edge.b].alpha);if(visibility>.15)applySpring(edge,(.5+activity*.18)*visibility,edge.rest)})
  dynamic.forEach(edge=>{const visibility=Math.min(model[edge.a].alpha,model[edge.b].alpha);if(visibility<.12)return;applySpring(edge,(.24+activity*.1)*visibility,profile.threshold*.7);if(edge.distance<.29){const a=model[edge.a],b=model[edge.b],d=edge.distance||.001,force=(.29-d)*.5/d,fx=(a.x-b.x)*force,fy=(a.y-b.y)*force,fz=(a.z-b.z)*force;ax[edge.a]+=fx;ay[edge.a]+=fy;az[edge.a]+=fz;ax[edge.b]-=fx;ay[edge.b]-=fy;az[edge.b]-=fz}})
  longRange.forEach(edge=>applySpring(edge,.035,.9+hash(edge.a,edge.b)*.28))
  model.forEach((node,i)=>{if(node.transient){node.age+=dt;if(node.state==='alive'&&node.age>node.life)node.state='dying';if(node.state==='dying'){node.alpha=Math.max(0,node.alpha-dt/4);if(node.alpha===0){node.generation++;node.cluster=Math.floor(hash(i,node.generation+91)*7);const anchor=model.anchors[node.cluster],u=hash(i+node.generation*17,21.3)*Math.PI*2,spread=.28+hash(i+node.generation*23,31.7)*.5;node.x=anchor.x+Math.cos(u)*spread;node.y=anchor.y+(hash(i,node.generation+29)-.5)*spread;node.z=anchor.z+Math.sin(u)*spread;const bornLength=Math.hypot(node.x,node.y,node.z);node.x/=bornLength;node.y/=bornLength;node.z/=bornLength;node.importance=.12+Math.pow(hash(i,node.generation+101),5)*.88;node.hub=node.importance>.64;node.vx=(hash(i,node.generation+41)-.5)*.08;node.vy=(hash(i,node.generation+53)-.5)*.08;node.vz=(hash(i,node.generation+67)-.5)*.08;node.age=0;node.life=34+hash(i,node.generation+79)*18;node.state='born'}}else if(node.state==='born'){node.alpha=Math.min(1,node.alpha+dt/4.5);if(node.alpha===1)node.state='alive'}}let length=Math.hypot(node.x,node.y,node.z)||1,nx=node.x/length,ny=node.y/length,nz=node.z/length;const drive=(profile.wander*.78)*(1+activity*.65),anchor=model.anchors[node.cluster];ax[i]+=(noise(i*.31+9,time*.23)-.5)*drive+(anchor.x-node.x)*anchor.strength;ay[i]+=(noise(i*.53+27,time*.2)-.5)*drive+(anchor.y-node.y)*anchor.strength;az[i]+=(noise(i*.77+55,time*.25)-.5)*drive+(anchor.z-node.z)*anchor.strength;if(region===1)ax[i]+=.012*Math.sin(node.phase)*regionFocus;if(region===3){ax[i]+=(Math.round(node.x*4)/4-node.x)*.018*regionFocus;ay[i]+=(Math.round(node.y*4)/4-node.y)*.018*regionFocus}if(region===4){const angle=(i%6)/6*Math.PI*2;ax[i]+=(Math.cos(angle)*.82-node.x)*.014*regionFocus;az[i]+=(Math.sin(angle)*.82-node.z)*.014*regionFocus}if(pointer?.active){const sy=Math.sin(view.yaw+time*WORLD_SPIN),cyw=Math.cos(view.yaw+time*WORLD_SPIN),st=Math.sin(view.pitch),ct=Math.cos(view.pitch),x1=node.x*cyw+node.z*sy,z1=-node.x*sy+node.z*cyw,y1=node.y*ct-z1*st,z2=node.y*st+z1*ct,perspective=1+z2*.055,px=cx+x1*base*perspective,py=cy-y1*base*perspective,dx=px-pointer.x,dy=py-pointer.y,distance=Math.hypot(dx,dy),radius=Math.min(base*.34,180);if(distance<radius&&distance>1){const strength=(1-distance/radius)*.28,fx=dx/distance*strength,fy=dy/distance*strength;ax[i]+=cyw*fx+(-sy*st)*fy;ay[i]+=-ct*fy;az[i]+=sy*fx+(cyw*st)*fy}}const forceNormal=ax[i]*nx+ay[i]*ny+az[i]*nz;ax[i]-=forceNormal*nx;ay[i]-=forceNormal*ny;az[i]-=forceNormal*nz;const velocityNormal=node.vx*nx+node.vy*ny+node.vz*nz;node.vx-=velocityNormal*nx;node.vy-=velocityNormal*ny;node.vz-=velocityNormal*nz;const damping=Math.exp(-(1.05-activity*.12)*dt);node.vx=(node.vx+ax[i]*dt)*damping;node.vy=(node.vy+ay[i]*dt)*damping;node.vz=(node.vz+az[i]*dt)*damping;const speed=Math.hypot(node.vx,node.vy,node.vz),maxSpeed=.14+activity*.025+(pointer?.active?.008:0);if(speed>maxSpeed){const limit=maxSpeed/speed;node.vx*=limit;node.vy*=limit;node.vz*=limit}node.x+=node.vx*dt;node.y+=node.vy*dt;node.z+=node.vz*dt;length=Math.hypot(node.x,node.y,node.z)||1;node.x/=length;node.y/=length;node.z/=length;nx=node.x;ny=node.y;nz=node.z;const transportedNormal=node.vx*nx+node.vy*ny+node.vz*nz;node.vx-=transportedNormal*nx;node.vy-=transportedNormal*ny;node.vz-=transportedNormal*nz})
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

const globalDepthVisibility=z=>smoothstep(Math.max(0,Math.min(1,(z+.78)/.8)))

function paintLine(ctx,a,b,alpha,color=PEARL,width=.55){const visibilityA=globalDepthVisibility(a.z),visibilityB=globalDepthVisibility(b.z);if(visibilityA<.002&&visibilityB<.002)return;const raw=Math.max(0,Math.min(1,((a.z+b.z)*.5+1)/2)),depth=.025+.975*raw**1.7;if(Math.abs(visibilityA-visibilityB)<.12)ctx.strokeStyle=rgba(color,alpha*depth*(visibilityA+visibilityB)*.5);else{const gradient=ctx.createLinearGradient(a.x,a.y,b.x,b.y);gradient.addColorStop(0,rgba(color,alpha*depth*visibilityA));gradient.addColorStop(1,rgba(color,alpha*depth*visibilityB));ctx.strokeStyle=gradient}ctx.lineWidth=width;ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke()}

function paintGlobalFlowWaves(ctx,time,view,base,cx,cy,opacity) {
  const sy=Math.sin(view.yaw+time*WORLD_SPIN),cyw=Math.cos(view.yaw+time*WORLD_SPIN),st=Math.sin(view.pitch),ct=Math.cos(view.pitch)
  for(let band=0;band<2;band++){let previous=null;for(let step=0;step<=72;step++){const longitude=-Math.PI+step/72*Math.PI*2,latitude=(band?-.2:.18)+Math.sin(longitude*(band?2.4:2.9)+time*(band?.12:.15)+band*1.7)*.06,ring=Math.cos(latitude),wx=Math.cos(longitude)*ring,wy=Math.sin(latitude),wz=Math.sin(longitude)*ring,x1=wx*cyw+wz*sy,z1=-wx*sy+wz*cyw,y1=wy*ct-z1*st,z2=wy*st+z1*ct,perspective=1+z2*.055,current={x:cx+x1*base*perspective,y:cy-y1*base*perspective,z:z2};if(previous)paintLine(ctx,previous,current,(band?.095:.12)*opacity,band?SMOKE:PEARL,band?.4:.46);previous=current}}
}

function paintWhatsappRoute(ctx,hub,node,weight,width=.8) {
  const depth=Math.max(.08,Math.min(1,((hub.z+node.z)*.5+1)/2))
  const gradient=ctx.createLinearGradient(hub.x,hub.y,node.x,node.y)
  gradient.addColorStop(0,rgba(GOLD,.82*weight*depth))
  gradient.addColorStop(.42,rgba('#c4a882',.5*weight*depth))
  gradient.addColorStop(1,rgba(PEARL,.2*weight*depth))
  ctx.strokeStyle=gradient;ctx.lineWidth=width;ctx.beginPath();ctx.moveTo(hub.x,hub.y);ctx.lineTo(node.x,node.y);ctx.stroke()
}

function paintWhatsappNetworkLine(ctx,a,b,hub,weight,width=.45) {
  const distanceA=Math.hypot(a.x-hub.x,a.y-hub.y),distanceB=Math.hypot(b.x-hub.x,b.y-hub.y)
  const warmthA=Math.max(0,1-distanceA/240),warmthB=Math.max(0,1-distanceB/240)
  const depth=Math.max(.04,Math.min(1,((a.z+b.z)*.5+1)/2))
  const gradient=ctx.createLinearGradient(a.x,a.y,b.x,b.y)
  gradient.addColorStop(0,rgba(warmthA>.45?GOLD:PEARL,(.12+warmthA*.27)*weight*depth))
  gradient.addColorStop(1,rgba(warmthB>.45?GOLD:PEARL,(.12+warmthB*.27)*weight*depth))
  ctx.strokeStyle=gradient;ctx.lineWidth=width;ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke()
}

function paintSignalWave(ctx,hub,node,weight,time,index) {
  const dx=node.x-hub.x,dy=node.y-hub.y,length=Math.hypot(dx,dy)||1,nx=-dy/length,ny=dx/length,segments=28
  ctx.strokeStyle=rgba(index<2?GOLD:PEARL,(.2-index*.022)*weight);ctx.lineWidth=index<2?.72:.48;ctx.beginPath()
  for(let step=0;step<=segments;step++){const progress=step/segments,envelope=Math.sin(progress*Math.PI),wave=Math.sin(progress*Math.PI*(4+index%3)+time*.32+index)*envelope*(4.5+index*1.1),x=lerp(hub.x,node.x,progress)+nx*wave,y=lerp(hub.y,node.y,progress)+ny*wave;if(step===0)ctx.moveTo(x,y);else ctx.lineTo(x,y)}
  ctx.stroke()
}

function paintWhatsappWorld(ctx,nodes,hub,weight,time) {
  const depth=Math.max(.3,(hub.z+1)/2),strength=weight*depth
  const participants=selectNodesAroundAnchor(nodes,REGION_ANCHORS.whatsapp,{innerAngle:.34,outerAngle:1.08,minAlpha:.2,limit:30})
  const populated=participants.map(node=>{let density=0;participants.forEach(other=>{if(other===node)return;const distance=Math.hypot(node.x-other.x,node.y-other.y);if(distance<118)density+=(1-distance/118)*(.6+other.importance*.4)});return{node,density}}).sort((a,b)=>b.density-a.density)
  const secondary=[]
  populated.forEach(candidate=>{if(secondary.length>=6||candidate.node.anchorAngle<=.3||candidate.node.z<-.5)return;if(secondary.every(node=>Math.hypot(node.x-candidate.node.x,node.y-candidate.node.y)>48))secondary.push(candidate.node)})
  const densityByNode=new Map(populated.map(({node,density})=>[node,Math.min(1,density/4.2)]))

  // Raise the regional density floor while retaining the model's clustered distribution.
  nodes.forEach(node=>{const nodeDepth=Math.max(.02,(node.z+1)/2),hubDistance=Math.hypot(node.x-hub.x,node.y-hub.y),warmth=Math.max(0,1-hubDistance/235),nodeColor=warmth>.42?GOLD:PEARL;ctx.fillStyle=rgba(nodeColor,(.075+nodeDepth**1.85*(.48+warmth*.22))*weight*node.alpha);ctx.beginPath();ctx.arc(node.x,node.y,(.34+node.importance*1.22)*(.3+nodeDepth*1.05),0,Math.PI*2);ctx.fill()})
  participants.forEach((node,index)=>{const density=densityByNode.get(node)||0,target=populated[(index*5+3)%Math.min(populated.length,18)]?.node||participants[(index+1)%participants.length];paintWhatsappNetworkLine(ctx,node,target,hub,weight,.4+density*.22);if(density>.3||index%4===0)paintWhatsappNetworkLine(ctx,node,participants[(index+1)%participants.length],hub,weight,.43+density*.16);if(density>.62)paintWhatsappNetworkLine(ctx,node,participants[(index+3)%participants.length],hub,weight,.38)})
  participants.forEach(node=>{const density=densityByNode.get(node)||0,nodeDepth=Math.max(.08,(node.z+1)/2);ctx.fillStyle=rgba(density>.58?GOLD:PEARL,(.2+density*.56)*nodeDepth*weight);ctx.beginPath();ctx.arc(node.x,node.y,.65+node.importance*1.2+density*1.05,0,Math.PI*2);ctx.fill()})
  secondary.forEach((node,index)=>{paintWhatsappRoute(ctx,hub,node,weight,index<3?1.25:1);const nodeDepth=Math.max(.12,(node.z+1)/2);ctx.strokeStyle=rgba(index<3?GOLD:PEARL,(.48+nodeDepth*.28)*weight);ctx.lineWidth=.85;ctx.beginPath();ctx.arc(node.x,node.y,5.5+node.importance*2.5,0,Math.PI*2);ctx.stroke();ctx.fillStyle=rgba(index<3?GOLD:PEARL,.68*nodeDepth*weight);ctx.beginPath();ctx.arc(node.x,node.y,1.7+node.importance,0,Math.PI*2);ctx.fill()})

  const field=ctx.createRadialGradient(hub.x,hub.y,2,hub.x,hub.y,150);field.addColorStop(0,rgba(GOLD,.3*strength));field.addColorStop(.24,rgba(GOLD,.105*strength));field.addColorStop(.62,rgba('#c4a882',.025*strength));field.addColorStop(1,'transparent');ctx.fillStyle=field;ctx.beginPath();ctx.arc(hub.x,hub.y,150,0,Math.PI*2);ctx.fill()
  ;[25,39,57,79].forEach((radius,index)=>{const segments=72,breathe=1+Math.sin(time*.22+index*1.4)*.025;ctx.strokeStyle=rgba(index<2?GOLD:PEARL,(.36-index*.055)*strength);ctx.lineWidth=index===0?1.15:.62;ctx.beginPath();for(let step=0;step<=segments;step++){const angle=step/segments*Math.PI*2,organic=Math.sin(angle*3+time*.16+index)*radius*.035+Math.sin(angle*7-time*.09+index*1.7)*radius*.016,driftX=Math.sin(angle*2-time*.07+index)*radius*.018,ringRadius=radius*breathe+organic,x=hub.x+Math.cos(angle)*ringRadius+driftX,y=hub.y+Math.sin(angle)*ringRadius*.92;if(step)ctx.lineTo(x,y);else ctx.moveTo(x,y)}ctx.closePath();ctx.stroke()})

  secondary.slice(0,5).forEach((node,index)=>paintSignalWave(ctx,hub,node,strength,time,index))

  const routes=[...participants.slice(0,12),...secondary]
  for(let packet=0;packet<18;packet++){const node=routes[(packet*7)%routes.length],phase=frac(time*(.078+(packet%5)*.008)+packet*.113),progress=packet%2?1-phase:phase,envelope=Math.sin(phase*Math.PI)**1.3,x=lerp(hub.x,node.x,progress),y=lerp(hub.y,node.y,progress),z=lerp(hub.z,node.z,progress),packetDepth=.05+.95*Math.max(0,(z+1)/2)**1.7;ctx.fillStyle=rgba(packet%3===0?GOLD:PEARL,envelope*packetDepth*strength);ctx.beginPath();ctx.arc(x,y,.85+packetDepth*1.15,0,Math.PI*2);ctx.fill()}

  ctx.fillStyle=rgba('#090a0d',.96*strength);ctx.beginPath();ctx.arc(hub.x,hub.y,22,0,Math.PI*2);ctx.fill();ctx.strokeStyle=rgba(GOLD,.98*strength);ctx.lineWidth=1.45;ctx.beginPath();ctx.arc(hub.x,hub.y,21,0,Math.PI*2);ctx.stroke();ctx.strokeStyle=rgba(PEARL,.88*strength);ctx.lineWidth=1.25;ctx.lineCap='round';ctx.lineJoin='round';ctx.beginPath();ctx.arc(hub.x,hub.y,12.5,0,Math.PI*2);ctx.moveTo(hub.x-7,hub.y+10);ctx.lineTo(hub.x-10,hub.y+15);ctx.lineTo(hub.x-3.5,hub.y+12);ctx.stroke();ctx.beginPath();ctx.moveTo(hub.x-5,hub.y-5);ctx.bezierCurveTo(hub.x-3,hub.y+1,hub.x+1,hub.y+5,hub.x+6,hub.y+6);ctx.lineTo(hub.x+8,hub.y+3);ctx.lineTo(hub.x+4,hub.y);ctx.lineTo(hub.x+2,hub.y+2);ctx.bezierCurveTo(hub.x,hub.y+1,hub.x-2,hub.y-1,hub.x-3,hub.y-3);ctx.lineTo(hub.x-1,hub.y-5);ctx.closePath();ctx.stroke();ctx.lineCap='butt';ctx.lineJoin='miter'
}

function paintWebTower(ctx,node,weight,time,buildState) {
  const depth=Math.max(.03,(node.z+1)/2),fog=.34+smoothstep(depth)*.66,importance=.35+node.importance*.9,growth=smoothstep(weight),height=(20+node.seed*42+node.importance*82)*(.4+depth*.82)*growth,width=(5+node.importance*11)*(.5+depth*.76),lean=(node.seed-.5)*width*.7,topX=node.x+lean,topY=node.y-height,color=node.importance>.62?GOLD:PEARL,alpha=(.28+depth**1.35*.78)*weight*node.alpha*fog,archetype=Math.floor(node.seed*3),levels=3+Math.floor(height/19)+Math.floor(node.importance*2),rawBuild=Math.max(0,Math.min(1,(time-buildState.startedAt)/buildState.duration)),levelProgress=rawBuild*levels,builtLevels=Math.floor(levelProgress),segmentEase=smoothstep(frac(levelProgress)),reveal=Math.min(1,(builtLevels+segmentEase)/levels),revealY=lerp(node.y,topY,reveal)
  ctx.save();ctx.beginPath();ctx.rect(node.x-width*2.2,revealY-2,width*4.4,node.y-revealY+4);ctx.clip();ctx.strokeStyle=rgba(color,alpha);ctx.lineWidth=node.importance>.62?.85:.48;ctx.beginPath()
  if(archetype===0){ctx.moveTo(node.x-width,node.y);ctx.lineTo(topX-width*.45,topY);ctx.lineTo(topX+width*.45,topY);ctx.lineTo(node.x+width,node.y);ctx.moveTo(topX-width*.45,topY);ctx.lineTo(node.x+width,node.y);ctx.moveTo(topX+width*.45,topY);ctx.lineTo(node.x-width,node.y)}
  else if(archetype===1){const wing=width*1.45;ctx.moveTo(node.x-width*.65,node.y);ctx.lineTo(topX-width*.42,topY);ctx.lineTo(topX+width*.42,topY);ctx.lineTo(node.x+width*.65,node.y);ctx.moveTo(node.x+width*.65,node.y);ctx.lineTo(node.x+wing,node.y-height*.42);ctx.lineTo(topX+width*.72,topY+height*.18);ctx.lineTo(topX+width*.42,topY)}
  else{const midY=node.y-height*.48,midX=lerp(node.x,topX,.48),setback=width*.7;ctx.moveTo(node.x-width,node.y);ctx.lineTo(midX-width,midY);ctx.lineTo(midX-setback,midY);ctx.lineTo(topX-setback,topY);ctx.lineTo(topX+setback,topY);ctx.lineTo(midX+setback,midY);ctx.lineTo(midX+width,midY);ctx.lineTo(node.x+width,node.y)}
  ctx.moveTo(node.x-width,node.y);ctx.lineTo(node.x+width,node.y);ctx.stroke();ctx.restore()
  for(let level=1;level<levels;level++){const progress=level/levels;if(progress>reveal)continue;const y=lerp(node.y,topY,progress),x=lerp(node.x,topX,progress),setback=archetype===2&&progress>.48?.7:1,half=lerp(width,width*.45,progress)*setback,activation=Math.min(1,(reveal-progress)*levels*2);ctx.strokeStyle=rgba(level===levels-1&&node.importance>.62?GOLD:SMOKE,alpha*.55*activation);ctx.beginPath();ctx.moveTo(x-half,y);ctx.lineTo(x+half,y);ctx.stroke()}
  const panelCount=node.seed>.12?(node.importance>.62||height>68?2:1):0;for(let panel=0;panel<panelCount;panel++){const progress=.28+frac(node.seed*3.7+panel*.41)*.48;if(progress>reveal)continue;const panelY=lerp(node.y,topY,progress),panelX=lerp(node.x,topX,progress),panelWidth=width*(.72+frac(node.seed*7.1+panel)*.62),panelHeight=Math.max(3.5,height*(.065+frac(node.seed*5.3+panel)*.055)),activation=Math.min(1,(reveal-progress)*levels*1.4);ctx.fillStyle=rgba('#171a20',alpha*.2*activation);ctx.fillRect(panelX-panelWidth,panelY-panelHeight,panelWidth*2,panelHeight);ctx.strokeStyle=rgba(panel===1?GOLD:PEARL,alpha*.48*activation);ctx.strokeRect(panelX-panelWidth,panelY-panelHeight,panelWidth*2,panelHeight)}
  if(rawBuild<1&&rawBuild>0){const segmentStart=builtLevels/levels,segmentEnd=Math.min(1,(builtLevels+1)/levels),pulseProgress=lerp(segmentStart,segmentEnd,segmentEase),travel=Math.sin(segmentEase*Math.PI),px=lerp(node.x,topX,pulseProgress),py=lerp(node.y,topY,pulseProgress);ctx.fillStyle=rgba(color,travel*alpha*1.6);ctx.beginPath();ctx.arc(px,py,.8+importance*.65,0,Math.PI*2);ctx.fill()}
  return{...node,topX,topY,width,depth,alpha,reveal}
}

function paintWebWorld(ctx,nodes,model,weight,time) {
  const dpr=ctx.getTransform().a||1,viewportWidth=ctx.canvas.width/dpr,viewportHeight=ctx.canvas.height/dpr,radius=Math.min(viewportWidth,viewportHeight)*.25
  const driftX=(1-weight)*13+Math.sin(time*.09)*2.2,driftY=(1-weight)*-5+Math.cos(time*.075)*1.4,sceneNodes=nodes.map(node=>({...node,x:node.x+node.z*driftX,y:node.y+node.z*driftY}))
  const eligible=sceneNodes.filter(node=>node.z>-.58&&node.alpha>.2&&node.x>viewportWidth*.08&&node.x<viewportWidth*.98&&node.y>viewportHeight*.015&&node.y<viewportHeight*.98)
  if(model.webDistrictIndices.length<1){if(weight<.62)return;const districtRadius=radius*1.08,centerCandidates=eligible.filter(node=>node.z>-.38&&node.x>viewportWidth*.34&&node.x<viewportWidth*.9&&node.y>viewportHeight*.42&&node.y<viewportHeight*.76).map(node=>({...node,density:eligible.filter(other=>Math.hypot(node.x-other.x,node.y-other.y)<districtRadius).length}));const center=centerCandidates.sort((a,b)=>(b.density*1.8+b.importance)-(a.density*1.8+a.importance))[0];if(center)model.webDistrictIndices=[center.index]}
  const centers=model.webDistrictIndices.map(index=>sceneNodes.find(node=>node.index===index)).filter(Boolean)
  if(!centers.length)return
  const districts=centers.map(center=>({center,nodes:[],pool:eligible.map(node=>({node,distance:Math.hypot(node.x-center.x,(node.y-center.y)*2.15)})).sort((a,b)=>a.distance-b.distance)}))
  districts.forEach(district=>{const selected=[district.center],ranked=district.pool.filter(({node})=>node.index!==district.center.index).map(({node,distance})=>({node,score:distance*(.88+hash(node.index,district.center.index+57)*.24)-node.importance*radius*.08})).sort((a,b)=>a.score-b.score);ranked.slice(0,17).forEach(({node})=>selected.push(node));district.nodes=selected})
  if(model.webDistrictMembers&&model.webDistrictLayouts)districts.forEach((district,index)=>{const layout=model.webDistrictLayouts[index],fixedCenter=layout.nodes.find(node=>node.index===layout.centerIndex);district.center={...fixedCenter,alpha:Math.max(.82,fixedCenter.alpha||0),x:layout.centerX,y:layout.centerY};district.nodes=model.webDistrictMembers[index].map(nodeIndex=>{const fixed=layout.nodes.find(candidate=>candidate.index===nodeIndex);return fixed?{...fixed,alpha:Math.max(.78,fixed.alpha||0),x:layout.centerX+fixed.offsetX,y:layout.centerY+fixed.offsetY}:null}).filter(Boolean)})
  else if(weight>.62){model.webDistrictMembers=districts.map(district=>district.nodes.map(node=>node.index));model.webDistrictLayouts=districts.map(district=>({centerIndex:district.center.index,centerX:district.center.x,centerY:district.center.y,nodes:district.nodes.map(node=>({...node,offsetX:node.x-district.center.x,offsetY:node.y-district.center.y}))}))}

  districts.forEach((district,districtIndex)=>{const spreadX=Math.max(58,Math.min(250,Math.max(...district.nodes.map(node=>Math.abs(node.x-district.center.x)))+24)),spreadY=Math.max(30,Math.min(118,Math.max(...district.nodes.map(node=>Math.abs(node.y-district.center.y)))+15)),fog=.62+smoothstep(Math.max(0,(district.center.z+1)/2))*.38;ctx.save();ctx.beginPath();ctx.ellipse(district.center.x,district.center.y,spreadX,spreadY,-.08+(districtIndex-1)*.06,0,Math.PI*2);ctx.clip();ctx.strokeStyle=rgba(SMOKE,.18*weight*fog);ctx.lineWidth=.46;for(let offset=-spreadX;offset<=spreadX;offset+=18){ctx.beginPath();ctx.moveTo(district.center.x+offset-spreadY*.35,district.center.y-spreadY);ctx.lineTo(district.center.x+offset+spreadY*.35,district.center.y+spreadY);ctx.stroke()}for(let offset=-spreadY;offset<=spreadY;offset+=14){ctx.beginPath();ctx.moveTo(district.center.x-spreadX,district.center.y+offset);ctx.lineTo(district.center.x+spreadX,district.center.y+offset*.72);ctx.stroke()}ctx.restore();ctx.strokeStyle=rgba(PEARL,.28*weight*fog);ctx.lineWidth=.62;ctx.beginPath();ctx.ellipse(district.center.x,district.center.y,spreadX,spreadY,-.08+(districtIndex-1)*.06,0,Math.PI*2);ctx.stroke();ctx.fillStyle=rgba(GOLD,.72*weight*fog);ctx.beginPath();ctx.arc(district.center.x,district.center.y,1.9,0,Math.PI*2);ctx.fill()})

  const streetEdges=[];districts.forEach((district,districtIndex)=>{const streetKeys=new Set();district.nodes.forEach(node=>district.nodes.filter(peer=>peer.index!==node.index).sort((a,b)=>Math.hypot(a.x-node.x,a.y-node.y)-Math.hypot(b.x-node.x,b.y-node.y)).slice(0,node.importance>.62?3:2).forEach(peer=>{const key=node.index<peer.index?`${node.index}:${peer.index}`:`${peer.index}:${node.index}`;if(streetKeys.has(key))return;streetKeys.add(key);const depth=Math.max(.03,((node.z+peer.z)*.5+1)/2),fog=.38+smoothstep(depth)*.62;ctx.strokeStyle=rgba(PEARL,.29*fog*weight);ctx.lineWidth=.84;ctx.beginPath();ctx.moveTo(node.x,node.y);ctx.lineTo(peer.x,peer.y);ctx.stroke();streetEdges.push({a:node,b:peer,districtIndex,depth:fog})}))})
  const intercityEdges=[];districts.slice(0,-1).forEach((district,index)=>{const next=districts[index+1];ctx.strokeStyle=rgba(index===0?GOLD:PEARL,.038*weight);ctx.lineWidth=.34;ctx.setLineDash([2,9]);ctx.beginPath();ctx.moveTo(district.center.x,district.center.y);ctx.lineTo(next.center.x,next.center.y);ctx.stroke();ctx.setLineDash([]);intercityEdges.push({a:district.center,b:next.center})})

  model.webBuildStates||=new Map();const towers=districts.flatMap((district,districtIndex)=>district.nodes.map(node=>{if(weight>.18&&!model.webBuildStates.has(node.index))model.webBuildStates.set(node.index,{startedAt:time+districtIndex*.48+node.seed*1.35,duration:7.5+node.seed*5});const buildState=model.webBuildStates.get(node.index)||{startedAt:Infinity,duration:10},architecturalNode=node.index===district.center.index?{...node,importance:Math.max(.74,node.importance)}:node;return{...paintWebTower(ctx,architecturalNode,weight,time,buildState),districtIndex}})).sort((a,b)=>a.z-b.z)
  towers.forEach(tower=>{const peers=towers.filter(other=>other.districtIndex===tower.districtIndex&&other.index!==tower.index).sort((a,b)=>Math.hypot(a.x-tower.x,a.y-tower.y)-Math.hypot(b.x-tower.x,b.y-tower.y)).slice(0,tower.importance>.62?2:1);peers.forEach((peer,peerIndex)=>{const depth=Math.max(.06,(tower.depth+peer.depth)/2),active=tower.importance>.62||peer.importance>.62;ctx.strokeStyle=rgba(active&&peerIndex===0?GOLD:PEARL,(active?.2:.105)*depth*weight);ctx.lineWidth=active?.7:.42;ctx.beginPath();ctx.moveTo(tower.topX,tower.topY);ctx.lineTo(peer.topX,peer.topY);ctx.stroke()})})
  towers.forEach((tower,index)=>{const footprint=tower.width*1.35;ctx.strokeStyle=rgba(index%7===0?GOLD:SMOKE,(.12+tower.depth*.14)*weight);ctx.lineWidth=.48;ctx.beginPath();ctx.moveTo(tower.x-footprint,tower.y);ctx.lineTo(tower.x,tower.y+footprint*.35);ctx.lineTo(tower.x+footprint,tower.y);ctx.lineTo(tower.x,tower.y-footprint*.35);ctx.closePath();ctx.stroke()})
  for(let packet=0;packet<22&&streetEdges.length;packet++){const edge=streetEdges[(packet*7)%streetEdges.length],phase=frac(time*(.07+(packet%4)*.009)+packet*.119),envelope=Math.sin(phase*Math.PI),x=lerp(edge.a.x,edge.b.x,phase),y=lerp(edge.a.y,edge.b.y,phase);ctx.fillStyle=rgba(packet%5===0?GOLD:PEARL,envelope*edge.depth*.95*weight);ctx.beginPath();ctx.arc(x,y,1+edge.depth*.78,0,Math.PI*2);ctx.fill()}
  intercityEdges.forEach((edge,index)=>{const phase=frac(time*.028+index*.43),envelope=Math.sin(phase*Math.PI),x=lerp(edge.a.x,edge.b.x,phase),y=lerp(edge.a.y,edge.b.y,phase);ctx.fillStyle=rgba(index===0?GOLD:PEARL,envelope*.24*weight);ctx.beginPath();ctx.arc(x,y,.75,0,Math.PI*2);ctx.fill()})
}

function paintRegionalLayer(ctx,nodes,model,weights,time,regionalContext) {
  const ia=regionalContext.iaWeight,automation=regionalContext.automationWeight,whatsapp=weights[2],web=weights[3],data=weights[4]
  if(ia>.01){const {view,width,height,iaFocus}=regionalContext,iaNodes=selectNodesAroundAnchor(nodes,REGION_ANCHORS.ia,{innerAngle:.34,outerAngle:1.04,minAlpha:.2,limit:48});renderIaSubworld({ctx,camera:view,time,viewport:{width,height},nodes:iaNodes,focus:iaFocus,intensity:ia,palette:{gold:GOLD,pearl:PEARL,smoke:SMOKE,rgba}})}
  if(automation>.01){const {view,width,height,automationFocus}=regionalContext,automationNodes=selectNodesAroundAnchor(nodes,REGION_ANCHORS.automation,{innerAngle:.34,outerAngle:1.04,minAlpha:.2,limit:42});renderAutomationSubworld({ctx,camera:view,time,viewport:{width,height},nodes:automationNodes,focus:automationFocus,intensity:automation,palette:{gold:GOLD,pearl:PEARL,smoke:SMOKE,rgba}})}
  if(web>.01)paintWebWorld(ctx,nodes,model,web,time)
  if(data>.01){const {view,width,height,dataFocus}=regionalContext;renderDataSubworld({ctx,camera:view,time,viewport:{width,height},focus:dataFocus,intensity:data,palette:{gold:GOLD,pearl:PEARL,smoke:SMOKE,rgba}})}
  if(whatsapp>.01)paintWhatsappWorld(ctx,nodes,regionalContext.whatsappHub,whatsapp,time)
}

export function renderNasusOrb(ctx,model,{width,height,time,progress,regionalFocus,mode,reduced,pointer}) {
  const regional=regionalStateAt(progress),region=regional.index,weights=regional.weights,profile=profileAt(regional),view=cameraAt(progress,regional),iaWeight=weights[0]*(regionalFocus||0),automationWeight=weights[1]
  const iaTravel=cinematicTravel(iaWeight),automationTravel=cinematicTravel(automationWeight),whatsappTravel=cinematicTravel(weights[2]),dataTravel=cinematicTravel(weights[4])
  if(iaTravel>.001){const target=cameraTargetForAnchor(REGION_ANCHORS.ia,time*WORLD_SPIN),yawDelta=Math.atan2(Math.sin(target.yaw-view.yaw),Math.cos(target.yaw-view.yaw)),orbitArc=Math.sin(iaTravel*Math.PI);view.zoom=lerp(view.zoom,1.62,iaTravel);view.yaw+=yawDelta*iaTravel+orbitArc*.18;view.pitch=lerp(view.pitch,target.pitch,iaTravel);view.x=lerp(view.x,.06,iaTravel)+orbitArc*.045;view.y=lerp(view.y,-.01,iaTravel)-orbitArc*.018}
  if(automationTravel>.001){const target=cameraTargetForAnchor(REGION_ANCHORS.automation,time*WORLD_SPIN),yawDelta=Math.atan2(Math.sin(target.yaw-view.yaw),Math.cos(target.yaw-view.yaw)),orbitArc=Math.sin(automationTravel*Math.PI);view.zoom=lerp(view.zoom,1.58,automationTravel);view.yaw+=yawDelta*automationTravel-orbitArc*.16;view.pitch=lerp(view.pitch,target.pitch,automationTravel);view.x=lerp(view.x,.08,automationTravel)-orbitArc*.042;view.y=lerp(view.y,0,automationTravel)+orbitArc*.016}
  if(weights[2]>.001){
    const target=cameraTargetForAnchor(REGION_ANCHORS.whatsapp,time*WORLD_SPIN)
    const yawDelta=Math.atan2(Math.sin(target.yaw-view.yaw),Math.cos(target.yaw-view.yaw))
    view.yaw+=yawDelta*whatsappTravel
    view.pitch=lerp(view.pitch,target.pitch,whatsappTravel)
  }
  if(dataTravel>.001){const target=cameraTargetForAnchor(REGION_ANCHORS.data,time*WORLD_SPIN),yawDelta=Math.atan2(Math.sin(target.yaw-view.yaw),Math.cos(target.yaw-view.yaw)),orbitArc=Math.sin(dataTravel*Math.PI);view.zoom=lerp(view.zoom,1.92,dataTravel);view.yaw+=yawDelta*dataTravel+orbitArc*.12;view.pitch=lerp(view.pitch,target.pitch,dataTravel);view.x=lerp(view.x,.2,dataTravel)+orbitArc*.035;view.y=lerp(view.y,-.14,dataTravel)-orbitArc*.014}
  const activity=mode==='thinking'?1:mode==='speaking'?.85:mode==='listening'?.55:0
  const signal=mode==='speaking'?Math.sin(time*7.2)*.08:0,base=Math.min(width,height)*.49*view.zoom*(1+signal)*(1+whatsappTravel*.16+cinematicTravel(weights[3])*.04)
  const cx=width*(.5+view.x),cy=height*(.5+view.y),t=reduced?.65:time*(1+activity*.55)
  stepSimulation(model,t,GLOBAL_PROFILE,-1,0,activity,reduced,pointer,view,base,cx,cy)
  const nodes=projectNodes(model,t,view,base,cx,cy)
  const iaFocus=projectAnchor(REGION_ANCHORS.ia,{yaw:view.yaw,pitch:view.pitch,worldRotation:t*WORLD_SPIN,base,cx,cy})
  const automationFocus=projectAnchor(REGION_ANCHORS.automation,{yaw:view.yaw,pitch:view.pitch,worldRotation:t*WORLD_SPIN,base,cx,cy})
  const dataFocus=projectAnchor(REGION_ANCHORS.data,{yaw:view.yaw,pitch:view.pitch,worldRotation:t*WORLD_SPIN,base,cx,cy})
  const whatsappProjection=projectAnchor(REGION_ANCHORS.whatsapp,{yaw:view.yaw,pitch:view.pitch,worldRotation:t*WORLD_SPIN,base,cx,cy})
  const whatsappHub={...whatsappProjection,x3:REGION_ANCHORS.whatsapp.position.x,y3:REGION_ANCHORS.whatsapp.position.y,z3:REGION_ANCHORS.whatsapp.position.z,alpha:1,importance:1,index:-1}
  const localEdges=proximityEdges(nodes,profile.threshold+.025+(activity*.018),profile.neighbours+(mode==='thinking'?1:0),t)
  const edges=smoothEdges(model,[...localEdges,...hubEdges(model,t,weights[1])])
  const isolationWeights=[cinematicIsolation(iaWeight),cinematicIsolation(automationWeight),cinematicIsolation(weights[2]),cinematicIsolation(weights[3]),cinematicIsolation(weights[4])],regionalBudgetFocus=Math.max(...isolationWeights),globalOpacity=1-regionalBudgetFocus*.94,edgeBudget=1-regionalBudgetFocus*.88,nodeBudget=1-regionalBudgetFocus*.84
  const globalEdges=edges.filter(edge=>hash(edge.a+11,edge.b+29)<=edgeBudget)
  const globalNodes=nodes.filter(node=>hash(node.index,71.3)<=nodeBudget)

  const halo=ctx.createRadialGradient(cx,cy,base*.12,cx,cy,base*1.08);halo.addColorStop(0,'rgba(23,26,32,.08)');halo.addColorStop(.78,'rgba(11,13,17,.025)');halo.addColorStop(1,'transparent');ctx.fillStyle=halo;ctx.fillRect(0,0,width,height)
  paintGlobalFlowWaves(ctx,t,view,base,cx,cy,globalOpacity)
  globalEdges.forEach(edge=>{const visibility=Math.min(nodes[edge.a].alpha,nodes[edge.b].alpha),long=edge.distance>.6;paintLine(ctx,nodes[edge.a],nodes[edge.b],edge.opacity*(long?.84:.78+activity*.18)*visibility*globalOpacity,long?PEARL:SMOKE,long?.54:.49)})

  const pulseWindow=.24+weights[1]*.08,pulses=[]
  globalEdges.forEach(edge=>{const cycle=frac(t/edge.pulsePeriod+edge.pulseOffset);if(cycle>=pulseWindow||edge.opacity<.08)return;const a=nodes[edge.a],b=nodes[edge.b],progress=cycle/pulseWindow,envelope=Math.sin(progress*Math.PI)**1.5,importance=Math.max(a.importance,b.importance),long=edge.distance>.6;pulses.push({a,b,progress,envelope,importance,long,score:importance+(long?.45:0)})})
  pulses.sort((a,b)=>b.score-a.score).slice(0,(width<700?6:11)+Math.round(weights[1]*3)).forEach(pulse=>{const x=lerp(pulse.a.x,pulse.b.x,pulse.progress),y=lerp(pulse.a.y,pulse.b.y,pulse.progress),z=lerp(pulse.a.z,pulse.b.z,pulse.progress),raw=Math.max(0,Math.min(1,(z+1)/2)),depth=.04+.96*raw**1.7,visibility=Math.min(pulse.a.alpha,pulse.b.alpha)*globalDepthVisibility(z),alpha=pulse.envelope*depth*visibility*(.48+pulse.importance*.24)*globalOpacity;ctx.fillStyle=rgba(pulse.long||pulse.importance>.64?GOLD:PEARL,alpha);ctx.beginPath();ctx.arc(x,y,.65+pulse.importance*.75+raw*.35,0,Math.PI*2);ctx.fill()})

  globalNodes.sort((a,b)=>a.z-b.z).forEach(node=>{const depth=(node.z+1)/2,hub=node.importance>.64,weight=.58+node.importance*1.55,r=Math.max(.2,.29+depth*.76)*weight*(hub?1.42:.78)*(width<700?.86:1),opacity=(.09+depth*.68)*(.54+node.importance*.42)*(hub?1.32:.62)*globalDepthVisibility(node.z);ctx.fillStyle=rgba(hub&&node.index%5===region?GOLD:PEARL,opacity*node.alpha*globalOpacity);ctx.beginPath();ctx.arc(node.x,node.y,r+(activity*(hub?.7:.08)),0,Math.PI*2);ctx.fill()})
  const visualWeights=weights.map(cinematicReveal)
  paintRegionalLayer(ctx,nodes,model,visualWeights,t,{view,width,height,iaWeight:cinematicReveal(iaWeight),automationWeight:cinematicReveal(automationWeight),iaFocus,automationFocus,dataFocus,whatsappHub})
}
