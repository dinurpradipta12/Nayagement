import { useEffect, useRef, useState } from 'react'
import * as T from 'three'
import { poseCompanion } from './motion.mjs'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { createCompanion, createFurniture, createOfficeShell, disposeTree } from './models.mjs'
import type { ConsultationBooking } from '../../types'
import { ROOMS, CONSULTANT, CHARACTER_SCALE, seatedHeight, SOFA_TOP, workstations, avatarVariant, canGreet, consultationGuests, pointOnPath, isServiceFurniture, placementError, snap, type ConsultationGuest, type Furniture, type OfficeItem, type OfficeLayout, type RoomId } from './model'

interface Props {
  bookings: ConsultationBooking[]; layout: OfficeLayout; items: OfficeItem[]; room: RoomId | null; selectedFurniture: string | null
  editing: boolean; dark: boolean; reducedMotion: boolean; reset: number
  onRoom: (room: RoomId) => void; onItem: (id: string) => void; onFurniture: (id: string) => void
  onMove: (f: Furniture) => void; onMessage: (message: string) => void
}
type WorkJourney = { path:[number,number][]; started:number; duration:number; targetHeading:number }
type Companion = ReturnType<typeof createCompanion> & { room: RoomId; item?: OfficeItem; base: T.Vector3; phase: number; heading:number; guest?:ConsultationGuest; host?:boolean; key:string; seated:boolean; working:boolean; walking:boolean; journey?:WorkJourney; greetUntil:number; greetStarted:number; look?:T.Vector3; bubble?:HTMLSpanElement }
interface Runtime {
  scene: T.Scene; renderer: T.WebGLRenderer; camera: T.PerspectiveCamera; controls: OrbitControls
  architecture: T.Group; furniture: T.Group; actors: T.Group; companions: Companion[]; light: T.DirectionalLight
  selection: T.BoxHelper | null; objects: Map<string,T.Group>; focus: T.Vector3; focusUntil: number; sun: T.HemisphereLight
}
const HOME = new T.Vector3(16,20,21), CENTER = new T.Vector3(0,0,0)

export default function OfficeScene(props: Props) {
  const host = useRef<HTMLDivElement>(null), live = useRef(props), runtime=useRef<Runtime|null>(null)
  const roomLabels=useRef(new Map<string,HTMLButtonElement>()), actorLabels=useRef(new Map<string,HTMLButtonElement>())
  const [failure,setFailure]=useState(''), [rendered,setRendered]=useState(false)
  const appearances=useRef(new Map<string,number>())
  const arrivedWork=useRef(new Set<string>())
  const population=props.items.filter(i=>i.kind!=='booking').map(i=>i.id+':'+i.room).join('|')
  live.current=props
  useEffect(()=>{
    const node=host.current;if(!node)return
    let renderer:T.WebGLRenderer
    try { renderer=new T.WebGLRenderer({antialias:true,alpha:true,powerPreference:'low-power'}) } catch {setFailure('Tampilan 3D tidak tersedia di perangkat ini. Semua aktivitas tetap tersedia dalam daftar di samping.');return}
    renderer.setPixelRatio(Math.min(window.devicePixelRatio,1.6));renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.2
    renderer.domElement.setAttribute('aria-label','Kantor 3D interaktif. Gunakan tombol bilik untuk navigasi keyboard.');renderer.domElement.setAttribute('role','img');node.prepend(renderer.domElement)
    const scene=new T.Scene(),camera=new T.PerspectiveCamera(38,1,.1,160);camera.position.copy(HOME)
    const controls=new OrbitControls(camera,renderer.domElement);controls.target.copy(CENTER);controls.enableDamping=true;controls.dampingFactor=.08;controls.minDistance=8;controls.maxDistance=110;controls.maxPolarAngle=Math.PI*.46;controls.minPolarAngle=.2;controls.enablePan=true;controls.update()
    const sun=new T.HemisphereLight('#f4f6ff','#a9b1be',2.4);scene.add(sun)
    const light=new T.DirectionalLight('#fff1dd',3.4);light.position.set(-6,14,8);light.castShadow=true;light.shadow.mapSize.set(1024,1024);light.shadow.camera.left=-24;light.shadow.camera.right=24;light.shadow.camera.top=24;light.shadow.camera.bottom=-24;light.shadow.normalBias=.04;light.shadow.bias=-.0001;scene.add(light)
    const floor=new T.Mesh(new T.PlaneGeometry(200,200),new T.ShadowMaterial({opacity:.14}));floor.rotation.x=-Math.PI/2;floor.position.y=-.51;floor.receiveShadow=true;scene.add(floor)
    const architecture=new T.Group(),furniture=new T.Group(),actors=new T.Group();scene.add(architecture,furniture,actors)
    const rt:Runtime={scene,renderer,camera,controls,architecture,furniture,actors,companions:[],light,sun,objects:new Map(),selection:null,focus:CENTER.clone(),focusUntil:0};runtime.current=rt
    controls.addEventListener('start',()=>{rt.focusUntil=0});const resize=()=>{const w=node.clientWidth,h=node.clientHeight;if(!w||!h)return;renderer.setSize(w,h);camera.aspect=w/h;camera.updateProjectionMatrix()};const observer=new ResizeObserver(resize);observer.observe(node);resize()
    const ray=new T.Raycaster(),cursor=new T.Vector2(),plane=new T.Plane(new T.Vector3(0,1,0),-.07)
    const point=(event:PointerEvent)=>{const rect=renderer.domElement.getBoundingClientRect();cursor.set((event.clientX-rect.left)/rect.width*2-1,-(event.clientY-rect.top)/rect.height*2+1);ray.setFromCamera(cursor,camera);return ray.ray.intersectPlane(plane,new T.Vector3())}
    const pick=(event:PointerEvent)=>{point(event);for(const hit of ray.intersectObjects([...furniture.children,...actors.children],true)){let o:T.Object3D|null=hit.object;while(o){if(o.userData.furniture||o.userData.room)return o;o=o.parent}}return null}
    let down:{x:number;y:number;id?:string;start?:T.Vector3;offset?:T.Vector3;candidate?:Furniture;invalid?:string}|null=null
    const start=(event:PointerEvent)=>{
      if(event.button!==0)return
      rt.focusUntil=0;const object=pick(event);down={x:event.clientX,y:event.clientY}
      if(live.current.editing && object?.userData.furniture){const id=String(object.userData.furniture),f=live.current.layout.furniture.find(f=>f.id===id),p=point(event);if(f&&p){if(isServiceFurniture(id)){live.current.onMessage('Kursi layanan dan ruang tunggu dipertahankan agar alur konsultasi tetap berjalan.');return}down.id=id;down.start=object.position.clone();down.offset=object.position.clone().sub(p);controls.enabled=false;live.current.onFurniture(id);renderer.domElement.setPointerCapture(event.pointerId)}}
    }
    const move=(event:PointerEvent)=>{if(!down?.id)return;const p=point(event),f=live.current.layout.furniture.find(f=>f.id===down?.id);if(!p||!f)return;p.add(down.offset!);const candidate={...f,x:snap(p.x),z:snap(p.z)},error=placementError(candidate,live.current.layout.furniture);down.invalid=error??undefined;down.candidate=error?undefined:candidate;if(!error)rt.objects.get(f.id)?.position.set(candidate.x,.07,candidate.z)}
    const end=(event:PointerEvent)=>{
      const old=down;down=null;controls.enabled=true;if(!old)return
      if(old.id){const object=rt.objects.get(old.id);if(old.candidate)live.current.onMove(old.candidate);else if(object&&old.start)object.position.copy(old.start);if(old.invalid)live.current.onMessage(old.invalid);if(renderer.domElement.hasPointerCapture(event.pointerId))renderer.domElement.releasePointerCapture(event.pointerId);return}
      if(Math.hypot(event.clientX-old.x,event.clientY-old.y)>6)return
      const object=pick(event)
      const greeted=rt.companions.find(a=>a.root===object);if(greeted&&!live.current.editing){greeted.greetStarted=performance.now()/1000;greeted.greetUntil=greeted.greetStarted+1.8;greeted.look=rt.camera.position.clone()}
      if(object?.userData.item && !live.current.editing){live.current.onItem(String(object.userData.item));return}
      const p=point(event);if(p){const room=ROOMS.find(r=>Math.abs(p.x-r.x)<=r.width/2&&Math.abs(p.z-r.z)<=r.depth/2);if(room)live.current.onRoom(room.id)}
    }
    const cancel=()=>{if(down?.id&&down.start)rt.objects.get(down.id)?.position.copy(down.start);down=null;controls.enabled=true}
    const canvas=renderer.domElement;canvas.addEventListener('pointerdown',start);canvas.addEventListener('pointermove',move);canvas.addEventListener('pointerup',end);canvas.addEventListener('pointercancel',cancel)
    const lost=(e:Event)=>{e.preventDefault();cancel();setFailure('Konteks 3D terhenti. Gunakan daftar aktivitas, atau muat ulang halaman untuk membuka 3D kembali.')};canvas.addEventListener('webglcontextlost',lost)
    let frame=0,last=0,guestTick=-Infinity,socialTick=-Infinity,visible=true;const greetingCooldown=new Map<string,number>();const project=(element:HTMLElement|undefined,p:T.Vector3)=>{if(!element)return;const v=p.clone().project(camera);element.style.transform=`translate(-50%,-50%) translate(${(v.x*.5+.5)*node.clientWidth}px,${(-v.y*.5+.5)*node.clientHeight}px)`;element.style.visibility=v.z>1||Math.abs(v.x)>1.1||Math.abs(v.y)>1.1?'hidden':'visible'}
    const animate=(time:number)=>{frame=requestAnimationFrame(animate);if(document.hidden||!visible)return;if(time-last<1000/(live.current.reducedMotion?20:40))return;last=time
      if(rt.focusUntil>time){const alpha=.08;controls.target.lerp(rt.focus,alpha)}
      controls.update();const t=time/1000
      const now=Date.now()
      if(time-guestTick>500){guestTick=time;const guests=consultationGuests(live.current.bookings,now),ids=new Set(guests.map(g=>g.id))
        for(const actor of [...rt.companions])if(actor.guest&&!ids.has(actor.guest.id)){rt.actors.remove(actor.root);disposeTree(actor.root);actor.bubble?.remove();rt.companions.splice(rt.companions.indexOf(actor),1)}
        for(const guest of guests){let actor=rt.companions.find(a=>a.guest?.id===guest.id)
          if(!actor){const model=createCompanion('#9ab9cc',avatarVariant('guest:'+guest.id,appearances.current),!live.current.reducedMotion);model.root.scale.setScalar(CHARACTER_SCALE);rt.actors.add(model.root);actor={...model,room:'waiting',base:new T.Vector3(),phase:guest.seat,heading:guest.heading,guest,key:'guest:'+guest.id,seated:guest.seated,working:false,walking:false,greetUntil:0,greetStarted:-Infinity};rt.companions.push(actor)}
          actor.guest=guest;actor.room=guest.phase==='waiting'?'waiting':'consultation';actor.item=live.current.items.find(i=>i.id==='booking:'+guest.id);actor.root.userData={...actor.root.userData,room:actor.room,item:'booking:'+guest.id}
        }
      }
      // Resolve world poses before detecting encounters; never compare last frame's positions.
      for(const a of rt.companions){const guest=a.guest,journey=a.journey
        a.walking=!!journey||!!guest&&(guest.phase==='entering'||guest.phase==='leaving');a.seated=!!a.host||!!guest?.seated||(!guest&&a.seated)
        if(journey){const progress=Math.min(1,(time-journey.started)/journey.duration),position=pointOnPath(journey.path,progress);a.base.set(position.x,.08,position.z);a.heading=position.heading;const actualRoom=ROOMS.find(r=>Math.abs(position.x-r.x)<r.width/2&&Math.abs(position.z-r.z)<r.depth/2);if(actualRoom)a.room=actualRoom.id;if(progress>=1){a.journey=undefined;a.walking=false;a.seated=true;a.base.y=seatedHeight();a.heading=journey.targetHeading;if(a.item)arrivedWork.current.add(a.item.id)}}
        else if(guest){const position=a.walking?pointOnPath(guest.path,(now-guest.phaseStarted)/guest.duration):guest;a.base.set(position.x,a.seated?seatedHeight():.08,position.z);a.heading=position.heading;const actualRoom=ROOMS.find(r=>Math.abs(position.x-r.x)<r.width/2&&Math.abs(position.z-r.z)<r.depth/2);if(actualRoom)a.room=actualRoom.id}
        a.root.position.copy(a.base);a.root.rotation.y=a.heading
        // Move the seated body slightly forward of the backrest, with its underside above the cushion.
        if(a.seated){a.root.position.x+=Math.sin(a.heading)*.12;a.root.position.z+=Math.cos(a.heading)*.12}
      }
      if(!live.current.reducedMotion&&!live.current.editing&&time-socialTick>200){socialTick=time
        for(let i=0;i<rt.companions.length;i++)for(let j=i+1;j<rt.companions.length;j++){const a=rt.companions[i],b=rt.companions[j],pair=[a.key,b.key].sort().join('|')
          if(t<(greetingCooldown.get(pair)??0)||a.greetUntil>t||b.greetUntil>t)continue
          if(canGreet({x:a.root.position.x,z:a.root.position.z,room:a.room,walking:a.walking},{x:b.root.position.x,z:b.root.position.z,room:b.room,walking:b.walking})){a.greetStarted=b.greetStarted=t;a.greetUntil=b.greetUntil=t+1.7;a.look=b.root.position.clone();b.look=a.root.position.clone();greetingCooldown.set(pair,t+18)}
        }
        if(greetingCooldown.size>500)for(const [key,until] of greetingCooldown)if(until<t)greetingCooldown.delete(key)
      }
      const inSession=rt.companions.some(a=>a.guest?.phase==='consulting')
      for(const a of rt.companions){const moving=a.walking,greeting=a.greetUntil>t&&!live.current.reducedMotion&&!live.current.editing,typing=a.working&&!!a.item&&!moving&&!greeting&&!live.current.editing,chat=(a.host||a.guest?.phase==='consulting')&&inSession
        poseCompanion(a,{t,moving:!!moving,greeting,typing,chat,reducedMotion:live.current.reducedMotion,editing:live.current.editing})
        if(greeting&&!a.bubble){a.bubble=document.createElement('span');a.bubble.className='office3d-greeting';a.bubble.setAttribute('aria-hidden','true');a.bubble.textContent='Hai!';node.append(a.bubble)}
        if(a.bubble){a.bubble.style.display=greeting?'block':'none';if(greeting)project(a.bubble,a.root.position.clone().add(new T.Vector3(0,1.25,0)))}
        if(a.host)project(actorLabels.current.get('consultant'),a.root.position.clone().add(new T.Vector3(0,1.3,0)))
        if(a.item)project(actorLabels.current.get(a.item.id),a.root.position.clone().add(new T.Vector3(0,1.3,0)))
      }
      for(const room of ROOMS)project(roomLabels.current.get(room.id),new T.Vector3(room.x,.12,room.z+room.depth/2-.38))
      if(rt.selection)rt.selection.update();renderer.render(scene,camera)
    };frame=requestAnimationFrame(animate)
    const intersection=new IntersectionObserver(entries=>{visible=entries[0]?.isIntersecting??true});intersection.observe(node);setRendered(true)
    return()=>{cancelAnimationFrame(frame);observer.disconnect();intersection.disconnect();controls.dispose();rt.companions.forEach(a=>a.bubble?.remove());canvas.removeEventListener('pointerdown',start);canvas.removeEventListener('pointermove',move);canvas.removeEventListener('pointerup',end);canvas.removeEventListener('pointercancel',cancel);canvas.removeEventListener('webglcontextlost',lost);disposeTree(scene as unknown as T.Group);renderer.dispose();canvas.remove();runtime.current=null}
  },[])
  useEffect(()=>{const rt=runtime.current;if(!rt)return;for(const child of [...rt.architecture.children]){rt.architecture.remove(child);disposeTree(child as T.Group)}rt.architecture.add(createOfficeShell(ROOMS,props.layout.floor,props.layout.wall));const hour=props.layout.daylight;rt.light.position.set(Math.cos((hour-6)/17*Math.PI)*12,Math.max(2,Math.sin((hour-6)/17*Math.PI)*16),7);rt.light.color.set(hour>18?'#f5c69a':'#fff2df');rt.light.intensity=hour>20?1.1:3.4;rt.sun.intensity=props.dark?1.6:2.4;rt.renderer.toneMappingExposure=props.dark?.95:1.2},[rendered,props.layout.floor,props.layout.wall,props.layout.daylight,props.dark])
  useEffect(()=>{const rt=runtime.current;if(!rt)return;for(const child of [...rt.furniture.children]){rt.furniture.remove(child);disposeTree(child as T.Group)}rt.objects.clear();const bindings=workstations(props.layout.furniture)
    for(const item of props.layout.furniture){const model=createFurniture(item.kind,ROOMS.find(r=>r.id===item.room)?.color),seat=bindings.find(b=>b.chairId===item.id),desk=bindings.find(b=>b.deskId===item.id);model.userData.furniture=item.id;model.position.set(seat?.x??item.x,.07,seat?.z??item.z);const table=item.kind==='chair'&&!isServiceFurniture(item.id)?props.layout.furniture.find(f=>f.kind==='table'&&f.room===item.room):undefined;model.rotation.y=seat?.heading??desk?.deskHeading??(table?Math.atan2(table.x-item.x,table.z-item.z):item.rotation);rt.furniture.add(model);rt.objects.set(item.id,model)}
  },[rendered,props.layout.furniture])
  useEffect(()=>{const rt=runtime.current;if(!rt)return;rt.companions.forEach(a=>a.bubble?.remove());for(const child of [...rt.actors.children]){rt.actors.remove(child);disposeTree(child as T.Group)}rt.companions=[]
    const activeWorkIds=new Set(props.items.filter(item=>item.room==='studio').map(item=>item.id));for(const id of arrivedWork.current)if(!activeWorkIds.has(id))arrivedWork.current.delete(id)
    const spawn=(room:RoomId,key:string,x:number,z:number,heading:number,seated:boolean,working:boolean,item?:OfficeItem,host=false,surface?:number,journey?:WorkJourney)=>{const color=ROOMS.find(r=>r.id===room)!.color,actor=createCompanion(color,avatarVariant(key,appearances.current),!props.reducedMotion),start=journey?pointOnPath(journey.path,0):{x,z,heading};actor.root.position.set(start.x,journey ? .08 : seated ? seatedHeight(surface) : .08,start.z);actor.root.scale.setScalar(CHARACTER_SCALE);actor.root.userData={...actor.root.userData,room,item:item?.id};rt.actors.add(actor.root);rt.companions.push({...actor,room,key,item,base:actor.root.position.clone(),phase:rt.companions.length*1.6,heading:start.heading,host,seated:journey?false:seated,working,walking:!!journey,journey,greetUntil:0,greetStarted:-Infinity})}
    const journeyFor=(item:OfficeItem,x:number,z:number,heading:number,index:number):WorkJourney|undefined=>{if(props.reducedMotion||arrivedWork.current.has(item.id))return undefined;const start:[number,number]=item.kind==='order'?[-.85+(index%3)*.35,4.8]:[2.05+(index%3)*.3,3.15+Math.floor(index/3)*.16],path:[number,number][]=item.kind==='order'?[start,[-2.7,4.8],[-2.7,2.2],[-2.7,1.4],[-2.7,.9],[x,.9],[x,z+1.35],[x,z]]:[start,[3.1,2.7],[3.1,2.2],[3.1,1.4],[x,.9],[x,z+1.35],[x,z]],distance=path.slice(1).reduce((sum,p,pathIndex)=>sum+Math.hypot(p[0]-path[pathIndex][0],p[1]-path[pathIndex][1]),0);return {path,started:performance.now()+Math.min(index,5)*240,duration:Math.max(2600,distance*520),targetHeading:heading}}
    const bindings=workstations(props.layout.furniture)
    for(const room of ROOMS){if(room.id==='waiting')continue
      if(room.id==='consultation'){spawn(room.id,'consultant',CONSULTANT.x,CONSULTANT.z,CONSULTANT.heading,true,false,undefined,true);continue}
      const entries=props.items.filter(i=>i.room===room.id),stations=bindings.filter(b=>props.layout.furniture.find(f=>f.id===b.deskId)?.room===room.id)
      if(room.id==='studio'){
        for(const [index,item] of entries.entries()){const station=stations[index];if(station)spawn(room.id,station.chairId,station.x,station.z,station.heading,true,true,item,false,undefined,journeyFor(item,station.x,station.z,station.heading,index));else spawn(room.id,'studio-overflow-'+item.id,-3.6+(index%4)*2.2,-.25+Math.floor(index/4)*.65,0,false,false,item)}
        continue
      }
      const seats=props.layout.furniture.filter(f=>f.room===room.id&&(f.kind==='chair'||f.kind==='sofa')).flatMap(seat=>seat.kind==='sofa'?[{...seat,id:seat.id+'-left',x:seat.x-.42},{...seat,id:seat.id+'-right',x:seat.x+.42}]:[seat])
      const table=props.layout.furniture.find(f=>f.room===room.id&&f.kind==='table')
      for(const [index,item] of entries.entries()){const seat=seats[index];if(seat){const heading=table?Math.atan2(table.x-seat.x,table.z-seat.z):seat.rotation;spawn(room.id,seat.id,seat.x,seat.z,heading,true,false,item,false,seat.kind==='sofa'?SOFA_TOP:undefined)}else spawn(room.id,room.id+'-overflow-'+item.id,room.x-1.35+(index%4)*.8,room.z+.95-Math.floor(index/4)*.55,0,false,false,item)}
    }
  },[rendered,props.reducedMotion,props.layout.furniture,population])
  useEffect(()=>{const rt=runtime.current;if(!rt)return;for(const a of rt.companions)if(!a.host&&!a.guest&&a.item){a.item=props.items.find(item=>item.id===a.item?.id);a.root.userData.item=a.item?.id}},[props.items,rendered])
  useEffect(()=>{const rt=runtime.current;if(!rt)return;if(rt.selection){rt.scene.remove(rt.selection);rt.selection.geometry.dispose();(rt.selection.material as T.Material).dispose();rt.selection=null}if(props.editing && props.selectedFurniture){const object=rt.objects.get(props.selectedFurniture);if(object){rt.selection=new T.BoxHelper(object,'#4c8fe9');rt.scene.add(rt.selection)}}},[rendered,props.selectedFurniture,props.editing,props.layout.furniture])
  useEffect(()=>{const rt=runtime.current;if(!rt)return;const room=ROOMS.find(r=>r.id===props.room);rt.focus.set(room?.x??CENTER.x,0,room?.z??CENTER.z);rt.focusUntil=performance.now()+1200;if(!room)rt.controls.target.copy(CENTER)},[props.room])
  useEffect(()=>{const rt=runtime.current;if(!rt)return;rt.camera.position.copy(HOME);rt.controls.target.copy(CENTER);rt.controls.update()},[props.reset])
  const labels=props.room?props.items.filter(i=>i.room===props.room).slice(0,props.room==='waiting'||props.room==='consultation'?12:1):[]
  return <div className="office3d-world" ref={host} data-testid="office3d-world">
    {failure?<div className="office3d-render-error" role="status"><strong>Kantor dalam mode daftar</strong><p>{failure}</p></div>:<>
      <div className="office3d-projections">{ROOMS.map(room=><button key={room.id} ref={el=>{if(el)roomLabels.current.set(room.id,el);else roomLabels.current.delete(room.id)}} className={'office3d-room-label '+(props.room===room.id?'is-active':'')} onClick={()=>props.onRoom(room.id)}>{room.name}</button>)}
      {!props.editing&&<button ref={el=>{if(el)actorLabels.current.set('consultant',el);else actorLabels.current.delete('consultant')}} className="office3d-actor-label" onClick={()=>props.onRoom('consultation')}>Konsultan</button>}
      {!props.editing&&labels.map(item=><button key={item.id} ref={el=>{if(el)actorLabels.current.set(item.id,el);else actorLabels.current.delete(item.id)}} className="office3d-actor-label" onClick={()=>{props.onRoom(item.room);props.onItem(item.id)}}>{item.title}</button>)}</div>
      <div className="office3d-world-hint">{props.editing?'Pilih furnitur · geser pada lantai · putar lewat panel':'Geser untuk melihat · scroll untuk zoom · klik bilik atau karakter'}</div>
    </>}
  </div>
}
