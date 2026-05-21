import { useEffect, useMemo, useRef, useState } from 'react'
import type { AnnouncementActiveItem } from '../api'

function formatDisplayDate(isoDate: string) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate)
  if (m) return `${m[3]}-${m[2]}-${m[1]}`
  return isoDate
}

type Props = {
  item: AnnouncementActiveItem
  rtl: boolean
}

export function AnnouncementTicker({ item, rtl }: Props) {
  const trackRef = useRef<HTMLDivElement>(null)
  const innerRef = useRef<HTMLDivElement>(null)
  const [durationSec, setDurationSec] = useState(18)
  const [scrollPx, setScrollPx] = useState(0)
  const datePrefix = useMemo(() => formatDisplayDate(item.display_date), [item.display_date])
  const label = `${datePrefix}: ${item.body_text}`

  useEffect(() => {
    const track = trackRef.current
    const inner = innerRef.current
    if (!track || !inner) return
    const run = () => {
      const overflow = Math.max(0, inner.scrollWidth - track.clientWidth)
      if (overflow < 8) {
        setScrollPx(0)
        setDurationSec(0)
        return
      }
      setScrollPx(overflow)
      const pxPerSec = 55
      const scrollSec = overflow / pxPerSec
      setDurationSec(Math.max(10, scrollSec + 4))
    }
    run()
    const ro = new ResizeObserver(run)
    ro.observe(track)
    ro.observe(inner)
    return () => ro.disconnect()
  }, [label, rtl])

  const priorityClass =
    item.priority === 'urgent' ? 'announcementTicker--urgent' : 'announcementTicker--important'

  const scrollClass = durationSec > 0 ? (rtl ? 'announcementTickerScrollRtl' : 'announcementTickerScrollLtr') : ''

  return (
    <div className={`announcementTicker ${priorityClass}`} role="status" aria-live="polite">
      <div className="announcementTickerTrack" ref={trackRef}>
        <div
          ref={innerRef}
          className={`announcementTickerInner ${scrollClass}`}
          style={
            durationSec > 0
              ? ({
                  ['--ticker-duration' as string]: `${durationSec}s`,
                  ['--ticker-scroll' as string]: `${scrollPx}px`,
                } as React.CSSProperties)
              : undefined
          }
        >
          <span className="announcementTickerText">{label}</span>
        </div>
      </div>
    </div>
  )
}
