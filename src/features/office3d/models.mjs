// Original procedural assets for Nayagement. No Sael or Munder source/assets are bundled.
import * as T from 'three'
const material = (color, roughness=.72) => new T.MeshStandardMaterial({color,roughness})
export function rounded(w,h,d,r=.06) {
  r=Math.min(r,w/3,h/3,d/3); const s=new T.Shape(),x=-w/2,y=-h/2
  s.moveTo(x+r,y);s.lineTo(x+w-r,y);s.quadraticCurveTo(x+w,y,x+w,y+r);s.lineTo(x+w,y+h-r);s.quadraticCurveTo(x+w,y+h,x+w-r,y+h);s.lineTo(x+r,y+h);s.quadraticCurveTo(x,y+h,x,y+h-r);s.lineTo(x,y+r);s.quadraticCurveTo(x,y,x+r,y)
  const geo=new T.ExtrudeGeometry(s,{depth:d-r*2,bevelEnabled:true,bevelSegments:2,steps:1,bevelSize:r*.45,bevelThickness:r,curveSegments:4});geo.translate(0,0,-d/2+r);geo.computeVertexNormals();return geo
}
const box=(group,mat,x,y,z,w,h,d,r=.04)=>{const m=new T.Mesh(r?rounded(w,h,d,r):new T.BoxGeometry(w,h,d),mat);m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;group.add(m);return m}
const sphere=(group,mat,x,y,z,sx,sy=sx,sz=sx)=>{const m=new T.Mesh(new T.SphereGeometry(1,20,14),mat);m.position.set(x,y,z);m.scale.set(sx,sy,sz);m.castShadow=true;group.add(m);return m}
const cylinder=(group,mat,x,y,z,r,h)=>{const m=new T.Mesh(new T.CylinderGeometry(r,r,h,16),mat);m.position.set(x,y,z);m.castShadow=true;group.add(m);return m}
export function createFurniture(kind,color='#8ca8ca') {
 const g=new T.Group();g.name='furniture-'+kind
 const wood=material('#b69375'),dark=material('#445064'),metal=material('#d6dce6',.4),fabric=material(color,.96),paper=material('#f3f1e9'),leaf=material('#659b7b')
 if(kind==='desk') {
  box(g,wood,0,.81,0,1.65,.09,.85)
  for(const x of [-.68,.68]) for(const z of [-.31,.31])box(g,metal,x,.4,z,.055,.78,.055,.01)
  box(g,dark,.1,1.18,-.15,.64,.43,.055);box(g,new T.MeshStandardMaterial({color:'#a9c8e9',emissive:'#7197cc',emissiveIntensity:.18}),.1,1.18,-.115,.56,.34,.01,.02)
  box(g,metal,.1,.93,-.15,.045,.2,.045,.01);box(g,dark,0,.87,.27,.68,.025,.23,.01)
  for(let row=0;row<3;row++)for(let col=0;col<8;col++)box(g,metal,-.28+col*.08,.887,.20+row*.065,.044,.008,.04,.003)
  box(g,paper,-.52,.88,.12,.27,.018,.32,.01);cylinder(g,material('#ddd0bd'),.57,.94,.12,.07,.17)
 } else if(kind==='chair') {
  box(g,fabric,0,.53,0,.64,.12,.61,.08);box(g,fabric,0,.88,-.25,.63,.62,.12,.07)
  cylinder(g,dark,0,.26,0,.035,.45);for(const angle of [0,1.25,2.5,3.75,5]) {const leg=box(g,dark,Math.sin(angle)*.16,.07,Math.cos(angle)*.16,.055,.045,.35,.01);leg.rotation.y=angle}
 } else if(kind==='sofa') {
  box(g,fabric,0,.31,0,1.9,.5,.85,.12);box(g,fabric,0,.74,-.31,1.9,.65,.19,.09)
  for(const x of [-.88,.88])box(g,fabric,x,.62,0,.19,.44,.85,.08)
  for(const x of [-.46,.46]){box(g,material('#e3dfd6'),x,.6,.02,.74,.16,.6,.06);const pillow=box(g,material(x<0?'#c6d8e4':'#d5b4a2'),x,.84,-.17,.41,.37,.13,.06);pillow.rotation.z=x<0?.12:-.12}
 } else if(kind==='table') {
  cylinder(g,wood,0,.62,0,.55,.075);cylinder(g,metal,0,.3,0,.055,.6);cylinder(g,metal,0,.035,0,.33,.04)
  box(g,paper,.08,.68,.08,.24,.015,.3,.01);cylinder(g,material('#e5cab8'),-.18,.73,-.1,.065,.15)
 } else if(kind==='plant') {
  const pot=new T.Mesh(new T.CylinderGeometry(.23,.17,.38,20),material('#e5d3bf'));pot.position.y=.19;pot.castShadow=true;g.add(pot)
  for(let i=0;i<7;i++){const a=i*2.4;const l=sphere(g,leaf,Math.sin(a)*.16,.65+i*.065,Math.cos(a)*.16,.11,.36,.065);l.rotation.z=Math.sin(a)*.5;l.rotation.x=Math.cos(a)*.45}
 } else if(kind==='shelf') {
  for(const x of [-.59,.59])box(g,wood,x,.82,0,.07,1.64,.4,.01)
  for(const y of [.1,.64,1.18,1.65])box(g,wood,0,y,0,1.25,.065,.4,.01)
  for(let row=0;row<3;row++) for(let i=0;i<6;i++){const colors=['#a7bbc7','#d2b5a0','#a9b9a2','#cfbdd9','#dfd6bc','#8a9db8'];box(g,material(colors[i]),-.44+i*.16,.29+row*.53,.02,.115,.32+(i%3)*.05,.24,.01)}
 } else if(kind==='board') {
  box(g,wood,0,1.24,0,1.6,1,.1);box(g,paper,0,1.24,.06,1.48,.88,.015,.01)
  for(const x of [-.58,.58])box(g,metal,x,.38,0,.05,.76,.05,.01)
  for(let i=0;i<6;i++)box(g,material(['#9bbce3','#c3b1db','#a7cdbd'][i%3]),-.47+(i%3)*.46,1.45-Math.floor(i/3)*.35,.083,.31,.24,.012,.01)
 } else if(kind==='lamp') {
  cylinder(g,dark,0,.04,0,.23,.07);cylinder(g,metal,0,.85,0,.025,1.65)
  const shade=new T.Mesh(new T.ConeGeometry(.28,.4,24,1,true),material('#e8d5b7'));shade.position.y=1.65;shade.castShadow=true;g.add(shade)
  sphere(g,new T.MeshStandardMaterial({color:'#fff0cc',emissive:'#ffc878',emissiveIntensity:.7}),0,1.5,0,.07)
 }
 return g
}
// A continuous scalp shell follows the head ellipsoid, with a higher front hairline.
// Flattened hair blobs alone expose the skin at the crown, especially from above.
function scalpShell(material) {
 const positions=[],indices=[],segments=48,rows=24
 for(let row=0;row<=rows;row++)for(let i=0;i<=segments;i++){const phi=i/segments*Math.PI*2,front=Math.max(0,Math.sin(phi)),back=Math.max(0,-Math.sin(phi)),theta=row/rows*(1.9-.75*front+.15*back);positions.push(Math.sin(theta)*Math.cos(phi)*.214,Math.cos(theta)*.244,Math.sin(theta)*Math.sin(phi)*.194)}
 for(let row=0;row<rows;row++)for(let i=0;i<segments;i++){const a=row*(segments+1)+i,b=a+segments+1,c=b+1,d=a+1;indices.push(a,c,b,a,d,c)}
 const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));geometry.setIndex(indices);const normals=[];for(let i=0;i<positions.length;i+=3){const normal=new T.Vector3(positions[i]/(.214*.214),positions[i+1]/(.244*.244),positions[i+2]/(.194*.194)).normalize();normals.push(normal.x,normal.y,normal.z)}geometry.setAttribute('normal',new T.Float32BufferAttribute(normals,3));const mesh=new T.Mesh(geometry,material);mesh.name='continuous-scalp-hair';mesh.castShadow=true;return mesh
}
export const HUMAN_STYLES = [
 {gender:'male',hair:'crop'},{gender:'female',hair:'bob'},
 {gender:'male',hair:'side-part'},{gender:'female',hair:'ponytail'},
 {gender:'male',hair:'quiff'},{gender:'female',hair:'bun'},
 {gender:'male',hair:'curls'},{gender:'female',hair:'pixie'},
 {gender:'male',hair:'swept'},{gender:'female',hair:'waves'},
 {gender:'male',hair:'textured'},{gender:'female',hair:'braid'},
]
export function createCompanion(color='#8aaed9',variant=0,_detail=true) {
 const style=HUMAN_STYLES[((variant%12)+12)%12],variation=Math.floor(variant/12)%4;
 const root=new T.Group();root.name='human-office-character';root.userData.appearance={...style,variant};const body=new T.Group();body.name='human-upper-body';root.add(body)
 const skin=material(['#edc2a0','#c28d68','#a96e4b','#e3b18e','#8b593f'][variant%5],.85),shirt=material(color,.95),pants=material('#34475c',.9),shoe=material('#293544',.7),hair=material(['#302927','#704b32','#28282e','#805c3a','#47352e','#a87946'][Math.floor(variant/2)%6],.9)
 box(body,pants,0,.15,0,.35,.2,.25,.065).name='pelvis'
 box(body,shirt,0,.43,0,.43,.47,.25,.085).name='shirt-torso'
 cylinder(body,skin,0,.73,0,.065,.16)
 const trim=material('#e8edf2');if(style.gender==='male'){for(const x of [-.075,.075]){const collar=box(body,trim,x,.64,.125,.10,.065,.025,.012);collar.rotation.z=x<0?-.3:.3}}else{const neckline=new T.Mesh(new T.TorusGeometry(.075,.012,6,16,Math.PI),trim);neckline.position.set(0,.64,.13);neckline.rotation.z=Math.PI;body.add(neckline)}
 for(const y of [.31,.41,.51])sphere(body,trim,0,y,.135,.012,.012,.008)
 const head=new T.Group();head.name='human-head';head.position.y=.98;body.add(head)
 sphere(head,skin,0,0,0,.205,.235,.185).name='human-face'
 for(const x of [-.205,.205])sphere(head,skin,x,-.015,0,.035,.055,.035)
 const hairstyle=new T.Group();hairstyle.name='hairstyle-'+style.hair;hairstyle.userData={...style};head.add(hairstyle)
 const scalp=scalpShell(hair);hairstyle.add(scalp);const cap=()=>scalp
 const lock=(x,y,z,w,h,d,angle=0)=>{const piece=sphere(hairstyle,hair,x,y,z,w,h,d);piece.rotation.z=angle;return piece}
 const length=1+variation*.06
 switch(style.hair){
  case 'crop':cap(.10);for(const x of [-.15,.15])lock(x,.07,-.05,.06,.09,.12);break
  case 'bob':cap();for(const x of [-.17,.17])lock(x,-.035,-.015,.072,.19*length,.14);lock(0,-.06,-.17,.18,.19,.07);lock(-.09,.13,.13,.115,.06,.055,-.12);break
  case 'side-part':cap(.10);lock(-.08,.145,.085,.14,.07,.10,.20);lock(.14,.10,.08,.055,.07,.09,-.20);break
  case 'ponytail':cap(.105);lock(0,.01,-.22,.105,.12,.085);lock(0,-.15,-.25,.075,.19*length,.075,.18);lock(.10,.13,.12,.10,.055,.05,.2);break
  case 'quiff':cap(.10);lock(.025,.17,.055,.15,.07,.12,-.17);lock(-.13,.10,-.025,.06,.085,.12);break
  case 'bun':cap(.105);lock(0,.13,-.21,.095,.10,.085);lock(-.1,.12,.11,.11,.055,.055,-.15);break
  case 'curls':for(let row=0;row<3;row++)for(let i=0;i<9;i++){const angle=i/9*Math.PI*2;lock(Math.cos(angle)*(.12+row*.025),.13-row*.055,Math.sin(angle)*.14-.025,.065,.075,.065)}break
  case 'pixie':cap(.095);lock(.09,.12,.10,.12,.07,.07,-.3);lock(-.17,.035,0,.045,.10,.10);break
  case 'swept':cap(.09);for(let i=0;i<4;i++)lock(-.12+i*.07,.14,.04-i*.025,.08,.065,.115,.32);break
  case 'waves':cap();for(const x of [-.17,.17])for(let i=0;i<4;i++)lock(x+Math.sin(i*1.5)*.017,-.005-i*.065,-.07,.068,.09,.11,Math.sin(i)*.12);lock(-.09,.13,.12,.12,.055,.055,.12);break
  case 'textured':cap(.08);for(let i=0;i<7;i++)lock(-.15+i*.05,.15+(i%2)*.015,-.01,.047,.065,.13,(i%3-1)*.16);break
  case 'braid':cap(.105);for(let i=0;i<5;i++)lock(.13+(i%2)*.015,-.05-i*.055,-.18,.05-i*.003,.05,.05);lock(-.08,.125,.12,.12,.06,.05,-.12);break
 }
 sphere(head,skin,0,-.025,.185,.036,.045,.045)
 const eyes=[];for(const x of [-.073,.073]){const eye=sphere(head,material('#24303c'),x,.025,.173,.018,.026,.014);eye.geometry.scale(.018,.026,.014);eye.scale.set(1,1,1);eye.name=x<0?'left-eye':'right-eye';eyes.push(eye);const brow=box(head,hair,x,.079,.166,.055,.013,.015,.004);brow.rotation.z=x<0?.08:-.08}
 const smile=new T.Mesh(new T.TorusGeometry(.038,.006,6,16,Math.PI*.8),material('#ad655c'));smile.position.set(0,-.087,.173);smile.rotation.z=Math.PI*1.1;head.add(smile)
 const arms=[],elbows=[],hands=[]
 for(const [i,x] of [-.265,.265].entries()){const arm=new T.Group();arm.name=i?'right-upper-arm':'left-upper-arm';arm.position.set(x,.68,0);sphere(arm,shirt,0,-.13,0,.085,.155,.085);body.add(arm)
  const elbow=new T.Group();elbow.name=i?'right-elbow':'left-elbow';elbow.position.y=-.26;sphere(elbow,skin,0,-.13,0,.058,.15,.058);arm.add(elbow)
  const hand=new T.Group();hand.name=i?'right-hand':'left-hand';hand.position.y=-.29;box(hand,skin,0,-.025,0,.10,.12,.05,.025)
  for(let finger=0;finger<4;finger++)sphere(hand,skin,-.036+finger*.024,-.096,0,.011,.04,.019)
  const thumb=sphere(hand,skin,i?-.06:.06,-.03,.008,.022,.045,.024);thumb.rotation.z=i?-.45:.45;elbow.add(hand);arms.push(arm);elbows.push(elbow);hands.push(hand)
 }
 const legs=[],shins=[],feet=[]
 for(const [i,x] of [-.105,.105].entries()){const leg=new T.Group();leg.name=i?'right-thigh':'left-thigh';leg.position.set(x,1.06,0);sphere(leg,pants,0,-.21,0,.092,.23,.095);root.add(leg)
  const shin=new T.Group();shin.name=i?'right-knee-and-shin':'left-knee-and-shin';shin.position.y=-.42;sphere(shin,pants,0,-.27,0,.073,.30,.075);leg.add(shin)
  const foot=new T.Group();foot.name=i?'right-shoe':'left-shoe';foot.position.y=-.58;box(foot,shoe,0,.01,.07,.16,.13,.30,.045);box(foot,material('#d7dce1'),0,-.047,.075,.165,.028,.30,.012);shin.add(foot);legs.push(leg);shins.push(shin);feet.push(foot)
 }
 return {root,body,head,eyes,arms,elbows,hands,legs,shins,feet}
}
export function createOfficeShell(rooms,floor='#d4c6b3',wall='#e5e7ed') {
 const g=new T.Group();g.name='nayagement-office';const base=material('#d8dee8'),wood=material(floor),walls=material(wall),trim=material('#fafaf7'),route=material('#87aeb5')
 // Planner reference footprint: main block plus upper-right meeting-room wing.
 box(g,base,-2.25,-.25,0,15.1,.48,12.6,.1);box(g,base,7.3,-.25,-1.9,4.4,.48,8.8,.1)
 box(g,base,-2.7,-.25,6.45,2.6,.48,1.2,.1)
 const plankFloor=(x,z,w,d,color)=>{box(g,material(color),x,.018,z,w,.055,d,.02);for(let i=0;i<Math.floor(w/.4);i++)box(g,material(new T.Color(color).multiplyScalar(.88)),x-w/2+.2+i*.4,.049,z,.007,.003,d,0)}
 const panel=(a,b,side,pos,height)=>{if(b-a<.03)return;if(side==='north'||side==='south')box(g,walls,(a+b)/2,height/2,pos,b-a,height,.12);else box(g,walls,pos,height/2,(a+b)/2,.12,height,b-a)}
 for(const room of rooms){const color=new T.Color(floor).lerp(new T.Color(room.color),.07);plankFloor(room.x,room.z,room.width,room.depth,color)
  const left=room.x-room.width/2,right=room.x+room.width/2,back=room.z-room.depth/2,front=room.z+room.depth/2,doors=[{x:room.doorX,z:room.doorZ,side:room.doorSide},...(room.doors||[])]
  for(const side of ['north','south','east','west']){const horizontal=side==='north'||side==='south',min=horizontal?left:back,max=horizontal?right:front,pos=side==='north'?back:side==='south'?front:side==='west'?left:right;const cuts=doors.filter(d=>d.side===side).map(d=>horizontal?d.x:d.z).sort((a,b)=>a-b);let cursor=min;const height=side==='north'&&back<=-5.9?1.9:.85
    for(const cut of cuts){panel(cursor,cut-.7,side,pos,height);cursor=cut+.7}panel(cursor,max,side,pos,height)
  }
  for(const d of doors){const portal=new T.Group();portal.position.set(d.x,0,d.z);if(d.side==='east'||d.side==='west')portal.rotation.y=Math.PI/2
    for(const x of [-.75,.75])box(portal,trim,x,.85,0,.08,1.7,.16)
    box(portal,material(room.color),0,1.67,0,1.58,.1,.16);box(portal,material(room.color),0,.064,0,1.4,.02,.28)
    // Sliding leaf parks along the wall, keeping turns beside the doorway clear.
    box(portal,material(room.color),-1.05,.43,0,.6,.85,.04);g.add(portal)
  }
 }
 // Fixed support spaces from the reference's left service wing: pantry and washrooms.
 plankFloor(-7.1,.3,4.8,2.6,new T.Color(floor).multiplyScalar(.94));plankFloor(-7.1,3.9,4.8,4.2,'#d5d9d7')
 const wallLine=(x,z,w,d)=>box(g,walls,x,.45,z,w,.9,d)
 wallLine(-9.5,2.4,.12,7.2);wallLine(-7.1,-1.1,4.8,.12);wallLine(-7.1,1.7,4.8,.12);wallLine(-7.1,6,4.8,.12)
 // Support-space doors align with the studio and reception-side doors.
 for(const [start,end] of [[-1.1,-.2],[1.2,2.5],[3.9,6]])wallLine(-4.7,(start+end)/2,.12,end-start)
 box(g,material('#d8d7cd'),-8.95,.46,.25,.75,.9,2.1);box(g,material('#48525a'),-8.95,.94,.25,.85,.07,2.15)
 box(g,material('#f5f4ef'),-8.95,1.03,-.2,.48,.08,.48);cylinder(g,material('#88949c'),-8.95,1.14,-.2,.13,.08)
 for(const z of [2.4,3.8,5.2]){wallLine(-7.4,z,4.1,.08);box(g,material('#f6f7f5'),-8.6,.37,z+.5,.5,.7,.7,.1);box(g,material('#c2d7dd'),-8.6,.73,z+.5,.4,.04,.36)}
 // Shaded windows follow the outer north facade and meeting-room wing.
 for(const x of [-8,-6.2,-2.5,-.2,2.2,6.2,8.1]){box(g,trim,x,1.15,-5.9,1.3,1.05,.07);box(g,material('#b7d0d7',.25),x,1.15,-5.85,1.18,.94,.025);for(let row=0;row<5;row++)box(g,wood,x,.8+row*.17,-5.8,1.2,.045,.04,.005)}
 const arrow=(x,z,rotation=0)=>{const a=new T.Group();a.position.set(x,.075,z);a.rotation.y=rotation;box(a,route,0,0,0,.06,.012,.42,.005);for(const sign of [-1,1]){const wing=box(a,route,sign*.08,0,-.15,.05,.012,.2,.005);wing.rotation.y=sign*-.7}g.add(a)}
 for(const z of [5.5,4,2.7])arrow(-2.7,z)
 for(const x of [-1.8,.3,2.5])arrow(x,.9,Math.PI/2)
 arrow(-3.6,-.5);arrow(4.1,-2)
 return g
}

export function disposeTree(root) {const geometries=new Set(),materials=new Set(),textures=new Set();root.traverse(o=>{if(o.geometry)geometries.add(o.geometry);for(const m of o.material?(Array.isArray(o.material)?o.material:[o.material]):[]){materials.add(m);for(const value of Object.values(m))if(value?.isTexture)textures.add(value)}});textures.forEach(t=>t.dispose());geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose())}
