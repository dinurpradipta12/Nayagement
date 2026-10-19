import type { Vector3 } from 'three'
import type { createCompanion } from './models.mjs'
export function poseCompanion(actor:ReturnType<typeof createCompanion>&{phase:number;heading:number;seated:boolean;greetUntil:number;greetStarted?:number;look?:Vector3},options:{t:number;moving?:boolean;greeting?:boolean;typing?:boolean;chat?:boolean;reducedMotion?:boolean;editing?:boolean}):void
