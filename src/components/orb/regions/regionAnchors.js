const clamp=(value,min,max)=>Math.max(min,Math.min(max,value))
const smoothstep=value=>{const t=clamp(value,0,1);return t*t*(3-2*t)}
const normalizeAngle=angle=>Math.atan2(Math.sin(angle),Math.cos(angle))

export function vectorFromYawPitch(yaw,pitch) {
  const latitudeCos=Math.cos(pitch)
  return Object.freeze({x:-Math.sin(yaw)*latitudeCos,y:Math.sin(pitch),z:Math.cos(yaw)*latitudeCos})
}

const createAnchor=(id,yaw,pitch,view)=>Object.freeze({id,position:vectorFromYawPitch(yaw,pitch),view:Object.freeze({...view})})

export const REGION_ANCHORS=Object.freeze({
  ia:createAnchor('ia',0,-.08,{zoom:.72,x:0,y:0}),
  automation:createAnchor('automation',.75,.18,{zoom:1.08,x:-.13,y:.05}),
  whatsapp:createAnchor('whatsapp',1.6,-.3,{zoom:1.34,x:.18,y:-.05}),
  web:createAnchor('web',2.45,.22,{zoom:1.58,x:-.22,y:.12}),
  data:createAnchor('data',3.25,-.16,{zoom:1.92,x:.2,y:-.14}),
})

export const WORLD_HOTSPOTS=Object.freeze({
  cases:createAnchor('cases',-.62,.3,{zoom:.86,x:0,y:0}),
})

export function cameraTargetForAnchor(anchor,worldRotation=0) {
  const {x,y,z}=anchor.position
  return Object.freeze({yaw:normalizeAngle(Math.atan2(-x,z)-worldRotation),pitch:Math.atan2(y,Math.hypot(x,z))})
}

export function angularDistanceToAnchor(node,anchor) {
  const x=node.x3??node.x,y=node.y3??node.y,z=node.z3??node.z,length=Math.hypot(x,y,z)||1,{position}=anchor,dot=clamp((x*position.x+y*position.y+z*position.z)/length,-1,1)
  return Math.acos(dot)
}

export function selectNodesAroundAnchor(nodes,anchor,{innerAngle=.38,outerAngle=.7,minAlpha=.2,limit=Infinity}={}) {
  return nodes.map(node=>{const angle=angularDistanceToAnchor(node,anchor),regionWeight=1-smoothstep((angle-innerAngle)/(outerAngle-innerAngle));return{node,angle,regionWeight}}).filter(item=>item.regionWeight>0&&(item.node.alpha??1)>=minAlpha).sort((a,b)=>a.angle-b.angle).slice(0,limit).map(item=>Object.freeze({...item.node,regionWeight:item.regionWeight,anchorAngle:item.angle}))
}

export function projectAnchor(anchor,{yaw,pitch,worldRotation=0,base,cx,cy}) {
  const rotation=yaw+worldRotation,sy=Math.sin(rotation),cyw=Math.cos(rotation),st=Math.sin(pitch),ct=Math.cos(pitch),{x,y,z}=anchor.position,x1=x*cyw+z*sy,z1=-x*sy+z*cyw,y1=y*ct-z1*st,z2=y*st+z1*ct,perspective=1+z2*.055
  return Object.freeze({x:cx+x1*base*perspective,y:cy-y1*base*perspective,z:z2,perspective})
}
