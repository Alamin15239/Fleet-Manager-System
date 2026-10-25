"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"

const chapters = [
  { eyebrow: "BUILT FOR THE LONG HAUL", title: "Every kilometre has a story.", copy: "Bring every truck, trailer, and service record into one clear view." },
  { eyebrow: "MAINTENANCE, IN MOTION", title: "Keep your fleet moving.", copy: "Plan preventive work, track breakdowns, and keep workshop activity connected." },
  { eyebrow: "ONE CONNECTED WORKSPACE", title: "Control the details. See the whole fleet.", copy: "Tires, oil changes, job cards, documents, and costs—organized in one place." },
]

export function TruckScrollExperience() {
  const runwayRef = useRef<HTMLElement | null>(null)
  const [progress, setProgress] = useState(0)
  const [reducedMotion, setReducedMotion] = useState(false)

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)")
    const updateMotionPreference = () => setReducedMotion(media.matches)
    updateMotionPreference()
    media.addEventListener?.("change", updateMotionPreference)

    let frame = 0
    const update = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        const element = runwayRef.current
        if (!element || media.matches) {
          setProgress(0)
          return
        }
        const rect = element.getBoundingClientRect()
        const travel = Math.max(1, element.offsetHeight - window.innerHeight)
        const next = Math.max(0, Math.min(1, -rect.top / travel))
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

  const chapterIndex = progress < 0.32 ? 0 : progress < 0.68 ? 1 : 2
  const chapter = chapters[chapterIndex]
  const truckX = reducedMotion ? 0 : (progress - 0.5) * 20
  const truckScale = reducedMotion ? 0.92 : 0.78 + progress * 0.3
  const glowOpacity = reducedMotion ? 0.35 : 0.2 + Math.sin(progress * Math.PI) * 0.42

  return (
    <section ref={runwayRef} aria-label="Fleet Manager Pro truck experience" className="truck-experience-runway relative bg-[#050b16] text-white">
      <div className="truck-experience-sticky sticky top-0 flex min-h-[100svh] items-center overflow-hidden">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_55%,rgba(24,102,190,0.28),transparent_56%),linear-gradient(110deg,#050b16_0%,#07182b_48%,#030811_100%)]" />
        <div className="truck-experience-grid pointer-events-none absolute inset-0 opacity-30" />
        <div className="pointer-events-none absolute left-1/2 top-1/2 h-[34rem] w-[34rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-blue-500/10 blur-[100px]" style={{ opacity: glowOpacity }} />
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
          </div>

          <div className="relative mx-auto flex w-full max-w-5xl items-center justify-center lg:-ml-12">
            <div className="pointer-events-none absolute inset-x-0 bottom-[12%] h-24 rounded-[50%] bg-blue-500/20 blur-3xl" />
            <div className="truck-experience-speedline pointer-events-none absolute left-0 right-0 top-1/2 h-px bg-gradient-to-r from-transparent via-sky-300/50 to-transparent" />
            <div className="truck-experience-vehicle relative w-[118%] min-w-[660px] max-w-none sm:min-w-[850px] lg:min-w-[980px]" style={{ transform: `translate3d(${truckX}vw, ${Math.sin(progress * Math.PI * 2) * (reducedMotion ? 0 : 3)}px, 0) scale(${truckScale})` }}>
              <svg viewBox="0 0 1200 500" role="img" aria-label="Detailed blue heavy-duty semi-truck with a white trailer" className="h-auto w-full overflow-visible">
                <defs>
                  <linearGradient id="heroTrailer" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#ffffff"/><stop offset=".72" stopColor="#dce7f3"/><stop offset="1" stopColor="#aabbd0"/></linearGradient>
                  <linearGradient id="heroCab" x1="0" x2="1" y1="0" y2="1"><stop offset="0" stopColor="#66d4ff"/><stop offset=".28" stopColor="#1686db"/><stop offset=".72" stopColor="#0752a1"/><stop offset="1" stopColor="#08264c"/></linearGradient>
                  <linearGradient id="heroGlass" x1="0" x2="1" y1="0" y2="1"><stop offset="0" stopColor="#dff8ff"/><stop offset="1" stopColor="#387ba9"/></linearGradient>
                  <linearGradient id="heroRoad" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#334155" stopOpacity=".12"/><stop offset="1" stopColor="#020617" stopOpacity=".95"/></linearGradient>
                  <filter id="heroShadow" x="-20%" y="-40%" width="140%" height="200%"><feGaussianBlur stdDeviation="15"/></filter>
                  <filter id="heroGlow" x="-100%" y="-100%" width="300%" height="300%"><feGaussianBlur stdDeviation="10"/></filter>
                </defs>
                <ellipse cx="620" cy="390" rx="485" ry="38" fill="#00040b" opacity=".9" filter="url(#heroShadow)"/>
                <path d="M20 402H1180L1200 500H0Z" fill="url(#heroRoad)"/>
                <path d="M0 451H1200" stroke="#8ab9e6" strokeOpacity=".18" strokeWidth="2"/>
                <path d="M40 464H260M340 464H560M640 464H860M940 464H1160" stroke="#d7e9ff" strokeOpacity=".65" strokeWidth="5" strokeLinecap="round" strokeDasharray="72 32"/>
                <g className="truck-experience-trailer">
                  <rect x="105" y="104" width="700" height="244" rx="9" fill="#071426" opacity=".65" transform="translate(0 12)"/>
                  <rect x="94" y="91" width="714" height="249" rx="8" fill="url(#heroTrailer)" stroke="#9eb4ca" strokeWidth="3"/>
                  <path d="M112 109H790" stroke="#fff" strokeWidth="7" opacity=".9"/>
                  <path d="M115 319H787" stroke="#9badc1" strokeWidth="3" opacity=".8"/>
                  <path d="M126 121V306M777 121V306" stroke="#c3d2e2" strokeWidth="6"/>
                  <path d="M147 135H755" stroke="#d9e6f2" strokeWidth="2"/>
                  <path d="M146 170H754" stroke="#c2d5e8" strokeWidth="1" opacity=".7"/>
                  <path d="M146 283H754" stroke="#c2d5e8" strokeWidth="1" opacity=".7"/>
                  <path d="M94 92H808" stroke="#fff" strokeWidth="4" opacity=".9"/>
                  <rect x="175" y="182" width="400" height="91" rx="7" fill="#edf6ff" stroke="#c3d7e9" strokeWidth="2"/>
                  <path d="M192 198H558" stroke="#9bc8f3" strokeWidth="2"/>
                  <text x="375" y="225" textAnchor="middle" fill="#0752a1" fontSize="25" fontWeight="800" letterSpacing="4">FLEET MANAGER PRO</text>
                  <text x="375" y="249" textAnchor="middle" fill="#526b84" fontSize="12" fontWeight="700" letterSpacing="5">EVERY TRUCK. EVERY SERVICE.</text>
                  <path d="M808 115H828V341H808" fill="#64748b" stroke="#a7b9cb" strokeWidth="3"/>
                  <path d="M816 138H824M816 163H824M816 188H824M816 213H824M816 238H824M816 263H824" stroke="#dce8f3" strokeWidth="4"/>
                  <rect x="120" y="342" width="690" height="18" rx="3" fill="#27384d"/>
                  <path d="M155 360H758" stroke="#c4d6e8" strokeWidth="4"/>
                  <g transform="translate(240 360)"><g className="truck-experience-wheel"><circle r="43" fill="#030712" stroke="#64748b" strokeWidth="5"/><circle r="28" fill="#475569" stroke="#cbd5e1" strokeWidth="4"/><circle r="9" fill="#dbeafe"/><path d="M0-24V24M-24 0H24M-17-17L17 17M17-17L-17 17" stroke="#cbd5e1" strokeWidth="5"/></g></g>
                  <g transform="translate(670 360)"><g className="truck-experience-wheel"><circle r="43" fill="#030712" stroke="#64748b" strokeWidth="5"/><circle r="28" fill="#475569" stroke="#cbd5e1" strokeWidth="4"/><circle r="9" fill="#dbeafe"/><path d="M0-24V24M-24 0H24M-17-17L17 17M17-17L-17 17" stroke="#cbd5e1" strokeWidth="5"/></g></g>
                  <g transform="translate(742 360)"><g className="truck-experience-wheel"><circle r="43" fill="#030712" stroke="#64748b" strokeWidth="5"/><circle r="28" fill="#475569" stroke="#cbd5e1" strokeWidth="4"/><circle r="9" fill="#dbeafe"/><path d="M0-24V24M-24 0H24M-17-17L17 17M17-17L-17 17" stroke="#cbd5e1" strokeWidth="5"/></g></g>
                  <g className="truck-trailer-side-lights">
                    <rect x="144" y="303" width="17" height="7" rx="2" fill="#fbbf24" className="truck-side-light" />
                    <rect x="278" y="303" width="17" height="7" rx="2" fill="#fbbf24" className="truck-side-light" />
                    <rect x="412" y="303" width="17" height="7" rx="2" fill="#fbbf24" className="truck-side-light" />
                    <rect x="546" y="303" width="17" height="7" rx="2" fill="#fbbf24" className="truck-side-light" />
                    <rect x="680" y="303" width="17" height="7" rx="2" fill="#fbbf24" className="truck-side-light" />
                    <rect x="793" y="303" width="8" height="7" rx="2" fill="#fbbf24" className="truck-side-light" />
                    <rect x="96" y="284" width="8" height="22" rx="2" fill="#ef4444" className="truck-tail-light" />
                    <rect x="98" y="111" width="6" height="20" rx="2" fill="#fbbf24" className="truck-side-light" />
                  </g>
                </g>
                <g className="truck-hitch-connector">
                  <path d="M777 345H839V354H777Z" fill="#0f172a" stroke="#64748b" strokeWidth="2" />
                  <path d="M788 347H823" stroke="#94a3b8" strokeWidth="3" strokeLinecap="round" />
                </g>
                <g className="truck-experience-cab">
                  <path d="M807 143H885Q909 143 925 169L969 238V342H815V166Q815 143 807 143Z" fill="url(#heroCab)" stroke="#8edaff" strokeWidth="3"/>
                  <path d="M834 160H879Q895 160 905 178L931 225H834Z" fill="url(#heroGlass)" stroke="#174f82" strokeWidth="4"/>
                  <path d="M880 162L909 220H891L858 162Z" fill="#fff" opacity=".36"/>
                  <path d="M817 239H962V318H817Z" fill="#0752a1" opacity=".7"/>
                  <path d="M826 252H949" stroke="#8edaff" strokeWidth="4" opacity=".85"/>
                  <path d="M817 322H968V345H817Z" fill="#111827"/>
                  <path d="M832 346V360H949V346" fill="#334155"/>
                  <path d="M830 177V301" stroke="#9be7ff" strokeWidth="4" opacity=".85"/>
                  <path d="M840 279H951" stroke="#38bdf8" strokeWidth="3" opacity=".55"/>
                  <rect x="944" y="256" width="22" height="34" rx="5" fill="#fff7cc"/>
                  <rect x="949" y="260" width="13" height="26" rx="4" fill="#fff" className="truck-experience-headlight"/>
                  <ellipse cx="1005" cy="278" rx="68" ry="24" fill="#9be7ff" opacity=".2" filter="url(#heroGlow)"/>
                  <path d="M966 300H981V330H966Z" fill="#ef4444"/>
                  <path d="M817 207H809V313H817" stroke="#9be7ff" strokeWidth="4" fill="none"/>
                  <rect x="831" y="325" width="135" height="14" rx="3" fill="#0f172a"/>
                  <g transform="translate(850 360)"><g className="truck-experience-wheel"><circle r="39" fill="#030712" stroke="#64748b" strokeWidth="5"/><circle r="25" fill="#475569" stroke="#cbd5e1" strokeWidth="4"/><circle r="8" fill="#dbeafe"/><path d="M0-21V21M-21 0H21M-15-15L15 15M15-15L-15 15" stroke="#cbd5e1" strokeWidth="4"/></g></g>
                  <g transform="translate(933 360)"><g className="truck-experience-wheel"><circle r="39" fill="#030712" stroke="#64748b" strokeWidth="5"/><circle r="25" fill="#475569" stroke="#cbd5e1" strokeWidth="4"/><circle r="8" fill="#dbeafe"/><path d="M0-21V21M-21 0H21M-15-15L15 15M15-15L-15 15" stroke="#cbd5e1" strokeWidth="4"/></g></g>
                  <path d="M822 340H967" stroke="#7dd3fc" strokeWidth="4"/>
                </g>
              </svg>
            </div>
          </div>
        </div>
        <div className="pointer-events-none absolute bottom-5 left-1/2 z-20 -translate-x-1/2 text-center">
          <p className="text-[9px] font-semibold uppercase tracking-[0.32em] text-slate-500">Scroll to explore</p>
          <div className="mx-auto mt-2 h-7 w-px bg-gradient-to-b from-sky-300 to-transparent" />
        </div>
      </div>
      <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-[#050b16] to-transparent" />
    </section>
  )
}
