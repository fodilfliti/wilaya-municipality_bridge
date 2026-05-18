import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { ETAT_TRANSMISSION_ENABLED } from '../etatPrincipale/transmissionFeature'

type Props = {
  saving: boolean
  onSaveDraft: () => void
  addLineLabel: string
  onAddLine: () => void
  canAddLine?: boolean
  withRncStep?: boolean
  showTransmitStep?: boolean
  submittedAt?: string | null
  transmitting?: boolean
  onTransmit?: () => void
  children: ReactNode
}

export function MuniEtatPrincipalWorkflow({
  saving,
  onSaveDraft,
  addLineLabel,
  onAddLine,
  canAddLine = true,
  withRncStep = true,
  showTransmitStep = ETAT_TRANSMISSION_ENABLED,
  submittedAt = null,
  transmitting = false,
  onTransmit,
  children,
}: Props) {
  const { t } = useTranslation()
  const busy = saving || transmitting
  const saveLabel = showTransmitStep ? t('etatMuniSaveDraft') : t('etatMuniSaveData')

  const steps = (() => {
    if (showTransmitStep && withRncStep) {
      return [
        { n: 1, title: t('etatMuniStep1Title'), desc: t('etatMuniStep1DescRnc') },
        { n: 2, title: t('etatMuniStep2Title'), desc: t('etatMuniStep2DescRnc') },
        { n: 3, title: t('etatMuniStep3Title'), desc: t('etatMuniStep3Desc') },
      ]
    }
    if (showTransmitStep && !withRncStep) {
      return [
        { n: 1, title: t('etatMuniStep1Title'), desc: t('etatMuniStep1DescSimple') },
        { n: 2, title: t('etatMuniStep3Title'), desc: t('etatMuniStep3Desc') },
      ]
    }
    if (withRncStep) {
      return [
        { n: 1, title: t('etatMuniStep1Title'), desc: t('etatMuniStep1DescRncNoTransmit') },
        { n: 2, title: t('etatMuniStep2Title'), desc: t('etatMuniStep2DescRnc') },
      ]
    }
    return [{ n: 1, title: t('etatMuniStep1Title'), desc: t('etatMuniStep1DescSimpleNoTransmit') }]
  })()

  return (
    <>
      <div className="etatMuniStepsGuide" role="list" aria-label={t('etatMuniStepsTitle')}>
        <div className="muted" style={{ fontWeight: 700, marginBottom: 4 }}>
          {t('etatMuniStepsTitle')}
        </div>
        {steps.map((s) => (
          <div key={s.n} className="etatMuniStepRow" role="listitem">
            <span className="etatMuniStepNum" aria-hidden>
              {s.n}
            </span>
            <div>
              <div style={{ fontWeight: 700 }}>{s.title}</div>
              <div className="muted" style={{ fontSize: 13, marginTop: 2 }}>
                {s.desc}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="etatMuniWorkflowStack">
        <div className="etatMuniLineCards">{children}</div>

        <div className="etatMuniActionPanel card cardSubtle">
          <div className="etatMuniPanelHead">
            <span className="etatMuniStepNum" aria-hidden>
              1
            </span>
            <div>
              <div style={{ fontWeight: 700 }}>{t('etatMuniStep1Title')}</div>
              <div className="muted" style={{ fontSize: 13, marginTop: 2 }}>
                {withRncStep ? t('etatMuniStep1PanelHintRnc') : t('etatMuniStep1PanelHintSimple')}
              </div>
            </div>
          </div>
          <div className="row" style={{ gap: 10, flexWrap: 'wrap', marginTop: 12 }}>
            <button type="button" className="btn" disabled={!canAddLine || busy} onClick={() => onAddLine()}>
              {addLineLabel}
            </button>
            <button type="button" className="btn btnPrimary" disabled={busy} onClick={() => onSaveDraft()}>
              {saving ? '…' : saveLabel}
            </button>
          </div>
        </div>

        {showTransmitStep && !submittedAt && onTransmit ? (
          <div className="etatMuniActionPanel card cardSubtle etatMuniTransmitPanel">
            <div className="etatMuniPanelHead">
              <span className="etatMuniStepNum" aria-hidden>
                {withRncStep ? 3 : 2}
              </span>
              <div>
                <div style={{ fontWeight: 700 }}>{t('etatMuniStep3Title')}</div>
                <div className="muted" style={{ fontSize: 13, marginTop: 2 }}>
                  {t('etatMuniStep3PanelHint')}
                </div>
              </div>
            </div>
            <div className="row" style={{ justifyContent: 'flex-end', marginTop: 12 }}>
              <button type="button" className="btn btnPrimary" disabled={busy} onClick={() => onTransmit()}>
                {transmitting ? '…' : t('etatMuniTransmit')}
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </>
  )
}

export function MuniEtatLineDraftBadge({ isDraft }: { isDraft: boolean }) {
  const { t } = useTranslation()
  if (!isDraft) return null
  return <span className="chip chipSm chipWarn">{t('etatMuniDraftBadge')}</span>
}

export function MuniEtatRncStepHeader() {
  const { t } = useTranslation()
  return <div className="muted etatMuniRncStepLabel">{t('etatMuniStep2Section')}</div>
}
