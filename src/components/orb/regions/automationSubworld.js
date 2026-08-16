const lerp=(a,b,t)=>a+(b-a)*t
const frac=value=>value-Math.floor(value)

const duneHeight=(x,z,time)=>{
  const drift=time*.115
  const primary=Math.sin(z*7.2+x*1.15-drift)*.62
  const secondary=Math.sin(z*3.35-x*2.1-drift*.47+1.3)*.25
  const cross=Math.cos(x*3.4+z*1.55+drift*.22)*.13
  return (primary+secondary+cross)*(.54+.46*z)
}

export function renderAutomationSubworld({ctx,time,viewport,focus,intensity,palette}) {
  if(intensity<=.01)return
  const {width,height}=viewport,{gold,pearl,smoke,rgba}=palette
  const horizonY=height*.48,bottomY=height*1.035,rows=18,columns=27,grid=[]

  for(let row=0;row<rows;row++){
    const depth=row/(rows-1),perspective=depth**1.58,halfWidth=lerp(width*.58,width*.76,perspective),baseY=lerp(horizonY,bottomY,perspective),rowPoints=[]
    for(let column=0;column<columns;column++){
      const across=column/(columns-1),nx=across*2-1,heightField=duneHeight(nx,depth,time),ridgeLift=heightField*lerp(height*.032,height*.105,perspective),sandDrift=Math.sin(nx*7.1-depth*9.4-time*.42)*lerp(1.2,5.5,perspective)
      rowPoints.push({x:focus.x+nx*halfWidth,y:baseY-ridgeLift+sandDrift,depth,height:heightField,visibility:lerp(.24,1,perspective)})
    }
    grid.push(rowPoints)
  }

  ctx.save()
  const haze=ctx.createLinearGradient(0,horizonY-height*.04,0,bottomY)
  haze.addColorStop(0,rgba('#0b0d11',.035*intensity));haze.addColorStop(.45,rgba('#171a20',.075*intensity));haze.addColorStop(1,rgba('#171a20',.14*intensity));ctx.fillStyle=haze;ctx.fillRect(0,horizonY-height*.04,width,height-horizonY+height*.08)
  grid.forEach((points,row)=>{const depth=row/(rows-1),crest=Math.abs(points[Math.floor(columns/2)].height)>.42;ctx.strokeStyle=rgba(crest&&row%3===0?pearl:smoke,lerp(.16,.5,depth)*intensity);ctx.lineWidth=lerp(.42,1.12,depth);ctx.beginPath();ctx.moveTo(points[0].x,points[0].y);for(let index=1;index<points.length;index++)ctx.lineTo(points[index].x,points[index].y);ctx.stroke()})
  for(let column=0;column<columns;column+=2){ctx.strokeStyle=rgba(pearl,.2*intensity);ctx.lineWidth=.48;ctx.beginPath();grid.forEach((row,index)=>index?ctx.lineTo(row[column].x,row[column].y):ctx.moveTo(row[column].x,row[column].y));ctx.stroke()}
  for(let pulse=0;pulse<24;pulse++){const row=2+(pulse*7)%(rows-3),direction=pulse%3===0?-1:1,phase=frac(time*(.072+(pulse%5)*.006)+pulse*.137),travel=direction>0?phase:1-phase,position=travel*(columns-1),index=Math.min(columns-2,Math.floor(position)),local=position-index,a=grid[row][index],b=grid[row][index+1],envelope=Math.sin(phase*Math.PI)**.72,x=lerp(a.x,b.x,local),y=lerp(a.y,b.y,local),warm=pulse%4===0||a.height>.48;ctx.fillStyle=rgba(warm?gold:pearl,envelope*lerp(.28,.82,a.depth)*intensity);ctx.beginPath();ctx.arc(x,y,lerp(.75,1.8,a.depth),0,Math.PI*2);ctx.fill()}
  grid.forEach((row,rowIndex)=>row.forEach((point,column)=>{if(rowIndex%2||column%2)return;const active=(rowIndex*13+column*7)%29===0;ctx.fillStyle=rgba(active?gold:pearl,(active?.78:.34)*point.visibility*intensity);ctx.beginPath();ctx.arc(point.x,point.y,active?1.65:lerp(.55,1.12,point.depth),0,Math.PI*2);ctx.fill()}))
  ctx.restore()
}
