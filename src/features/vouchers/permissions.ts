export type VoucherType = 'journal' | 'general' | 'contra' | 'opening'

export function voucherCreateAction(type: VoucherType): 'create' | 'manage' {
  return type === 'opening' ? 'manage' : 'create'
}
