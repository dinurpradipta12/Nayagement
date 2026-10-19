import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import ts from 'typescript'
import * as THREE from 'three'
import {createCompanion,createFurniture,disposeTree,HUMAN_STYLES} from '../src/features/office3d/models.mjs'
import {poseCompanion} from '../src/features/office3d/motion.mjs'
process.env.TZ='Asia/Makassar'
const source=await fs.readFile(new URL('../src/features/office3d/model.ts',import.meta.url),'utf8')
const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ES2020,target:ts.ScriptTarget.ES2020}}).outputText
const {freshLayout,readLayout,placementError,officeItems,localDay,consultationGuests,pointOnPath,ROOMS,SERVICE_FURNITURE,GUEST_CHAIR,roomDoors,WAITING_SEATS,workstations,seatedHeight,CHARACTER_SCALE,CHAIR_TOP,canGreet,facingTurn,avatarVariant}=await import('data:text/javascript;base64,'+Buffer.from(js).toString('base64'))
const layout=freshLayout();assert.deepEqual(readLayout(JSON.parse(JSON.stringify(layout))),layout,'default layout survives export/import')
assert.equal(layout.furniture.length,31)
const original=layout.furniture[0]
assert.equal(placementError({...original,x:-99},layout.furniture),'Furnitur harus tetap di dalam bilik.')
assert.equal(placementError({...original,id:'new-desk'},layout.furniture),'Posisi bertabrakan dengan furnitur lain.')
assert.equal(placementError(original,layout.furniture),null,'selected item does not collide with itself')
assert.throws(()=>readLayout({...layout,version:2}),/Versi/)
assert.throws(()=>readLayout({...layout,furniture:[...layout.furniture,original]}),/Identitas/)
assert.throws(()=>readLayout({...layout,furniture:[{...original,x:Infinity}]}),/Posisi/)
assert.throws(()=>readLayout({...layout,furniture:[{...original,kind:'__proto__'}]}),/Identitas/)
assert.throws(()=>readLayout({...layout,furniture:[{...original,id:'one'},{...original,id:'two'}]}),/bertabrakan/)
assert.throws(()=>readLayout({...layout,floor:'url(evil)'}),/material/)
assert.throws(()=>readLayout({...layout,daylight:NaN}),/pencahayaan/)
assert.equal(localDay('2026-10-19T18:30:00Z'),'2026-10-20','UTC dates converted to the local calendar day')
assert.equal(localDay('not-a-date'),null)
const task=(id,status,projectId='a',dueAt)=>({id,status,projectId,name:id,project:projectId,priority:'High',due:'',visibleToClient:false,dueAt})
const booking=(id,status)=>({id,status,startsAt:'2026-10-19T18:30:00Z',endsAt:'2026-10-19T19:30:00Z',name:id,topic:'Topic'})
const data={tasks:[task('working','In Progress'),task('todo','Todo'),task('review','Review'),task('done','Completed'),task('scheduled','Todo','b','2026-10-19T18:30:00Z')],projects:[],clients:[],invoices:[],orders:[{id:'new-order',status:'New',projectId:'a',submitterName:'New order',orderFormTitle:'Form',createdAt:'2026-10-19'},{id:'rejected',status:'Rejected'}],bookings:[booking('confirmed','Confirmed'),booking('cancelled','Cancelled'),booking('completed','Completed')],timelines:{a:[{id:'next',title:'Next',state:'next',occurredAt:'2026-10-20T10:00:00+08:00'},{id:'done',title:'Done',state:'done'}]}}
const all=officeItems(data,'','');assert.equal(all.length,7);assert.equal(all.find(i=>i.sourceId==='working').room,'studio');assert.equal(all.find(i=>i.sourceId==='review').room,'review');assert.equal(all.find(i=>i.sourceId==='confirmed').room,'consultation');assert(!all.some(i=>['done','cancelled','completed','rejected'].includes(i.sourceId)))
const filtered=officeItems(data,'a','');assert(filtered.every(i=>i.projectId==='a'));assert(filtered.some(i=>i.sourceId==='new-order'),'linked order respects project filter');assert(!filtered.some(i=>i.kind==='booking'))
const day=officeItems(data,'','2026-10-20');assert.deepEqual(day.map(i=>i.sourceId).sort(),['confirmed','next','scheduled'])
assert.equal(officeItems({...data,tasks:[],orders:[],bookings:[],timelines:{}},'','').length,0,'empty workspace stays empty')
// The asymmetric reference plan has side doors and a central working area with clear circulation.
assert.equal(ROOMS.find(r=>r.id==='studio').width,9.5)
assert(ROOMS.find(r=>r.id==='waiting').x<ROOMS.find(r=>r.id==='studio').x)
assert(ROOMS.find(r=>r.id==='consultation').x>ROOMS.find(r=>r.id==='studio').x)
for(const room of ROOMS)for(const door of roomDoors(room)){const x=door.x+(door.side==='east'?-.45:door.side==='west'?.45:0),z=door.z+(door.side==='south'?-.45:door.side==='north'?.45:0);assert.equal(placementError({id:'block-door',kind:'plant',room:room.id,x,z,rotation:0},[]),'Jalur pintu dan sirkulasi harus tetap kosong.')}
assert.throws(()=>readLayout({...layout,furniture:layout.furniture.filter(f=>f.id!=='service-host')}),/layanan/)
const at=Date.parse('2026-10-20T10:00:00+08:00'),until=at+3600000
const visit={id:'visit',status:'Confirmed',name:'Tamu',startsAt:new Date(at).toISOString(),endsAt:new Date(until).toISOString(),createdAt:'2026-10-19T08:00:00+08:00'}
const guests=(now,bookings=[visit])=>consultationGuests(bookings,now)
assert.equal(guests(at-86400000).length,0,'not visible before the appointment day')
assert.equal(guests(at-3600000)[0].phase,'waiting','waits from booking creation on scheduled day')
assert.equal(guests(at-1)[0].seated,true)
assert.equal(guests(at)[0].phase,'entering')
assert.equal(guests(at+6000)[0].phase,'entering')
assert.equal(guests(at+12000)[0].phase,'consulting')
assert.deepEqual([guests(at+12000)[0].x,guests(at+12000)[0].z],[GUEST_CHAIR.x,GUEST_CHAIR.z])
assert.equal(guests(until)[0].phase,'leaving')
assert.equal(guests(until+21999)[0].phase,'leaving')
assert.equal(guests(until+22000).length,0,'goes home after walking through the entrance')
assert.equal(guests(at,[{...visit,status:'Cancelled'}]).length,0)
assert.equal(guests(at,[{...visit,status:'Completed'}]).length,0)
assert.equal(guests(at,[{...visit,createdAt:new Date(at+1).toISOString()}]).length,0)
assert.equal(guests(at,[{...visit,endsAt:'invalid'}]).length,0)
assert.equal(guests(at,[{...visit,endsAt:new Date(at-1).toISOString()}]).length,0)
const short={...visit,endsAt:new Date(at+4000).toISOString()};assert.equal(guests(at+2000,[short])[0].phase,'consulting','short sessions still reach a seated phase')
const overlap={...visit,id:'second',startsAt:new Date(at+60000).toISOString(),endsAt:new Date(until+3600000).toISOString()}
assert.equal(guests(at+120000,[visit,overlap]).find(g=>g.id==='second').phase,'waiting','overlapping sessions queue for one consultant')
assert.equal(guests(until+12000,[visit,overlap]).find(g=>g.id==='second').phase,'consulting')
assert.deepEqual(pointOnPath([[0,0],[0,2],[2,2]],.75),{x:1,z:2,heading:Math.PI/2})
// Check walking samples avoid editable furniture and cross the consultation doorway.
const traveller=guests(at)[0];assert(traveller.path.some(p=>p[0]===5.2&&p[1]===1));assert(traveller.path.some(p=>p[0]===-4.7&&p[1]===-2))
for(let n=0;n<=100;n++){const p=pointOnPath(traveller.path,n/100);for(const f of layout.furniture.filter(f=>!SERVICE_FURNITURE.some(s=>s.id===f.id)))assert(Math.abs(p.x-f.x)>.6||Math.abs(p.z-f.z)>.6,'circulation avoids editable defaults')}
const prior={version:1,plan:2,floor:'#d4c6b3',wall:'#e5e7ed',daylight:16,furniture:[{id:'desk-1',kind:'desk',room:'studio',x:-12,z:-8,rotation:0}]}
const upgraded=readLayout(prior);assert.equal(upgraded.plan,3);assert.equal(upgraded.floor,prior.floor);assert.equal(upgraded.furniture.length,31);assert.deepEqual(prior.furniture[0].x,-12,'migration does not mutate the source layout')
assert.throws(()=>readLayout({...prior,furniture:[...prior.furniture,...prior.furniture]}),/lama/)
const stations=workstations(layout.furniture);assert.equal(stations.length,5)
for(const station of stations){const desk=layout.furniture.find(f=>f.id===station.deskId);const front=new THREE.Vector3(Math.sin(station.heading),0,Math.cos(station.heading));assert(front.dot(new THREE.Vector3(desk.x-station.x,0,desk.z-station.z).normalize())>.999,'character faces its computer')
 const actor={...createCompanion('#8aaed9',0,false),phase:0,heading:station.heading,seated:true,greetUntil:100,greetStarted:-1,look:new THREE.Vector3(station.x+1,1,station.z)};actor.root.scale.setScalar(CHARACTER_SCALE);actor.root.rotation.y=station.heading
 const chair=createFurniture('chair');chair.position.set(station.x,.07,station.z);chair.rotation.y=station.heading;chair.updateMatrixWorld(true)
 for(const options of [{typing:true},{greeting:true},{chat:true},{typing:true,reducedMotion:true}])for(const time of [0,.125,.5,2,7,12,14]){actor.root.position.set(station.x+front.x*.12,seatedHeight(),station.z+front.z*.12);poseCompanion(actor,{t:time,...options});actor.root.updateMatrixWorld(true)
  const torso=new THREE.Box3().setFromObject(actor.body);assert(torso.min.y>=CHAIR_TOP,JSON.stringify({station:station.chairId,options,time,min:torso.min.y,seat:CHAIR_TOP}))
  const backrest=new THREE.Box3().setFromObject(chair.children[1]);assert(!torso.intersectsBox(backrest),'body stays in front of the backrest');
  if(options.typing&&!options.reducedMotion&&time%15<11.5)for(const hand of actor.hands)assert(new THREE.Box3().setFromObject(hand).min.y>=.925,'typing hands stay above the desktop');
  const cushion=new THREE.Box3().setFromObject(chair.children[0]);for(const foot of actor.feet){const bounds=new THREE.Box3().setFromObject(foot);assert(!bounds.intersectsBox(cushion),'seated feet hang in front of the cushion')}
 }
 disposeTree(chair);disposeTree(actor.root)
}
const human={...createCompanion('#8aaed9',3,false),phase:0,heading:0,seated:false,greetUntil:2,greetStarted:0}
human.root.scale.setScalar(CHARACTER_SCALE)
for(const part of ['arms','elbows','hands','legs','shins','feet'])assert.equal(human[part].length,2,'two distinct human '+part)
assert(human.head.children.some(o=>o.name==='human-face'));assert(!human.root.getObjectByName('monitor-face'));assert(!human.root.getObjectByName('floating-blue-propeller'))
for(const time of [0,.1,.2,.4,.6,.8,1]){human.root.position.set(0,.08,0);poseCompanion(human,{t:time,moving:true});human.root.updateMatrixWorld(true);assert.equal(human.body.scale.y,1,'human gait does not squash the torso');assert(new THREE.Box3().setFromObject(human.root).max.y<1.62,JSON.stringify({time,max:new THREE.Box3().setFromObject(human.root).max.y}))}
poseCompanion(human,{t:1,reducedMotion:true});assert.equal(human.legs[0].rotation.x,0);disposeTree(human.root)
const avatars=new Map(),ids=['chair-1','chair-2','review-chair-1','consultant','reception-chair','planning-sofa',...Array.from({length:6},(_,i)=>'guest:'+i)]
const variants=ids.map(id=>avatarVariant(id,avatars));assert.equal(new Set(variants).size,12,'first twelve occupants have distinct hairstyles')
assert.equal(HUMAN_STYLES.filter(s=>s.gender==='male').length,6);assert.equal(HUMAN_STYLES.filter(s=>s.gender==='female').length,6);assert.equal(new Set(HUMAN_STYLES.map(s=>s.hair)).size,12)
assert.equal(ids.slice(0,6).filter(id=>HUMAN_STYLES[avatarVariant(id,avatars)].gender==='female').length,3,'default staff mix has men and women')
avatarVariant('guest:extra',avatars);assert.deepEqual(ids.map(id=>avatarVariant(id,avatars)),variants,'existing avatar appearance survives new arrivals')
for(const [index,style] of HUMAN_STYLES.entries()){const rig={...createCompanion('#8aaed9',index,false),phase:0,heading:0,seated:false,greetUntil:2,greetStarted:0};rig.root.scale.setScalar(CHARACTER_SCALE);rig.root.position.set(0,.08,0);poseCompanion(rig,{t:.2,moving:true});rig.root.updateMatrixWorld(true);assert(rig.head.getObjectByName('hairstyle-'+style.hair));assert.equal(rig.root.userData.appearance.gender,style.gender);const scalp=rig.head.getObjectByName('continuous-scalp-hair'),face=rig.head.getObjectByName('human-face');assert(scalp,'every hairstyle has a continuous scalp shell');const center=rig.head.localToWorld(new THREE.Vector3())
 for(const theta of [.05,.3,.6,.9,1.1])for(let azimuth=0;azimuth<16;azimuth++){const phi=(azimuth+.37)/16*Math.PI*2,local=new THREE.Vector3(Math.sin(theta)*Math.cos(phi)*.214,Math.cos(theta)*.244,Math.sin(theta)*Math.sin(phi)*.194).multiplyScalar(4),origin=rig.head.localToWorld(local),direction=center.clone().sub(origin).normalize(),hits=new THREE.Raycaster(origin,direction).intersectObjects([scalp,face]);assert(hits.length&&hits[0].object===scalp,JSON.stringify({style:style.hair,theta,azimuth,hits:hits.map(h=>({name:h.object.name,distance:h.distance}))}))}
 const frontOrigin=rig.head.localToWorld(new THREE.Vector3(0,0,1)),frontHits=new THREE.Raycaster(frontOrigin,center.clone().sub(frontOrigin).normalize()).intersectObjects([scalp,face]);assert(frontHits[0].object===face,'hairline keeps the face and eyes visible');assert(new THREE.Box3().setFromObject(rig.root).max.y<1.62,'every hairstyle clears door lintels');disposeTree(rig.root)}
const moved=layout.furniture.map(f=>f.id==='desk-1'?{...f,x:f.x+.2}:f);assert.notEqual(workstations(moved)[0].heading,stations[0].heading,'desk edits update character orientation')
const nearby={x:0,z:0,room:'studio',walking:true},colleague={x:1,z:0,room:'studio',walking:false};assert(canGreet(nearby,colleague));assert(!canGreet({...nearby,walking:false},colleague));assert(!canGreet(nearby,{...colleague,room:'review'}));assert(!canGreet(nearby,{...colleague,x:4}));assert(Math.abs(facingTurn(Math.PI-.01,-Math.PI+.01,.65))<.03,'gaze follows the shortest angle')
for(const name of ['office-shell.glb','furniture-kit.glb','companion-base.glb','human-variants.glb']){const b=await fs.readFile(new URL('../public/office3d/'+name,import.meta.url));assert.equal(b.toString('utf8',0,4),'glTF');assert.equal(b.readUInt32LE(4),2);assert.equal(b.readUInt32LE(8),b.length);const json=JSON.parse(b.toString('utf8',20,20+b.readUInt32LE(12)).trim());assert(json.meshes.length>0);if(name==='companion-base.glb')assert.deepEqual(json.animations.map(a=>a.name),['Idle','Blink','Wave','Celebrate','Typing','Walk','Nod','Sit'])}
console.log('PASS: character seating/backrest/feet/typing clearance, workstation orientation, greeting eligibility, Planner reference topology,  consultation clock phases/queue/arrival/departure, protected door paths,  layout round-trip, collisions/bounds, malformed imports, timezone filters, status mapping, project filters, empty state and four GLB assets, diverse human appearances and animation clips.')
