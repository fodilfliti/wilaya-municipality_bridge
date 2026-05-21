import { useTranslation } from 'react-i18next'
import { useAnnouncements } from '../announcements/AnnouncementsContext'
import { AnnouncementTicker } from './AnnouncementTicker'

export function AnnouncementBannerStack() {
  const { i18n } = useTranslation()
  const { active, loading } = useAnnouncements()
  const rtl = i18n.language !== 'fr'

  if (loading && active.length === 0) return null
  if (active.length === 0) return null

  return (
    <div className="announcementStack" aria-label="announcements">
      {active.map((item) => (
        <AnnouncementTicker key={item.id} item={item} rtl={rtl} />
      ))}
    </div>
  )
}
