import type { BufferGeometry, Group, Mesh } from 'three'
import type { OfficeRoom, FurnitureKind } from './model'
export function rounded(w:number,h:number,d:number,r?:number):BufferGeometry
export function createFurniture(kind:FurnitureKind,color?:string):Group
export function createCompanion(color?:string,variant?:number,fur?:boolean):{root:Group;body:Group;head:Group;eyes:Mesh[];arms:Group[];elbows:Group[];hands:Group[];legs:Group[];shins:Group[];feet:Group[]}
export function createOfficeShell(rooms:OfficeRoom[],floor?:string,wall?:string):Group
export function disposeTree(root:Group):void

export const HUMAN_STYLES:Array<{gender:'male'|'female';hair:string}>
