// Articulated human rig: shoulders, elbows, wrists, hips, knees and ankles.
const facingTurn=(from,to,max)=>Math.max(-max,Math.min(max,Math.atan2(Math.sin(to-from),Math.cos(to-from))))
export function poseCompanion(a,{t,moving=false,greeting=false,typing=false,chat=false,reducedMotion=false,editing=false}) {
 const rest=reducedMotion||editing,thinking=typing&&(t+a.phase)%15>11.5,phase=t*7+a.phase
 a.body.position.set(0,a.seated?0:.94,typing?.025:0);a.body.rotation.set(typing&&!thinking?.025:0,0,0);a.body.scale.set(1,1,1);a.head.rotation.set(0,0,0)
 for(const [i,leg] of a.legs.entries()){leg.position.set(i?.105:-.105,a.seated?.12:1.06,0);leg.rotation.set(a.seated?-Math.PI/2:0,0,0);const shin=a.shins[i],extension=a.seated?Math.max(1,Math.min(1.9,(a.root.position.y+.084-.125)/.406)):1;shin.rotation.set(a.seated?Math.PI/2:0,0,0);shin.scale.set(1,extension,1);a.feet[i].rotation.set(0,0,0);a.feet[i].scale.set(1,1/extension,1)}
 for(const [i,arm] of a.arms.entries()){arm.position.set(i?.265:-.265,.68,0);arm.rotation.set(a.seated?-.12:0,0,0);a.elbows[i].rotation.set(a.seated?-.2:0,0,0);a.hands[i].rotation.set(0,0,0)}
 if(!rest){const blink=Math.sin(t*.6+a.phase)>.995?.12:1;for(const eye of a.eyes)eye.scale.y=blink
  if(moving){a.root.position.y+=Math.abs(Math.sin(phase*2))*.012;a.body.rotation.z=Math.sin(phase)*.018
   for(const [i,leg] of a.legs.entries()){const step=phase+(i?Math.PI:0);leg.rotation.x=Math.sin(step)*.30;a.shins[i].rotation.x=Math.max(0,-Math.sin(step))*.36;a.feet[i].rotation.x=-leg.rotation.x*.4; a.arms[i].rotation.x=-Math.sin(step)*.28;a.elbows[i].rotation.x=-.12}
  }else if(typing&&!thinking){a.head.rotation.x=.035+Math.sin(t*.8+a.phase)*.015
   for(const [i,arm] of a.arms.entries()){arm.rotation.x=-.60+Math.sin(t*11+a.phase+i*Math.PI)*.018;a.elbows[i].rotation.x=-.90;a.hands[i].rotation.x=Math.sin(t*11+i*Math.PI)*.025}
  }else if(thinking){a.head.rotation.y=Math.sin(t*.8+a.phase)*.14;a.arms[1].rotation.x=-.5;a.elbows[1].rotation.x=-1.5}
  else if(chat){a.head.rotation.x=Math.sin(t*2.3+a.phase)*.065;a.arms[1].rotation.x=-.3;a.elbows[1].rotation.x=-.7+Math.sin(t*2+a.phase)*.15;a.hands[1].rotation.z=Math.sin(t*2)*.1}
  else {a.head.rotation.y=Math.sin(t*.45+a.phase)*.06;a.body.rotation.z=Math.sin(t*.8+a.phase)*.005}
  if(greeting){const fade=Math.max(0,Math.min(1,(t-(a.greetStarted??a.greetUntil-1.8))*5,(a.greetUntil-t)*3)),envelope=fade*fade*(3-2*fade);a.arms[1].rotation.set(-.15*envelope,0,1.7*envelope);a.elbows[1].rotation.x=-.65*envelope;a.hands[1].rotation.z=Math.sin(t*12)*.25*envelope
   if(a.look){const target=Math.atan2(a.look.x-a.root.position.x,a.look.z-a.root.position.z);a.head.rotation.y=facingTurn(a.heading,target,.55)*envelope;a.body.rotation.y=facingTurn(a.heading,target,.06)*envelope}
  }
 }else for(const eye of a.eyes)eye.scale.y=1
}
