/** Generate portable GLB assets from the same original builders used by OfficeScene. */
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'
import * as THREE from 'three'
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js'
import { poseCompanion } from '../src/features/office3d/motion.mjs'
import { createFurniture, createCompanion, createOfficeShell, disposeTree, HUMAN_STYLES } from '../src/features/office3d/models.mjs'
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),out=path.join(root,'public/office3d')
await fs.mkdir(out,{recursive:true})
// model.ts is pure data/validation, with type-only imports. Transpile without executing package scripts.
const source=await fs.readFile(path.join(root,'src/features/office3d/model.ts'),'utf8')
const code=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.ES2020}}).outputText
const {ROOMS,FURNITURE,freshLayout,readLayout,CHARACTER_SCALE,seatedHeight}=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'))
const layout=readLayout(freshLayout())
if(!globalThis.FileReader)globalThis.FileReader=class {
 readAsArrayBuffer(blob){blob.arrayBuffer().then(result=>{this.result=result;this.onloadend?.()}).catch(error=>this.onerror?.(error))}
 readAsDataURL(blob){blob.arrayBuffer().then(result=>{this.result=`data:${blob.type};base64,${Buffer.from(result).toString('base64')}`;this.onloadend?.()}).catch(error=>this.onerror?.(error))}
}
async function save(name,scene,animations=[]){scene.updateMatrixWorld(true);const binary=await new GLTFExporter().parseAsync(scene,{binary:true,animations,onlyVisible:true});if(!(binary instanceof ArrayBuffer))throw Error('GLB encoding failed');await fs.writeFile(path.join(out,name),Buffer.from(binary));console.log(name,binary.byteLength,'bytes');disposeTree(scene)}
await save('office-shell.glb',createOfficeShell(ROOMS,layout.floor,layout.wall))
const kit=new THREE.Group();kit.name='Nayagement modular furniture'
Object.keys(FURNITURE).forEach((kind,index)=>{const model=createFurniture(kind,ROOMS[index%ROOMS.length].color);model.position.set(index%4*2.7,0,Math.floor(index/4)*2.7);model.userData.assetType=kind;kit.add(model)})
await save('furniture-kit.glb',kit)
const actor={...createCompanion('#a9d9f2',0,true),phase:0,heading:0,seated:false,greetUntil:0,greetStarted:0,look:new THREE.Vector3(0,1,2)};actor.root.scale.setScalar(CHARACTER_SCALE)
const nodes=[actor.root,actor.body,actor.head,...actor.arms,...actor.elbows,...actor.hands,...actor.legs,...actor.shins,...actor.feet,...actor.eyes]
function bake(name,duration,options={},steps=32){const times=[],samples=nodes.map(()=>({position:[],quaternion:[],scale:[]}));actor.seated=!!options.seated;actor.greetUntil=duration
 for(let i=0;i<=steps;i++){const t=i/steps*duration;times.push(t);actor.root.position.set(0,actor.seated?seatedHeight():.08,0);actor.root.rotation.set(0,0,0);poseCompanion(actor,{t,...options,greeting:!!options.greeting&&t<duration});for(const [index,node] of nodes.entries()){samples[index].position.push(...node.position.toArray());samples[index].quaternion.push(...node.quaternion.toArray());samples[index].scale.push(...node.scale.toArray())}}
 const tracks=[];for(const [i,node] of nodes.entries())for(const property of ['position','quaternion','scale']){const Track=property==='quaternion'?THREE.QuaternionKeyframeTrack:THREE.VectorKeyframeTrack;tracks.push(new Track(node.uuid+'.'+property,times,samples[i][property]))}return new THREE.AnimationClip(name,duration,tracks)
}
const idle=bake('Idle',3),blink=new THREE.AnimationClip('Blink',.3,actor.eyes.map(eye=>new THREE.VectorKeyframeTrack(eye.uuid+'.scale',[0,.12,.3],[1,1,1,1,.12,1,1,1,1])))
const wave=bake('Wave',2,{greeting:true}),celebrate=bake('Celebrate',Math.PI/2,{moving:true}),typing=bake('Typing',2,{typing:true,seated:true}),walk=bake('Walk',Math.PI/4,{moving:true}),nod=bake('Nod',2,{chat:true,seated:true}),sit=bake('Sit',1,{seated:true,reducedMotion:true},1)
actor.seated=false;actor.root.position.set(0,.08,0);poseCompanion(actor,{t:0,reducedMotion:true})
await save('companion-base.glb',actor.root,[idle,blink,wave,celebrate,typing,walk,nod,sit])
const gallery=new THREE.Group();gallery.name='Twelve human avatar appearances'
for(const [index,style] of HUMAN_STYLES.entries()){const person={...createCompanion(index%2?'#a18bdd':'#6b9be8',index,false),phase:0,heading:0,seated:false,greetUntil:0};person.root.scale.setScalar(CHARACTER_SCALE);person.root.position.set(index%4*1.25,.08,Math.floor(index/4)*1.5);poseCompanion(person,{t:0,reducedMotion:true});person.root.name=style.gender+'-'+style.hair;gallery.add(person.root)}
await save('human-variants.glb',gallery)
await fs.writeFile(path.join(out,'human-appearances.json'),JSON.stringify({note:'Visual avatar presets only; not inferred personal gender data.',styles:HUMAN_STYLES},null,2)+'\n')
await fs.writeFile(path.join(out,'layout.default.json'),JSON.stringify(layout,null,2)+'\n')
await fs.writeFile(path.join(out,'rooms.json'),JSON.stringify(ROOMS,null,2)+'\n')
await fs.writeFile(path.join(out,'materials.json'),JSON.stringify({floor:['#bda58b','#d9dfe7','#a5b2b4','#b39278'],wall:['#e5e7ed','#d9e6e0','#dfd5e6','#b9c6d3']},null,2)+'\n')
console.log('Validated default layout and generated all Office 3D assets.')
