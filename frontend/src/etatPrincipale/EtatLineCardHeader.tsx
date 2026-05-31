import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { RncAuthStatusChip } from './rncAuthUi'

type Props = {
  lineNumber: number
  rncStatus?: string
  onRemove: () => void
  removeDisabled?: boolean
  removeLabelKey?: 'mcltRemoveLine' | 'annexRncRemoveLine'
  /** e.g. draft badge (commune only). */
  titleExtra?: ReactNode
}

/** Line card title row: number + optional extras + RNC chip + remove (commune + wilaya modals). */
export function EtatLineCardHeader({
  lineNumber,
  rncStatus,
  onRemove,
  removeDisabled = false,
  removeLabelKey = 'mcltRemoveLine',
  titleExtra = null,
}: Props) {
  const { t } = useTranslation()

  return (
    <div className="etatMuniLineCardHead row">
      <div className="row" style={{ gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ fontWeight: 700 }}>{t('backupServersLineTitle', { n: lineNumber })}</div>
        {titleExtra}
      </div>
      <div className="row" style={{ gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
        {rncStatus != null ? <RncAuthStatusChip status={rncStatus} /> : null}
        <button type="button" className="btn btnSmall" disabled={removeDisabled} onClick={() => onRemove()}>
          {t(removeLabelKey)}
        </button>
      </div>
    </div>
  )
}
