import { useTranslation } from 'react-i18next'
import type * as api from '../api'
import { MuniEtatLineDraftBadge } from '../components/MuniEtatPrincipalWorkflow'

type Line = api.BackupServerLine & { id: number }

type Props = {
  lines: Line[]
  saving?: boolean
  onUpdate: (index: number, patch: Partial<Line>) => void
  onRemove: (index: number) => void
  showDraftBadge?: boolean
}

/** Dense table editor for backup-server lines (commune + wilaya modal). */
export function BackupServerLinesEditor({
  lines,
  saving = false,
  onUpdate,
  onRemove,
  showDraftBadge = false,
}: Props) {
  const { t } = useTranslation()

  return (
    <div className="etatLinesTableWrap">
      <table className="table etatLinesTable">
        <colgroup>
          <col className="etatColIdx" />
          <col className="etatColCheck" />
          <col className="etatColType" />
          <col className="etatColCheck" />
          <col className="etatColOs" />
          <col className="etatColCheck" />
          <col className="etatColAnom" />
          <col className="etatColAct" />
        </colgroup>
        <thead>
          <tr>
            <th className="etatLinesTableIdx etatLinesTableGroupStart">{t('backupServersLineIndex')}</th>
            <th
              className="etatLinesTableCheck"
              title={t('backupServersColExiste')}
            >
              {t('backupServersThExiste')}
            </th>
            <th title={t('backupServersColServerType')}>{t('backupServersThType')}</th>
            <th
              className="etatLinesTableCheck etatLinesTableGroupSep"
              title={t('backupServersColConfigured')}
            >
              {t('backupServersThConfigured')}
            </th>
            <th title={t('backupServersColOsType')}>{t('backupServersThOs')}</th>
            <th
              className="etatLinesTableCheck"
              title={t('backupServersColOsActive')}
            >
              {t('backupServersThOsActive')}
            </th>
            <th
              className="etatLinesTableGroupSep"
              title={t('backupServersColAnomalie')}
            >
              {t('backupServersThAnomalie')}
            </th>
            <th className="etatLinesTableActions" aria-hidden />
          </tr>
        </thead>
        <tbody>
          {lines.map((line, i) => {
            const rowDisabled = saving || !line.existe
            return (
              <tr key={line.id > 0 ? String(line.id) : `new-${i}`}>
                <td className="etatLinesTableIdx etatLinesTableGroupStart">
                  <div className="etatLinesTableIdxCell">
                    <span>{i + 1}</span>
                    {showDraftBadge ? <MuniEtatLineDraftBadge isDraft={line.id <= 0} /> : null}
                  </div>
                </td>
                <td className="etatLinesTableCheck">
                  <input
                    type="checkbox"
                    checked={line.existe}
                    disabled={saving}
                    aria-label={t('backupServersColExiste')}
                    onChange={(e) => onUpdate(i, { existe: e.target.checked })}
                  />
                </td>
                <td>
                  <input
                    className="input inputDense"
                    value={line.server_type || ''}
                    disabled={rowDisabled}
                    placeholder={t('backupServersServerTypeHint')}
                    aria-label={t('backupServersColServerType')}
                    onChange={(e) => onUpdate(i, { server_type: e.target.value })}
                  />
                </td>
                <td className="etatLinesTableCheck etatLinesTableGroupSep">
                  <input
                    type="checkbox"
                    checked={line.configured}
                    disabled={rowDisabled}
                    aria-label={t('backupServersColConfigured')}
                    onChange={(e) => onUpdate(i, { configured: e.target.checked })}
                  />
                </td>
                <td>
                  <input
                    className="input inputDense"
                    value={line.os_type || ''}
                    disabled={rowDisabled}
                    placeholder={t('backupServersOsTypeHint')}
                    aria-label={t('backupServersColOsType')}
                    onChange={(e) => onUpdate(i, { os_type: e.target.value })}
                  />
                </td>
                <td className="etatLinesTableCheck">
                  <input
                    type="checkbox"
                    checked={line.os_active}
                    disabled={rowDisabled}
                    aria-label={t('backupServersColOsActive')}
                    onChange={(e) => onUpdate(i, { os_active: e.target.checked })}
                  />
                </td>
                <td className="etatLinesTableGroupSep etatLinesTableAnom">
                  <textarea
                    className="input inputDense etatAnomalieField"
                    rows={1}
                    value={line.anomalie || ''}
                    disabled={rowDisabled}
                    aria-label={t('backupServersColAnomalie')}
                    onChange={(e) => onUpdate(i, { anomalie: e.target.value })}
                  />
                </td>
                <td className="etatLinesTableActions">
                  <button
                    type="button"
                    className="btn btnSmall btnIconDanger"
                    disabled={saving || lines.length <= 1}
                    aria-label={t('backupServersRemoveServerLine')}
                    title={t('backupServersRemoveServerLine')}
                    onClick={() => onRemove(i)}
                  >
                    ×
                  </button>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
