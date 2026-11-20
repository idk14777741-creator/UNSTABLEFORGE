import * as THREE from 'three'

/**
 * The constellation.
 *
 * Scene 05–08 of the homepage sequence: the forged emblem becomes a passage,
 * the passage opens into a field of particles, the particles settle into a
 * constellation of challenge domains, and finally the field contracts back
 * into a single ember.
 *
 * Like the forge world, everything is a pure function of a normalised scroll
 * progress value plus slow ambient time, so scrolling backwards rewinds it.
 */

const clamp01 = (value) => (value < 0 ? 0 : value > 1 ? 1 : value)
const smooth = (a, b, value) => {
  const t = clamp01((value - a) / (b - a || 1e-6))
  return t * t * (3 - 2 * t)
}
const lerp = (a, b, t) => a + (b - a) * t

const CENTER = { x: 0, y: 0, z: -12 }
const SHELL = 5.35

const CAMERA_KEYS = [
  { p: 0, z: 8.6, y: 0.28, fov: 42 },
  { p: 0.07, z: 5.7, y: 0.3, fov: 42 },
  { p: 0.18, z: 1.9, y: 0.34, fov: 44 },
  { p: 0.46, z: -1.1, y: 0.5, fov: 46 },
  { p: 0.78, z: -2.9, y: 0.42, fov: 46 },
  { p: 1, z: -3.5, y: 0.36, fov: 44 },
]

const PARTICLE_COLORS = [0xffe9cd, 0xf2d5b0, 0xdfb083, 0xc98b56, 0xb46b33]

function mulberry32(seed) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function makeGlow(size = 128) {
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
  gradient.addColorStop(0, 'rgba(255,248,236,1)')
  gradient.addColorStop(0.18, 'rgba(255,214,170,0.9)')
  gradient.addColorStop(0.44, 'rgba(226,140,74,0.32)')
  gradient.addColorStop(0.72, 'rgba(150,72,28,0.08)')
  gradient.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, size, size)
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  return texture
}

function cameraAt(progress, mobile) {
  let index = 0
  while (index < CAMERA_KEYS.length - 2 && progress > CAMERA_KEYS[index + 1].p) index += 1
  const from = CAMERA_KEYS[index]
  const to = CAMERA_KEYS[index + 1]
  const t = smooth(from.p, to.p, progress)
  return {
    z: lerp(from.z, to.z, t) * (mobile ? 1.34 : 1),
    y: lerp(from.y, to.y, t),
    fov: lerp(from.fov, to.fov, t) + (mobile ? 2 : 0),
  }
}

export function createConstellationWorld({ canvas, nodeCount = 12, mobile = false }) {
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
  renderer.setClearColor(0x060403, 1)
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.06
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, mobile ? 1.4 : 1.7))

  const scene = new THREE.Scene()
  scene.fog = new THREE.FogExp2(0x070504, 0.026)

  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 90)
  camera.position.set(0, 0.28, 8.6)

  const glow = track(makeGlow(160))
  const rand = mulberry32(0x0c3c0de)

  // ------------------------------------------------------------ the passage
  const portal = new THREE.Group()
  portal.position.set(0, 0, 4.6)
  scene.add(portal)

  const ringMaterial = track(
    new THREE.MeshBasicMaterial({
      color: 0xd79a63,
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    }),
  )
  const portalRing = new THREE.Mesh(track(new THREE.TorusGeometry(2.35, 0.035, 10, 128)), ringMaterial)
  portal.add(portalRing)

  const portalRingFine = new THREE.Mesh(
    track(new THREE.TorusGeometry(2.05, 0.012, 8, 128)),
    ringMaterial,
  )
  portal.add(portalRingFine)

  const notchGeometry = track(new THREE.BoxGeometry(0.2, 0.03, 0.03))
  for (let i = 0; i < 18; i += 1) {
    const angle = (i / 18) * Math.PI * 2
    const notch = new THREE.Mesh(notchGeometry, ringMaterial)
    notch.position.set(Math.cos(angle) * 2.35, Math.sin(angle) * 2.35, 0)
    notch.rotation.z = angle + Math.PI / 2
    portal.add(notch)
  }

  const portalHalo = new THREE.Sprite(
    track(
      new THREE.SpriteMaterial({
        map: glow,
        color: 0xffb877,
        transparent: true,
        opacity: 0.5,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        toneMapped: false,
        fog: false,
      }),
    ),
  )
  portalHalo.scale.set(7, 7, 1)
  portal.add(portalHalo)

  const portalCore = new THREE.Sprite(
    track(
      new THREE.SpriteMaterial({
        map: glow,
        color: 0xffd9b4,
        transparent: true,
        opacity: 0.35,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        toneMapped: false,
        fog: false,
      }),
    ),
  )
  portalCore.scale.set(2.6, 2.6, 1)
  portal.add(portalCore)

  // ------------------------------------------------------------ nodes
  const nodeGroup = new THREE.Group()
  nodeGroup.position.set(CENTER.x, CENTER.y, CENTER.z)
  scene.add(nodeGroup)

  const nodes = []
  for (let i = 0; i < nodeCount; i += 1) {
    const y = 1 - (i / Math.max(1, nodeCount - 1)) * 2
    const radius = Math.sqrt(Math.max(0, 1 - y * y))
    const theta = i * 2.399963229728653
    const base = new THREE.Vector3(
      Math.cos(theta) * radius * (0.92 + rand() * 0.22),
      y * 0.74,
      Math.sin(theta) * radius * 0.86 * (0.9 + rand() * 0.2),
    ).multiplyScalar(SHELL)

    const halo = new THREE.Sprite(
      track(
        new THREE.SpriteMaterial({
          map: glow,
          color: 0xffdcb6,
          transparent: true,
          opacity: 0,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          toneMapped: false,
          fog: false,
        }),
      ),
    )
    halo.position.copy(base)
    halo.scale.setScalar(1.5)
    nodeGroup.add(halo)

    const core = new THREE.Sprite(
      track(
        new THREE.SpriteMaterial({
          map: glow,
          color: 0xfff4e6,
          transparent: true,
          opacity: 0,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          toneMapped: false,
          fog: false,
        }),
      ),
    )
    core.position.copy(base)
    core.scale.setScalar(0.55)
    nodeGroup.add(core)

    nodes.push({ base, halo, core, index: i })
  }

  // ------------------------------------------------------------ connections
  const edgePairs = []
  const seen = new Set()
  const connect = (a, b) => {
    const low = Math.min(a, b)
    const high = Math.max(a, b)
    const key = `${low}:${high}`
    if (low === high || seen.has(key)) return
    seen.add(key)
    edgePairs.push([low, high])
  }
  nodes.forEach((node, index) => {
    const distances = nodes
      .map((other, otherIndex) => ({
        otherIndex,
        distance: node.base.distanceTo(other.base),
      }))
      .filter((entry) => entry.otherIndex !== index)
      .sort((a, b) => a.distance - b.distance)
    distances.slice(0, 1).forEach((entry) => connect(index, entry.otherIndex))
  })
  // a few long threads so the field reads as one structure, never a diagram
  for (let i = 0; i < nodeCount; i += 1) {
    connect(i, (i + Math.round(nodeCount / 4)) % nodeCount)
  }

  const edgePositions = new Float32Array(edgePairs.length * 6)
  const edgeColors = new Float32Array(edgePairs.length * 6)
  edgePairs.forEach(([a, b], index) => {
    const from = nodes[a].base
    const to = nodes[b].base
    edgePositions.set([from.x, from.y, from.z, to.x, to.y, to.z], index * 6)
  })

  const edgeGeometry = track(new THREE.BufferGeometry())
  edgeGeometry.setAttribute('position', new THREE.BufferAttribute(edgePositions, 3))
  edgeGeometry.setAttribute('color', new THREE.BufferAttribute(edgeColors, 3))

  const edges = new THREE.LineSegments(
    edgeGeometry,
    track(
      new THREE.LineBasicMaterial({
        vertexColors: true,
        transparent: true,
        opacity: 0.9,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        toneMapped: false,
      }),
    ),
  )
  edges.frustumCulled = false
  nodeGroup.add(edges)

  // ------------------------------------------------------------ particles
  const particleCount = mobile ? 520 : 1500
  const particleBase = new Float32Array(particleCount * 3)
  const particleStart = new Float32Array(particleCount * 3)
  const particlePositions = new Float32Array(particleCount * 3)
  const particleColors = new Float32Array(particleCount * 3)
  const particleStagger = new Float32Array(particleCount)

  const palette = PARTICLE_COLORS.map((hex) => new THREE.Color(hex))
  for (let i = 0; i < particleCount; i += 1) {
    const y = 1 - (i / Math.max(1, particleCount - 1)) * 2
    const radius = Math.sqrt(Math.max(0, 1 - y * y))
    const theta = i * 2.399963229728653 + rand() * 0.35
    const scale = 0.5 + rand() * 0.62
    particleBase[i * 3] = Math.cos(theta) * radius * SHELL * scale
    particleBase[i * 3 + 1] = y * SHELL * 0.78 * scale + (rand() - 0.5) * 0.4
    particleBase[i * 3 + 2] = Math.sin(theta) * radius * SHELL * 0.9 * scale

    const diskAngle = rand() * Math.PI * 2
    const diskRadius = Math.pow(rand(), 0.6) * 1.9
    particleStart[i * 3] = Math.cos(diskAngle) * diskRadius
    particleStart[i * 3 + 1] = Math.sin(diskAngle) * diskRadius * 0.9
    particleStart[i * 3 + 2] = 4.65 + (rand() - 0.5) * 0.4

    const color = palette[Math.floor(rand() * palette.length)]
    particleColors[i * 3] = color.r
    particleColors[i * 3 + 1] = color.g
    particleColors[i * 3 + 2] = color.b

    particleStagger[i] = rand()
  }

  const particleGeometry = track(new THREE.BufferGeometry())
  particleGeometry.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3))
  particleGeometry.setAttribute('color', new THREE.BufferAttribute(particleColors, 3))

  const particles = new THREE.Points(
    particleGeometry,
    track(
      new THREE.PointsMaterial({
        map: glow,
        size: mobile ? 0.12 : 0.095,
        sizeAttenuation: true,
        vertexColors: true,
        transparent: true,
        opacity: 0.9,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        toneMapped: false,
      }),
    ),
  )
  particles.frustumCulled = false
  scene.add(particles)

  // ------------------------------------------------------------ ember
  const ember = new THREE.Sprite(
    track(
      new THREE.SpriteMaterial({
        map: glow,
        color: 0xffb579,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        toneMapped: false,
        fog: false,
      }),
    ),
  )
  ember.position.set(CENTER.x, CENTER.y, CENTER.z)
  ember.scale.setScalar(1)
  scene.add(ember)

  // ------------------------------------------------------------ state
  const projected = nodes.map(() => ({ x: 0.5, y: 0.5, visible: false }))
  const vector = new THREE.Vector3()
  let focus = -1
  let lastRenderedProgress = -1

  const dimColor = new THREE.Color(0x6a5540)
  const litColor = new THREE.Color(0xc9975f)
  const focusColor = new THREE.Color(0xffd7a6)

  function updateEdges(progress) {
    const contract = smooth(0.86, 0.99, progress)
    edgePairs.forEach(([a, b], index) => {
      const litA = nodeLight(a, progress)
      const litB = nodeLight(b, progress)
      const lit = Math.min(litA, litB)
      const touching = focus >= 0 && (a === focus || b === focus)
      const strength = touching ? 1 : lit * 0.85
      const color = touching ? focusColor : lit > 0.02 ? litColor : dimColor
      const alpha = (touching ? 0.8 : 0.05 + lit * 0.2) * (1 - contract)
      const offset = index * 6
      for (let corner = 0; corner < 2; corner += 1) {
        const base = offset + corner * 3
        edgeColors[base] = color.r * alpha
        edgeColors[base + 1] = color.g * alpha
        edgeColors[base + 2] = color.b * alpha
      }
    })
    edgeGeometry.attributes.color.needsUpdate = true
  }

  function nodeLight(index, progress) {
    const order = index / Math.max(1, nodeCount)
    const start = 0.16 + order * 0.34
    const lit = smooth(start, start + 0.1, progress)
    return index === focus ? Math.max(lit, 0.9) : lit
  }

  function update(progress, pointer, time) {
    const p = clamp01(progress)
    lastRenderedProgress = p

    const cam = cameraAt(p, mobile)
    const parallaxX = (pointer?.x || 0) * 0.55
    const parallaxY = (pointer?.y || 0) * 0.3

    camera.position.set(
      lerp(camera.position.x, parallaxX * 0.35, 0.12),
      cam.y - parallaxY * 0.25,
      cam.z,
    )
    camera.fov = cam.fov
    camera.updateProjectionMatrix()
    camera.lookAt(CENTER.x + parallaxX, CENTER.y + 0.12 - parallaxY * 0.2, CENTER.z)

    // the emblem becomes a passage, then dissolves
    const approached = smooth(0, 0.12, p)
    portal.scale.setScalar(1 + approached * 0.85)
    ringMaterial.opacity = (1 - smooth(0.03, 0.15, p)) * 0.92
    portalHalo.material.opacity = (1 - smooth(0.01, 0.12, p)) * 0.26
    portalCore.material.opacity = (1 - smooth(0, 0.08, p)) * 0.22

    const contract = smooth(0.86, 0.99, p)

    // particles travel from the passage into the field
    const positions = particleGeometry.attributes.position.array
    for (let i = 0; i < particleCount; i += 1) {
      const stagger = particleStagger[i]
      const t = smooth(0.05 + stagger * 0.2, 0.44 + stagger * 0.2, p)
      const index = i * 3
      const drift = (1 - contract) * t
      let x = lerp(particleStart[index], particleBase[index], t)
      let y = lerp(particleStart[index + 1], particleBase[index + 1], t)
      let z = lerp(particleStart[index + 2], particleBase[index + 2], t)

      x += Math.sin(time * 0.32 + stagger * 12) * 0.06 * drift
      y += Math.cos(time * 0.27 + stagger * 9) * 0.06 * drift

      positions[index] = lerp(x, CENTER.x, contract)
      positions[index + 1] = lerp(y, CENTER.y, contract)
      positions[index + 2] = lerp(z, CENTER.z, contract)
    }
    particleGeometry.attributes.position.needsUpdate = true
    particles.material.opacity =
      (0.16 + 0.72 * smooth(0.02, 0.13, p)) * (1 - smooth(0.9, 0.995, p))

    // nodes assemble out of the field
    nodes.forEach((node, index) => {
      const order = index / Math.max(1, nodeCount)
      const appear = smooth(0.18 + order * 0.3, 0.44 + order * 0.26, p)
      const lit = nodeLight(index, p)
      const isFocus = index === focus
      const pulse = 0.82 + Math.sin(time * 1.1 + index) * 0.1
      const presence = appear * (1 - contract)

      node.halo.position.copy(node.base).multiplyScalar(1 - contract)
      node.core.position.copy(node.halo.position)
      node.halo.scale.setScalar((isFocus ? 2.1 : 1.35) * (0.35 + lit * 0.75) * pulse)
      node.core.scale.setScalar((isFocus ? 0.95 : 0.5) * (0.4 + lit * 0.7))
      node.halo.material.opacity = presence * (0.16 + lit * 0.62)
      node.core.material.opacity = presence * (0.25 + lit * 0.75)
      node.halo.material.color.setHex(isFocus ? 0xffe3c1 : 0xffcfa1)
    })

    updateEdges(p)

    // the whole field returns to a single ember on the anvil
    ember.material.opacity = contract * 0.95
    ember.scale.setScalar(0.5 + contract * 1.9 + Math.sin(time * 1.6) * 0.04)

    renderer.render(scene, camera)

    const width = canvas.clientWidth || 1
    const height = canvas.clientHeight || 1
    nodes.forEach((node, index) => {
      node.halo.getWorldPosition(vector)
      vector.project(camera)
      projected[index].x = (vector.x * 0.5 + 0.5) * width
      projected[index].y = (-vector.y * 0.5 + 0.5) * height
      projected[index].visible =
        contract < 0.45 &&
        vector.z < 1 &&
        vector.z > -1 &&
        projected[index].x > -80 &&
        projected[index].x < width + 80 &&
        projected[index].y > -60 &&
        projected[index].y < height + 60
    })
  }

  function resize() {
    const width = canvas.clientWidth || window.innerWidth
    const height = canvas.clientHeight || window.innerHeight
    renderer.setSize(width, height, false)
    camera.aspect = width / Math.max(1, height)
    camera.updateProjectionMatrix()
    if (lastRenderedProgress >= 0) update(lastRenderedProgress, { x: 0, y: 0 }, 0)
  }

  function screenNodes() {
    return projected
  }

  function setFocus(index) {
    focus = typeof index === 'number' ? index : -1
  }

  function dispose() {
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
    renderer.dispose()
  }

  resize()
  update(0, { x: 0, y: 0 }, 0)

  return { update, resize, dispose, screenNodes, setFocus }
}
