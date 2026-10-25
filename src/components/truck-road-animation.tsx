"use client"

export function TruckRoadAnimation() {
  return (
    <div className="fleet-truck-scene relative isolate overflow-hidden rounded-[2rem] border border-sky-100 bg-gradient-to-b from-sky-100 via-white to-slate-100 px-4 pb-3 pt-6 shadow-inner dark:border-white/10 dark:from-slate-800 dark:via-slate-900 dark:to-slate-950 sm:px-8">
      <div className="pointer-events-none absolute left-[12%] top-8 h-12 w-12 rounded-full bg-amber-200/80 blur-[1px] dark:bg-amber-300/20" />
      <div className="pointer-events-none absolute right-[18%] top-7 h-10 w-24 rounded-full bg-white/80 blur-md dark:bg-white/5" />
      <div className="pointer-events-none absolute right-[22%] top-5 h-8 w-16 rounded-full bg-white/80 blur-md dark:bg-white/5" />
      <div className="relative mx-auto max-w-5xl">
        <svg viewBox="0 0 900 190" role="img" aria-label="An animated blue semi-truck with a long trailer driving along a road" className="relative z-10 h-auto w-full overflow-visible">
          <defs>
            <linearGradient id="trailerPaint" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="#ffffff" />
              <stop offset="100%" stopColor="#dbeafe" />
            </linearGradient>
            <linearGradient id="cabPaint" x1="0" x2="1" y1="0" y2="1">
              <stop offset="0%" stopColor="#38bdf8" />
              <stop offset="55%" stopColor="#1677d2" />
              <stop offset="100%" stopColor="#123b76" />
            </linearGradient>
            <linearGradient id="glassPaint" x1="0" x2="1" y1="0" y2="1">
              <stop offset="0%" stopColor="#dff7ff" />
              <stop offset="100%" stopColor="#5ca6d8" />
            </linearGradient>
            <filter id="truckShadow" x="-20%" y="-20%" width="140%" height="160%">
              <feGaussianBlur stdDeviation="4" />
            </filter>
          </defs>
          <ellipse cx="470" cy="151" rx="330" ry="13" fill="#0f172a" opacity=".14" filter="url(#truckShadow)" />
          <g className="fleet-truck-driving">
            <g className="fleet-truck-suspension">
              <rect x="100" y="38" width="515" height="96" rx="7" fill="#94a3b8" opacity=".3" transform="translate(0 4)" />
              <rect x="94" y="31" width="520" height="98" rx="7" fill="url(#trailerPaint)" stroke="#94a3b8" strokeWidth="2" />
              <path d="M106 43H602" stroke="#fff" strokeWidth="4" opacity=".95" />
              <path d="M110 113H598" stroke="#94a3b8" strokeWidth="2" opacity=".7" />
              <rect x="112" y="48" width="7" height="62" rx="2" fill="#cbd5e1" />
              <rect x="592" y="48" width="7" height="62" rx="2" fill="#cbd5e1" />
              <path d="M132 54H575" stroke="#dbeafe" strokeWidth="1.5" />
              <rect x="123" y="65" width="270" height="35" rx="5" fill="#eff6ff" />
              <text x="258" y="79" fill="#1554a1" textAnchor="middle" fontSize="12" fontWeight="800" letterSpacing="2">FLEET MANAGER PRO</text>
              <text x="258" y="92" fill="#475569" textAnchor="middle" fontSize="9" fontWeight="600" letterSpacing="1.2">FLEET CARE • ON THE MOVE</text>
              <path d="M615 48H634V129H615" fill="#64748b" stroke="#475569" strokeWidth="2" />
              <path d="M622 57H630M622 67H630M622 77H630M622 87H630M622 97H630" stroke="#cbd5e1" strokeWidth="2" />
              <rect x="631" y="83" width="26" height="9" rx="2" fill="#334155" />
              <path d="M657 86H672" stroke="#334155" strokeWidth="6" strokeLinecap="round" />
              <path d="M670 88H687" stroke="#64748b" strokeWidth="7" strokeLinecap="round" />
              <path d="M670 88H687" stroke="#cbd5e1" strokeWidth="2" />
              <path d="M646 128H687V136H646Z" fill="#475569" />
              <rect x="659" y="44" width="8" height="18" rx="2" fill="#f59e0b" />
              <rect x="659" y="103" width="8" height="18" rx="2" fill="#ef4444" />
              <path d="M672 53H683M672 112H683" stroke="#f8fafc" strokeWidth="3" strokeLinecap="round" />
              <path d="M95 40H88V119H95" stroke="#64748b" strokeWidth="4" fill="none" />
              <rect x="88" y="52" width="5" height="12" rx="2" fill="#ef4444" />
              <rect x="88" y="97" width="5" height="12" rx="2" fill="#ef4444" />
              <path d="M110 129V139H635V129" fill="#475569" />
              <path d="M125 139H615" stroke="#cbd5e1" strokeWidth="2" />
              <g className="fleet-truck-wheel">
                <circle cx="170" cy="139" r="20" fill="#0f172a" />
                <circle cx="170" cy="139" r="12" fill="#64748b" stroke="#cbd5e1" strokeWidth="3" />
                <circle cx="170" cy="139" r="4" fill="#e2e8f0" />
                <path d="M170 128V150M159 139H181M162 131L178 147M178 131L162 147" stroke="#cbd5e1" strokeWidth="2" />
              </g>
              <g className="fleet-truck-wheel">
                <circle cx="540" cy="139" r="20" fill="#0f172a" />
                <circle cx="540" cy="139" r="12" fill="#64748b" stroke="#cbd5e1" strokeWidth="3" />
                <circle cx="540" cy="139" r="4" fill="#e2e8f0" />
                <path d="M540 128V150M529 139H551M532 131L548 147M548 131L532 147" stroke="#cbd5e1" strokeWidth="2" />
              </g>
              <g className="fleet-truck-wheel">
                <circle cx="588" cy="139" r="20" fill="#0f172a" />
                <circle cx="588" cy="139" r="12" fill="#64748b" stroke="#cbd5e1" strokeWidth="3" />
                <circle cx="588" cy="139" r="4" fill="#e2e8f0" />
                <path d="M588 128V150M577 139H599M580 131L596 147M596 131L580 147" stroke="#cbd5e1" strokeWidth="2" />
              </g>
              <g>
                <path d="M638 35H682Q695 35 702 49L720 84V128H646V50Q646 35 638 35Z" fill="url(#cabPaint)" stroke="#124780" strokeWidth="2" />
                <path d="M655 45H679Q686 45 691 54L704 80H655Z" fill="url(#glassPaint)" stroke="#0f4c81" strokeWidth="2" />
                <path d="M683 46L698 78H688L674 46Z" fill="#fff" opacity=".45" />
                <path d="M648 85H711V121H648Z" fill="#1766ad" opacity=".65" />
                <path d="M652 88H706" stroke="#7dd3fc" strokeWidth="2" opacity=".9" />
                <rect x="651" y="92" width="55" height="25" rx="3" fill="#0f3c70" />
                <path d="M657 98H700M657 104H700M657 110H700" stroke="#8bb8db" strokeWidth="2" />
                <path d="M647 121H717V130H647Z" fill="#0f172a" />
                <rect x="702" y="91" width="13" height="17" rx="3" fill="#fef3c7" />
                <rect x="704" y="94" width="9" height="11" rx="2" fill="#fff7ed" className="fleet-truck-headlight" />
                <rect x="650" y="110" width="7" height="12" rx="2" fill="#ef4444" />
                <path d="M647 53H652V116H647" fill="#38bdf8" opacity=".8" />
                <path d="M657 131V139H700V131" fill="#334155" />
                <g className="fleet-truck-wheel">
                  <circle cx="663" cy="139" r="18" fill="#0f172a" />
                  <circle cx="663" cy="139" r="10" fill="#64748b" stroke="#cbd5e1" strokeWidth="3" />
                  <circle cx="663" cy="139" r="3" fill="#e2e8f0" />
                  <path d="M663 130V148M654 139H672M657 133L669 145M669 133L657 145" stroke="#cbd5e1" strokeWidth="1.7" />
                </g>
                <g className="fleet-truck-wheel">
                  <circle cx="704" cy="139" r="18" fill="#0f172a" />
                  <circle cx="704" cy="139" r="10" fill="#64748b" stroke="#cbd5e1" strokeWidth="3" />
                  <circle cx="704" cy="139" r="3" fill="#e2e8f0" />
                  <path d="M704 130V148M695 139H713M698 133L710 145M710 133L698 145" stroke="#cbd5e1" strokeWidth="1.7" />
                </g>
              </g>
            </g>
          </g>
        </svg>
      </div>
      <div className="fleet-road relative mt-[-1px] h-8 overflow-hidden rounded-xl bg-slate-700 shadow-inner dark:bg-slate-800">
        <div className="fleet-road-markings absolute inset-y-0 left-0 flex items-center gap-12 whitespace-nowrap">
          {Array.from({ length: 18 }, (_, i) => <span key={i} className="h-1 w-8 rounded-full bg-amber-100/90" />)}
        </div>
      </div>
      <div className="relative z-10 mt-3 flex flex-col items-center justify-between gap-1 text-center sm:flex-row sm:text-left">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Reliable fleet operations</p>
        <p className="text-sm font-semibold text-blue-800 dark:text-blue-200">Every truck. Every service. One workspace.</p>
      </div>
    </div>
  )
}
