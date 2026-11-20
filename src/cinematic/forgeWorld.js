import * as THREE from 'three'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'

/**
 * The forge world.
 *
 * One continuous three.js scene is driven entirely by a normalised scroll
 * progress value. Every animation is a pure function of that progress (plus
 * slow ambient time), so scrolling backwards replays the sequence exactly.
 */

const IMPACTS = [0.44, 0.505, 0.565]

const clamp01 = (value) => (value < 0 ? 0 : value > 1 ? 1 : value)
const smooth = (a, b, value) => {
  const t = clamp01((value - a) / (b - a || 1e-6))
  return t * t * (3 - 2 * t)
}
const lerp = (a, b, t) => a + (b - a) * t
const mix3 = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)]

const CAMERA_KEYS = [
  { p: 0, pos: [0, 1.12, 12], tgt: [0, 1.05, -2], fov: 33 },
  { p: 0.1, pos: [0.18, 1.04, 8.9], tgt: [0, 0.95, -1.2], fov: 35 },
  { p: 0.19, pos: [1.28, 1.18, 6.4], tgt: [0, 0.78, 0], fov: 37 },
  { p: 0.28, pos: [1.98, 1.4, 5.5], tgt: [0, 0.95, 0], fov: 37 },
  { p: 0.38, pos: [1.82, 2.05, 5.0], tgt: [0, 1.72, 0], fov: 38 },
  { p: 0.46, pos: [1.5, 1.38, 4.6], tgt: [0, 0.72, 0], fov: 39 },
  { p: 0.56, pos: [1.35, 1.16, 4.3], tgt: [0, 0.56, 0], fov: 39 },
  { p: 0.64, pos: [0.92, 1.32, 3.8], tgt: [0, 0.98, 0], fov: 38 },
  { p: 0.72, pos: [0.25, 2.78, 5.5], tgt: [0, 2.36, 0.9], fov: 36 },
  { p: 0.83, pos: [0, 2.76, 4.8], tgt: [0, 2.36, 0.9], fov: 35 },
  { p: 0.92, pos: [0, 2.72, 4.4], tgt: [0, 2.34, 0.9], fov: 34 },
  { p: 1, pos: [0, 2.56, 4.7], tgt: [0, 2.2, 0.9], fov: 36 },
]

function makeTexture(size, paint, { srgb = true, repeat = null } = {}) {
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  paint(ctx, size)
  const texture = new THREE.CanvasTexture(canvas)
  if (srgb) texture.colorSpace = THREE.SRGBColorSpace
  if (repeat) {
    texture.wrapS = THREE.RepeatWrapping
    texture.wrapT = THREE.RepeatWrapping
    texture.repeat.set(repeat, repeat)
  }
  return texture
}

function roundedBoxGeometry(width, height, depth, radius = 0.05) {
  const x = -width / 2
  const y = -height / 2
  const shape = new THREE.Shape()
  shape.moveTo(x + radius, y)
  shape.lineTo(x + width - radius, y)
  shape.quadraticCurveTo(x + width, y, x + width, y + radius)
  shape.lineTo(x + width, y + height - radius)
  shape.quadraticCurveTo(x + width, y + height, x + width - radius, y + height)
  shape.lineTo(x + radius, y + height)
  shape.quadraticCurveTo(x, y + height, x, y + height - radius)
  shape.lineTo(x, y + radius)
  shape.quadraticCurveTo(x, y, x + radius, y)
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: true,
    bevelSize: 0.012,
    bevelThickness: 0.012,
    bevelSegments: 2,
    curveSegments: 3,
  })
  geometry.center()
  geometry.rotateY(0)
  return geometry
}

export function createForgeWorld({ canvas, mobile = false }) {
  const disposables = []
  const track = (item) => {
    disposables.push(item)
    return item
  }

  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: !mobile,
    alpha: false,
    powerPreference: 'high-performance',
    stencil: false,
  })
  renderer.setClearColor(0x070504, 1)
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.12
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, mobile ? 1.5 : 1.75))

  const scene = new THREE.Scene()
  scene.fog = new THREE.FogExp2(0x0a0705, 0.058)

  const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 160)

  // --- environment reflections (studio room, tinted by the forge lights) ---
  const pmrem = new THREE.PMREMGenerator(renderer)
  const room = new RoomEnvironment()
  const envTarget = pmrem.fromScene(room, 0.04)
  scene.environment = envTarget.texture
  if ('environmentIntensity' in scene) scene.environmentIntensity = 0.42
  room.traverse((child) => {
    if (child.geometry) child.geometry.dispose()
    if (child.material) {
      const materials = Array.isArray(child.material) ? child.material : [child.material]
      materials.forEach((material) => material.dispose())
    }
  })

  const glowTexture = track(
    makeTexture(128, (ctx, size) => {
      const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
      gradient.addColorStop(0, 'rgba(255,244,222,1)')
      gradient.addColorStop(0.22, 'rgba(255,176,96,0.82)')
      gradient.addColorStop(0.58, 'rgba(196,82,26,0.2)')
      gradient.addColorStop(1, 'rgba(0,0,0,0)')
      ctx.fillStyle = gradient
      ctx.fillRect(0, 0, size, size)
    }),
  )

  const smokeTexture = track(
    makeTexture(256, (ctx, size) => {
      const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
      gradient.addColorStop(0, 'rgba(146,132,118,0.5)')
      gradient.addColorStop(0.45, 'rgba(104,92,82,0.2)')
      gradient.addColorStop(1, 'rgba(0,0,0,0)')
      ctx.fillStyle = gradient
      ctx.fillRect(0, 0, size, size)
    }),
  )

  const groundTexture = track(
    makeTexture(
      512,
      (ctx, size) => {
        ctx.fillStyle = '#191512'
        ctx.fillRect(0, 0, size, size)
        for (let i = 0; i < 5200; i += 1) {
          const x = Math.random() * size
          const y = Math.random() * size
          const shade = 18 + Math.random() * 46
          ctx.fillStyle = `rgba(${shade + 10},${shade + 4},${shade},${0.1 + Math.random() * 0.3})`
          const r = Math.random() * 1.8 + 0.3
          ctx.beginPath()
          ctx.arc(x, y, r, 0, Math.PI * 2)
          ctx.fill()
        }
      },
      { repeat: 7 },
    ),
  )

  const shadowTexture = track(
    makeTexture(256, (ctx, size) => {
      const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
      gradient.addColorStop(0, 'rgba(0,0,0,0.92)')
      gradient.addColorStop(0.45, 'rgba(0,0,0,0.5)')
      gradient.addColorStop(1, 'rgba(0,0,0,0)')
      ctx.fillStyle = gradient
      ctx.fillRect(0, 0, size, size)
    }),
  )

  const materials = {
    stone: track(
      new THREE.MeshStandardMaterial({
        color: 0x241f1a,
        roughness: 0.95,
        metalness: 0.05,
        map: groundTexture,
      }),
    ),
    wall: track(
      new THREE.MeshStandardMaterial({ color: 0x1a1512, roughness: 1, metalness: 0.02 }),
    ),
    steel: track(
      new THREE.MeshStandardMaterial({
        color: 0x6f675d,
        roughness: 0.42,
        metalness: 1,
        envMapIntensity: 0.9,
      }),
    ),
    darkSteel: track(
      new THREE.MeshStandardMaterial({
        color: 0x332e29,
        roughness: 0.55,
        metalness: 0.95,
        envMapIntensity: 0.7,
      }),
    ),
    copper: track(
      new THREE.MeshStandardMaterial({
        color: 0x9a5228,
        roughness: 0.32,
        metalness: 1,
        envMapIntensity: 1.1,
      }),
    ),
    gold: track(
      new THREE.MeshStandardMaterial({
        color: 0xc79a5e,
        roughness: 0.28,
        metalness: 1,
        envMapIntensity: 1.2,
      }),
    ),
    ingot: track(
      new THREE.MeshStandardMaterial({
        color: 0x2a1108,
        emissive: 0xff5a14,
        emissiveIntensity: 1.2,
        roughness: 0.55,
        metalness: 0.6,
      }),
    ),
  }

  const forge = new THREE.Group()
  scene.add(forge)

  // ---------------------------------------------------------------- floor
  const floor = new THREE.Mesh(track(new THREE.PlaneGeometry(70, 70)), materials.stone)
  floor.rotation.x = -Math.PI / 2
  floor.position.y = -0.9
  forge.add(floor)

  const contactShadow = new THREE.Mesh(
    track(new THREE.PlaneGeometry(5.4, 4.2)),
    track(
      new THREE.MeshBasicMaterial({
        map: shadowTexture,
        transparent: true,
        opacity: 0.95,
        depthWrite: false,
      }),
    ),
  )
  contactShadow.rotation.x = -Math.PI / 2
  contactShadow.position.y = -0.885
  forge.add(contactShadow)

  // ---------------------------------------------------------------- hall
  const hall = new THREE.Group()
  forge.add(hall)

  const backWall = new THREE.Mesh(track(new THREE.PlaneGeometry(46, 20)), materials.wall)
  backWall.position.set(0, 5, -11)
  hall.add(backWall)

  const pillarGeometry = track(new THREE.BoxGeometry(0.9, 9.4, 0.9))
  for (let i = 0; i < 5; i += 1) {
    const z = -8.4 + i * 2.8
    for (const side of [-1, 1]) {
      const pillar = new THREE.Mesh(pillarGeometry, materials.darkSteel)
      pillar.position.set(side * (6.4 + (i % 2) * 0.7), 3.8, z)
      hall.add(pillar)
    }
  }

  const beamGeometry = track(new THREE.BoxGeometry(13.6, 0.42, 0.42))
  for (let i = 0; i < 4; i += 1) {
    const beam = new THREE.Mesh(beamGeometry, materials.darkSteel)
    beam.position.set(0, 8.1, -8.2 + i * 3)
    hall.add(beam)
  }

  // light spilling across the floor, so the hall has a lit path instead of a black void
  const floorGlow = new THREE.Mesh(
    track(new THREE.PlaneGeometry(8.5, 8.5)),
    track(
      new THREE.MeshBasicMaterial({
        map: glowTexture,
        color: 0xff8338,
        transparent: true,
        opacity: 0.3,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        toneMapped: false,
        fog: false,
      }),
    ),
  )
  floorGlow.rotation.x = -Math.PI / 2
  floorGlow.position.set(-3.4, -0.874, -4.2)
  forge.add(floorGlow)

  const archGeometry = track(new THREE.TorusGeometry(3.6, 0.14, 8, 40, Math.PI))
  for (let i = 0; i < 3; i += 1) {
    const arch = new THREE.Mesh(archGeometry, materials.darkSteel)
    arch.position.set(0, 4.6, -6.4 - i * 2.2)
    hall.add(arch)
  }

  // ---------------------------------------------------------------- furnace
  const furnace = new THREE.Group()
  furnace.position.set(-3.7, 0.02, -5.9)
  forge.add(furnace)

  const furnaceBody = new THREE.Mesh(track(new THREE.BoxGeometry(3.2, 2.4, 0.95)), materials.stone)
  furnaceBody.position.y = 0.5
  furnace.add(furnaceBody)

  // a recessed fire mouth instead of a glowing panel
  const furnaceRecess = new THREE.Mesh(
    track(new THREE.PlaneGeometry(1.52, 1.18)),
    track(
      new THREE.MeshBasicMaterial({
        color: 0x0b0603,
        toneMapped: false,
      }),
    ),
  )
  furnaceRecess.position.set(0, 0.56, 0.49)
  furnace.add(furnaceRecess)

  const furnaceMouth = new THREE.Sprite(
    track(
      new THREE.SpriteMaterial({
        map: glowTexture,
        color: 0xffa257,
        transparent: true,
        opacity: 0.95,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        toneMapped: false,
      }),
    ),
  )
  furnaceMouth.scale.set(2.05, 1.75, 1)
  furnaceMouth.position.set(0, 0.56, 0.62)
  furnace.add(furnaceMouth)

  const furnaceArch = new THREE.Mesh(
    track(new THREE.TorusGeometry(0.8, 0.13, 8, 26, Math.PI)),
    materials.darkSteel,
  )
  furnaceArch.position.set(0, 1.05, 0.5)
  furnace.add(furnaceArch)

  const jambGeometry = track(new THREE.BoxGeometry(0.22, 1.05, 0.24))
  for (const side of [-1, 1]) {
    const jamb = new THREE.Mesh(jambGeometry, materials.darkSteel)
    jamb.position.set(side * 0.86, 0.56, 0.5)
    furnace.add(jamb)
  }

  const furnaceHood = new THREE.Mesh(track(new THREE.BoxGeometry(3.9, 0.34, 1.5)), materials.darkSteel)
  furnaceHood.position.set(0, 2.06, 0.06)
  furnace.add(furnaceHood)

  const furnaceButtressGeometry = track(new THREE.BoxGeometry(0.3, 2.1, 1.1))
  for (const side of [-1, 1]) {
    const buttress = new THREE.Mesh(furnaceButtressGeometry, materials.stone)
    buttress.position.set(side * 1.66, 0.62, 0)
    furnace.add(buttress)
  }

  const furnaceHalo = new THREE.Sprite(
    track(
      new THREE.SpriteMaterial({
        map: glowTexture,
        color: 0xff7d33,
        transparent: true,
        opacity: 0.5,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        toneMapped: false,
        fog: false,
      }),
    ),
  )
  furnaceHalo.scale.set(7, 6, 1)
  furnaceHalo.position.set(0, 0.9, 0.4)
  furnace.add(furnaceHalo)

  // ---------------------------------------------------------------- lights
  const hemi = new THREE.HemisphereLight(0x3a2c20, 0x080604, 0.32)
  scene.add(hemi)

  const furnaceLight = new THREE.PointLight(0xff7c2c, 46, 22, 2)
  furnaceLight.position.set(-3.3, 1.25, -4.9)
  scene.add(furnaceLight)

  const keyLight = new THREE.PointLight(0xffb07a, 15, 13, 2)
  keyLight.position.set(2.3, 3.4, 2.4)
  scene.add(keyLight)

  const rimLight = new THREE.PointLight(0x93a1ac, 8, 18, 2)
  rimLight.position.set(-2.4, 3.8, -3.6)
  scene.add(rimLight)

  const emberLight = new THREE.PointLight(0xff7a2a, 9, 7, 2)
  emberLight.position.set(0, 0.42, 0.3)
  scene.add(emberLight)

  // ---------------------------------------------------------------- smoke
  const smoke = []
  const smokeCount = mobile ? 4 : 7
  for (let i = 0; i < smokeCount; i += 1) {
    const sprite = new THREE.Sprite(
      track(
        new THREE.SpriteMaterial({
          map: smokeTexture,
          color: 0x7d6a58,
          transparent: true,
          opacity: 0.1 + Math.random() * 0.1,
          depthWrite: false,
          fog: true,
        }),
      ),
    )
    const spread = 16
    const base = new THREE.Vector3(
      (Math.random() - 0.5) * spread,
      2.6 + Math.random() * 4.2,
      -8.4 + Math.random() * 3.4,
    )
    sprite.position.copy(base)
    const scale = 5 + Math.random() * 6
    sprite.scale.set(scale, scale * 0.75, 1)
    sprite.userData = {
      base,
      speed: 0.1 + Math.random() * 0.16,
      sway: Math.random() * 6,
      opacity: sprite.material.opacity,
    }
    smoke.push(sprite)
    forge.add(sprite)
  }

  // ---------------------------------------------------------------- anvil
  const anvil = new THREE.Group()
  forge.add(anvil)

  const anvilBase = new THREE.Mesh(track(new THREE.BoxGeometry(1.4, 0.18, 0.58)), materials.darkSteel)
  anvilBase.position.y = -0.81
  anvil.add(anvilBase)

  const anvilWaist = new THREE.Mesh(
    track(new THREE.CylinderGeometry(0.36, 0.52, 0.52, 8)),
    materials.darkSteel,
  )
  anvilWaist.position.y = -0.46
  anvil.add(anvilWaist)

  const anvilTop = new THREE.Mesh(
    track(new THREE.BoxGeometry(1.62, 0.24, 0.6)),
    materials.steel,
  )
  anvilTop.position.y = -0.12
  anvil.add(anvilTop)

  const anvilHorn = new THREE.Mesh(
    track(new THREE.ConeGeometry(0.19, 0.78, 14)),
    materials.steel,
  )
  anvilHorn.rotation.z = -Math.PI / 2
  anvilHorn.position.set(1.1, -0.05, 0)
  anvil.add(anvilHorn)

  const anvilHeel = new THREE.Mesh(track(new THREE.BoxGeometry(0.3, 0.16, 0.44)), materials.steel)
  anvilHeel.position.set(-0.78, -0.04, 0)
  anvil.add(anvilHeel)

  // ---------------------------------------------------------------- hammer
  const hammer = new THREE.Group()
  forge.add(hammer)

  const railGeometry = track(new THREE.BoxGeometry(0.16, 4.2, 0.16))
  for (const x of [-1.18, 1.18]) {
    for (const z of [-0.34, 0.34]) {
      const rail = new THREE.Mesh(railGeometry, materials.darkSteel)
      rail.position.set(x, 1.1, z)
      hammer.add(rail)
    }
  }

  const hammerTop = new THREE.Mesh(track(new THREE.BoxGeometry(2.85, 0.34, 0.98)), materials.darkSteel)
  hammerTop.position.set(0, 3.24, 0)
  hammer.add(hammerTop)

  const counterweight = new THREE.Mesh(track(new THREE.BoxGeometry(1.9, 0.42, 0.62)), materials.steel)
  counterweight.position.set(0, 3.06, -0.66)
  hammer.add(counterweight)

  const braceGeometry = track(new THREE.BoxGeometry(0.09, 1.4, 0.09))
  for (const side of [-1, 1]) {
    const brace = new THREE.Mesh(braceGeometry, materials.darkSteel)
    brace.position.set(side * 1.42, 2.42, 0)
    brace.rotation.z = side * 0.52
    hammer.add(brace)
  }

  const hammerCylinder = new THREE.Mesh(
    track(new THREE.CylinderGeometry(0.26, 0.26, 1.1, 18)),
    materials.copper,
  )
  hammerCylinder.position.set(0, 2.62, 0)
  hammer.add(hammerCylinder)

  const ram = new THREE.Group()
  hammer.add(ram)

  const ramBody = new THREE.Mesh(
    track(roundedBoxGeometry(1.46, 0.52, 0.72, 0.06)),
    track(
      new THREE.MeshStandardMaterial({
        color: 0x39322b,
        roughness: 0.34,
        metalness: 0.94,
        envMapIntensity: 0.85,
      }),
    ),
  )
  ramBody.position.y = 0.28
  ram.add(ramBody)

  const ramCap = new THREE.Mesh(track(new THREE.BoxGeometry(1.62, 0.1, 0.82)), materials.steel)
  ramCap.position.y = 0.58
  ram.add(ramCap)

  const ramFace = new THREE.Mesh(
    track(roundedBoxGeometry(1.02, 0.16, 0.56, 0.03)),
    materials.copper,
  )
  ramFace.position.y = 0.02
  ram.add(ramFace)

  // ---------------------------------------------------------------- ingot
  const ingot = new THREE.Mesh(track(new THREE.BoxGeometry(0.66, 0.17, 0.44)), materials.ingot)
  ingot.position.set(0, 0.085, 0)
  anvil.add(ingot)

  const ingotCore = new THREE.Mesh(
    track(new THREE.BoxGeometry(0.5, 0.075, 0.3)),
    track(
      new THREE.MeshStandardMaterial({
        color: 0x3a1206,
        emissive: 0xffa869,
        emissiveIntensity: 2.4,
        roughness: 0.42,
        metalness: 0.25,
      }),
    ),
  )
  ingotCore.position.set(0, 0.035, 0)
  ingot.add(ingotCore)

  const ingotGlow = new THREE.Sprite(
    track(
      new THREE.SpriteMaterial({
        map: glowTexture,
        color: 0xff8a3d,
        transparent: true,
        opacity: 0.55,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        toneMapped: false,
        fog: false,
      }),
    ),
  )
  ingotGlow.scale.set(2.1, 1.7, 1)
  ingotGlow.position.set(0, 0.16, 0)
  anvil.add(ingotGlow)

  // ---------------------------------------------------------------- sparks
  const sparkCount = mobile ? 90 : 180
  const sparkGeometry = track(new THREE.BufferGeometry())
  const sparkPositions = new Float32Array(sparkCount * 3)
  const sparkSizes = new Float32Array(sparkCount)
  const sparkAlphas = new Float32Array(sparkCount)
  const sparkSeeds = []
  for (let i = 0; i < sparkCount; i += 1) {
    const burst = i % IMPACTS.length
    const angle = Math.random() * Math.PI * 2
    const speed = 0.55 + Math.random() * 1.5
    sparkSeeds.push({
      burst,
      vx: Math.cos(angle) * speed,
      vz: Math.sin(angle) * speed * 0.7,
      vy: 1.1 + Math.random() * 2.4,
      size: 2.2 + Math.random() * 4.6,
      offset: Math.random() * 0.018,
    })
    sparkSizes[i] = sparkSeeds[i].size
  }
  sparkGeometry.setAttribute('position', new THREE.BufferAttribute(sparkPositions, 3))
  sparkGeometry.setAttribute('aSize', new THREE.BufferAttribute(sparkSizes, 1))
  sparkGeometry.setAttribute('aAlpha', new THREE.BufferAttribute(sparkAlphas, 1))

  const sparkMaterial = track(
    new THREE.ShaderMaterial({
      uniforms: { uColor: { value: new THREE.Color(0xffc089) } },
      vertexShader: `
        attribute float aSize;
        attribute float aAlpha;
        varying float vAlpha;
        void main() {
          vAlpha = aAlpha;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = aSize * (200.0 / max(0.001, -mv.z));
          gl_Position = projectionMatrix * mv;
        }
      `,
      fragmentShader: `
        uniform vec3 uColor;
        varying float vAlpha;
        void main() {
          float d = length(gl_PointCoord - vec2(0.5));
          if (d > 0.5) discard;
          float a = smoothstep(0.5, 0.0, d);
          gl_FragColor = vec4(uColor, a * vAlpha);
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }),
  )

  const sparks = new THREE.Points(sparkGeometry, sparkMaterial)
  sparks.frustumCulled = false
  forge.add(sparks)

  // ---------------------------------------------------------------- shockwaves
  const shockwaves = IMPACTS.map(() => {
    const mesh = new THREE.Mesh(
      track(new THREE.RingGeometry(0.35, 0.44, 48)),
      track(
        new THREE.MeshBasicMaterial({
          color: 0xffd0a0,
          transparent: true,
          opacity: 0,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          side: THREE.DoubleSide,
          toneMapped: false,
        }),
      ),
    )
    mesh.rotation.x = -Math.PI / 2
    mesh.position.y = 0.19
    forge.add(mesh)
    return mesh
  })

  // ---------------------------------------------------------------- embers
  const emberCount = mobile ? 60 : 130
  const emberGeometry = track(new THREE.BufferGeometry())
  const emberPositions = new Float32Array(emberCount * 3)
  const emberSeeds = []
  for (let i = 0; i < emberCount; i += 1) {
    const seed = {
      x: (Math.random() - 0.5) * 13,
      y: Math.random() * 6.4 - 0.4,
      z: (Math.random() - 0.5) * 12 - 1,
      speed: 0.06 + Math.random() * 0.16,
      phase: Math.random() * Math.PI * 2,
    }
    emberSeeds.push(seed)
    emberPositions[i * 3] = seed.x
    emberPositions[i * 3 + 1] = seed.y
    emberPositions[i * 3 + 2] = seed.z
  }
  emberGeometry.setAttribute('position', new THREE.BufferAttribute(emberPositions, 3))
  const embers = new THREE.Points(
    emberGeometry,
    track(
      new THREE.PointsMaterial({
        map: glowTexture,
        color: 0xff9a52,
        size: 0.11,
        sizeAttenuation: true,
        transparent: true,
        opacity: 0.75,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        toneMapped: false,
      }),
    ),
  )
  embers.frustumCulled = false
  forge.add(embers)

  // ---------------------------------------------------------------- forged forms
  const chunks = [0, 1, 2].map((index) => {
    const chunk = new THREE.Mesh(
      track(new THREE.BoxGeometry(0.2, 0.2, 0.2)),
      track(
        new THREE.MeshStandardMaterial({
          color: 0x2c1309,
          emissive: 0xff5f1a,
          emissiveIntensity: 1.6,
          roughness: 0.5,
          metalness: 0.55,
          transparent: true,
          opacity: 0,
        }),
      ),
    )
    chunk.position.set(0, 0.2, 0)
    chunk.userData = { index }
    forge.add(chunk)
    return chunk
  })

  // ---------------------------------------------------------------- emblem
  // the emblem floats clear of the anvil so the reveal owns the frame
  const emblem = new THREE.Group()
  emblem.position.set(0, 2.35, 0.9)
  forge.add(emblem)

  const emblemMaterials = []

  // a forged plate the mark is mounted on: keeps the reveal on solid material
  const plateMaterial = track(
    new THREE.MeshStandardMaterial({
      color: 0x2a231c,
      roughness: 0.62,
      metalness: 0.85,
      envMapIntensity: 0.55,
      transparent: true,
      opacity: 0,
    }),
  )
  const plate = new THREE.Mesh(
    track(new THREE.CylinderGeometry(1.06, 1.1, 0.07, 72)),
    plateMaterial,
  )
  plate.rotation.x = Math.PI / 2
  plate.position.z = -0.34
  emblem.add(plate)
  emblemMaterials.push(plateMaterial)

  const plateRim = new THREE.Mesh(
    track(new THREE.TorusGeometry(1.03, 0.014, 8, 96)),
    plateMaterial,
  )
  plateRim.position.z = -0.29
  emblem.add(plateRim)

  // three nested C's, hammered one inside the next — the C³ mark itself
  const arcSpecs = [
    { radius: 0.7, tube: 0.085, z: 0.05, material: materials.gold },
    { radius: 0.5, tube: 0.068, z: -0.03, material: materials.copper },
    { radius: 0.31, tube: 0.052, z: -0.1, material: materials.steel },
  ]

  arcSpecs.forEach((spec) => {
    const material = track(
      new THREE.MeshStandardMaterial({
        color: spec.material.color,
        roughness: spec.material.roughness,
        metalness: 1,
        envMapIntensity: 1.35,
        transparent: true,
        opacity: 0,
      }),
    )
    emblemMaterials.push(material)
    const arc = new THREE.Mesh(
      track(new THREE.TorusGeometry(spec.radius, spec.tube, 16, 84, Math.PI * 1.48)),
      material,
    )
    // every C opens to the right, like a struck initial
    arc.rotation.z = -Math.PI * 0.26
    arc.rotation.x = -0.06
    arc.position.z = spec.z
    emblem.add(arc)
  })

  const emblemRing = new THREE.Mesh(
    track(new THREE.TorusGeometry(0.92, 0.012, 8, 96)),
    track(
      new THREE.MeshStandardMaterial({
        color: 0xa8683a,
        roughness: 0.35,
        metalness: 1,
        transparent: true,
        opacity: 0,
      }),
    ),
  )
  emblemMaterials.push(emblemRing.material)
  emblem.add(emblemRing)

  for (let i = 0; i < 12; i += 1) {
    const tick = new THREE.Mesh(
      track(new THREE.BoxGeometry(0.028, 0.1, 0.028)),
      emblemMaterials[0],
    )
    const angle = (i / 12) * Math.PI * 2
    tick.position.set(Math.cos(angle) * 1.02, Math.sin(angle) * 1.02, 0)
    tick.rotation.z = angle
    emblem.add(tick)
  }

  const emblemLight = new THREE.PointLight(0xffc79a, 4.5, 6, 2)
  emblemLight.position.set(0.4, 0.5, 1.4)
  emblem.add(emblemLight)

  // ---------------------------------------------------------------- helpers
  function cameraAt(progress) {
    let index = 0
    while (index < CAMERA_KEYS.length - 2 && progress > CAMERA_KEYS[index + 1].p) index += 1
    const from = CAMERA_KEYS[index]
    const to = CAMERA_KEYS[index + 1]
    const t = smooth(from.p, to.p, progress)
    // a portrait frame needs its own framing: further back at the strike and
    // further back again for the emblem, so nothing is cropped
    const depth = mobile ? lerp(1.42, 1.92, smooth(0.58, 0.74, progress)) : 1
    const height = mobile ? 1.02 : 1
    const pos = mix3(from.pos, to.pos, t)
    const tgt = mix3(from.tgt, to.tgt, t)
    return {
      pos: [pos[0], pos[1] * height, pos[2] * depth],
      tgt: [tgt[0], tgt[1] - (mobile ? 0.06 : 0), tgt[2] * depth],
      fov: lerp(from.fov, to.fov, t) + (mobile ? 3 : 0),
    }
  }

  function hammerHeight(progress) {
    const keys = [
      { p: 0, y: 2.9, ease: 'hold' },
      { p: 0.3, y: 2.9, ease: 'out' },
      { p: 0.38, y: 2.42, ease: 'in' },
      { p: 0.44, y: 0.34, ease: 'out' },
      { p: 0.47, y: 2.52, ease: 'in' },
      { p: 0.505, y: 0.34, ease: 'out' },
      { p: 0.535, y: 2.42, ease: 'in' },
      { p: 0.565, y: 0.34, ease: 'out' },
      { p: 0.62, y: 3.1, ease: 'out' },
      { p: 0.74, y: 4.6, ease: 'out' },
      { p: 0.9, y: 4.6, ease: 'hold' },
      { p: 1, y: 4.6 },
    ]
    let index = 0
    while (index < keys.length - 2 && progress > keys[index + 1].p) index += 1
    const from = keys[index]
    const to = keys[index + 1]
    if (to.ease === 'hold') return to.y
    const raw = clamp01((progress - from.p) / (to.p - from.p || 1e-6))
    const eased = to.ease === 'in' ? Math.pow(raw, 2.4) : 1 - Math.pow(1 - raw, 2.4)
    return lerp(from.y, to.y, eased)
  }

  function update(progress, pointer, time) {
    const p = clamp01(progress)
    const cam = cameraAt(p)

    const impulse = IMPACTS.reduce(
      (sum, point) => sum + Math.exp(-Math.pow((p - point) / 0.014, 2)),
      0,
    )
    const shakeX = impulse * 0.05 * Math.sin(p * 1400)
    const shakeY = impulse * 0.06 * Math.sin(p * 1050 + 1.3)

    const px = (pointer?.x || 0) * 0.22
    const py = (pointer?.y || 0) * 0.13

    camera.position.set(
      cam.pos[0] + shakeX + px,
      cam.pos[1] + shakeY - py,
      cam.pos[2],
    )
    camera.fov = cam.fov
    camera.updateProjectionMatrix()
    camera.lookAt(cam.tgt[0] + px * 0.35, cam.tgt[1] - py * 0.35, cam.tgt[2])

    // furnace glow breathes instead of sounding
    const breath = 0.86 + Math.sin(time * 1.35) * 0.07 + Math.sin(time * 2.7 + 1.1) * 0.04
    // the hall dims as the emblem takes over the frame, leaving it in deep space
    const clear = smooth(0.58, 0.71, p)
    furnaceLight.intensity = (42 * breath + impulse * 16) * (1 - clear)
    keyLight.intensity = 15 * (1 - clear * 0.9)
    rimLight.intensity = 8 * (1 - clear * 0.75)
    furnaceMouth.material.opacity = (0.82 + Math.sin(time * 1.7) * 0.06) * (1 - clear)
    furnaceHalo.material.opacity = (0.42 + Math.sin(time * 1.1) * 0.06) * (1 - clear)
    floorGlow.material.opacity = 0.3 * (1 - clear)

    const stageOn = clear < 0.999
    hall.visible = stageOn
    floor.visible = stageOn
    contactShadow.visible = stageOn
    furnace.visible = stageOn
    floorGlow.visible = stageOn

    // hammer + strike response; the machine recedes once the emblem is forged
    ram.position.y = hammerHeight(p)
    ram.position.x = 0
    hammer.position.z = -2.2 * smooth(0.6, 0.73, p)

    const strikeCount = IMPACTS.filter((point) => p >= point).length
    const heat = 1 + strikeCount * 0.22 + impulse * 1.6
    materials.ingot.emissiveIntensity = heat * 0.7 + Math.sin(time * 2.4) * 0.08
    ingotCore.material.emissiveIntensity = heat * 1.15
    ingot.scale.set(1 + strikeCount * 0.09, 1 - strikeCount * 0.16, 1 + strikeCount * 0.06)
    ingotGlow.material.opacity = (0.4 + strikeCount * 0.12) * (1 - smooth(0.58, 0.65, p)) + impulse * 0.5
    emberLight.intensity = 6 + strikeCount * 2.4 + impulse * 22

    // metal fragments lift toward the emblem
    const lift = smooth(0.575, 0.68, p)
    const chunkFade = smooth(0.575, 0.62, p) * (1 - smooth(0.67, 0.73, p))
    chunks.forEach((chunk, index) => {
      const angle = (index / 3) * Math.PI * 2 + 0.6
      chunk.position.set(
        lerp(0.13 * Math.cos(angle), 0.42 * Math.cos(angle), lift),
        lerp(0.2, 2.35 + Math.sin(angle) * 0.26, lift),
        lerp(0.1 * Math.sin(angle), 0.24 * Math.sin(angle), lift),
      )
      chunk.rotation.y = time * 0.2 + index
      chunk.rotation.x = time * 0.14
      chunk.material.opacity = chunkFade
      chunk.material.emissiveIntensity = 1.2 + Math.sin(time * 3 + index) * 0.2
      chunk.visible = chunkFade > 0.001
    })

    // ingot yields once the fragments take over
    ingot.visible = p < 0.66
    ingotGlow.visible = p < 0.66

    // emblem forms out of the cooled metal
    const emblemIn = smooth(0.655, 0.75, p)
    emblem.visible = emblemIn > 0.002
    emblemMaterials.forEach((material) => {
      material.opacity = emblemIn
    })
    const scale = 0.84 + smooth(0.7, 0.84, p) * 0.16
    emblem.scale.setScalar(scale)
    emblem.rotation.y = lerp(0.5, 0.04, smooth(0.68, 0.86, p))
    emblem.rotation.x = lerp(-0.18, -0.02, smooth(0.68, 0.86, p))
    emblemLight.intensity = emblemIn * 4.5

    // sparks — deterministic so reverse scrolling rewinds them
    for (let i = 0; i < sparkCount; i += 1) {
      const seed = sparkSeeds[i]
      const origin = IMPACTS[seed.burst]
      const t = clamp01((p - origin - seed.offset) / 0.07)
      const positionIndex = i * 3
      if (t <= 0 || t >= 1) {
        sparkAlphas[i] = 0
        sparkPositions[positionIndex] = 0
        sparkPositions[positionIndex + 1] = -2
        sparkPositions[positionIndex + 2] = 0
        continue
      }
      sparkPositions[positionIndex] = seed.vx * t * 0.75
      sparkPositions[positionIndex + 1] = 0.16 + seed.vy * t - 2.6 * t * t
      sparkPositions[positionIndex + 2] = seed.vz * t * 0.75
      sparkAlphas[i] = Math.pow(1 - t, 1.4)
    }
    sparkGeometry.attributes.position.needsUpdate = true
    sparkGeometry.attributes.aAlpha.needsUpdate = true

    // shockwaves
    shockwaves.forEach((wave, index) => {
      const origin = IMPACTS[index]
      const t = clamp01((p - origin) / 0.05)
      wave.visible = t > 0 && t < 1
      wave.scale.setScalar(0.6 + t * 4.4)
      wave.material.opacity = (1 - t) * 0.32
    })

    // ambient smoke and embers — the haze clears for the revelation
    const smokeFade = 1 - smooth(0.5, 0.66, p)
    smoke.forEach((sprite, index) => {
      const { base, speed, sway, opacity } = sprite.userData
      sprite.position.y = base.y + ((time * speed) % 3.2)
      sprite.position.x = base.x + Math.sin(time * 0.18 + sway + index) * 0.5
      sprite.position.z = base.z + Math.cos(time * 0.12 + sway) * 0.3
      sprite.material.opacity = opacity * smokeFade
    })

    const emberPositionsAttr = emberGeometry.attributes.position
    for (let i = 0; i < emberCount; i += 1) {
      const seed = emberSeeds[i]
      const drift = (time * seed.speed + seed.phase) % 1
      emberPositionsAttr.array[i * 3] = seed.x + Math.sin(time * 0.4 + seed.phase) * 0.3
      emberPositionsAttr.array[i * 3 + 1] = seed.y + drift * 2.6
      emberPositionsAttr.array[i * 3 + 2] = seed.z
    }
    emberPositionsAttr.needsUpdate = true

    renderer.render(scene, camera)
  }

  function resize() {
    const width = canvas.clientWidth || window.innerWidth
    const height = canvas.clientHeight || window.innerHeight
    renderer.setSize(width, height, false)
    camera.aspect = width / Math.max(1, height)
    camera.updateProjectionMatrix()
  }

  function dispose() {
    renderer.setAnimationLoop(null)
    scene.traverse((child) => {
      if (child.geometry) child.geometry.dispose()
      if (child.material) {
        const list = Array.isArray(child.material) ? child.material : [child.material]
        list.forEach((material) => {
          if (material.map) material.map.dispose()
          material.dispose()
        })
      }
    })
    disposables.forEach((item) => {
      if (item && typeof item.dispose === 'function') item.dispose()
    })
    envTarget.dispose()
    pmrem.dispose()
    renderer.dispose()
  }

  resize()
  update(0, { x: 0, y: 0 }, 0)

  return { update, resize, dispose }
}
