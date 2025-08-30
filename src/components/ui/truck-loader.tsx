'use client'

interface TruckLoaderProps {
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

export function TruckLoader({ size = 'md', className = '' }: TruckLoaderProps) {
  const sizeClasses = {
    sm: 'h-6 w-12',
    md: 'h-8 w-16', 
    lg: 'h-12 w-24'
  }

  return (
    <div className={`relative overflow-hidden ${sizeClasses[size]} ${className}`}>
      <div className="absolute inset-0">
        {/* Road */}
        <div className="absolute bottom-1 left-0 right-0 h-0.5 bg-current opacity-30"></div>
        
        {/* Truck */}
        <div className="truck-moving absolute">
          <svg viewBox="0 0 60 30" className="w-full h-full text-current">
            {/* Truck Body */}
            <rect x="5" y="12" width="25" height="8" rx="1" fill="currentColor"/>
            
            {/* Truck Cab */}
            <rect x="30" y="8" width="12" height="12" rx="1" fill="currentColor"/>
            
            {/* Windshield */}
            <rect x="31" y="9" width="10" height="6" rx="0.5" fill="currentColor" opacity="0.3"/>
            
            {/* Wheels */}
            <circle cx="12" cy="23" r="2.5" fill="currentColor"/>
            <circle cx="24" cy="23" r="2.5" fill="currentColor"/>
            <circle cx="36" cy="23" r="2.5" fill="currentColor"/>
            
            {/* Headlight */}
            <circle cx="41" cy="12" r="1" fill="currentColor" opacity="0.7"/>
          </svg>
        </div>
      </div>
      
      <style jsx>{`
        .truck-moving {
          animation: truck-drive 2s linear infinite;
          width: 100%;
          height: 100%;
        }
        
        @keyframes truck-drive {
          0% {
            transform: translateX(100%);
          }
          100% {
            transform: translateX(-100%);
          }
        }
      `}</style>
    </div>
  )
}