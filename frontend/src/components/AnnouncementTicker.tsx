import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { AnnouncementActiveItem } from '../api'

const PX_PER_SEC = 52

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
  const { t } = useTranslation()
  const viewportRef = useRef<HTMLDivElement>(null)
  const textRef = useRef<HTMLSpanElement>(null)
  const [motion, setMotion] = useState<{ durationSec: number; startX: number; endX: number } | null>(
    null,
  )

  const datePrefix = useMemo(() => formatDisplayDate(item.display_date), [item.display_date])
  const label = `${datePrefix}: ${item.body_text}`

  const priorityClass =
    item.priority === 'urgent' ? 'announcementTicker--urgent' : 'announcementTicker--important'

  const icon = item.priority === 'urgent' ? '\u{1F6A8}' : '\u{26A0}\u{FE0F}'
  const priorityLabel =
    item.priority === 'urgent' ? t('announcementPriorityUrgent') : t('announcementPriorityImportant')

  useEffect(() => {
    const viewport = viewportRef.current
    const textEl = textRef.current
    if (!viewport || !textEl) return

    const measure = () => {
      const viewportW = viewport.clientWidth
      const textW = textEl.offsetWidth
      const travel = viewportW + textW
      const durationSec = Math.max(8, travel / PX_PER_SEC)

      if (rtl) {
        setMotion({ durationSec, startX: -textW, endX: viewportW })
      } else {
        setMotion({ durationSec, startX: viewportW, endX: -textW })
      }
    }

    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(viewport)
    ro.observe(textEl)
    return () => ro.disconnect()
  }, [label, rtl])

  return (
    <div
      className={`announcementTicker ${priorityClass}`}
      role="status"
      aria-live="polite"
      aria-label={`${priorityLabel}: ${label}`}
    >
      <span className="announcementTickerIcon" title={priorityLabel} aria-hidden>
        {icon}
      </span>
      <div className="announcementTickerViewport" ref={viewportRef}>
        <span
          ref={textRef}
          className={`announcementTickerText${motion ? ' announcementTickerText--run' : ''}`}
          style={
            motion
              ? ({
                  ['--marquee-duration' as string]: `${motion.durationSec}s`,
                  ['--marquee-start' as string]: `${motion.startX}px`,
                  ['--marquee-end' as string]: `${motion.endX}px`,
                } as React.CSSProperties)
              : undefined
          }
        >
          {label}
        </span>
      </div>
    </div>
  )
}
