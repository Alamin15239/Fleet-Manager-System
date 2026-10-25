'use client'

interface TruckLoaderProps {
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

export function TruckLoader({ size = 'md', className = '' }: TruckLoaderProps) {
  const sizeClasses = {
    sm: 'h-7 w-14',
    md: 'h-10 w-20',
    lg: 'h-16 w-32',
  }

  return (
    <div className={`relative ${sizeClasses[size]} ${className}`} role="img" aria-label="Truck driving animation">
      <svg viewBox="0 0 140 72" className="h-full w-full overflow-visible" aria-hidden="true">
        <defs>
          <linearGradient id="loaderTrailer" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="100%" stopColor="#cbd5e1" />
          </linearGradient>
          <linearGradient id="loaderCab" x1="0" x2="1" y1="0" y2="1">
            <stop offset="0%" stopColor="#38bdf8" />
            <stop offset="100%" stopColor="#1d4ed8" />
          </linearGradient>
        </defs>
        <ellipse cx="71" cy="59" rx="59" ry="4" fill="currentColor" opacity=".12" />
        <g className="truck-loader-bounce">
          <rect x="8" y="19" width="78" height="32" rx="3" fill="url(#loaderTrailer)" stroke="#94a3b8" strokeWidth="1.5" />
          <path d="M13 24H80M13 45H80" stroke="#e2e8f0" strokeWidth="2" />
          <rect x="17" y="29" width="53" height="12" rx="2" fill="#dbeafe" />
          <path d="M24 32H62" stroke="#2563eb" strokeWidth="2" strokeLinecap="round" />
          <path d="M24 36H51" stroke="#64748b" strokeWidth="1.5" strokeLinecap="round" />
          <path d="M87 31H96L106 41V52H85V33Z" fill="url(#loaderCab)" stroke="#1e40af" strokeWidth="1.5" />
          <path d="M92 34H97L103 41H92Z" fill="#dff7ff" stroke="#0f4c81" strokeWidth="1" />
          <rect x="89" y="43" width="15" height="6" rx="1" fill="#1e3a8a" />
          <path d="M92 45H102M92 47H102" stroke="#93c5fd" strokeWidth="1" />
          <rect x="103" y="43" width="3" height="5" rx="1" fill="#fef3c7" className="truck-loader-light" />
          <rect x="86" y="51" width="21" height="3" rx="1" fill="#334155" />
          <g className="truck-loader-wheel">
            <circle cx="25" cy="52" r="7" fill="#0f172a" />
            <circle cx="25" cy="52" r="3.8" fill="#94a3b8" stroke="#e2e8f0" strokeWidth="1" />
            <path d="M25 49V55M22 52H28" stroke="#475569" strokeWidth="1" />
          </g>
          <g className="truck-loader-wheel">
            <circle cx="72" cy="52" r="7" fill="#0f172a" />
            <circle cx="72" cy="52" r="3.8" fill="#94a3b8" stroke="#e2e8f0" strokeWidth="1" />
            <path d="M72 49V55M69 52H75" stroke="#475569" strokeWidth="1" />
          </g>
          <g className="truck-loader-wheel">
            <circle cx="94" cy="53" r="7" fill="#0f172a" />
            <circle cx="94" cy="53" r="3.8" fill="#94a3b8" stroke="#e2e8f0" strokeWidth="1" />
            <path d="M94 50V56M91 53H97" stroke="#475569" strokeWidth="1" />
          </g>
        </g>
        <path d="M1 64H139" stroke="currentColor" strokeWidth="1.5" opacity=".3" strokeLinecap="round" />
        <path className="truck-loader-road" d="M3 64H22M31 64H50M59 64H78M87 64H106M115 64H134" stroke="#f59e0b" strokeWidth="2.5" strokeLinecap="round" />
      </svg>
    </div>
  )
}
