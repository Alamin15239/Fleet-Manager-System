"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"

const chapters = [
  { eyebrow: "BUILT FOR THE LONG HAUL", title: "Every kilometre has a story.", copy: "Bring every truck, trailer, and service record into one clear view." },
  { eyebrow: "MAINTENANCE, IN MOTION", title: "Keep your fleet moving.", copy: "Plan preventive work, track breakdowns, and keep workshop activity connected." },
  { eyebrow: "ONE CONNECTED WORKSPACE", title: "Control the details. See the whole fleet.", copy: "Tires, oil changes, job cards, documents, and costs—organized in one place." },
]

type Vec3 = [number, number, number]
type Mat4 = Float32Array

function perspective(fov: number, aspect: number, near: number, far: number): Mat4 {
  const f = 1 / Math.tan(fov / 2)
  const out = new Float32Array(16)
  out[0] = f / aspect; out[5] = f; out[10] = (far + near) / (near - far)
  out[11] = -1; out[14] = (2 * far * near) / (near - far)
  return out
}
function lookAt(eye: Vec3, target: Vec3): Mat4 {
  let zx = eye[0] - target[0], zy = eye[1] - target[1], zz = eye[2] - target[2]
  let n = Math.hypot(zx, zy, zz) || 1; zx /= n; zy /= n; zz /= n
  let xx = zz, xy = 0, xz = -zx
  n = Math.hypot(xx, xy, xz) || 1; xx /= n; xy /= n; xz /= n
  const yx = zy * xz - zz * xy, yy = zz * xx - zx * xz, yz = zx * xy - zy * xx
  return new Float32Array([
    xx, yx, zx, 0, xy, yy, zy, 0, xz, yz, zz, 0,
    -(xx * eye[0] + xy * eye[1] + xz * eye[2]),
    -(yx * eye[0] + yy * eye[1] + yz * eye[2]),
    -(zx * eye[0] + zy * eye[1] + zz * eye[2]), 1,
  ])
}
function multiply(a: Mat4, b: Mat4): Mat4 {
  const out = new Float32Array(16)
  for (let c = 0; c < 4; c++) for (let row = 0; row < 4; row++) {
    out[c * 4 + row] = a[row] * b[c * 4] + a[4 + row] * b[c * 4 + 1] + a[8 + row] * b[c * 4 + 2] + a[12 + row] * b[c * 4 + 3]
  }
  return out
}
function modelMatrix(position: Vec3, scale: Vec3, rotation: Vec3 = [0, 0, 0]): Mat4 {
  const [rx, ry, rz] = rotation, cx = Math.cos(rx), sx = Math.sin(rx), cy = Math.cos(ry), sy = Math.sin(ry), cz = Math.cos(rz), sz = Math.sin(rz)
  const out = new Float32Array(16)
  out[0] = (cy * cz) * scale[0]; out[1] = (cy * sz) * scale[0]; out[2] = (-sy) * scale[0]
  out[4] = (sx * sy * cz - cx * sz) * scale[1]; out[5] = (sx * sy * sz + cx * cz) * scale[1]; out[6] = (sx * cy) * scale[1]
  out[8] = (cx * sy * cz + sx * sz) * scale[2]; out[9] = (cx * sy * sz - sx * cz) * scale[2]; out[10] = (cx * cy) * scale[2]
  out[12] = position[0]; out[13] = position[1]; out[14] = position[2]; out[15] = 1
  return out
}

function initTruckScene(canvas: HTMLCanvasElement, progressRef: { current: number }, reducedRef: { current: boolean }) {
  const gl = canvas.getContext("webgl", { alpha: true, antialias: true, powerPreference: "low-power" })
  if (!gl) return () => {}
  const vertex = `
    attribute vec3 aPosition;
    attribute vec3 aNormal;
    uniform mat4 uMvp;
    uniform mat4 uModel;
    varying vec3 vNormal;
    varying vec3 vWorld;
    void main() {
      vec4 world = uModel * vec4(aPosition, 1.0);
      vWorld = world.xyz;
      vNormal = normalize(mat3(uModel) * aNormal);
      gl_Position = uMvp * vec4(aPosition, 1.0);
    }`
  const fragment = `
    precision mediump float;
    uniform vec3 uColor;
    uniform vec3 uCamera;
    uniform float uEmissive;
    varying vec3 vNormal;
    varying vec3 vWorld;
    void main() {
      vec3 n = normalize(vNormal);
      vec3 key = normalize(vec3(-0.45, 0.85, 0.65));
      float diffuse = max(dot(n, key), 0.0);
      float rim = pow(1.0 - max(dot(n, normalize(uCamera - vWorld)), 0.0), 2.0);
      vec3 color = uColor * (0.34 + diffuse * 0.78) + vec3(0.12, 0.34, 0.58) * rim * 0.48;
      color += uColor * uEmissive;
      gl_FragColor = vec4(color, 1.0);
    }`
  const compile = (type: number, source: string) => {
    const shader = gl.createShader(type)
    if (!shader) throw new Error("WebGL shader unavailable")
    gl.shaderSource(shader, source); gl.compileShader(shader)
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader) || "Shader compile failed")
    return shader
  }
  let program: WebGLProgram
  try {
    program = gl.createProgram()!
    gl.attachShader(program, compile(gl.VERTEX_SHADER, vertex))
    gl.attachShader(program, compile(gl.FRAGMENT_SHADER, fragment))
    gl.linkProgram(program)
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error("Shader link failed")
  } catch {
    return () => {}
  }
  gl.useProgram(program)
  const posLoc = gl.getAttribLocation(program, "aPosition")
  const normLoc = gl.getAttribLocation(program, "aNormal")
  const mvpLoc = gl.getUniformLocation(program, "uMvp")
  const modelLoc = gl.getUniformLocation(program, "uModel")
  const colorLoc = gl.getUniformLocation(program, "uColor")
  const cameraLoc = gl.getUniformLocation(program, "uCamera")
  const emissiveLoc = gl.getUniformLocation(program, "uEmissive")

  const cubePositions: number[] = [], cubeNormals: number[] = []
  const faces: Array<{ n: Vec3; v: Vec3[] }> = [
    { n: [0, 0, 1], v: [[-1,-1,1],[1,-1,1],[1,1,1],[-1,-1,1],[1,1,1],[-1,1,1]] },
    { n: [0, 0, -1], v: [[1,-1,-1],[-1,-1,-1],[-1,1,-1],[1,-1,-1],[-1,1,-1],[1,1,-1]] },
    { n: [1, 0, 0], v: [[1,-1,1],[1,-1,-1],[1,1,-1],[1,-1,1],[1,1,-1],[1,1,1]] },
    { n: [-1, 0, 0], v: [[-1,-1,-1],[-1,-1,1],[-1,1,1],[-1,-1,-1],[-1,1,1],[-1,1,-1]] },
    { n: [0, 1, 0], v: [[-1,1,1],[1,1,1],[1,1,-1],[-1,1,1],[1,1,-1],[-1,1,-1]] },
    { n: [0, -1, 0], v: [[-1,-1,-1],[1,-1,-1],[1,-1,1],[-1,-1,-1],[1,-1,1],[-1,-1,1]] },
  ]
  faces.forEach(face => face.v.forEach(v => { cubePositions.push(...v); cubeNormals.push(...face.n) }))
  const cubeBuffer = gl.createBuffer()!
  gl.bindBuffer(gl.ARRAY_BUFFER, cubeBuffer); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([...cubePositions, ...cubeNormals]), gl.STATIC_DRAW)
  const cubeVertexCount = cubePositions.length / 3

  const cylinderPositions: number[] = [], cylinderNormals: number[] = []
  const segments = 24
  for (let i = 0; i < segments; i++) {
    const a = (i / segments) * Math.PI * 2, b = ((i + 1) / segments) * Math.PI * 2
    const p: Vec3[] = [[Math.cos(a),-1,Math.sin(a)],[Math.cos(b),-1,Math.sin(b)],[Math.cos(b),1,Math.sin(b)],[Math.cos(a),-1,Math.sin(a)],[Math.cos(b),1,Math.sin(b)],[Math.cos(a),1,Math.sin(a)]]
    p.forEach(v => { cylinderPositions.push(...v); cylinderNormals.push(v[0], 0, v[2]) })
    const capA: Vec3 = [0,-1,0], capB: Vec3 = [0,1,0]
    ;[capA,[Math.cos(b),-1,Math.sin(b)],[Math.cos(a),-1,Math.sin(a)],capB,[Math.cos(a),1,Math.sin(a)],[Math.cos(b),1,Math.sin(b)]].forEach((v, j) => {
      cylinderPositions.push(...v); cylinderNormals.push(0, j < 3 ? -1 : 1, 0)
    })
  }
  const wheelBuffer = gl.createBuffer()!
  gl.bindBuffer(gl.ARRAY_BUFFER, wheelBuffer); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([...cylinderPositions, ...cylinderNormals]), gl.STATIC_DRAW)
  const wheelVertexCount = cylinderPositions.length / 3

  const box = (position: Vec3, scale: Vec3, color: Vec3, rotation: Vec3 = [0,0,0], emissive = 0) => ({ position, scale, color, rotation, emissive, kind: "box" as const })
  const wheel = (x: number, z: number, y = 0.48) => [
    { ...box([x,y,z], [0.43,0.43,0.17], [0.025,0.04,0.065], [Math.PI / 2,0,0]), kind: "wheel" as const },
    { ...box([x,y,z + (z > 0 ? 0.18 : -0.18)], [0.25,0.25,0.025], [0.42,0.53,0.65], [Math.PI / 2,0,0]), kind: "wheel" as const },
    { ...box([x,y,z + (z > 0 ? 0.21 : -0.21)], [0.075,0.075,0.03], [0.82,0.9,0.96], [Math.PI / 2,0,0]), kind: "wheel" as const },
  ]
  const objects = [
    box([-1.65,1.85,0], [2.85,1.28,1.16], [0.86,0.91,0.96]),
    box([-1.65,0.54,0], [3.0,0.17,0.57], [0.09,0.15,0.23]),
    box([-1.65,0.76,0], [2.72,0.08,0.65], [0.24,0.32,0.43]),
    box([1.42,0.56,0], [1.82,0.16,0.56], [0.07,0.1,0.16]),
    box([1.9,1.35,0], [0.9,1.16,0.79], [0.025,0.22,0.58]),
    box([2.42,0.95,0], [0.58,0.64,0.8], [0.02,0.16,0.42]),
    box([1.88,2.02,0], [0.76,0.12,0.74], [0.03,0.31,0.72]),
    box([2.12,1.78,0.81], [0.48,0.48,0.035], [0.55,0.83,0.96], [0,0,-0.12]),
    box([2.12,1.78,-0.81], [0.48,0.48,0.035], [0.55,0.83,0.96], [0,0,-0.12]),
    box([2.89,0.88,0.43], [0.12,0.16,0.09], [1,0.84,0.46], [0,0,0], 0.8),
    box([2.89,0.88,-0.43], [0.12,0.16,0.09], [1,0.84,0.46], [0,0,0], 0.8),
    box([2.97,0.65,0], [0.12,0.12,0.52], [0.72,0.78,0.85]),
    box([-4.48,0.82,1.17], [0.12,0.09,0.035], [1,0.61,0.08], [0,0,0], 0.6),
    box([-3.35,0.82,1.17], [0.12,0.09,0.035], [1,0.61,0.08], [0,0,0], 0.6),
    box([-2.2,0.82,1.17], [0.12,0.09,0.035], [1,0.61,0.08], [0,0,0], 0.6),
    box([-1.05,0.82,1.17], [0.12,0.09,0.035], [1,0.61,0.08], [0,0,0], 0.6),
    box([0.1,0.82,1.17], [0.12,0.09,0.035], [1,0.61,0.08], [0,0,0], 0.6),
    box([-4.52,0.62,0], [0.18,0.18,0.28], [0.025,0.04,0.07]),
    ...wheel(-3.7,1.17), ...wheel(-3.7,-1.17), ...wheel(-1.4,1.17), ...wheel(-1.4,-1.17),
    ...wheel(0.9,0.86), ...wheel(0.9,-0.86), ...wheel(2.35,0.86), ...wheel(2.35,-0.86),
  ]
  const ground = box([0,0.01,0], [7.2,0.035,2.2], [0.045,0.075,0.12])
  let raf = 0
  const draw = () => {
    const rect = canvas.getBoundingClientRect()
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5)
    const width = Math.max(1, Math.floor(rect.width * dpr)), height = Math.max(1, Math.floor(rect.height * dpr))
    if (canvas.width !== width || canvas.height !== height) { canvas.width = width; canvas.height = height }
    gl.viewport(0, 0, width, height)
    gl.enable(gl.DEPTH_TEST); gl.enable(gl.CULL_FACE); gl.cullFace(gl.BACK)
    gl.clearColor(0,0,0,0); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT)
    const p = progressRef.current
    const angle = reducedRef.current ? 0.55 : 0.68 - p * 0.36
    const distance = (window.innerWidth < 640 ? 12.6 : 10.7) - (reducedRef.current ? 0 : Math.sin(p * Math.PI) * 0.7)
    const camera: Vec3 = [Math.sin(angle) * distance, 4.1 + p * 0.28, Math.cos(angle) * distance]
    const projection = perspective(0.67, width / Math.max(1,height), 0.1, 100)
    const view = lookAt(camera, [0,1.1,0])
    gl.uniform3fv(cameraLoc, camera)
    const drawObject = (obj: typeof ground | typeof objects[number]) => {
      const buffer = obj.kind === "wheel" ? wheelBuffer : cubeBuffer
      const count = obj.kind === "wheel" ? wheelVertexCount : cubeVertexCount
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
      gl.enableVertexAttribArray(posLoc); gl.vertexAttribPointer(posLoc,3,gl.FLOAT,false,0,0)
      gl.enableVertexAttribArray(normLoc); gl.vertexAttribPointer(normLoc,3,gl.FLOAT,false,0,count*3*4)
      const model = modelMatrix(obj.position, obj.scale, obj.rotation)
      gl.uniformMatrix4fv(modelLoc,false,model)
      gl.uniformMatrix4fv(mvpLoc,false,multiply(multiply(projection,view),model))
      gl.uniform3fv(colorLoc,obj.color); gl.uniform1f(emissiveLoc,obj.emissive)
      gl.drawArrays(gl.TRIANGLES,0,count)
    }
    drawObject(ground)
    objects.forEach(drawObject)
    raf = requestAnimationFrame(draw)
  }
  draw()
  return () => cancelAnimationFrame(raf)
}

export function TruckScrollExperience() {
  const runwayRef = useRef<HTMLElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const progressRef = useRef(0)
  const reducedRef = useRef(false)
  const [progress, setProgress] = useState(0)
  const [reducedMotion, setReducedMotion] = useState(false)
  const [webglAvailable, setWebglAvailable] = useState(true)

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)")
    const updateMotionPreference = () => {
      reducedRef.current = media.matches
      setReducedMotion(media.matches)
    }
    updateMotionPreference()
    media.addEventListener?.("change", updateMotionPreference)
    let frame = 0
    const update = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        const element = runwayRef.current
        if (!element || media.matches) {
          progressRef.current = 0
          setProgress(0)
          return
        }
        const rect = element.getBoundingClientRect()
        const travel = Math.max(1, element.offsetHeight - window.innerHeight)
        const next = Math.max(0, Math.min(1, -rect.top / travel))
        progressRef.current = next
        setProgress(next)
      })
    }
    update()
    window.addEventListener("scroll", update, { passive: true })
    window.addEventListener("resize", update)
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener("scroll", update)
      window.removeEventListener("resize", update)
      media.removeEventListener?.("change", updateMotionPreference)
    }
  }, [])

  useEffect(() => {
    if (!canvasRef.current) return
    const cleanup = initTruckScene(canvasRef.current, progressRef, reducedRef)
    const gl = canvasRef.current.getContext("webgl")
    setWebglAvailable(Boolean(gl))
    return cleanup
  }, [])

  const chapterIndex = progress < 0.32 ? 0 : progress < 0.68 ? 1 : 2
  const chapter = chapters[chapterIndex]

  return (
    <section ref={runwayRef} aria-label="Fleet Manager Pro 3D truck experience" className="truck-experience-runway relative bg-[#050b16] text-white">
      <div className="truck-experience-sticky sticky top-0 flex min-h-[100svh] items-center overflow-hidden">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_55%,rgba(24,102,190,0.28),transparent_56%),linear-gradient(110deg,#050b16_0%,#07182b_48%,#030811_100%)]" />
        <div className="truck-experience-grid pointer-events-none absolute inset-0 opacity-30" />
        <div className="pointer-events-none absolute left-1/2 top-1/2 h-[34rem] w-[34rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-blue-500/10 blur-[100px]" style={{ opacity: reducedMotion ? 0.25 : 0.2 + Math.sin(progress * Math.PI) * 0.42 }} />
        <div className="relative z-10 mx-auto grid min-h-[100svh] w-full max-w-[1500px] items-center gap-0 px-5 py-12 sm:px-8 lg:grid-cols-[0.78fr_1.22fr] lg:px-14">
          <div className="relative z-20 mx-auto w-full max-w-xl text-center lg:mx-0 lg:text-left">
            <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-sky-300 sm:text-xs">{chapter.eyebrow}</p>
            <h2 key={chapter.title} className="truck-chapter-title mt-4 text-4xl font-semibold leading-[1.04] tracking-[-0.045em] sm:text-5xl lg:text-6xl xl:text-7xl">{chapter.title}</h2>
            <p key={chapter.copy} className="mt-5 max-w-lg text-sm leading-7 text-slate-300 sm:text-base sm:leading-8">{chapter.copy}</p>
            <div className="mt-7 flex flex-wrap justify-center gap-3 lg:justify-start">
              <Link href="/signup" className="inline-flex min-h-11 items-center justify-center rounded-full bg-sky-300 px-5 text-sm font-bold text-slate-950 transition hover:bg-white">Get started</Link>
              <Link href="/purchase" className="inline-flex min-h-11 items-center justify-center rounded-full border border-white/20 bg-white/[0.04] px-5 text-sm font-semibold text-white transition hover:bg-white/10">Explore plans</Link>
            </div>
            <div className="mt-9 flex items-center justify-center gap-2 lg:justify-start" aria-label={`Chapter ${chapterIndex + 1} of 3`}>
              {chapters.map((item, index) => <span key={item.eyebrow} className={`h-1 rounded-full transition-all duration-300 ${index === chapterIndex ? "w-10 bg-sky-300" : "w-4 bg-white/25"}`} />)}
              <span className="ml-2 text-[10px] font-semibold tracking-[0.2em] text-slate-400">0{chapterIndex + 1} / 03</span>
            </div>
            <p className="mt-4 text-[10px] tracking-wide text-slate-500">FLEET MANAGER PRO · 3D FLEET EXPERIENCE</p>
          </div>

          <div className="relative mx-auto flex h-[390px] w-full items-center justify-center sm:h-[470px] lg:-ml-12 lg:h-[620px]">
            <div className="pointer-events-none absolute inset-x-0 bottom-[12%] h-24 rounded-[50%] bg-blue-500/20 blur-3xl" />
            <div className="truck-experience-speedline pointer-events-none absolute left-0 right-0 top-1/2 h-px bg-gradient-to-r from-transparent via-sky-300/50 to-transparent" />
            <div
              role="img"
              aria-label="Cinematic close-up of a modern semi truck on the road"
              className="truck-cinematic-hero relative z-10 h-full w-full overflow-hidden rounded-[2rem] border border-white/10 shadow-2xl"
              style={{
                backgroundImage: "linear-gradient(115deg,rgba(5,9,18,.12),rgba(5,9,18,.02)),url('https://images.pexels.com/photos/27508769/pexels-photo-27508769.jpeg?auto=compress&cs=tinysrgb&w=2400')",
                backgroundSize: `${112 + progress * 16}% auto`,
                backgroundPosition: `${54 - progress * 12}% ${52 + progress * 8}%`,
                transform: `perspective(1200px) rotateY(${-4 + progress * 8}deg) scale(${1 + Math.sin(progress * Math.PI) * .025})`,
                filter: `saturate(${1.05 + progress * .25}) contrast(${1.05 + progress * .1})`,
              }}
            >
              <div className="absolute inset-0 bg-gradient-to-t from-[#070b12]/75 via-transparent to-[#f97316]/10" />
              <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/50 to-transparent" />
              <div className="absolute left-5 top-5 rounded-full border border-orange-200/25 bg-black/35 px-3 py-1.5 text-[10px] font-bold tracking-[.22em] text-orange-100 backdrop-blur-md sm:left-7 sm:top-7">FLEET / MOTION 01</div>
              <div className="absolute bottom-5 left-5 right-5 flex items-end justify-between gap-3 sm:bottom-7 sm:left-7 sm:right-7">
                <div>
                  <p className="text-[10px] font-bold tracking-[.25em] text-orange-200">BUILT TO KEEP MOVING</p>
                  <p className="mt-1 text-lg font-semibold text-white drop-shadow sm:text-2xl">Power. Precision. Uptime.</p>
                </div>
                <span className="rounded-full border border-white/25 bg-black/30 px-3 py-2 text-[10px] tracking-[.18em] text-white/80 backdrop-blur">01 — 03</span>
              </div>
              <div className="pointer-events-none absolute inset-0 opacity-30" style={{ background: `radial-gradient(ellipse at ${30 + progress * 40}% ${25 + progress * 20}%, rgba(249,115,22,.32), transparent 45%)` }} />
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
