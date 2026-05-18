import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

type Props = {
  className?: string
  fallbackTo?: string
  labelKey?: string
}

export function BackButton({ className = 'btn', fallbackTo = '/', labelKey = 'back' }: Props) {
  const navigate = useNavigate()
  const { t } = useTranslation()

  return (
    <button
      type="button"
      className={className}
      onClick={() => {
        if (window.history.length > 1) navigate(-1)
        else navigate(fallbackTo)
      }}
    >
      {t(labelKey)}
    </button>
  )
}
