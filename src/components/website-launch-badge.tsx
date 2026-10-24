"use client"

import { useState } from "react"

const badgeUrl = "https://websitelaunches.com/badge/fleetmaintenance.site.svg"
const launchRecordUrl = "https://websitelaunches.com/site/fleetmaintenance.site"

export function WebsiteLaunchBadge() {
  const [imageFailed, setImageFailed] = useState(false)

  return (
    <a
      href={launchRecordUrl}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Established online — view the public launch record"
      className="inline-flex w-fit max-w-full items-center rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
    >
      {imageFailed ? (
        <span className="flex h-[55px] w-[255px] max-w-full items-center gap-3 rounded-lg border border-slate-300 bg-white px-3 text-slate-800 shadow-sm dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300">
            <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" className="size-5">
              <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8" />
              <path d="M3.5 12h17M12 3c2.2 2.4 3.3 5.4 3.3 9s-1.1 6.6-3.3 9c-2.2-2.4-3.3-5.4-3.3-9S9.8 5.4 12 3Z" stroke="currentColor" strokeWidth="1.5" />
            </svg>
          </span>
          <span className="min-w-0 text-left leading-tight">
            <span className="block truncate text-xs font-semibold">Established online</span>
            <span className="mt-1 block truncate text-[11px] text-slate-500 dark:text-slate-400">
              Public launch record
            </span>
          </span>
          <span aria-hidden="true" className="ml-auto shrink-0 text-slate-400">↗</span>
        </span>
      ) : (
        <img
          src={badgeUrl}
          alt="Established online — Public launch record"
          width="255"
          height="55"
          loading="lazy"
          onError={() => setImageFailed(true)}
          className="h-auto max-w-full"
        />
      )}
    </a>
  )
}