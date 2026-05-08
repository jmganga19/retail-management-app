export const paymentMethodLabel = (value: string): string => {
  if (value === 'card') return 'Bank'
  if (value === 'mobile_money') return 'Mobile Money'
  if (value === 'cash') return 'Cash'
  return value.replace(/_/g, ' ')
}

