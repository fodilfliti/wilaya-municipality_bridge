import type { ReactNode } from 'react'
import { Modal } from '../components/Modal'

type Props = {
  title: string
  children: ReactNode
  toolbar: ReactNode
  error?: string | null
  onClose: () => void
}

/** Wilaya edit modal for état principal multi-line forms (servers, MCLT, annex RNC). */
export function EtatPrincipaleEditModal({ title, children, toolbar, error, onClose }: Props) {
  return (
    <Modal title={title} error={error} onClose={onClose} etat>
      <div className="etatModalShell">
        <div className="etatModalScroll">{children}</div>
        <div className="etatModalToolbar">{toolbar}</div>
      </div>
    </Modal>
  )
}
