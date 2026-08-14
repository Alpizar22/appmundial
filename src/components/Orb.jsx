import { useEffect, useRef } from 'react'

const camera = [
  { zoom: .72, yaw: 0, pitch: -.08, x: 0, y: 0 },
  { zoom: 1.08, yaw: .75, pitch: .18, x: -.13, y: .05 },
  { zoom: 1.34, yaw: 1.6, pitch: -.3, x: .18, y: -.05 },
  { zoom: 1.58, yaw: 2.45, pitch: .22, x: -.22, y: .12 },
  { zoom: 1.92, yaw: 3.25, pitch: -.16, x: .2, y: -.14 },
]

export default function Orb({ region, mode, onActivate }) {
  const canvasRef = useRef(null), regionRef = useRef(region), modeRef = useRef(mode)
  useEffect(() => { regionRef.current = region }, [region])
  useEffect(() => { modeRef.current = mode }, [mode])

  useEffect(() => {
    const canvas = canvasRef.current, ctx = canvas.getContext('2d')
    let frame, width, height, scrollTarget = 0, scrollCamera = 0, spin = 0
    const points = Array.from({ length: 560 }, (_, i) => {
      const y=1-(i/559)*2,r=Math.sqrt(1-y*y),theta=Math.PI*(3-Math.sqrt(5))*i
      return { x:Math.cos(theta)*r, y, z:Math.sin(theta)*r, seed:Math.random(), cluster:i%5 }
    })
    const membrane = Array.from({ length: 19 * 15 }, (_, i) => ({
      u:(i%19)/18*2-1, v:Math.floor(i/19)/14*2-1, seed:Math.random(), column:i%19, row:Math.floor(i/19),
    }))
    const routes = Array.from({ length: 34 }, (_, i) => ({
      from:(i*37+11)%points.length, to:(i*83+97)%points.length, bend:((i%7)-3)*.045, speed:.000025+(i%5)*.000006, phase:(i*.173)%1, cluster:i%5,
    }))
    const activeNodes = Array.from({ length: 25 }, (_, i) => {
      const cluster=Math.floor(i/5),slot=i%5,theta=cluster*1.17+slot*1.31,y=-.58+slot*.29+Math.sin(cluster+slot)*.08,r=Math.sqrt(Math.max(.12,1-y*y))*.86
      return { x:Math.cos(theta)*r, y, z:Math.sin(theta)*r, cluster, phase:i*.91, importance:slot===0||slot===3 }
    })
    const principalLinks = Array.from({ length: 38 }, (_, i) => ({
      from:(i*7+Math.floor(i/5))%activeNodes.length, to:(i*11+6+(i%4)*3)%activeNodes.length, phase:(i*.137)%1, speed:.00018+(i%6)*.000018,
    })).filter(link=>link.from!==link.to)
    const dust=Array.from({length:65},()=>({x:Math.random(),y:Math.random(),z:Math.random(),r:Math.random()}))
    const resize=()=>{const box=canvas.getBoundingClientRect(),dpr=Math.min(devicePixelRatio||1,2);width=box.width;height=box.height;canvas.width=width*dpr;canvas.height=height*dpr;ctx.setTransform(dpr,0,0,dpr,0,0)}
    const trackScroll=()=>{const vh=Math.max(innerHeight,1);scrollTarget=Math.max(0,Math.min(4,(scrollY-vh*.72)/(vh*1.34)))}
    const lerp=(a,b,t)=>a+(b-a)*t
    const cameraAt=p=>{const lo=Math.floor(p),hi=Math.min(4,lo+1),t=p-lo,a=camera[lo],b=camera[hi];return{zoom:lerp(a.zoom,b.zoom,t),yaw:lerp(a.yaw,b.yaw,t),pitch:lerp(a.pitch,b.pitch,t),x:lerp(a.x,b.x,t),y:lerp(a.y,b.y,t)}}
    const rgba=(color,alpha)=>`${color}${Math.round(Math.max(0,Math.min(1,alpha))*255).toString(16).padStart(2,'0')}`
    const curve=(a,b,bend,alpha,color='#8d9199')=>{const mx=(a.x+b.x)/2+(a.y-b.y)*bend,my=(a.y+b.y)/2+(b.x-a.x)*bend;const luminous=alpha>.2||color==='#c4a882';ctx.strokeStyle=rgba(color,alpha);ctx.shadowColor=luminous?rgba(color,Math.min(alpha,.28)):'transparent';ctx.shadowBlur=luminous?3.5:0;ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.quadraticCurveTo(mx,my,b.x,b.y);ctx.stroke();ctx.shadowBlur=0;return{mx,my}}
    const curvePoint=(a,b,bend,t)=>{const cx=(a.x+b.x)/2+(a.y-b.y)*bend,cy=(a.y+b.y)/2+(b.x-a.x)*bend,u=1-t;return{x:u*u*a.x+2*u*t*cx+t*t*b.x,y:u*u*a.y+2*u*t*cy+t*t*b.y}}

    const drawFields=(active,cx,cy,base,time,view)=>{
      ctx.lineWidth=.45
      if(active===0){
        for(let branch=0;branch<3;branch++){ctx.strokeStyle=`rgba(191,194,200,${.04+branch*.01})`;ctx.beginPath();for(let i=0;i<42;i++){const t=i/41,a=t*Math.PI*1.25+branch*1.8,r=base*(.18+t*.62),x=cx+Math.cos(a)*r,y=cy+Math.sin(a)*r*.54;i?ctx.lineTo(x,y):ctx.moveTo(x,y)}ctx.stroke()}
      }
      if(active===1){
        for(let lane=0;lane<3;lane++){ctx.strokeStyle=`rgba(191,194,200,${.045+lane*.012})`;ctx.beginPath();for(let i=0;i<54;i++){const t=i/53,x=cx-base*.74+t*base*1.48,y=cy+(lane-1)*base*.2+Math.sin(t*5+lane+time*.00018)*base*.025;i?ctx.lineTo(x,y):ctx.moveTo(x,y)}ctx.stroke()}
      }
      if(active===2){
        for(let ring=0;ring<3;ring++){const wave=((time*.000025+ring/3)%1),alpha=(1-wave)*.11;ctx.strokeStyle=`rgba(191,194,200,${alpha})`;ctx.beginPath();ctx.ellipse(cx,cy,base*(.2+wave*.62),base*(.07+wave*.19),view.yaw*.4,0,Math.PI*2);ctx.stroke()}
      }
      if(active===3){
        ctx.save();ctx.translate(cx,cy);ctx.rotate(view.yaw*.12);ctx.strokeStyle='rgba(191,194,200,.13)';for(let row=-5;row<=5;row++){ctx.beginPath();for(let col=-8;col<=8;col++){const x=col*base*.105,y=row*base*.105+Math.sin(col*.7+row+time*.00025)*base*.018;col===-8?ctx.moveTo(x,y):ctx.lineTo(x,y)}ctx.stroke()}for(let col=-8;col<=8;col++){ctx.beginPath();for(let row=-5;row<=5;row++){const x=col*base*.105+Math.sin(row*.8)*base*.015,y=row*base*.105;row===-5?ctx.moveTo(x,y):ctx.lineTo(x,y)}ctx.stroke()}ctx.restore()
      }
      if(active===4){
        for(let band=0;band<3;band++){ctx.beginPath();for(let i=0;i<40;i++){const t=i/39,a=t*Math.PI*2,x=cx+Math.cos(a)*base*(.28+band*.16),y=cy+Math.sin(a)*base*(.12+band*.075);i?ctx.lineTo(x,y):ctx.moveTo(x,y)}ctx.strokeStyle=`rgba(191,194,200,${.045+band*.012})`;ctx.stroke()}
      }
    }

    const draw=time=>{
      scrollCamera=lerp(scrollCamera,scrollTarget,.035);ctx.clearRect(0,0,width,height)
      const view=cameraAt(scrollCamera),voice=modeRef.current,active=Math.round(scrollCamera),energy=voice==='listening'?.04:voice==='thinking'?.075:voice==='speaking'?.115:.01
      spin+=voice==='thinking'?.0034:.00055
      const voiceWave=voice==='speaking'?Math.sin(time*.016)*.045:Math.sin(time*.002)*energy*.35,base=Math.min(width,height)*.49*view.zoom,cx=width*(.5+view.x),cy=height*(.5+view.y)
      dust.forEach(p=>{ctx.globalAlpha=.025+p.z*.07;ctx.fillStyle='#bfc2c8';ctx.fillRect(((p.x+scrollCamera*.008+p.z*.012)%1)*width,p.y*height,.4+p.r*.55,.4+p.r*.55)});ctx.globalAlpha=1
      const halo=ctx.createRadialGradient(cx,cy,base*.08,cx,cy,base*1.08);halo.addColorStop(0,'rgba(23,26,32,.12)');halo.addColorStop(.62,'rgba(11,13,17,.055)');halo.addColorStop(1,'transparent');ctx.fillStyle=halo;ctx.fillRect(0,0,width,height)
      drawFields(active,cx,cy,base,time,view)

      const yaw=view.yaw+spin,pitch=view.pitch
      const projected=points.map(p=>{let x=p.x*Math.cos(yaw)-p.z*Math.sin(yaw),z=p.x*Math.sin(yaw)+p.z*Math.cos(yaw);const y=p.y*Math.cos(pitch)-z*Math.sin(pitch);z=p.y*Math.sin(pitch)+z*Math.cos(pitch);const activation=p.cluster===active?1:0,scale=1+voiceWave*(.35+p.seed)+Math.sin(time*.002+p.seed*40)*energy*activation*.55;return{x:cx+x*base*scale,y:cy+y*base*scale,z,seed:p.seed,cluster:p.cluster}})
      const inner=membrane.map(p=>{const phase=time*.00022,fold=Math.sin(p.u*Math.PI*(1.2+active*.16)+phase)*Math.cos(p.v*Math.PI*1.35-active*.4),spread=.46+active*.025;let x=p.u*spread,y=p.v*.52,z=fold*(.18+active*.018)+Math.sin(p.v*4+phase)*.045;if(active===1)x+=Math.sin(p.v*5+phase)*.1;if(active===2)z+=Math.cos(Math.hypot(p.u,p.v)*10-phase*2)*.055;if(active===3){x=Math.round(x*8)/8;y=Math.round(y*8)/8}if(active===4)z+=Math.sin(p.u*9)*Math.sin(p.v*7)*.055;let rx=x*Math.cos(yaw*.72)-z*Math.sin(yaw*.72),rz=x*Math.sin(yaw*.72)+z*Math.cos(yaw*.72),ry=y*Math.cos(pitch)-rz*Math.sin(pitch);rz=y*Math.sin(pitch)+rz*Math.cos(pitch);return{x:cx+rx*base,y:cy+ry*base,z:rz,seed:p.seed,column:p.column,row:p.row}})
      const principals=activeNodes.map(p=>{const selected=p.cluster===active,motion=time*.00018+p.phase,drift=.032+(selected?.018:0)+energy*(selected?.25:.06),x=p.x+Math.sin(motion*1.7)*drift,y=p.y+Math.cos(motion*1.25)*drift,z=p.z+Math.sin(motion*.9)*drift;let rx=x*Math.cos(yaw)-z*Math.sin(yaw),rz=x*Math.sin(yaw)+z*Math.cos(yaw),ry=y*Math.cos(pitch)-rz*Math.sin(pitch);rz=y*Math.sin(pitch)+rz*Math.cos(pitch);return{x:cx+rx*base,y:cy+ry*base,z:rz,importance:p.importance,phase:p.phase,cluster:p.cluster,selected}})

      ctx.lineWidth=.42
      projected.forEach((a,i)=>{if(a.z<-.18)return;for(let j=i+1;j<Math.min(i+20,projected.length);j++){const b=projected[j],d=Math.hypot(a.x-b.x,a.y-b.y),same=a.cluster===b.cluster,limit=base*(same?.115:.068);if(d<limit&&b.z>-.18){const isActive=same&&a.cluster===active,reveal=.55+.45*Math.sin(time*.00045+a.seed*8);curve(a,b,(a.seed-.5)*.12,(1-d/limit)*(isActive?.38:.105)*(a.z+1)*reveal,isActive&&a.seed>.9?'#c4a882':'#bfc2c8')}}})

      ctx.lineWidth=.36
      inner.forEach((p,i)=>{if(p.z<-.32)return;const right=p.column<18?inner[i+1]:null,down=p.row<14?inner[i+19]:null,alpha=.045+Math.max(0,p.z)*.11;if(right)curve(p,right,0,alpha,'#bfc2c8');if(down&&p.column%2===0)curve(p,down,0,alpha*.7,'#858991');ctx.fillStyle=p.seed>.985?'#c4a882':'#d8d7d4';ctx.globalAlpha=.18+Math.max(0,p.z)*.38;ctx.beginPath();ctx.arc(p.x,p.y,.35+(p.seed>.9?.3:0),0,7);ctx.fill()});ctx.globalAlpha=1

      routes.forEach(route=>{const a=projected[route.from],b=projected[route.to];if(a.z<-.12||b.z<-.12)return;const selected=route.cluster===active,fade=selected?.32:.06,pulse=.55+.45*Math.sin(time*.00055+route.phase*8);curve(a,b,route.bend,fade*pulse,selected&&route.phase>.78?'#c4a882':'#bfc2c8');if(selected){const t=(time*route.speed+route.phase)%1,p=curvePoint(a,b,route.bend,t);ctx.fillStyle=voice==='idle'?'#d7d6d2':'#d6a64b';ctx.globalAlpha=.42+energy*3;ctx.beginPath();ctx.arc(p.x,p.y,.75+energy*4,0,7);ctx.fill();ctx.globalAlpha=1}})

      ctx.lineWidth=.58
      principalLinks.forEach(link=>{const a=principals[link.from],b=principals[link.to];if(a.z<-.2||b.z<-.2)return;const distance=Math.hypot(a.x-b.x,a.y-b.y);if(distance<base*.28||distance>base*1.72)return;const selected=a.selected||b.selected,cycle=(Math.sin(time*link.speed+link.phase*Math.PI*2)+1)/2,fade=Math.max(0,(cycle-.18)/.82),depth=Math.min(1,(a.z+b.z+1.25)/2),alpha=(selected?.27:.105)*fade*depth;ctx.strokeStyle=`rgba(216,215,212,${alpha})`;ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke()})

      if(active===0){const neural=projected.filter(p=>p.cluster===0&&p.z>.05&&p.seed>.55);neural.forEach((a,i)=>{const b=neural[(i*3+7)%neural.length];if(Math.hypot(a.x-b.x,a.y-b.y)<base*.34)curve(a,b,(a.seed-.5)*.16,.24,'#bfc2c8')})}
      if(active===3)projected.filter(p=>p.cluster===3&&p.z>.22&&p.seed>.78).forEach(p=>{ctx.strokeStyle='rgba(191,194,200,.11)';ctx.strokeRect(p.x-4-p.seed*4,p.y-4-p.seed*4,8+p.seed*8,8+p.seed*8)})
      if(active===4)projected.filter(p=>p.cluster===4&&p.z>.12&&p.seed>.72).forEach(p=>{const s=2+p.seed*5;ctx.fillStyle='rgba(160,164,172,.13)';ctx.fillRect(p.x-s/2,p.y-s/2,s,s)})

      projected.sort((a,b)=>a.z-b.z).forEach(p=>{const front=Math.max(0,(p.z+1)/2),selected=p.cluster===active,r=.22+p.seed*.72+front*.35;ctx.fillStyle=p.seed>.987?'#d6a64b':p.seed>.72?'#d6d5d2':'#81858d';ctx.globalAlpha=(.08+front*.55)*(selected?1:.45);ctx.beginPath();ctx.arc(p.x,p.y,r+(selected?energy*3:0),0,7);ctx.fill();if(p.seed>.994){ctx.globalAlpha=.04+energy*.3;ctx.beginPath();ctx.arc(p.x,p.y,r*4,0,7);ctx.fill()}});ctx.globalAlpha=1
      principals.sort((a,b)=>a.z-b.z).forEach(p=>{const front=Math.max(.18,(p.z+1)/2),gold=p.importance&&p.selected,r=(p.importance?2.15:1.55)+front*.6+(p.selected?energy*4:0);ctx.fillStyle=gold?'#d6a64b':'#e8e6e3';ctx.globalAlpha=(p.selected?.78:.38)+front*(p.selected?.2:.24);ctx.shadowColor=gold?'rgba(214,166,75,.5)':'rgba(232,230,227,.26)';ctx.shadowBlur=p.importance&&p.selected?7:3;ctx.beginPath();ctx.arc(p.x,p.y,r,0,7);ctx.fill();ctx.shadowBlur=0;ctx.globalAlpha=1})
      ctx.strokeStyle='rgba(191,194,200,.055)';ctx.lineWidth=.55;ctx.beginPath();ctx.arc(cx,cy,base,0,7);ctx.stroke()
      if(voice!=='idle')for(let i=0;i<3;i++){const wave=(time*.00005+i/3)%1;ctx.strokeStyle=`rgba(214,166,75,${(1-wave)*(.055+energy*.5)})`;ctx.beginPath();ctx.arc(cx,cy,base*(.45+wave*.58),0,7);ctx.stroke()}
      frame=requestAnimationFrame(draw)
    }
    resize();trackScroll();addEventListener('resize',resize);addEventListener('scroll',trackScroll,{passive:true});frame=requestAnimationFrame(draw)
    return()=>{cancelAnimationFrame(frame);removeEventListener('resize',resize);removeEventListener('scroll',trackScroll)}
  },[])
  return <canvas ref={canvasRef} className="orb" onClick={onActivate} aria-label="Orbe de Nasus. Activar conversación." role="button" tabIndex="0" onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();onActivate()}}} />
}
