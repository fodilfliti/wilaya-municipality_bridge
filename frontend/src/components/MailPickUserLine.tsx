export type MailPickUserMeta = {
  name: string | null | undefined
  username: string
  municipalityLabel?: string
  jobTitle?: string | null
}

export function MailPickUserLine({ name, username, municipalityLabel, jobTitle }: MailPickUserMeta) {
  const nameTrim = (name || '').trim()
  const userTrim = (username || '').trim()
  const displayName = nameTrim || userTrim
  const fonction = (jobTitle || '').trim()
  const muniTrim = (municipalityLabel || '').trim()

  return (
    <span className="mailPickUserLine">
      <span className="mailPickUserName">{displayName}</span>
      {nameTrim && userTrim && userTrim !== nameTrim ? (
        <span className="muted mailPickUserMeta">({userTrim})</span>
      ) : null}
      {fonction ? <span className="muted mailPickUserMeta">— {fonction}</span> : null}
      {muniTrim ? <span className="muted mailPickUserMeta">— {muniTrim}</span> : null}
    </span>
  )
}
