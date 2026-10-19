import { AdaptiveDpr, ContactShadows, OrbitControls, RoundedBox } from '@react-three/drei'
import { Canvas, type ThreeEvent, useFrame } from '@react-three/fiber'
import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import type { Task, TaskStatus } from '../../types'

interface WorkCenterSceneProps {
  tasks: Task[]
  dark: boolean
  selectedTaskId: string | null
  statusFilter: TaskStatus | 'All'
  onSelectTask: (task: Task) => void
}

const STATUS_COLORS: Record<TaskStatus, string> = {
  Todo: '#d2a74b',
  'In Progress': '#397be8',
  Review: '#9a6be3',
  Completed: '#48a47b',
}

const STATUS_POSITIONS: Record<TaskStatus, Array<[number, number, number]>> = {
  Todo: [[-6.8, .36, 3.8], [-5.6, .36, 4.2], [-7.2, .36, 2.6], [-5.7, .36, 2.7]],
  'In Progress': [[-2.8, .36, -2.6], [-.8, .36, -2.6], [1.3, .36, -2.6], [3.3, .36, -2.6], [-1.8, .36, .2], [2.3, .36, .2]],
  Review: [[5.9, .36, -2.1], [7.1, .36, -2.1], [6.5, .36, -.5]],
  Completed: [[5.6, .36, 3.2], [7, .36, 3.4], [5.3, .36, 4.6], [7.4, .36, 4.7]],
}

function Box({ position, scale, color, radius = .08 }: { position: [number, number, number]; scale: [number, number, number]; color: string; radius?: number }) {
  return <RoundedBox args={scale} radius={radius} smoothness={3} position={position} castShadow receiveShadow><meshStandardMaterial color={color} roughness={.82} /></RoundedBox>
}

function Plant({ position, scale = 1 }: { position: [number, number, number]; scale?: number }) {
  return <group position={position} scale={scale}>
    <mesh castShadow position={[0, .22, 0]}><cylinderGeometry args={[.23, .17, .44, 12]} /><meshStandardMaterial color="#bd8460" roughness={.9} /></mesh>
    {[[0, .7, 0], [.18, .6, .08], [-.18, .61, -.05], [.08, .82, -.12]].map((p, index) => <mesh key={index} castShadow position={p as [number, number, number]} rotation={[0, index, index % 2 ? .55 : -.45]}><sphereGeometry args={[.28, 12, 10]} /><meshStandardMaterial color={index % 2 ? '#87ae77' : '#74a06f'} roughness={.85} /></mesh>)}
  </group>
}

function DeskCluster({ x, z }: { x: number; z: number }) {
  return <group position={[x, 0, z]}>
    <Box position={[0, .7, 0]} scale={[1.75, .12, .82]} color="#e4d7bc" />
    <Box position={[-.69, .35, 0]} scale={[.1, .7, .64]} color="#c9b894" />
    <Box position={[.69, .35, 0]} scale={[.1, .7, .64]} color="#c9b894" />
    <Box position={[0, 1.02, -.08]} scale={[.72, .48, .08]} color="#34475d" radius={.04} />
    <Box position={[0, .32, .72]} scale={[.62, .1, .62]} color="#aac5bc" />
    <Box position={[0, .63, .93]} scale={[.55, .68, .1]} color="#9eb9b0" />
  </group>
}

function Sofa({ position, rotation = 0 }: { position: [number, number, number]; rotation?: number }) {
  return <group position={position} rotation={[0, rotation, 0]}>
    <Box position={[0, .38, 0]} scale={[1.6, .32, .72]} color="#d8d3bf" />
    <Box position={[0, .74, .29]} scale={[1.62, .7, .18]} color="#c7c6b5" />
    <Box position={[-.76, .54, 0]} scale={[.18, .45, .75]} color="#c7c6b5" />
    <Box position={[.76, .54, 0]} scale={[.18, .45, .75]} color="#c7c6b5" />
  </group>
}

function OfficeShell({ dark }: { dark: boolean }) {
  const floor = dark ? '#263447' : '#e8e3d7'
  const wall = dark ? '#46546a' : '#d9d0bb'
  return <group>
    <Box position={[0, -.18, .7]} scale={[17.2, .3, 11.3]} color={floor} radius={.16} />
    <Box position={[-8.45, 1.1, .7]} scale={[.18, 2.55, 11.3]} color={wall} />
    <Box position={[0, 1.1, -4.86]} scale={[17.1, 2.55, .18]} color={wall} />
    <Box position={[8.45, 1.1, -.9]} scale={[.18, 2.55, 8]} color={wall} />
    <Box position={[4.55, 1, -2.45]} scale={[.15, 2.25, 4.7]} color={wall} />
    <Box position={[6.45, 1, .0]} scale={[3.9, 2.25, .15]} color={wall} />
    <Box position={[-4.55, 1, 3.18]} scale={[.15, 2.25, 4.05]} color={wall} />
    <Box position={[-6.5, 1, 1.2]} scale={[4, 2.25, .15]} color={wall} />
    <Box position={[0, .04, 4.92]} scale={[8.1, .08, .2]} color="#9aa78a" />
    <Box position={[6.5, -.08, 4.9]} scale={[4, .12, 1.2]} color={dark ? '#344d43' : '#b8c99b'} />
    {[-6.2, -2.1, 2.1].map(x => <DeskCluster key={x} x={x / 1.5} z={-2.2} />)}
    <DeskCluster x={-1.4} z={.45} /><DeskCluster x={1.5} z={.45} />
    <Sofa position={[-6.7, 0, 3.15]} rotation={Math.PI / 2} />
    <Sofa position={[-5.3, 0, 4.2]} rotation={Math.PI} />
    <Box position={[-6, .34, 3.25]} scale={[.8, .65, .8]} color="#dbcaa8" />
    <Box position={[6.45, .56, -2.2]} scale={[2.4, .12, 1.1]} color="#ded1b7" />
    {[[-1.05, 0], [1.05, 0], [0, -.95], [0, .95]].map(([x, z], index) => <Box key={index} position={[6.45 + x, .28, -2.2 + z]} scale={[.62, .12, .62]} color="#a9bbb1" />)}
    <Sofa position={[5.65, 0, 1.05]} />
    <Sofa position={[7.25, 0, 1.05]} />
    <Plant position={[-7.7, 0, -4.05]} /><Plant position={[3.8, 0, -4.05]} /><Plant position={[-4.95, 0, 4.5]} /><Plant position={[5.1, 0, 4.15]} scale={1.25} /><Plant position={[7.85, 0, 4.35]} scale={1.15} />
    {[5.2, 6.25, 7.3].map((x, index) => <Box key={x} position={[x, .18, 3.45 + (index % 2) * .85]} scale={[.72, .12, .72]} color="#c9c1cc" />)}
  </group>
}

function StatusMarker({ position, color }: { position: [number, number, number]; color: string }) {
  return <group position={position}>
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, .012, 0]} receiveShadow><ringGeometry args={[.78, .9, 40]} /><meshBasicMaterial color={color} transparent opacity={.48} /></mesh>
  </group>
}

function TaskCharacter({ task, position, selected, reducedMotion, onSelect }: { task: Task; position: [number, number, number]; selected: boolean; reducedMotion: boolean; onSelect: (task: Task) => void }) {
  const group = useRef<THREE.Group>(null)
  const leftArm = useRef<THREE.Group>(null)
  const rightArm = useRef<THREE.Group>(null)
  const [hovered, setHovered] = useState(false)
  const color = STATUS_COLORS[task.status]
  const seed = useMemo(() => task.id.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0), [task.id])
  const skin = ['#e5b58d', '#c98863', '#8d573d', '#f0c9a8'][seed % 4]
  const hair = ['#29313d', '#51362d', '#1f2732'][seed % 3]

  useEffect(() => {
    if (!hovered) return
    const previous = document.body.style.cursor
    document.body.style.cursor = 'pointer'
    return () => { document.body.style.cursor = previous }
  }, [hovered])

  useFrame(({ clock }) => {
    if (!group.current || reducedMotion) return
    const time = clock.elapsedTime + seed
    const working = task.status === 'In Progress'
    const celebrating = task.status === 'Completed'
    group.current.position.y = position[1] + Math.sin(time * (celebrating ? 4 : 1.8)) * (celebrating ? .08 : .025)
    group.current.rotation.y = Math.sin(time * .55) * .06
    if (leftArm.current && rightArm.current) {
      const movement = working ? Math.sin(time * 7) * .22 : celebrating ? Math.sin(time * 4) * .6 : Math.sin(time * 1.5) * .07
      leftArm.current.rotation.x = movement
      rightArm.current.rotation.x = -movement
      leftArm.current.rotation.z = celebrating ? -.9 : -.08
      rightArm.current.rotation.z = celebrating ? .9 : .08
    }
  })

  const select = (event: ThreeEvent<MouseEvent>) => { event.stopPropagation(); onSelect(task) }
  return <group ref={group} position={position} onClick={select} onPointerOver={(event) => { event.stopPropagation(); setHovered(true) }} onPointerOut={() => setHovered(false)}>
    {(selected || hovered) && <StatusMarker position={[0, -.35, 0]} color={color} />}
    <mesh castShadow position={[0, 1.12, 0]}><sphereGeometry args={[.3, 18, 16]} /><meshStandardMaterial color={skin} roughness={.8} /></mesh>
    <mesh castShadow position={[0, 1.32, -.04]} scale={[1.03, .42, 1.02]}><sphereGeometry args={[.31, 18, 12]} /><meshStandardMaterial color={hair} roughness={.9} /></mesh>
    <mesh castShadow position={[0, .65, 0]}><capsuleGeometry args={[.27, .48, 6, 12]} /><meshStandardMaterial color={color} roughness={.78} /></mesh>
    <group ref={leftArm} position={[-.31, .78, 0]}><mesh castShadow position={[0, -.2, 0]}><capsuleGeometry args={[.08, .38, 5, 10]} /><meshStandardMaterial color={color} /></mesh></group>
    <group ref={rightArm} position={[-.31 * -1, .78, 0]}><mesh castShadow position={[0, -.2, 0]}><capsuleGeometry args={[.08, .38, 5, 10]} /><meshStandardMaterial color={color} /></mesh></group>
    <mesh castShadow position={[-.13, .12, 0]}><capsuleGeometry args={[.085, .38, 5, 10]} /><meshStandardMaterial color="#35425a" /></mesh>
    <mesh castShadow position={[.13, .12, 0]}><capsuleGeometry args={[.085, .38, 5, 10]} /><meshStandardMaterial color="#35425a" /></mesh>
  </group>
}

function World({ tasks, dark, selectedTaskId, statusFilter, onSelectTask }: WorkCenterSceneProps) {
  const reducedMotion = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const visibleTasks = tasks.filter(task => statusFilter === 'All' || task.status === statusFilter).slice(0, 14)
  const indexByStatus = new Map<TaskStatus, number>()
  return <>
    <color attach="background" args={[dark ? '#142034' : '#eef1eb']} />
    <fog attach="fog" args={[dark ? '#142034' : '#eef1eb', 24, 44]} />
    <ambientLight intensity={dark ? 1.25 : 1.6} />
    <hemisphereLight args={[dark ? '#b8d2ff' : '#fff7e8', dark ? '#233047' : '#9aa88f', dark ? 1.3 : 1.8]} />
    <directionalLight position={[-8, 14, 10]} intensity={dark ? 2.2 : 3.1} color="#fff1d9" castShadow shadow-mapSize={[1024, 1024]} shadow-camera-left={-15} shadow-camera-right={15} shadow-camera-top={15} shadow-camera-bottom={-15} />
    <OfficeShell dark={dark} />
    {visibleTasks.map(task => {
      const index = indexByStatus.get(task.status) ?? 0
      indexByStatus.set(task.status, index + 1)
      const options = STATUS_POSITIONS[task.status]
      const base = options[index % options.length]
      const round = Math.floor(index / options.length)
      const position: [number, number, number] = [base[0] + round * .35, base[1], base[2] + round * .25]
      return <TaskCharacter key={task.id} task={task} position={position} selected={selectedTaskId === task.id} reducedMotion={reducedMotion} onSelect={onSelectTask} />
    })}
    <ContactShadows position={[0, -.31, .5]} opacity={dark ? .3 : .42} scale={24} blur={2.8} far={7} resolution={512} />
    <OrbitControls makeDefault enableDamping dampingFactor={.08} minDistance={14} maxDistance={31} minPolarAngle={.55} maxPolarAngle={1.25} minAzimuthAngle={-.9} maxAzimuthAngle={1.1} target={[0, .25, .2]} />
    <AdaptiveDpr pixelated />
  </>
}

export function WorkCenterScene(props: WorkCenterSceneProps & { resetKey: number }) {
  return <Canvas key={props.resetKey} shadows dpr={[1, 1.6]} camera={{ position: [16, 16, 18], fov: 34, near: .1, far: 80 }} gl={{ antialias: true, powerPreference: 'high-performance' }} aria-label="Work Center 3D interaktif; karakter mewakili status task workspace">
    <Suspense fallback={null}><World {...props} /></Suspense>
  </Canvas>
}

