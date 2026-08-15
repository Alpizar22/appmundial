const clamp01=value=>Math.max(0,Math.min(1,value))
const smoothstep=value=>{const t=clamp01(value);return t*t*(3-2*t)}
const lerp=(a,b,t)=>a+(b-a)*t
const frac=value=>value-Math.floor(value)

export function renderIaSubworld({ctx,camera,time,viewport,nodes,focus,intensity,palette}) {
  if(intensity<=.01||nodes.length<3)return
  const {width,height}=viewport,{gold,pearl,smoke,rgba}=palette,cameraScale=Math.max(1,Math.min(1.82,camera.zoom/.86)),innerRadius=Math.min(width,height)*.17*cameraScale,outerRadius=innerRadius*(.25/.17)
  const columns=8,rows=6,spacing=innerRadius*1.72/(columns-1),rowHeight=spacing*Math.sqrt(3)/2,averageDepth=nodes.reduce((sum,node)=>sum+clamp01((node.z+1)/2),0)/nodes.length,vertices=[]
  for(let row=0;row<rows;row++)for(let column=0;column<columns;column++){
    const u=(column-(columns-1)/2)*spacing+(row%2?spacing/2:0),v=(row-(rows-1)/2)*rowHeight,distance=Math.hypot(u,v),localFade=1-smoothstep((distance-innerRadius)/(outerRadius-innerRadius)),waveA=Math.sin(time*.66-Math.hypot(u+innerRadius*.58,v-innerRadius*.24)*.034),waveB=Math.sin(time*.47-Math.hypot(u-innerRadius*.7,v+innerRadius*.42)*.026+1.1),displacement=(waveA*.68+waveB*.42)*innerRadius*.043*localFade,curvature=Math.sqrt(Math.max(0,1-Math.min(1,distance/outerRadius)**2)),depth=clamp01(.16+averageDepth*.3+curvature*.48+displacement/innerRadius*.12),perspective=.94+depth*.075,screenLift=displacement*(.82+Math.abs(camera.pitch)*.28)
    vertices.push({row,column,x:focus.x+u*perspective,y:focus.y+v*perspective-screenLift,z:depth,fade:localFade,displacement})
  }
  const at=(row,column)=>vertices[row*columns+column],edges=[]
  vertices.forEach(vertex=>{if(vertex.column<columns-1)edges.push([vertex,at(vertex.row,vertex.column+1)]);if(vertex.row<rows-1){const left=vertex.column-(vertex.row%2?0:1),right=left+1;if(left>=0)edges.push([vertex,at(vertex.row+1,left)]);if(right<columns)edges.push([vertex,at(vertex.row+1,right)])}})
  ctx.save()
  const field=ctx.createRadialGradient(focus.x,focus.y,innerRadius*.18,focus.x,focus.y,outerRadius);field.addColorStop(0,rgba('#171a20',.12*intensity));field.addColorStop(.68,rgba('#0b0d11',.045*intensity));field.addColorStop(1,'transparent');ctx.fillStyle=field;ctx.beginPath();ctx.arc(focus.x,focus.y,outerRadius,0,Math.PI*2);ctx.fill()
  edges.sort((a,b)=>(a[0].z+a[1].z)-(b[0].z+b[1].z)).forEach(([a,b])=>{const fade=Math.min(a.fade,b.fade),depth=.2+((a.z+b.z)*.5)*.8,strain=Math.abs(a.displacement-b.displacement)/Math.max(1,innerRadius*.043),active=strain>.48;ctx.strokeStyle=rgba(active?pearl:smoke,(active?.3:.19)*depth*fade*intensity);ctx.lineWidth=active?.68:.46;ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke()})
  for(let pulse=0;pulse<12;pulse++){const edge=edges[(pulse*17)%edges.length],phase=frac(time*(.064+(pulse%4)*.008)+pulse*.137),envelope=Math.sin(phase*Math.PI)**1.35,fade=Math.min(edge[0].fade,edge[1].fade),x=lerp(edge[0].x,edge[1].x,phase),y=lerp(edge[0].y,edge[1].y,phase),depth=(edge[0].z+edge[1].z)*.5;ctx.fillStyle=rgba(pulse%4===0?gold:pearl,envelope*(.24+depth*.7)*fade*intensity);ctx.beginPath();ctx.arc(x,y,.7+depth*.62,0,Math.PI*2);ctx.fill()}
  vertices.sort((a,b)=>a.z-b.z).forEach(vertex=>{const degree=(vertex.column>0?1:0)+(vertex.column<columns-1?1:0)+(vertex.row>0?2:0)+(vertex.row<rows-1?2:0),activity=Math.max(0,vertex.displacement/(innerRadius*.043)),synapse=degree>=6&&activity>.5,depth=.2+vertex.z*.8;ctx.fillStyle=rgba(synapse?gold:pearl,(degree>=6?.5:.32)*depth*vertex.fade*intensity);ctx.beginPath();ctx.arc(vertex.x,vertex.y,(degree>=6?1.12:.76)+depth*.4,0,Math.PI*2);ctx.fill()})
  ctx.restore()
}
