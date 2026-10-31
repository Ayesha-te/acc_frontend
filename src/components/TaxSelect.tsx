import { Link } from 'react-router-dom'
import { resource, TaxRate } from '../api/endpoints'
import { useFetch } from '../lib/useFetch'
import { Input, Select } from './ui'

/**
 * Tax picker for a document line. Offers the organization's own configured rates; the posted value is still the
 * plain percentage, so the document contract is unchanged. With no rates configured it falls back to a number box.
 */
export function useTaxRates() {
  return useFetch(() => resource<TaxRate>('tax-rates').list({ is_active: 'true' }), [])
}

export function TaxSelect({ value, onChange, rates }: { value: string; onChange: (v: string) => void; rates: TaxRate[] | null }) {
  if (!rates?.length) {
    return <Input type="number" step="any" min="0" max="100" value={value} onChange={(e) => onChange(e.target.value)} aria-label="Tax rate" placeholder="Tax %" />
  }
  const known = rates.some((r) => Number(r.rate) === Number(value))
  return (
    <Select value={known ? String(Number(value)) : value === '0' || value === '' ? '0' : 'custom'} onChange={(e) => onChange(e.target.value === 'custom' ? value : e.target.value)} aria-label="Tax rate">
      <option value="0">No tax</option>
      {rates.map((r) => <option key={r.id} value={String(Number(r.rate))}>{r.name} ({Number(r.rate)}%)</option>)}
      {!known && value !== '0' && value !== '' && <option value="custom">{value}%</option>}
    </Select>
  )
}

export const TaxHint = ({ rates }: { rates: TaxRate[] | null }) =>
  rates && !rates.length ? (
    <p className="text-xs text-slate-500">Tip: add your tax rates once under <Link to="/settings/tax-rates" className="text-indigo-600 underline">Setup → Tax rates</Link> and pick them from a list here.</p>
  ) : null
