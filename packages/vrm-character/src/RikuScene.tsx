'use client'

import { useEffect, useRef, useCallback } from 'react'
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { VRMLoaderPlugin, VRM, VRMUtils } from '@pixiv/three-vrm'
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js'
import { retargetMixamoAnimation } from './loadMixamoAnimation'
import { VrmLipSync, isTtsSupported } from './vrmLipSync'

export type RikuMood = 'neutral' | 'relaxed' | 'thinking' | 'happy' | 'shy' | 'sad' | 'surprised'

// 效能分級
type QualityTier = 'high' | 'mid' | 'low'

function detectTier(): QualityTier {
  if (typeof window === 'undefined') return 'mid'
  const gl = document.createElement('canvas').getContext('webgl2')
  if (!gl) return 'low'
  if (/Android/.test(navigator.userAgent) && !/Chrome\/[7-9]\d|Chrome\/1\d\d/.test(navigator.userAgent)) return 'mid'
  return 'high'
}

// 柔和三點燈光設置
function setupLights(scene: THREE.Scene) {
  const ambient = new THREE.AmbientLight(0xc0d8f8, 0.8)
  scene.add(ambient)

  const keyLight = new THREE.DirectionalLight(0xe8f0ff, 1.2)
  keyLight.position.set(1, 2, 3)
  scene.add(keyLight)

  const fillLight = new THREE.DirectionalLight(0xd0e8ff, 0.6)
  fillLight.position.set(-2, 1, 1)
  scene.add(fillLight)

  const rimLight = new THREE.DirectionalLight(0xc8d8ff, 0.4)
  rimLight.position.set(0, 3, -2)
  scene.add(rimLight)
}

// 玻璃球粒子背景（cool blue/silver tint）
function createGlassSpheres(scene: THREE.Scene, tier: QualityTier) {
  const count = tier === 'high' ? 6 : tier === 'mid' ? 3 : 0
  const group = new THREE.Group()

  for (let i = 0; i < count; i++) {
    const radius = 0.3 + Math.random() * 0.4
    const geo = new THREE.SphereGeometry(radius, 32, 32)
    const mat = tier === 'high'
      ? new THREE.MeshPhysicalMaterial({
          color: 0xc8d8f8,
          metalness: 0.05,
          roughness: 0,
          transmission: 0.9,
          thickness: 0.5,
          ior: 1.4,
          transparent: true,
          opacity: 0.3,
        })
      : new THREE.MeshStandardMaterial({
          color: 0xc8d8f8,
          transparent: true,
          opacity: 0.15,
          metalness: 0.15,
          roughness: 0.05,
        })

    const mesh = new THREE.Mesh(geo, mat)
    mesh.position.set(
      (Math.random() - 0.5) * 6,
      (Math.random() - 0.5) * 4,
      -2 - Math.random() * 3,
    )
    mesh.userData.floatSpeed = 0.3 + Math.random() * 0.4
    mesh.userData.floatOffset = Math.random() * Math.PI * 2
    group.add(mesh)
  }
  scene.add(group)
  return group
}

function createParticles(scene: THREE.Scene, tier: QualityTier) {
  const count = tier === 'high' ? 200 : tier === 'mid' ? 80 : 0
  if (count === 0) return null

  const positions = new Float32Array(count * 3)
  for (let i = 0; i < count; i++) {
    positions[i * 3]     = (Math.random() - 0.5) * 10
    positions[i * 3 + 1] = (Math.random() - 0.5) * 8
    positions[i * 3 + 2] = -3 - Math.random() * 4
  }
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))

  const mat = new THREE.PointsMaterial({
    color: 0xd0e0ff,
    size: 0.03,
    transparent: true,
    opacity: 0.6,
    sizeAttenuation: true,
  })
  const points = new THREE.Points(geo, mat)
  scene.add(points)
  return points
}

interface RikuSceneProps {
  /** 畫布模式：fullBody / upperBody / face */
  cameraMode?: 'fullBody' | 'upperBody' | 'face'
  /** 初始表情 */
  mood?: RikuMood
  /** 是否顯示背景玻璃球 */
  showBackground?: boolean
  /** 開啟 360° 軌道旋轉（拖拽/捏合/滾輪） */
  allowOrbit?: boolean
  /** 效能模式：high = 全效能（預設）/ low = 省電 */
  quality?: 'high' | 'low'
  /** FPS 持續低於 20 時觸發（最多一次）*/
  onLowPerformance?: () => void
  /** 外部注入的 mood 變更 */
  onLoad?: (controls: RikuControls) => void
  /** 角色大小倍率（預設 1.0，範圍 0.5~2.0） */
  characterSize?: number
  className?: string
}

export interface RikuControls {
  setMood: (mood: RikuMood, durationMs?: number) => void
  playAnimation: (name: string) => void
  /** 取得目前正在播放的動作名稱 */
  getCurrentAnimation: () => string
  /** 取得目前心情 */
  getCurrentMood: () => RikuMood
  /** 讓凜空朗讀文字並同步口型 */
  speak: (text: string, options?: { lang?: string; rate?: number; pitch?: number; onEnd?: () => void }) => void
  /** 中止朗讀 */
  stopSpeaking: () => void
  /** 是否支援 TTS */
  isTtsSupported: boolean
}

const CAMERA_PRESETS = {
  fullBody:   { pos: [0, 0.9, 2.2] as const, target: [0, 0.9, 0] as const },
  upperBody:  { pos: [0, 1.2, 1.4] as const, target: [0, 1.2, 0] as const },
  face:       { pos: [0, 1.5, 0.9] as const, target: [0, 1.5, 0] as const },
}

// 表情對應 VRM Expression 名稱（Riku 的微妙表情）
const MOOD_EXPRESSION: Record<RikuMood, string> = {
  neutral:   'neutral',
  relaxed:   'relaxed',
  thinking:  'neutral',
  happy:     'happy',
  shy:       'relaxed',
  sad:       'neutral',
  surprised: 'surprised',
}


export default function RikuScene({
  cameraMode = 'fullBody',
  mood = 'neutral',
  showBackground = true,
  allowOrbit = false,
  quality = 'high',
  onLowPerformance,
  onLoad,
  characterSize = 1.0,
  className = '',
}: RikuSceneProps) {
  const mountRef = useRef<HTMLDivElement>(null)
  const vrmRef = useRef<VRM | null>(null)
  const clockRef = useRef(new THREE.Clock())
  const currentMoodRef = useRef<RikuMood>(mood)
  const currentAnimationRef = useRef<string>('idle')
  const blinkTimerRef = useRef(0)
  const blinkIntervalRef = useRef(3 + Math.random() * 4)
  const mouseRef = useRef({ x: 0, y: 0 })
  const rafRef = useRef<number>(0)
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null)
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null)
  const clickCooldownRef = useRef(false)
  const mountedRef = useRef(true)

  // 隨機身體轉向
  const targetBodyYRotRef = useRef(0)
  const currentBodyYRotRef = useRef(0)
  const randomActionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // FPS 監控
  const fpsBufferRef = useRef<number[]>([])
  const lastPerfCheckRef = useRef(0)
  const perfWarningFiredRef = useRef(false)
  const onLowPerformanceRef = useRef(onLowPerformance)
  onLowPerformanceRef.current = onLowPerformance

  // Orbit 軌道旋轉
  const orbitRef = useRef({
    theta: 0, phi: Math.PI / 2, radius: 2.2,
    targetTheta: 0, targetPhi: Math.PI / 2, targetRadius: 2.2,
    isDragging: false, dragMoved: false, lastX: 0, lastY: 0, pinchDist: 0,
  })
  const orbitPointersRef = useRef(new Map<number, { x: number; y: number }>())

  const baseScaleRef      = useRef<number>(1)
  const lipSyncRef        = useRef<VrmLipSync | null>(null)
  const mixerRef          = useRef<THREE.AnimationMixer | null>(null)
  const fbxClipsRef       = useRef<Record<string, THREE.AnimationClip>>({})
  const currentIdleRef    = useRef<THREE.AnimationAction | null>(null)
  const pendingFbxAnimRef = useRef<string>('fbx_breathing')
  const userSelectedPoseRef = useRef<string | null>(null) // 使用者主動選的姿勢，setMood 不覆蓋

  // 點擊互動：隨機切換表情
  const CLICK_REACTIONS: RikuMood[] = ['neutral', 'relaxed', 'happy', 'thinking', 'surprised']
  const clickReactionIdxRef = useRef(0)

  // ── 動作動畫庫 ────────────────────────────────────────────────────────────

  // 揮手
  const playArmWave = useCallback((vrm: VRM) => {
    const upperArm = vrm.humanoid.getNormalizedBoneNode('rightUpperArm')
    const lowerArm = vrm.humanoid.getNormalizedBoneNode('rightLowerArm')
    if (!upperArm) return
    let t = 0
    const anim = () => {
      t += 0.07
      upperArm.rotation.z = -1.0 + Math.sin(t * 3) * 0.3
      upperArm.rotation.x = -0.1
      if (lowerArm) lowerArm.rotation.z = 0.15 + Math.sin(t * 3 + 0.5) * 0.15
      if (t < Math.PI * 2.5) requestAnimationFrame(anim)
      else { upperArm.rotation.set(0, 0, 0); if (lowerArm) lowerArm.rotation.set(0, 0, 0) }
    }
    requestAnimationFrame(anim)
  }, [])

  // 點頭
  const playNod = useCallback((vrm: VRM) => {
    const head = vrm.humanoid.getNormalizedBoneNode('head')
    if (!head) return
    let t = 0
    const anim = () => {
      t += 0.1
      head.rotation.x = Math.sin(t * 3) * 0.22 * Math.max(0, 1 - t / (Math.PI * 2))
      if (t < Math.PI * 2) requestAnimationFrame(anim)
      else head.rotation.x = 0
    }
    requestAnimationFrame(anim)
  }, [])

  // 搖頭
  const playShakeHead = useCallback((vrm: VRM) => {
    const head = vrm.humanoid.getNormalizedBoneNode('head')
    if (!head) return
    let t = 0
    const anim = () => {
      t += 0.09
      head.rotation.y = Math.sin(t * 3.5) * 0.28 * Math.max(0, 1 - t / (Math.PI * 2.2))
      if (t < Math.PI * 2.2) requestAnimationFrame(anim)
      else head.rotation.y = 0
    }
    requestAnimationFrame(anim)
  }, [])

  // 歪頭（可愛）
  const playTiltHead = useCallback((vrm: VRM) => {
    const head = vrm.humanoid.getNormalizedBoneNode('head')
    const neck = vrm.humanoid.getNormalizedBoneNode('neck')
    if (!head) return
    const dir = Math.random() > 0.5 ? 1 : -1
    let t = 0
    const anim = () => {
      t += 0.04
      const tilt = Math.sin(Math.min(t, Math.PI)) * 0.28 * dir
      head.rotation.z = tilt
      if (neck) neck.rotation.z = tilt * 0.35
      if (t < Math.PI * 3) requestAnimationFrame(anim)
      else { head.rotation.z = 0; if (neck) neck.rotation.z = 0 }
    }
    requestAnimationFrame(anim)
  }, [])

  // 鞠躬
  const playBow = useCallback((vrm: VRM) => {
    const spine = vrm.humanoid.getNormalizedBoneNode('spine')
    const chest = vrm.humanoid.getNormalizedBoneNode('chest')
    const head  = vrm.humanoid.getNormalizedBoneNode('head')
    if (!spine) return
    let t = 0
    const anim = () => {
      t += 0.04
      const lean = Math.sin(Math.min(t, Math.PI)) * 0.45
      spine.rotation.x = lean
      if (chest) chest.rotation.x = lean * 0.4
      if (head) head.rotation.x = -lean * 0.3
      if (t < Math.PI * 2) requestAnimationFrame(anim)
      else {
        spine.rotation.x = 0
        if (chest) chest.rotation.x = 0
        if (head) head.rotation.x = 0
      }
    }
    requestAnimationFrame(anim)
  }, [])

  // 聳肩
  const playShrug = useCallback((vrm: VRM) => {
    const leftArm  = vrm.humanoid.getNormalizedBoneNode('leftUpperArm')
    const rightArm = vrm.humanoid.getNormalizedBoneNode('rightUpperArm')
    if (!leftArm || !rightArm) return
    let t = 0
    const anim = () => {
      t += 0.06
      const lift = Math.sin(Math.min(t * 1.4, Math.PI)) * 0.38
      leftArm.rotation.z  =  lift
      rightArm.rotation.z = -lift
      if (t < Math.PI * 1.6) requestAnimationFrame(anim)
      else { leftArm.rotation.z = 0; rightArm.rotation.z = 0 }
    }
    requestAnimationFrame(anim)
  }, [])

  // 思考手勢
  const playThinkPose = useCallback((vrm: VRM) => {
    const rUpper = vrm.humanoid.getNormalizedBoneNode('rightUpperArm')
    const rLower = vrm.humanoid.getNormalizedBoneNode('rightLowerArm')
    const head   = vrm.humanoid.getNormalizedBoneNode('head')
    if (!rUpper) return
    let t = 0
    const anim = () => {
      t += 0.04
      const p = Math.min(t / (Math.PI * 0.5), 1)
      const ease = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2
      rUpper.rotation.x = -0.7 * ease
      rUpper.rotation.z = -0.45 * ease
      if (rLower) rLower.rotation.z = 0.55 * ease
      if (head) head.rotation.z = 0.07 * ease
      if (t < Math.PI * 3.5) requestAnimationFrame(anim)
      else {
        rUpper.rotation.set(0, 0, 0)
        if (rLower) rLower.rotation.set(0, 0, 0)
        if (head) head.rotation.z = 0
      }
    }
    requestAnimationFrame(anim)
  }, [])

  // 興奮抖動
  const playExcitedBounce = useCallback((vrm: VRM) => {
    const spine = vrm.humanoid.getNormalizedBoneNode('spine')
    if (!spine) return
    let t = 0
    const anim = () => {
      t += 0.2
      spine.rotation.x = Math.abs(Math.sin(t * 5)) * 0.025 * Math.max(0, 1 - t / (Math.PI * 2.5))
      if (t < Math.PI * 2.5) requestAnimationFrame(anim)
      else spine.rotation.x = 0
    }
    requestAnimationFrame(anim)
  }, [])

  // 左右搖擺
  const playSway = useCallback((vrm: VRM) => {
    const hips  = vrm.humanoid.getNormalizedBoneNode('hips')
    const spine = vrm.humanoid.getNormalizedBoneNode('spine')
    if (!hips) return
    let t = 0
    const anim = () => {
      t += 0.045
      const s = Math.sin(t * 2) * 0.07 * Math.max(0, 1 - t / (Math.PI * 3))
      hips.rotation.z  =  s
      if (spine) spine.rotation.z = -s * 0.5
      if (t < Math.PI * 3) requestAnimationFrame(anim)
      else { hips.rotation.z = 0; if (spine) spine.rotation.z = 0 }
    }
    requestAnimationFrame(anim)
  }, [])

  // 舞步擺動
  const playDanceStep = useCallback(() => {
    const seq = [0.5, -0.5, 0.3, -0.3, 0]
    seq.forEach((v, i) => {
      setTimeout(() => { targetBodyYRotRef.current = v }, i * 300)
    })
  }, [])

  // 雙手上舉伸展
  const playStretch = useCallback((vrm: VRM) => {
    const lUpper = vrm.humanoid.getNormalizedBoneNode('leftUpperArm')
    const rUpper = vrm.humanoid.getNormalizedBoneNode('rightUpperArm')
    const lLower = vrm.humanoid.getNormalizedBoneNode('leftLowerArm')
    const rLower = vrm.humanoid.getNormalizedBoneNode('rightLowerArm')
    const spine  = vrm.humanoid.getNormalizedBoneNode('spine')
    if (!lUpper || !rUpper) return
    let t = 0
    const anim = () => {
      t += 0.04
      const ext = Math.sin(Math.min(t * 0.7, Math.PI))
      lUpper.rotation.z =  ext * 1.1
      rUpper.rotation.z = -ext * 1.1
      lUpper.rotation.x = rUpper.rotation.x = -ext * 0.25
      if (lLower) lLower.rotation.x = -ext * 0.15
      if (rLower) rLower.rotation.x = -ext * 0.15
      if (spine) spine.rotation.x = -ext * 0.06
      if (t < Math.PI * 2.8) requestAnimationFrame(anim)
      else {
        lUpper.rotation.set(0, 0, 0); rUpper.rotation.set(0, 0, 0)
        if (lLower) lLower.rotation.set(0, 0, 0)
        if (rLower) rLower.rotation.set(0, 0, 0)
        if (spine) spine.rotation.x = 0
      }
    }
    requestAnimationFrame(anim)
  }, [])

  /** 根據心情切換 FBX idle 動畫 */
  const switchIdleByMood = useCallback((newMood: RikuMood) => {
    const mixer = mixerRef.current
    if (!mixer) return
    const clips = fbxClipsRef.current

    // 使用者主動選了姿勢 → 只換表情，不動 FBX 動畫
    if (userSelectedPoseRef.current) return

    const clipName =
      newMood === 'happy' ? 'fbx_happy' :
      newMood === 'relaxed' ? 'fbx_sitting' :
      'fbx_breathing'

    const clip = clips[clipName] ?? clips['fbx_idle']
    if (!clip) return

    const newAction = mixer.clipAction(clip)
    newAction.setLoop(THREE.LoopRepeat, Infinity)

    if (currentIdleRef.current && currentIdleRef.current !== newAction) {
      newAction.reset().fadeIn(0.5).play()
      currentIdleRef.current.fadeOut(0.5)
    } else if (!currentIdleRef.current) {
      newAction.play()
    }
    currentIdleRef.current = newAction
  }, [])

  // 平滑過渡表情
  const transitionExpression = useCallback((vrm: VRM, target: RikuMood, durationMs = 300) => {
    const targetExpr = MOOD_EXPRESSION[target]
    const steps = Math.ceil(durationMs / 16)
    let step = 0

    const currentExpr = MOOD_EXPRESSION[currentMoodRef.current]
    if (currentExpr !== targetExpr) {
      vrm.expressionManager?.setValue(currentExpr, 0)
    }

    const tick = () => {
      step++
      const t = step / steps
      vrm.expressionManager?.setValue(targetExpr, Math.min(t * 0.85, 0.85))
      if (step < steps) requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
    currentMoodRef.current = target
  }, [])

  useEffect(() => {
    if (!mountRef.current) return
    const container = mountRef.current
    const tier = detectTier()
    if (tier === 'low') return

    // ── Scene 設置 ─────────────────────────────────────────────────────────
    const scene = new THREE.Scene()
    const { width, height } = container.getBoundingClientRect()
    const camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 100)
    const preset = CAMERA_PRESETS[cameraMode]
    camera.position.set(preset.pos[0], preset.pos[1], preset.pos[2])
    camera.lookAt(preset.target[0], preset.target[1], preset.target[2])
    cameraRef.current = camera

    const isLowQuality = quality === 'low'
    const renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: !isLowQuality,
      precision: isLowQuality ? 'mediump' : 'highp',
      powerPreference: isLowQuality ? 'low-power' : 'high-performance',
    })
    renderer.setSize(width, height)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, isLowQuality ? 1.5 : 3))
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.2
    renderer.outputColorSpace = THREE.SRGBColorSpace
    container.appendChild(renderer.domElement)
    rendererRef.current = renderer

    setupLights(scene)

    let sphereGroup: THREE.Group | null = null
    let particles: THREE.Points | null = null
    if (showBackground && !isLowQuality) {
      sphereGroup = createGlassSpheres(scene, tier)
      particles = createParticles(scene, tier)
    }

    // ── VRM 載入 ───────────────────────────────────────────────────────────
    const loader = new GLTFLoader()
    loader.register((parser) => new VRMLoaderPlugin(parser))

    loader.loadAsync('/models/Riku.vrm').then((gltf) => {
      const vrm: VRM = gltf.userData.vrm
      VRMUtils.removeUnnecessaryJoints(vrm.scene)
      vrm.scene.rotation.y = 0

      const box = new THREE.Box3().setFromObject(vrm.scene)
      const modelHeight = box.max.y - box.min.y
      if (modelHeight > 0) {
        const targetHeight = 1.65
        const scale = targetHeight / modelHeight
        baseScaleRef.current = scale
        vrm.scene.scale.setScalar(scale * characterSize)
        box.setFromObject(vrm.scene)
        vrm.scene.position.y = -box.min.y
      }

      const maxAnisotropy = renderer.capabilities.getMaxAnisotropy()
      vrm.scene.traverse((node) => {
        if (node instanceof THREE.Mesh) {
          const materials = Array.isArray(node.material) ? node.material : [node.material]
          materials.forEach((mat) => {
            if (!mat) return
            const m = mat as THREE.MeshStandardMaterial
            if (m.map) m.map.anisotropy = maxAnisotropy
            if (m.normalMap) m.normalMap.anisotropy = maxAnisotropy
            if (m.roughnessMap) m.roughnessMap.anisotropy = maxAnisotropy
            if (m.emissiveMap) m.emissiveMap.anisotropy = maxAnisotropy
          })
        }
      })

      scene.add(vrm.scene)
      vrmRef.current = vrm

      // ── FBX 動畫載入 ──────────────────────────────────────────────────────
      const fbxLoader = new FBXLoader()
      const mixer = new THREE.AnimationMixer(vrm.scene)
      mixerRef.current = mixer

      const FBX_ANIMS: [string, string][] = [
        ['fbx_idle',      '/animations/idle/Idle.fbx'],
        ['fbx_breathing', '/animations/idle/breathing -idle.fbx'],
        ['fbx_happy',     '/animations/idle/happy-idle.fbx'],
        ['fbx_happy2',    '/animations/idle/happy-dle2.fbx'],
        ['fbx_sitting',   '/animations/idle/sitting-idle.fbx'],
      ]

      Promise.all(
        FBX_ANIMS.map(([name, path]) =>
          fbxLoader.loadAsync(path)
            .then(fbx => {
              if (fbx.animations.length > 0) {
                fbxClipsRef.current[name] = retargetMixamoAnimation(fbx, vrm)
              }
            })
            .catch(() => { /* 載入失敗跳過 */ })
        )
      ).then(() => {
        const target = pendingFbxAnimRef.current
        const clip = fbxClipsRef.current[target]
          ?? fbxClipsRef.current['fbx_breathing']
          ?? fbxClipsRef.current['fbx_idle']
        if (clip) {
          currentIdleRef.current = mixer.clipAction(clip)
          currentIdleRef.current.setLoop(THREE.LoopRepeat, Infinity)
          currentIdleRef.current.play()
        }
      })

      // 初始表情
      transitionExpression(vrm, mood)

      // 初始化口型同步
      lipSyncRef.current = new VrmLipSync(vrm)

      // 暴露外部控制 API
      if (onLoad) {
        onLoad({
          setMood: (m, dur) => {
            currentMoodRef.current = m
            transitionExpression(vrm, m, dur)
            switchIdleByMood(m)
          },
          playAnimation: (name) => {
            currentAnimationRef.current = name
            switch (name) {
              case 'wave':        playArmWave(vrm); break
              case 'nod':         playNod(vrm); break
              case 'shake_head':  playShakeHead(vrm); break
              case 'tilt_head':   playTiltHead(vrm); break
              case 'bow':         playBow(vrm); break
              case 'shrug':       playShrug(vrm); break
              case 'think':       playThinkPose(vrm); break
              case 'excited':     playExcitedBounce(vrm); break
              case 'sway':        playSway(vrm); break
              case 'dance':       playDanceStep(); break
              case 'stretch':     playStretch(vrm); break
              case 'fbx_idle':
              case 'fbx_breathing':
              case 'fbx_happy':
              case 'fbx_happy2':
              case 'fbx_sitting': {
                // 使用者主動選的姿勢，記住它，setMood 不再覆蓋
                userSelectedPoseRef.current = name
                const clip = fbxClipsRef.current[name]
                if (!clip) {
                  pendingFbxAnimRef.current = name
                  break
                }
                if (mixerRef.current) {
                  const action = mixerRef.current.clipAction(clip)
                  if (currentIdleRef.current && currentIdleRef.current !== action) {
                    currentIdleRef.current.fadeOut(0.3)
                  }
                  action.reset().setLoop(THREE.LoopRepeat, Infinity).fadeIn(0.3).play()
                  currentIdleRef.current = action
                }
                break
              }
            }
            // FBX pose 是持續循環，不重置；其他過渡動作 3 秒後回 idle
            if (!name.startsWith('fbx_')) {
              setTimeout(() => { currentAnimationRef.current = 'idle' }, 3000)
            }
          },
          getCurrentAnimation: () => currentAnimationRef.current,
          getCurrentMood: () => currentMoodRef.current,
          speak: (text, options) => {
            lipSyncRef.current?.speak(text, options)
          },
          stopSpeaking: () => {
            lipSyncRef.current?.stop()
          },
          isTtsSupported: isTtsSupported(),
        })
      }

      // 隨機 idle 動作排程（不包含 FBX pose，避免覆蓋使用者選擇的姿勢）
      const idleActions = [
        'turn_left', 'turn_right', 'center',
        'wave', 'look_left', 'look_right', 'idle',
        'nod', 'shake_head', 'tilt_head', 'bow',
        'shrug', 'think', 'excited', 'sway', 'dance', 'stretch',
      ] as const
      const scheduleRandomAction = () => {
        if (!mountedRef.current) return
        const action = idleActions[Math.floor(Math.random() * idleActions.length)]
        switch (action) {
          case 'turn_left':
            targetBodyYRotRef.current = -(0.25 + Math.random() * 0.35)
            break
          case 'turn_right':
            targetBodyYRotRef.current = 0.25 + Math.random() * 0.35
            break
          case 'center':
            targetBodyYRotRef.current = (Math.random() - 0.5) * 0.1
            break
          case 'wave':
            playArmWave(vrm)
            targetBodyYRotRef.current = 0.2
            setTimeout(() => { targetBodyYRotRef.current = 0 }, 3500)
            break
          case 'look_left':
            mouseRef.current = { x: -0.9, y: mouseRef.current.y }
            setTimeout(() => { mouseRef.current = { x: 0, y: 0 } }, 2500)
            break
          case 'look_right':
            mouseRef.current = { x: 0.9, y: mouseRef.current.y }
            setTimeout(() => { mouseRef.current = { x: 0, y: 0 } }, 2500)
            break
          case 'nod':         playNod(vrm); break
          case 'shake_head':  playShakeHead(vrm); break
          case 'tilt_head':   playTiltHead(vrm); break
          case 'bow':         playBow(vrm); break
          case 'shrug':       playShrug(vrm); break
          case 'think':       playThinkPose(vrm); break
          case 'excited':     playExcitedBounce(vrm); break
          case 'sway':        playSway(vrm); break
          case 'dance':       playDanceStep(); break
          case 'stretch':     playStretch(vrm); break
          case 'idle':
          default:
            break
        }
        const delay = 4000 + Math.random() * 9000
        randomActionTimerRef.current = setTimeout(scheduleRandomAction, delay)
      }
      if (!isLowQuality) setTimeout(scheduleRandomAction, 3000)
    }).catch((err) => {
      console.error('[RikuScene] VRM 載入失敗', err)
    })

    // ── 滑鼠視差 ───────────────────────────────────────────────────────────
    const onMouseMove = (e: MouseEvent) => {
      mouseRef.current = {
        x: (e.clientX / window.innerWidth - 0.5) * 2,
        y: -(e.clientY / window.innerHeight - 0.5) * 2,
      }
    }
    window.addEventListener('mousemove', onMouseMove)

    // ── 點擊互動 ───────────────────────────────────────────────────────────
    const onClick = (e: MouseEvent) => {
      const vrm = vrmRef.current
      if (!vrm || clickCooldownRef.current) return
      if (allowOrbit && orbitRef.current.dragMoved) return

      const rect = container.getBoundingClientRect()
      const ndcX = ((e.clientX - rect.left) / rect.width) * 2 - 1
      const ndcY = -((e.clientY - rect.top) / rect.height) * 2 + 1

      const raycaster = new THREE.Raycaster()
      raycaster.setFromCamera(new THREE.Vector2(ndcX, ndcY), camera)
      const intersects = raycaster.intersectObjects(vrm.scene.children, true)

      if (intersects.length > 0) {
        clickCooldownRef.current = true
        const reactions = CLICK_REACTIONS
        const idx = clickReactionIdxRef.current % reactions.length
        const reaction = reactions[idx] ?? 'neutral'
        clickReactionIdxRef.current++

        transitionExpression(vrm, reaction, 200)
        const headBone = vrm.humanoid.getNormalizedBoneNode('head')
        if (headBone) {
          let t = 0
          const headAnim = () => {
            t += 0.12
            if (t < Math.PI * 2) {
              headBone.rotation.y = Math.sin(t * 2) * 0.18
              requestAnimationFrame(headAnim)
            } else {
              headBone.rotation.y = 0
            }
          }
          requestAnimationFrame(headAnim)
        }
        setTimeout(() => {
          transitionExpression(vrm, 'neutral', 400)
          clickCooldownRef.current = false
        }, 2000)
      }
    }
    container.addEventListener('click', onClick)

    // ── 陀螺儀（行動裝置） ─────────────────────────────────────────────────
    const onDeviceOrientation = (e: DeviceOrientationEvent) => {
      if (e.gamma != null && e.beta != null) {
        mouseRef.current = {
          x: e.gamma / 45,
          y: e.beta / 45,
        }
      }
    }
    window.addEventListener('deviceorientation', onDeviceOrientation)

    // ── Orbit 互動 ────────────────────────────────────────────────────────
    const canvas = renderer.domElement
    let orbitCleanup: (() => void) | null = null

    if (allowOrbit) {
      const p = CAMERA_PRESETS[cameraMode]
      const dx0 = p.pos[0] - p.target[0], dy0 = p.pos[1] - p.target[1], dz0 = p.pos[2] - p.target[2]
      const r0 = Math.sqrt(dx0 * dx0 + dy0 * dy0 + dz0 * dz0)
      orbitRef.current = {
        theta: Math.atan2(dx0, dz0),
        phi: Math.acos(Math.max(-1, Math.min(1, dy0 / r0))),
        radius: r0,
        targetTheta: Math.atan2(dx0, dz0),
        targetPhi: Math.acos(Math.max(-1, Math.min(1, dy0 / r0))),
        targetRadius: r0,
        isDragging: false, dragMoved: false, lastX: 0, lastY: 0, pinchDist: 0,
      }
      canvas.style.touchAction = 'none'

      const onCanvasDown = (e: PointerEvent) => {
        e.preventDefault()
        const pid = e.pointerId
        orbitPointersRef.current.set(pid, { x: e.clientX, y: e.clientY })

        if (orbitPointersRef.current.size === 1) {
          orbitRef.current.isDragging = true
          orbitRef.current.dragMoved = false
          orbitRef.current.lastX = e.clientX
          orbitRef.current.lastY = e.clientY
        } else if (orbitPointersRef.current.size === 2) {
          orbitRef.current.isDragging = false
          const pts = Array.from(orbitPointersRef.current.values())
          const ddx = pts[1]!.x - pts[0]!.x, ddy = pts[1]!.y - pts[0]!.y
          orbitRef.current.pinchDist = Math.sqrt(ddx * ddx + ddy * ddy)
        }

        const onDocMove = (ev: PointerEvent) => {
          if (ev.pointerId !== pid) return
          ev.preventDefault()
          orbitPointersRef.current.set(pid, { x: ev.clientX, y: ev.clientY })

          if (orbitPointersRef.current.size >= 2) {
            const pts = Array.from(orbitPointersRef.current.values())
            const ddx = pts[1]!.x - pts[0]!.x, ddy = pts[1]!.y - pts[0]!.y
            const dist = Math.sqrt(ddx * ddx + ddy * ddy)
            orbitRef.current.targetRadius = Math.max(0.7, Math.min(5,
              orbitRef.current.targetRadius + (orbitRef.current.pinchDist - dist) * 0.012))
            orbitRef.current.pinchDist = dist
            return
          }
          if (!orbitRef.current.isDragging) return
          const ddx2 = ev.clientX - orbitRef.current.lastX
          const ddy2 = ev.clientY - orbitRef.current.lastY
          orbitRef.current.lastX = ev.clientX
          orbitRef.current.lastY = ev.clientY
          if (Math.abs(ddx2) > 2 || Math.abs(ddy2) > 2) orbitRef.current.dragMoved = true
          orbitRef.current.targetTheta -= ddx2 * 0.008
          orbitRef.current.targetPhi = Math.max(0.08,
            Math.min(Math.PI * 0.88, orbitRef.current.targetPhi + ddy2 * 0.008))
        }
        const onDocUp = (ev: PointerEvent) => {
          if (ev.pointerId !== pid) return
          orbitPointersRef.current.delete(pid)
          if (orbitPointersRef.current.size === 0) orbitRef.current.isDragging = false
          document.removeEventListener('pointermove', onDocMove)
          document.removeEventListener('pointerup',   onDocUp)
        }
        document.addEventListener('pointermove', onDocMove, { passive: false })
        document.addEventListener('pointerup',   onDocUp)
      }

      const onWheel = (e: WheelEvent) => {
        e.preventDefault()
        orbitRef.current.targetRadius = Math.max(0.7,
          Math.min(5, orbitRef.current.targetRadius + e.deltaY * 0.004))
      }

      canvas.addEventListener('pointerdown', onCanvasDown, { passive: false })
      canvas.addEventListener('wheel',       onWheel,      { passive: false })

      orbitCleanup = () => {
        canvas.removeEventListener('pointerdown', onCanvasDown)
        canvas.removeEventListener('wheel',       onWheel)
      }
    }

    // ── 動畫主迴圈 ─────────────────────────────────────────────────────────
    let lastFrameMs = performance.now()
    const animate = () => {
      rafRef.current = requestAnimationFrame(animate)
      const delta = clockRef.current.getDelta()
      const elapsed = clockRef.current.elapsedTime

      if (!isLowQuality && !perfWarningFiredRef.current) {
        const now = performance.now()
        const frameMs = now - lastFrameMs
        lastFrameMs = now
        if (frameMs > 0) {
          fpsBufferRef.current.push(1000 / frameMs)
          if (fpsBufferRef.current.length > 90) fpsBufferRef.current.shift()
        }
        if (now - lastPerfCheckRef.current > 10000 && fpsBufferRef.current.length >= 60) {
          lastPerfCheckRef.current = now
          const avg = fpsBufferRef.current.reduce((a, b) => a + b, 0) / fpsBufferRef.current.length
          if (avg < 20) {
            perfWarningFiredRef.current = true
            onLowPerformanceRef.current?.()
          }
        }
      }

      const vrm = vrmRef.current

      // 眼睛跟隨滑鼠
      if (vrm?.lookAt) {
        const targetX = mouseRef.current.x * 0.3
        const targetY = mouseRef.current.y * 0.2
        vrm.lookAt.getLookAtWorldPosition(new THREE.Vector3(targetX, targetY + 1.4, 3))
      }

      // 自動眨眼
      if (vrm?.expressionManager) {
        blinkTimerRef.current += delta
        if (blinkTimerRef.current >= blinkIntervalRef.current) {
          vrm.expressionManager.setValue('blinkLeft', 1)
          vrm.expressionManager.setValue('blinkRight', 1)
          setTimeout(() => {
            vrm.expressionManager?.setValue('blinkLeft', 0)
            vrm.expressionManager?.setValue('blinkRight', 0)
          }, 120)
          blinkTimerRef.current = 0
          blinkIntervalRef.current = 3 + Math.random() * 4
        }
      }

      // Idle 呼吸動畫
      if (vrm?.humanoid) {
        const chestBone = vrm.humanoid.getNormalizedBoneNode('chest')
        if (chestBone) {
          chestBone.rotation.x = Math.sin(elapsed * 0.8) * 0.015
        }
        const hipsBone = vrm.humanoid.getNormalizedBoneNode('hips')
        if (hipsBone) {
          hipsBone.rotation.z = Math.sin(elapsed * 0.5) * 0.008
        }
      }

      // Orbit 相機
      if (allowOrbit) {
        const orb = orbitRef.current
        const s = Math.min(delta * 10, 1)
        orb.theta  = THREE.MathUtils.lerp(orb.theta,  orb.targetTheta,  s)
        orb.phi    = THREE.MathUtils.lerp(orb.phi,    orb.targetPhi,    s)
        orb.radius = THREE.MathUtils.lerp(orb.radius, orb.targetRadius, Math.min(delta * 8, 1))
        const t = CAMERA_PRESETS[cameraMode].target
        camera.position.set(
          t[0] + orb.radius * Math.sin(orb.phi) * Math.sin(orb.theta),
          t[1] + orb.radius * Math.cos(orb.phi),
          t[2] + orb.radius * Math.sin(orb.phi) * Math.cos(orb.theta),
        )
        camera.lookAt(t[0], t[1], t[2])
      }

      // 平滑身體轉向
      if (!allowOrbit && vrm) {
        currentBodyYRotRef.current = THREE.MathUtils.lerp(
          currentBodyYRotRef.current,
          targetBodyYRotRef.current,
          Math.min(delta * 1.8, 1)
        )
        vrm.scene.rotation.y = currentBodyYRotRef.current
      }

      // SpringBone 物理更新
      mixerRef.current?.update(delta)
      vrm?.update(delta)

      // 口型同步更新
      lipSyncRef.current?.update(delta)

      // 玻璃球漂浮
      if (sphereGroup) {
        sphereGroup.children.forEach((child) => {
          const mesh = child as THREE.Mesh
          mesh.position.y += Math.sin(elapsed * mesh.userData.floatSpeed + mesh.userData.floatOffset) * 0.002
          mesh.rotation.y += delta * 0.1
        })
      }

      // 粒子緩慢旋轉
      if (particles) {
        particles.rotation.y += delta * 0.02
      }

      // 背景玻璃球視差
      if (sphereGroup) {
        sphereGroup.rotation.x = THREE.MathUtils.lerp(
          sphereGroup.rotation.x, mouseRef.current.y * 0.05, 0.05
        )
        sphereGroup.rotation.y = THREE.MathUtils.lerp(
          sphereGroup.rotation.y, mouseRef.current.x * 0.05, 0.05
        )
      }

      renderer.render(scene, camera)
    }
    animate()

    // ── Resize ─────────────────────────────────────────────────────────────
    const onResize = () => {
      const { width, height } = container.getBoundingClientRect()
      camera.aspect = width / height
      camera.updateProjectionMatrix()
      renderer.setSize(width, height)
    }
    window.addEventListener('resize', onResize)

    // ── Cleanup ────────────────────────────────────────────────────────────
    return () => {
      mountedRef.current = false
      if (randomActionTimerRef.current) clearTimeout(randomActionTimerRef.current)
      cancelAnimationFrame(rafRef.current)
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('deviceorientation', onDeviceOrientation)
      window.removeEventListener('resize', onResize)
      container.removeEventListener('click', onClick)
      orbitCleanup?.()
      renderer.dispose()
      container.removeChild(renderer.domElement)
    }
  }, [cameraMode, mood, showBackground, allowOrbit, quality, onLoad, transitionExpression,
    switchIdleByMood, playArmWave, playNod, playShakeHead, playTiltHead, playBow, playShrug,
    playThinkPose, playExcitedBounce, playSway, playDanceStep, playStretch])

  // characterSize 變化時即時更新模型縮放
  useEffect(() => {
    if (!vrmRef.current) return
    vrmRef.current.scene.scale.setScalar(baseScaleRef.current * characterSize)
  }, [characterSize])

  return (
    <div
      ref={mountRef}
      className={className}
      style={{ width: '100%', height: '100%', cursor: 'pointer', ...(allowOrbit ? { touchAction: 'none' } : {}) }}
      aria-hidden="true"
    />
  )
}
