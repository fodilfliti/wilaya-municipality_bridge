import { useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'

export function useAdminEtatWilayaFilter() {
  const [searchParams, setSearchParams] = useSearchParams()

  const filterMunicipalityId = useMemo(() => {
    const raw = searchParams.get('municipalityId')
    const n = raw != null && String(raw).trim() !== '' ? Number(raw) : NaN
    return Number.isFinite(n) && n > 0 ? n : null
  }, [searchParams])

  function clearFilter() {
    const next = new URLSearchParams(searchParams)
    next.delete('municipalityId')
    setSearchParams(next, { replace: true })
  }

  function filterQueryString() {
    return filterMunicipalityId != null ? `municipalityId=${filterMunicipalityId}` : ''
  }

  return { filterMunicipalityId, clearFilter, filterQueryString }
}
