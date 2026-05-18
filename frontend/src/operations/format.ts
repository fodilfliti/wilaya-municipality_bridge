/** Raw value for inputs / API `cells` map */
export function rawFromValueJson(column: { column_type: string }, valueJson: { value?: unknown; value_key?: string } | null | undefined) {
  const t = column.column_type
  if (t === 'BOOLEAN') return Boolean(valueJson?.value)
  if (t === 'NUMBER') return typeof valueJson?.value === 'number' ? valueJson.value : Number(valueJson?.value ?? 0) || 0
  if (t === 'TEXT') return valueJson?.value != null ? String(valueJson.value) : ''
  if (t === 'DATE') return valueJson?.value != null ? String(valueJson.value) : ''
  if (t === 'CHOICE') return valueJson?.value_key != null ? String(valueJson.value_key) : ''
  return ''
}

export function defaultRawForColumn(column: { column_type: string; choices?: { value_key: string; position?: number }[] }) {
  const t = column.column_type
  if (t === 'BOOLEAN') return false
  if (t === 'NUMBER') return 0
  if (t === 'TEXT') return ''
  if (t === 'DATE') return ''
  if (t === 'CHOICE') {
    const first = (column.choices || []).slice().sort((a, b) => (a.position ?? 0) - (b.position ?? 0))[0]
    return first ? String(first.value_key) : ''
  }
  return ''
}

export function toValueJson(column: { column_type: string }, raw: unknown) {
  const t = column.column_type
  if (t === 'BOOLEAN') return { value: Boolean(raw) }
  if (t === 'NUMBER') {
    const n = typeof raw === 'number' ? raw : Number(String(raw).replace(',', '.'))
    return { value: Number.isFinite(n) ? n : 0 }
  }
  if (t === 'TEXT') return { value: raw == null ? '' : String(raw) }
  if (t === 'DATE') {
    const s = raw == null ? '' : String(raw).trim().slice(0, 10)
    return { value: s }
  }
  if (t === 'CHOICE') return { value_key: String(raw ?? '') }
  return {}
}

export function labelColumn(column: { label_ar?: string; label_fr?: string | null }, lang: 'ar' | 'fr') {
  if (lang === 'fr' && column.label_fr) return column.label_fr
  return column.label_ar || ''
}

export function triggerBlobDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
