import type { Client, ConsultationBooking, Invoice, OrderSubmission, Project, Task, TimelineItem } from '../../types'

export type RoomId = 'studio' | 'planning' | 'consultation' | 'review' | 'reception' | 'waiting'
export type FurnitureKind = 'desk' | 'chair' | 'sofa' | 'table' | 'plant' | 'shelf' | 'board' | 'lamp'
export interface OfficeRoom { id: RoomId; name: string; subtitle: string; color: string; x: number; z: number; width: number; depth: number; doorX: number; doorZ: number; doorSide: 'north'|'south'|'east'|'west'; doors?: {x:number;z:number;side:'north'|'south'|'east'|'west'}[] }
export interface Furniture { id: string; kind: FurnitureKind; room: RoomId; x: number; z: number; rotation: number }
export interface OfficeLayout { version: 1; plan: 3; furniture: Furniture[]; floor: string; wall: string; daylight: number }
export interface OfficeItem { id: string; kind: 'task' | 'booking' | 'order' | 'timeline'; room: RoomId; title: string; subtitle: string; status: string; date?: string; projectId?: string; progress?: number; priority?: string; sourceId: string }
export interface OfficeData { projects: Project[]; tasks: Task[]; bookings: ConsultationBooking[]; clients: Client[]; invoices: Invoice[]; orders: OrderSubmission[]; timelines: Record<string, TimelineItem[]> }

// Adapted from the user's Planner 5D office: central studio, left lounge/service wing,
// two meeting rooms on the right and two front offices. Coordinates are in metres.
export const ROOMS: OfficeRoom[] = [
 {id:'studio',name:'Studio kerja',subtitle:'Open office di pusat denah',color:'#6b9be8',x:.25,z:-2,width:9.5,depth:8,doorX:-2.7,doorZ:2,doorSide:'south',doors:[{x:-4.5,z:-2,side:'west'},{x:-4.5,z:.5,side:'west'},{x:5,z:-3.7,side:'east'},{x:5,z:1,side:'east'},{x:3.1,z:2,side:'south'}]},
 {id:'waiting',name:'Ruang tunggu',subtitle:'Lounge kiri atas',color:'#87b7c5',x:-7.1,z:-3.6,width:4.8,depth:4.8,doorX:-4.7,doorZ:-2,doorSide:'east'},
 {id:'review',name:'Ruang review',subtitle:'Rapat kanan atas',color:'#a18bdd',x:7.2,z:-4.35,width:4,depth:3.3,doorX:5.2,doorZ:-3.7,doorSide:'west'},
 {id:'consultation',name:'Bilik konsultasi',subtitle:'Ruang privat di kanan',color:'#dba286',x:7.2,z:-.15,width:4,depth:4.7,doorX:5.2,doorZ:1,doorSide:'west'},
 {id:'reception',name:'Resepsionis',subtitle:'Pintu masuk depan',color:'#d5b965',x:-1.9,z:4.1,width:5.2,depth:3.8,doorX:-2.7,doorZ:2.2,doorSide:'north',doors:[{x:-2.7,z:6,side:'south'},{x:-4.5,z:3.2,side:'west'}]},
 {id:'planning',name:'Planning lounge',subtitle:'Ruang depan kanan',color:'#75b9a5',x:2.95,z:4.1,width:4.1,depth:3.8,doorX:3.1,doorZ:2.2,doorSide:'north'},
]
export const ENTRY: [number,number] = [-2.7,6.7]
export const CONSULTANT = {x:8.6,z:-.8,heading:-Math.PI/2}
export const GUEST_CHAIR = {x:6.1,z:-.8,heading:Math.PI/2}
export const WAITING_SEATS = Array.from({length:8},(_,i)=>({x:[-8.6,-5.6][i%2],z:Math.round((-5.3+Math.floor(i/2)*.8)*10)/10,rotation:i%2===0?Math.PI/2:-Math.PI/2}))
export const SERVICE_FURNITURE: Furniture[] = [
 {id:'service-table',kind:'table',room:'consultation',x:7.4,z:-.8,rotation:0},
 {id:'service-host',kind:'chair',room:'consultation',x:CONSULTANT.x,z:CONSULTANT.z,rotation:CONSULTANT.heading},
 {id:'service-guest',kind:'chair',room:'consultation',x:GUEST_CHAIR.x,z:GUEST_CHAIR.z,rotation:GUEST_CHAIR.heading},
 ...WAITING_SEATS.map((seat,i)=>({id:'service-wait-'+i,kind:'chair' as const,room:'waiting' as const,...seat})),
]
export const isServiceFurniture = (id:string) => SERVICE_FURNITURE.some(f=>f.id===id)
export const roomDoors = (r:OfficeRoom) => [{x:r.doorX,z:r.doorZ,side:r.doorSide},...(r.doors??[])]
export function circulationAreas(room:RoomId) {
 const r=ROOMS.find(r=>r.id===room)!
 const paths=roomDoors(r).map(d=>({x:d.x+(d.side==='east'?-.45:d.side==='west'?.45:0),z:d.z+(d.side==='south'?-.45:d.side==='north'?.45:0),width:d.side==='east'||d.side==='west'?1.1:1.4,depth:d.side==='east'||d.side==='west'?1.4:1.1}))
 if(room==='studio')paths.push({x:.25,z:.9,width:9.5,depth:1.35},{x:-3.6,z:-.4,width:1.4,depth:3.8},{x:4.1,z:-1.4,width:1.35,depth:5.9},{x:-2.7,z:1.55,width:1.4,depth:1.3},{x:3.1,z:1.55,width:1.4,depth:1.3})
 if(room==='reception')paths.push({x:-2.7,z:4.1,width:1.4,depth:3.8},{x:-3.6,z:3.2,width:1.8,depth:1.25})
 if(room==='consultation')paths.push({x:5.9,z:.4,width:1.4,depth:2.6})
 if(room==='waiting')paths.push({x:-7.1,z:-3.6,width:1.25,depth:4.8},{x:-6.3,z:-2,width:3.2,depth:.9})
 return paths
}
export const FURNITURE: Record<FurnitureKind, { name: string; width: number; depth: number }> = {
  desk: { name: 'Meja kerja', width: 1.65, depth: .85 }, chair: { name: 'Kursi', width: .68, depth: .7 },
  sofa: { name: 'Sofa', width: 1.9, depth: .85 }, table: { name: 'Meja bundar', width: 1.1, depth: 1.1 },
  plant: { name: 'Tanaman', width: .65, depth: .65 }, shelf: { name: 'Rak buku', width: 1.25, depth: .4 },
  board: { name: 'Papan rencana', width: 1.6, depth: .4 }, lamp: { name: 'Lampu', width: .5, depth: .5 },
}
export function freshLayout(): OfficeLayout {
  const f = (id: string, kind: FurnitureKind, room: RoomId, x: number, z: number, rotation = 0): Furniture => ({ id, kind, room, x, z, rotation })
  return {version:1,plan:3,floor:'#bda58b',wall:'#e5e7ed',daylight:16,furniture:[
    f('desk-1','desk','studio',-1.5,-4.8),f('chair-1','chair','studio',-1.5,-3.8),f('desk-2','desk','studio',1.5,-4.8),f('chair-2','chair','studio',1.5,-3.8),
    f('desk-3','desk','studio',-1.5,-2.3),f('chair-3','chair','studio',-1.5,-1.3),f('desk-4','desk','studio',1.5,-2.3),f('chair-4','chair','studio',1.5,-1.3),
    f('shelf-1','shelf','studio',.1,-5.6),f('plant-1','plant','studio',-3.7,-5.3),
    f('review-table','table','review',7.3,-4.9),f('review-chair-1','chair','review',6,-4.9,Math.PI/2),f('review-chair-2','chair','review',8.5,-4.9,-Math.PI/2),
    f('planning-sofa','sofa','planning',2.4,4),f('planning-table','table','planning',2.4,5.2),f('planning-board','board','planning',4.4,4.4,Math.PI/2),
    f('reception-desk','desk','reception',-.5,4.2),f('reception-chair','chair','reception',-.5,3.2,Math.PI),f('reception-plant','plant','reception',-3.8,5.2),
    f('consult-plant','plant','consultation',8.6,-2),...SERVICE_FURNITURE.map(f=>({...f})),
  ]}
}

export function footprint(item: Furniture) {
  const spec = FURNITURE[item.kind], turn = Math.abs(Math.sin(item.rotation)) > .5
  return { width: turn ? spec.depth : spec.width, depth: turn ? spec.width : spec.depth }
}
export function placementError(item: Furniture, items: Furniture[]): string | null {
  const room = ROOMS.find(r => r.id === item.room)
  if (!room || !Number.isFinite(item.x) || !Number.isFinite(item.z) || !Number.isFinite(item.rotation)) return 'Posisi tidak valid.'
  const a = footprint(item), gap = .07
  if (Math.abs(item.x-room.x)+a.width/2 > room.width/2-gap || Math.abs(item.z-room.z)+a.depth/2 > room.depth/2-gap) return 'Furnitur harus tetap di dalam bilik.'
  if (!isServiceFurniture(item.id) && circulationAreas(item.room).some(p=>Math.abs(item.x-p.x)<(a.width+p.width)/2 && Math.abs(item.z-p.z)<(a.depth+p.depth)/2)) return 'Jalur pintu dan sirkulasi harus tetap kosong.'
  if (items.some(other => { if (other.id === item.id) return false; const b = footprint(other); return Math.abs(item.x-other.x)<(a.width+b.width)/2+gap && Math.abs(item.z-other.z)<(a.depth+b.depth)/2+gap })) return 'Posisi bertabrakan dengan furnitur lain.'
  return null
}
export const snap = (n: number) => Math.round(n*10)/10
export function readLayout(input: unknown): OfficeLayout {
  if (!input || typeof input !== 'object') throw new Error('Format tata ruang tidak valid.')
  const value = input as Record<string, unknown>
  if (value.version !== 1 || !Array.isArray(value.furniture) || value.furniture.length > 100 || !/^#[0-9a-f]{6}$/i.test(String(value.floor)) || !/^#[0-9a-f]{6}$/i.test(String(value.wall)) || typeof value.daylight !== 'number' || !Number.isFinite(value.daylight) || value.daylight < 6 || value.daylight > 23) throw new Error('Versi, material, atau pencahayaan tata ruang tidak valid.')
  if(value.plan!==3){
    if(value.plan!==undefined&&value.plan!==2)throw new Error('Versi denah tidak dikenal.')
    const previous:Record<string,[number,number,number,number]>=value.plan===2?{studio:[-9,-6,10,8],review:[0,-6,6,8],consultation:[9,-6,10,8],planning:[-9,6,10,8],reception:[0,6,6,8],waiting:[9,6,10,8]}:{studio:[-4.7,-2.6,7.8,5.8],review:[3.9,-3.55,7.6,3.9],planning:[-5.4,3.5,6.4,5.2],consultation:[4.9,2.7,5.6,6.8],reception:[.25,3.6,3.6,5]}
    const migrated:Furniture[]=freshLayout().furniture,seen=new Set<string>()
    for(const raw of value.furniture){const f=raw as Furniture,room=ROOMS.find(r=>r.id===f?.room),old=previous[f?.room]
      if(!old||!room||typeof f.id!=='string'||!f.id||f.id.length>100||seen.has(f.id)||!Number.isFinite(f.x)||!Number.isFinite(f.z)||!Number.isFinite(f.rotation)||!Object.prototype.hasOwnProperty.call(FURNITURE,f.kind))throw new Error('Furnitur lama tidak valid.')
      seen.add(f.id);if(f.id.startsWith('service-')||migrated.some(item=>item.id===f.id))continue
      const next={...f,x:snap(room.x+(f.x-old[0])*room.width/old[2]),z:snap(room.z+(f.z-old[1])*room.depth/old[3])}
      if(!placementError(next,migrated))migrated.push(next)
    }
    return readLayout({...value,plan:3,furniture:migrated})
  }
  const ids = new Set<string>(), furniture: Furniture[] = []
  for (const raw of value.furniture) {
    if (!raw || typeof raw !== 'object') throw new Error('Furnitur tidak valid.')
    const f = raw as Furniture
    if (typeof f.id !== 'string' || !f.id || f.id.length>100 || ids.has(f.id) || !Object.prototype.hasOwnProperty.call(FURNITURE,f.kind) || !ROOMS.some(r=>r.id===f.room) || typeof f.x!=='number' || typeof f.z!=='number' || typeof f.rotation!=='number') throw new Error('Identitas furnitur tidak valid.')
    const clean: Furniture = { id:f.id,kind:f.kind,room:f.room,x:snap(f.x),z:snap(f.z),rotation:Math.round((f.rotation%(Math.PI*2))/(Math.PI/2))*(Math.PI/2) }
    const error=placementError(clean,furniture); if(error) throw new Error(`${FURNITURE[f.kind].name}: ${error}`)
    furniture.push(clean);ids.add(f.id)
  }
  for(const fixed of SERVICE_FURNITURE)if(!furniture.some(f=>f.id===fixed.id&&f.kind===fixed.kind&&f.room===fixed.room&&f.x===fixed.x&&f.z===fixed.z&&f.rotation===fixed.rotation))throw new Error('Kursi layanan dan ruang tunggu harus tetap tersedia.')
  return { version:1,plan:3,furniture,floor:String(value.floor),wall:String(value.wall),daylight:value.daylight }
}
export function localDay(value?: string): string | null {
  if (!value) return null
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value
  const d = new Date(value)
  return Number.isNaN(+d) ? null : `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}
export function officeItems(data: OfficeData, project: string, date: string): OfficeItem[] {
  const matches = (id?: string, at?: string) => (!project || id===project) && (!date || localDay(at)===date)
  const items: OfficeItem[] = data.tasks.filter(t=>t.status!=='Completed' && matches(t.projectId,t.dueAt ?? undefined)).map(t=>({id:'task:'+t.id,sourceId:t.id,kind:'task',room:t.status==='In Progress'?'studio':t.status==='Review'?'review':'planning',title:t.name,subtitle:t.project,status:t.status,date:t.dueAt ?? undefined,projectId:t.projectId,progress:t.progress,priority:t.priority}))
  if (!project) {
    for (const b of data.bookings) if (b.status!=='Cancelled' && b.status!=='Completed' && matches(undefined,b.startsAt)) items.push({id:'booking:'+b.id,sourceId:b.id,kind:'booking',room:'consultation',title:b.name,subtitle:b.topic,status:b.status,date:b.startsAt})
  }
  for (const o of data.orders) if (['New','Reviewing'].includes(o.status) && matches(o.projectId,o.createdAt)) items.push({id:'order:'+o.id,sourceId:o.id,kind:'order',room:'reception',title:o.submitterName,subtitle:o.orderFormTitle,status:o.status,date:o.createdAt,projectId:o.projectId})
  for (const [projectId, timeline] of Object.entries(data.timelines)) for (const t of timeline) if(t.state!=='done' && matches(projectId,t.occurredAt)) items.push({id:'timeline:'+projectId+':'+(t.id??t.title),sourceId:t.id??'',kind:'timeline',room:'planning',title:t.title,subtitle:data.projects.find(p=>p.id===projectId)?.name??'Agenda proyek',status:t.state,date:t.occurredAt,projectId})
  return items.sort((a,b)=>(a.date?Date.parse(a.date):Infinity)-(b.date?Date.parse(b.date):Infinity))
}

export type GuestPhase = 'waiting' | 'entering' | 'consulting' | 'leaving'
export interface ConsultationGuest { id:string; name:string; phase:GuestPhase; seat:number; startsAt:number; endsAt:number; phaseStarted:number; duration:number; path:[number,number][]; seated:boolean; x:number; z:number; heading:number }
export function pointOnPath(path:[number,number][],progress:number) {
  const lengths=path.slice(1).map((p,i)=>Math.hypot(p[0]-path[i][0],p[1]-path[i][1])),total=lengths.reduce((a,b)=>a+b,0)
  let distance=Math.max(0,Math.min(1,progress))*total
  for(let i=0;i<lengths.length;i++){if(distance<=lengths[i]||i===lengths.length-1){const a=path[i],b=path[i+1],f=lengths[i]?distance/lengths[i]:1;return {x:a[0]+(b[0]-a[0])*f,z:a[1]+(b[1]-a[1])*f,heading:Math.atan2(b[0]-a[0],b[1]-a[1])}}distance-=lengths[i]}
  return {x:path[0][0],z:path[0][1],heading:0}
}
export function consultationGuests(bookings:ConsultationBooking[],now:number):ConsultationGuest[] {
  const today=localDay(new Date(now).toISOString());let busyUntil=-Infinity
  const scheduled=bookings.filter(b=>!['Cancelled','Completed'].includes(b.status)&&localDay(b.startsAt)===today&&Number.isFinite(Date.parse(b.endsAt))&&Date.parse(b.endsAt)>Date.parse(b.startsAt)&&(!b.createdAt||Date.parse(b.createdAt)<=now)).sort((a,b)=>Date.parse(a.startsAt)-Date.parse(b.startsAt)||a.id.localeCompare(b.id))
  return scheduled.flatMap((b,index)=>{
    const start=Date.parse(b.startsAt),end=Date.parse(b.endsAt),serviceStart=Math.max(start,busyUntil);busyUntil=Math.max(busyUntil,end)
    if(now>=end+22000)return []
    const seat=index%WAITING_SEATS.length,spot=WAITING_SEATS[seat]
    // Overflow visitors stand along the outer waiting-room wall instead of sharing a chair.
    const waiting:[number,number]=index<WAITING_SEATS.length?[spot.x,spot.z]:[-7.1,-5.3+((index-WAITING_SEATS.length)%5)*.65]
    const approach:[number,number][]=[waiting,[-7.1,waiting[1]],[-7.1,-2],[-4.7,-2],[-4.5,-2],[-3.6,-2],[-3.6,.9],[4.1,.9],[5,1],[5.2,1],[6.1,1]]
    const entryPath:[number,number][]=[...approach,[GUEST_CHAIR.x,GUEST_CHAIR.z]]
    const canServe=serviceStart<end,arrival=Math.min(12000,Math.max(0,(end-serviceStart)/2))
    let phase:GuestPhase='waiting',path:[number,number][]=[waiting],phaseStarted=start,duration=1,seated=index<WAITING_SEATS.length
    if(now>=end){phase='leaving';phaseStarted=end;duration=22000;seated=false;path=canServe?[[GUEST_CHAIR.x,GUEST_CHAIR.z],[6.1,1],[5.2,1],[5,1],[4.1,.9],[-2.7,.9],[-2.7,2],[-2.7,2.2],[-2.7,6],ENTRY]:[...approach.slice(0,7),[-2.7,.9],[-2.7,2],[-2.7,2.2],[-2.7,6],ENTRY]}
    else if(now>=serviceStart&&canServe){if(now<serviceStart+arrival){phase='entering';path=entryPath;phaseStarted=serviceStart;duration=arrival;seated=false}else{phase='consulting';path=[[GUEST_CHAIR.x,GUEST_CHAIR.z]];phaseStarted=serviceStart+arrival;seated=true}}
    const position=pointOnPath(path,(now-phaseStarted)/duration)
    if(phase==='waiting')position.heading=spot.rotation
    if(phase==='consulting')position.heading=GUEST_CHAIR.heading
    return [{id:b.id,name:b.name,phase,seat,startsAt:start,endsAt:end,phaseStarted,duration,path,seated,...position}]
  })
}

export const CHARACTER_SCALE=.7
export const CHAIR_TOP=.07+.53+.06
export const SOFA_TOP=.07+.6+.08
// Pelvis underside stays above the cushion; knees and feet are posed separately.
export const seatedHeight=(surface=CHAIR_TOP)=>surface+.007
export interface Workstation { deskId:string; chairId:string; x:number; z:number; heading:number; deskHeading:number }
export function workstations(furniture:Furniture[]):Workstation[] {
 const used=new Set<string>(),result:Workstation[]=[]
 for(const desk of furniture.filter(f=>f.kind==='desk')){
  const chair=furniture.filter(f=>f.kind==='chair'&&f.room===desk.room&&!used.has(f.id)&&!isServiceFurniture(f.id)).sort((a,b)=>Math.hypot(a.x-desk.x,a.z-desk.z)-Math.hypot(b.x-desk.x,b.z-desk.z))[0]
  if(!chair)continue
  const distance=Math.hypot(chair.x-desk.x,chair.z-desk.z);if(distance<.7||distance>1.8)continue
  const heading=Math.atan2(desk.x-chair.x,desk.z-chair.z)
  // Pull a loose workstation chair up to the desk, maintaining a .075 m gap.
  const pull=Math.max(0,distance-.85)
  result.push({deskId:desk.id,chairId:chair.id,x:chair.x+Math.sin(heading)*pull,z:chair.z+Math.cos(heading)*pull,heading,deskHeading:Math.atan2(chair.x-desk.x,chair.z-desk.z)})
  used.add(chair.id)
 }
 return result
}
export function facingTurn(from:number,to:number,max:number){const difference=Math.atan2(Math.sin(to-from),Math.cos(to-from));return Math.max(-max,Math.min(max,difference))}
export function canGreet(a:{x:number;z:number;room:RoomId;walking:boolean},b:{x:number;z:number;room:RoomId;walking:boolean}){const distance=Math.hypot(a.x-b.x,a.z-b.z);return (a.walking||b.walking)&&a.room===b.room&&distance>.65&&distance<2.4}

// Visual avatar styles are independent of a real person's gender; booking data has no gender field.
export function avatarVariant(key:string,assigned:Map<string,number>):number {
 const existing=assigned.get(key);if(existing!==undefined)return existing
 const preferred:Record<string,number>={'chair-1':0,'chair-2':1,'chair-3':2,'chair-4':3,'review-chair-1':4,'review-chair-2':5,'reception-chair':6,consultant:7,'planning-sofa':9}
 let hash=2166136261;for(const c of key)hash=Math.imul(hash^c.charCodeAt(0),16777619)>>>0
 const base=preferred[key]??hash%12,used=new Set(assigned.values());let variant=base
 for(let offset=0;used.has(variant)&&offset<12;offset++)variant=(base+offset+1)%12
 if(used.has(variant)){variant=12+hash%4096;while(used.has(variant))variant++}
 assigned.set(key,variant);return variant
}
