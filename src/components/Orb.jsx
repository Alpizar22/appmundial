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
    const points = Array.from({ length: 520 }, (_, i) => {
      const y = 1 - (i / 519) * 2, radius = Math.sqrt(1 - y * y), theta = Math.PI * (3 - Math.sqrt(5)) * i
      return { x: Math.cos(theta) * radius, y, z: Math.sin(theta) * radius, seed: Math.random(), cluster: i % 5 }
    })
    const dust = Array.from({ length: 90 }, () => ({ x: Math.random(), y: Math.random(), z: Math.random(), r: Math.random() }))
    const resize = () => { const box=canvas.getBoundingClientRect(),dpr=Math.min(devicePixelRatio||1,2);width=box.width;height=box.height;canvas.width=width*dpr;canvas.height=height*dpr;ctx.setTransform(dpr,0,0,dpr,0,0) }
    const trackScroll = () => { const vh=Math.max(innerHeight,1); scrollTarget=Math.max(0,Math.min(4,(scrollY-vh*.72)/(vh*1.34))) }
    const lerp = (a,b,t) => a+(b-a)*t
    const interpolateCamera = (progress) => { const low=Math.floor(progress),high=Math.min(4,low+1),t=progress-low,a=camera[low],b=camera[high];return {zoom:lerp(a.zoom,b.zoom,t),yaw:lerp(a.yaw,b.yaw,t),pitch:lerp(a.pitch,b.pitch,t),x:lerp(a.x,b.x,t),y:lerp(a.y,b.y,t)} }
    const line = (a,b,alpha,color='#bfc2c8') => { ctx.strokeStyle=`${color}${Math.round(alpha*255).toString(16).padStart(2,'0')}`;ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke() }

    const draw = (time) => {
      scrollCamera=lerp(scrollCamera,scrollTarget,.035);ctx.clearRect(0,0,width,height)
      const view=interpolateCamera(scrollCamera),voice=modeRef.current,energy=voice==='listening'?.035:voice==='thinking'?.065:voice==='speaking'?.105:.008
      spin+=voice==='thinking'?.0045:.00065
      const signal=voice==='speaking'?Math.sin(time*.018)*.055:Math.sin(time*.002)*energy
      const base=Math.min(width,height)*.49*view.zoom,cx=width*(.5+view.x),cy=height*(.5+view.y)

      dust.forEach(p=>{const drift=(scrollCamera*.023+p.z*.02);ctx.globalAlpha=.05+p.z*.14;ctx.fillStyle='#bfc2c8';ctx.beginPath();ctx.arc((p.x+drift)%1*width,p.y*height,p.r*1.2,0,7);ctx.fill()});ctx.globalAlpha=1
      const halo=ctx.createRadialGradient(cx,cy,base*.25,cx,cy,base*1.13);halo.addColorStop(0,'rgba(20,22,27,.4)');halo.addColorStop(.62,'rgba(9,10,13,.22)');halo.addColorStop(.88,'rgba(196,168,130,.035)');halo.addColorStop(1,'transparent');ctx.fillStyle=halo;ctx.fillRect(0,0,width,height)
      ctx.fillStyle='#0b0d11';ctx.globalAlpha=.86;ctx.beginPath();ctx.arc(cx,cy,base*.985,0,Math.PI*2);ctx.fill();ctx.globalAlpha=1

      const yaw=view.yaw+spin,pitch=view.pitch
      const projected=points.map(p=>{
        let x=p.x*Math.cos(yaw)-p.z*Math.sin(yaw),z=p.x*Math.sin(yaw)+p.z*Math.cos(yaw)
        const y=p.y*Math.cos(pitch)-z*Math.sin(pitch);z=p.y*Math.sin(pitch)+z*Math.cos(pitch)
        const regional=1+(p.cluster===regionRef.current?energy*2.2:energy*.25)*Math.sin(time*.004+p.seed*30)
        const scale=(1+signal*(.3+p.seed))*regional
        return {x:cx+x*base*scale,y:cy+y*base*scale,z,seed:p.seed,cluster:p.cluster}
      })
      ctx.lineWidth=.48
      projected.forEach((a,i)=>{if(a.z<-.25)return;for(let j=i+1;j<Math.min(i+16,projected.length);j++){const b=projected[j],d=Math.hypot(a.x-b.x,a.y-b.y),limit=base*(a.cluster===regionRef.current?.105:.075);if(d<limit&&b.z>-.25){const active=a.cluster===regionRef.current&&b.cluster===regionRef.current;line(a,b,(1-d/limit)*(active?.25:.09)*(a.z+1),active&&a.seed>.82?'#c4a882':'#737780')}}})

      const active=Math.round(scrollCamera)
      if(active===1){projected.filter(p=>p.cluster===1&&p.z>.15).slice(0,18).forEach((p,i,arr)=>{const b=arr[(i+5)%arr.length];line(p,b,.25,'#d0d2d6')})}
      if(active===2){for(let i=0;i<3;i++){ctx.strokeStyle=`rgba(191,194,200,${.1-i*.02})`;ctx.beginPath();ctx.ellipse(cx,cy,base*(.36+i*.13),base*(.13+i*.04),view.yaw,0,Math.PI*2);ctx.stroke()}}
      if(active===3){projected.filter(p=>p.cluster===3&&p.z>.25&&p.seed>.72).forEach(p=>{ctx.strokeStyle='rgba(191,194,200,.16)';ctx.strokeRect(p.x-8,p.y-8,16,16)})}
      if(active===4){projected.filter(p=>p.cluster===4&&p.z>.15&&p.seed>.6).forEach(p=>{const h=5+p.seed*15;ctx.fillStyle='rgba(122,126,135,.12)';ctx.fillRect(p.x-2,p.y-h,4,h)})}

      projected.sort((a,b)=>a.z-b.z).forEach(p=>{const front=Math.max(0,(p.z+1)/2),activeNode=p.cluster===regionRef.current,r=(.35+p.seed*1.25)*(1+front);ctx.fillStyle=p.seed>.965?'#d6a64b':p.seed>.66?'#e8e6e3':'#858991';ctx.globalAlpha=(.1+front*.72)*(activeNode?1:.62);ctx.beginPath();ctx.arc(p.x,p.y,r,0,7);ctx.fill();if(p.seed>.975){ctx.globalAlpha=.08+energy;ctx.beginPath();ctx.arc(p.x,p.y,r*7,0,7);ctx.fill()}});ctx.globalAlpha=1
      ctx.strokeStyle='rgba(191,194,200,.09)';ctx.lineWidth=.7;ctx.beginPath();ctx.arc(cx,cy,base,0,Math.PI*2);ctx.stroke()
      if(voice!=='idle')for(let i=0;i<3;i++){const wave=((time*.045+i*34)%100)/100;ctx.strokeStyle=`rgba(214,166,75,${(1-wave)*.13})`;ctx.beginPath();ctx.arc(cx,cy,base*(1+wave*.16),0,7);ctx.stroke()}
      frame=requestAnimationFrame(draw)
    }
    resize();trackScroll();addEventListener('resize',resize);addEventListener('scroll',trackScroll,{passive:true});frame=requestAnimationFrame(draw)
    return()=>{cancelAnimationFrame(frame);removeEventListener('resize',resize);removeEventListener('scroll',trackScroll)}
  },[])
  return <canvas ref={canvasRef} className="orb" onClick={onActivate} aria-label="Orbe de Nasus. Activar conversación." role="button" tabIndex="0" onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();onActivate()}}} />
}
