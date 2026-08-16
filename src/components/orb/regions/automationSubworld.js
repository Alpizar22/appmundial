const lerp=(a,b,t)=>a+(b-a)*t
const frac=value=>value-Math.floor(value)
const hash2=(x,y)=>frac(Math.sin(x*127.1+y*311.7)*43758.5453)
const valueNoise=(x,y)=>{const ix=Math.floor(x),iy=Math.floor(y),fx=x-ix,fy=y-iy,sx=fx*fx*(3-2*fx),sy=fy*fy*(3-2*fy),a=lerp(hash2(ix,iy),hash2(ix+1,iy),sx),b=lerp(hash2(ix,iy+1),hash2(ix+1,iy+1),sx);return lerp(a,b,sy)}
const dune=(x,z,cx,cz,width,depth)=>Math.exp(-(Math.pow((x-cx)/width,2)+Math.pow((z-cz)/depth,2)))
const duneHeight=(x,z,time)=>{
  const drift=Math.sin(time*.18)*.15
  const broad=(valueNoise(x*.72+4.2,z*.8+7.1)-.5)*.25
  const ridges=dune(x,z,-.67+drift,.28,.5,.12)*.72+dune(x,z,.16-drift*.7,.38,.72,.17)*.86+dune(x,z,.72+drift*.45,.59,.42,.14)*.64+dune(x,z,-.25-drift*.4,.73,.58,.19)*.55+dune(x,z,.48+drift*.8,.84,.68,.13)*.43
  const asymmetric=(valueNoise(x*1.45+17,z*1.18+3.4)-.46)*.22
  return Math.max(-.18,broad+ridges+asymmetric)
}
const strokeSpline=(ctx,points)=>{if(points.length<2)return;ctx.beginPath();ctx.moveTo(points[0].x,points[0].y);for(let index=1;index<points.length-1;index++){const point=points[index],next=points[index+1];ctx.quadraticCurveTo(point.x,point.y,(point.x+next.x)*.5,(point.y+next.y)*.5)}const last=points.at(-1);ctx.lineTo(last.x,last.y);ctx.stroke()}

export function renderAutomationSubworld({ctx,time,viewport,focus,intensity,palette}) {
  if(intensity<=.01)return
  const {width,height}=viewport,{gold,pearl,smoke,rgba}=palette
  const horizonY=height*.48,bottomY=height*1.035,rows=18,columns=27,grid=[]

  for(let row=0;row<rows;row++){
    const depth=row/(rows-1),perspective=depth**1.58,halfWidth=lerp(width*.58,width*.76,perspective),baseY=lerp(horizonY,bottomY,perspective),rowPoints=[],family=Math.floor(row/3),within=row%3-1,familyDepth=(family*3+1)/(rows-1),rowAmplitude=.22+hash2(family,31.7)*1.52,rowSpeed=.58+hash2(family,47.3)*1.22,rowWarp=(hash2(family,63.1)-.5)*.2
    for(let column=0;column<columns;column++){
      const across=column/(columns-1),nx=across*2-1,lateralPhase=time*(1.18+rowSpeed*.34)-nx*(3.15+family*.23),lateralTravel=Math.sin(lateralPhase+family*.91)+Math.sin(lateralPhase*.43-family*.63)*.38,localDepth=familyDepth+rowWarp+valueNoise(nx*(1.05+family*.19)+family*2.7,familyDepth*2.4)*.14,verticalBreath=.94+Math.sin(time*(.19+family*.012)+family*1.31)*.16,elevationWave=Math.sin(time*.31+family*.88-nx*.72)*(.07+hash2(family,71.9)*.08),heightField=(duneHeight(nx*(.76+hash2(family,8.4)*.64),localDepth,time*rowSpeed)+elevationWave)*rowAmplitude*verticalBreath*(1+within*.055),ridgeLift=heightField*lerp(height*.1,height*.42,perspective),localBurst=.55+valueNoise(nx*2.2+family,familyDepth*3.4+time*.12)*.9,sandDrift=lateralTravel*lerp(20,58,perspective)*localBurst+within*1.4
      rowPoints.push({x:focus.x+nx*halfWidth+sandDrift,y:baseY-ridgeLift,depth,height:heightField,visibility:lerp(.24,1,perspective)})
    }
    grid.push(rowPoints)
  }

  ctx.save()
  const haze=ctx.createLinearGradient(0,horizonY-height*.04,0,bottomY)
  haze.addColorStop(0,rgba('#0b0d11',.035*intensity));haze.addColorStop(.45,rgba('#171a20',.075*intensity));haze.addColorStop(1,rgba('#171a20',.14*intensity));ctx.fillStyle=haze;ctx.fillRect(0,horizonY-height*.04,width,height-horizonY+height*.08)
  grid.forEach((points,row)=>{const depth=row/(rows-1),averageHeight=points.reduce((sum,point)=>sum+Math.max(0,point.height),0)/points.length,elevation=Math.min(1,averageHeight/.48);ctx.strokeStyle=rgba(elevation>.38?gold:pearl,lerp(.16,.58,depth)*lerp(.55,1,elevation)*intensity);ctx.lineWidth=lerp(.45,1.22,depth)+elevation*.42;ctx.shadowColor=rgba(gold,elevation*.5*intensity);ctx.shadowBlur=elevation*7;let segment=[];points.forEach((point,index)=>{const connected=point.height>.035||index%7!==0;if(connected)segment.push(point);if((!connected||index===points.length-1)&&segment.length){strokeSpline(ctx,segment);segment=[]}});ctx.shadowBlur=0})
  for(let column=0;column<columns;column+=2){ctx.strokeStyle=rgba(smoke,.16*intensity);ctx.lineWidth=.44;let segment=[];grid.forEach((row,index)=>{const point=row[column],connected=point.height>.055||index%5!==0;if(connected)segment.push(point);if((!connected||index===grid.length-1)&&segment.length){strokeSpline(ctx,segment);segment=[]}})}
  for(let pulse=0;pulse<24;pulse++){const row=2+(pulse*7)%(rows-3),direction=pulse%3===0?-1:1,phase=frac(time*(.072+(pulse%5)*.006)+pulse*.137),travel=direction>0?phase:1-phase,position=travel*(columns-1),index=Math.min(columns-2,Math.floor(position)),local=position-index,a=grid[row][index],b=grid[row][index+1],envelope=Math.sin(phase*Math.PI)**.72,x=lerp(a.x,b.x,local),y=lerp(a.y,b.y,local),warm=pulse%4===0||a.height>.48;ctx.fillStyle=rgba(warm?gold:pearl,envelope*lerp(.28,.82,a.depth)*intensity);ctx.beginPath();ctx.arc(x,y,lerp(.75,1.8,a.depth),0,Math.PI*2);ctx.fill()}
  grid.forEach((row,rowIndex)=>row.forEach((point,column)=>{if(rowIndex%2||column%2)return;const active=(rowIndex*13+column*7)%29===0;ctx.fillStyle=rgba(active?gold:pearl,(active?.78:.34)*point.visibility*intensity);ctx.beginPath();ctx.arc(point.x,point.y,active?1.65:lerp(.55,1.12,point.depth),0,Math.PI*2);ctx.fill()}))
  ctx.restore()
}
