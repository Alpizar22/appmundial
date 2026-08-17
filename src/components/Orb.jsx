import { useEffect, useRef, useState } from 'react'
import { createOrbModel, renderNasusOrb } from './orb/nasusOrbEngine'
import { preloadDataIllustration } from './orb/regions/dataSubworld'

export default function Orb({ region, mode, voiceSignals, onActivate, onOpenCases }) {
  const canvasRef=useRef(null),hotspotRef=useRef(null),regionRef=useRef(region),modeRef=useRef(mode),voiceSignalsRef=useRef(voiceSignals)
  const suppressClickRef=useRef(false)
  const [ready,setReady]=useState(false)
  useEffect(()=>{regionRef.current=region;canvasRef.current?.dispatchEvent(new Event('orbinvalidate'))},[region])
  useEffect(()=>{modeRef.current=mode;canvasRef.current?.dispatchEvent(new Event('orbinvalidate'))},[mode])
  useEffect(()=>{voiceSignalsRef.current=voiceSignals},[voiceSignals])
  useEffect(()=>{preloadDataIllustration(()=>canvasRef.current?.dispatchEvent(new Event('orbinvalidate')))},[])

  useEffect(()=>{
    const canvas=canvasRef.current,ctx=canvas.getContext('2d'),reducedQuery=matchMedia('(prefers-reduced-motion: reduce)')
    let frame=0,startFrame=0,revealTimer=0,width=0,height=0,scrollTarget=0,scrollProgress=0,journeyTarget=0,journeyFocus=0,running=true,reduced=reducedQuery.matches,model=[],hasPainted=false,regionAnchorScrolls=[]
    const pointer={x:0,y:0,active:false,touching:false,startX:0,startY:0,dragged:false}
    const markOnce=name=>{if(performance.getEntriesByName(name,'mark').length)return;performance.mark(name);performance.measure(`${name}_DURATION`,{start:0,end:name})}
    const resize=()=>{const box=canvas.getBoundingClientRect();width=box.width;height=box.height;const dpr=Math.min(devicePixelRatio||1,width<700?1.75:width<1100?1.6:2);canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);ctx.setTransform(dpr,0,0,dpr,0,0);ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';const count=width<700?122:width<1100?180:360;if(model.length!==count)model=createOrbModel(count)}
    // Ancla cada region al scroll en el que su centro coincide con el centro del viewport,
    // leyendo el layout real. Los multiplos fijos de innerHeight asumian que el alto CSS de
    // hero (svh) y region (vh) eran iguales, lo que solo se cumple en desktop: en movil la
    // barra de URL los separa y el pico de camara caia antes que el texto de la region.
    const measureRegions=()=>{regionAnchorScrolls=[...document.querySelectorAll('[data-region]')].map(section=>{const box=section.getBoundingClientRect();return box.top+scrollY+box.height/2-innerHeight/2})}
    const trackScroll=()=>{const vh=Math.max(innerHeight,1),anchors=regionAnchorScrolls
      if(anchors.length<2){scrollTarget=Math.max(0,Math.min(5,Math.max(0,(scrollY-vh*.72)/(vh*1.34))/1.25));journeyTarget=Math.max(0,Math.min(1,(scrollY-vh*.58)/(vh*.28)));return}
      const last=anchors.length-1;let progress
      if(scrollY<=anchors[0])progress=0
      else if(scrollY>=anchors[last])progress=last+(scrollY-anchors[last])/Math.max(1,anchors[last]-anchors[last-1])
      else{let index=0;while(index<last-1&&scrollY>anchors[index+1])index++;progress=index+(scrollY-anchors[index])/Math.max(1,anchors[index+1]-anchors[index])}
      scrollTarget=Math.max(0,Math.min(5,progress))
      journeyTarget=Math.max(0,Math.min(1,(scrollY-(anchors[0]-vh*.78))/(vh*.5)))}
    const paint=time=>{scrollProgress+=((reduced?regionRef.current:scrollTarget)-scrollProgress)*(reduced?1:.04);journeyFocus+=(journeyTarget-journeyFocus)*(reduced?1:.055);ctx.clearRect(0,0,width,height);const result=renderNasusOrb(ctx,model,{width,height,time:time/1000,progress:scrollProgress,regionalFocus:journeyFocus,mode:modeRef.current,voiceSignals:voiceSignalsRef.current,reduced,pointer}),hotspot=hotspotRef.current;if(!hasPainted){hasPainted=true;setReady(true);revealTimer=window.setTimeout(()=>markOnce('ORB_VISIBLE'),1550)}if(hotspot&&result?.cases){hotspot.style.setProperty('--hotspot-x',`${result.cases.x}px`);hotspot.style.setProperty('--hotspot-y',`${result.cases.y}px`);hotspot.style.opacity=result.cases.visibility;hotspot.style.pointerEvents=result.cases.visibility>.32?'auto':'none';hotspot.classList.toggle('is-frontal',result.cases.visibility>.72);hotspot.tabIndex=result.cases.visibility>.32?0:-1}if(running&&!reduced)frame=requestAnimationFrame(paint)}
    const restart=()=>{cancelAnimationFrame(frame);ctx.clearRect(0,0,width,height);if(!running)return;if(reduced)paint(650);else frame=requestAnimationFrame(paint)}
    const onMotion=event=>{reduced=event.matches;restart()}
    const onVisibility=()=>{running=document.visibilityState!=='hidden';restart()}
    const locatePointer=event=>{const box=canvas.getBoundingClientRect();pointer.x=event.clientX-box.left;pointer.y=event.clientY-box.top}
    const onPointerDown=event=>{if(event.pointerType!=='touch'&&event.pointerType!=='pen')return;locatePointer(event);pointer.touching=true;pointer.active=true;pointer.dragged=false;pointer.startX=event.clientX;pointer.startY=event.clientY;suppressClickRef.current=false}
    const onPointerMove=event=>{if((event.pointerType==='touch'||event.pointerType==='pen')&&!pointer.touching)return;locatePointer(event);pointer.active=true;if(pointer.touching&&Math.hypot(event.clientX-pointer.startX,event.clientY-pointer.startY)>8)pointer.dragged=true}
    const onPointerEnd=event=>{if(event.pointerType!=='touch'&&event.pointerType!=='pen')return;suppressClickRef.current=pointer.dragged;pointer.touching=false;pointer.active=false}
    const onPointerLeave=()=>{if(!pointer.touching)pointer.active=false}
    const invalidate=()=>{if(reduced)restart()}
    const onRevealEnd=event=>{if(event.propertyName!=='opacity')return;window.clearTimeout(revealTimer);markOnce('ORB_VISIBLE')}
    const onResize=()=>{resize();measureRegions();trackScroll()}
    // window.resize no cubre todos los cambios de caja del canvas: en movil, al colapsar la
    // barra de URL cambia el alto del elemento sin que el evento dispare de forma garantizada.
    // Cuando el backing store queda desfasado de la caja CSS el navegador estira el bitmap,
    // la composicion se desplaza y el borde del halo se hace visible. El observer sigue la
    // caja real, venga el cambio de donde venga.
    const boxObserver=typeof ResizeObserver!=='undefined'?new ResizeObserver(()=>onResize()):null
    boxObserver?.observe(canvas)
    addEventListener('resize',onResize);addEventListener('scroll',trackScroll,{passive:true});addEventListener('pointermove',onPointerMove,{passive:true});addEventListener('blur',onPointerLeave);reducedQuery.addEventListener('change',onMotion);document.addEventListener('visibilitychange',onVisibility);document.documentElement.addEventListener('pointerleave',onPointerLeave);canvas.addEventListener('pointerdown',onPointerDown,{passive:true});canvas.addEventListener('pointerup',onPointerEnd,{passive:true});canvas.addEventListener('pointercancel',onPointerEnd,{passive:true});canvas.addEventListener('orbinvalidate',invalidate);canvas.addEventListener('transitionend',onRevealEnd);startFrame=requestAnimationFrame(()=>{if(!running)return;resize();measureRegions();trackScroll();markOnce('CANVAS_READY');restart()})
    return()=>{running=false;window.clearTimeout(revealTimer);cancelAnimationFrame(startFrame);cancelAnimationFrame(frame);boxObserver?.disconnect();removeEventListener('resize',onResize);removeEventListener('scroll',trackScroll);removeEventListener('pointermove',onPointerMove);removeEventListener('blur',onPointerLeave);reducedQuery.removeEventListener('change',onMotion);document.removeEventListener('visibilitychange',onVisibility);document.documentElement.removeEventListener('pointerleave',onPointerLeave);canvas.removeEventListener('pointerdown',onPointerDown);canvas.removeEventListener('pointerup',onPointerEnd);canvas.removeEventListener('pointercancel',onPointerEnd);canvas.removeEventListener('orbinvalidate',invalidate);canvas.removeEventListener('transitionend',onRevealEnd)}
  },[])

  return <div className="orb-shell"><canvas ref={canvasRef} className={`orb ${ready?'is-ready':''}`} onClick={()=>{if(suppressClickRef.current){suppressClickRef.current=false;return}onActivate()}} aria-label="Orbe de Nasus. Activar conversación." role="button" tabIndex="0" onKeyDown={event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();onActivate()}}} /><button ref={hotspotRef} type="button" className="cases-hotspot" onClick={onOpenCases} aria-label="Abrir casos reales"><span>CASOS</span></button></div>
}
