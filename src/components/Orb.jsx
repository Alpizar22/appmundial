import { useEffect, useRef } from 'react'
import { createOrbModel, renderNasusOrb } from './orb/nasusOrbEngine'

export default function Orb({ region, mode, onActivate }) {
  const canvasRef=useRef(null),regionRef=useRef(region),modeRef=useRef(mode)
  useEffect(()=>{regionRef.current=region;canvasRef.current?.dispatchEvent(new Event('orbinvalidate'))},[region])
  useEffect(()=>{modeRef.current=mode;canvasRef.current?.dispatchEvent(new Event('orbinvalidate'))},[mode])

  useEffect(()=>{
    const canvas=canvasRef.current,ctx=canvas.getContext('2d'),reducedQuery=matchMedia('(prefers-reduced-motion: reduce)')
    let frame=0,width=0,height=0,scrollTarget=0,scrollProgress=0,journeyTarget=0,journeyFocus=0,running=true,reduced=reducedQuery.matches,model=[]
    const pointer={x:0,y:0,active:false}
    const resize=()=>{const box=canvas.getBoundingClientRect(),dpr=Math.min(devicePixelRatio||1,2);width=box.width;height=box.height;canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);ctx.setTransform(dpr,0,0,dpr,0,0);const count=width<700?82:width<1100?118:148;if(model.length!==count)model=createOrbModel(count)}
    const trackScroll=()=>{const vh=Math.max(innerHeight,1);scrollTarget=Math.max(0,Math.min(4,(scrollY-vh*.72)/(vh*1.34)));journeyTarget=Math.max(0,Math.min(1,(scrollY-vh*.58)/(vh*.28)))}
    const paint=time=>{scrollProgress+=((reduced?regionRef.current:scrollTarget)-scrollProgress)*(reduced?1:.04);journeyFocus+=(journeyTarget-journeyFocus)*(reduced?1:.055);ctx.clearRect(0,0,width,height);renderNasusOrb(ctx,model,{width,height,time:time/1000,progress:scrollProgress,regionalFocus:journeyFocus,mode:modeRef.current,reduced,pointer});if(running&&!reduced)frame=requestAnimationFrame(paint)}
    const restart=()=>{cancelAnimationFrame(frame);ctx.clearRect(0,0,width,height);if(!running)return;if(reduced)paint(650);else frame=requestAnimationFrame(paint)}
    const onMotion=event=>{reduced=event.matches;restart()}
    const onVisibility=()=>{running=document.visibilityState!=='hidden';restart()}
    const onPointerMove=event=>{const box=canvas.getBoundingClientRect();pointer.x=event.clientX-box.left;pointer.y=event.clientY-box.top;pointer.active=true}
    const onPointerLeave=()=>{pointer.active=false}
    const invalidate=()=>{if(reduced)restart()}
    resize();trackScroll();addEventListener('resize',resize);addEventListener('scroll',trackScroll,{passive:true});addEventListener('pointermove',onPointerMove,{passive:true});addEventListener('blur',onPointerLeave);reducedQuery.addEventListener('change',onMotion);document.addEventListener('visibilitychange',onVisibility);document.documentElement.addEventListener('pointerleave',onPointerLeave);canvas.addEventListener('orbinvalidate',invalidate);restart()
    return()=>{running=false;cancelAnimationFrame(frame);removeEventListener('resize',resize);removeEventListener('scroll',trackScroll);removeEventListener('pointermove',onPointerMove);removeEventListener('blur',onPointerLeave);reducedQuery.removeEventListener('change',onMotion);document.removeEventListener('visibilitychange',onVisibility);document.documentElement.removeEventListener('pointerleave',onPointerLeave);canvas.removeEventListener('orbinvalidate',invalidate)}
  },[])

  return <canvas ref={canvasRef} className="orb" onClick={onActivate} aria-label="Orbe de Nasus. Activar conversación." role="button" tabIndex="0" onKeyDown={event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();onActivate()}}} />
}
