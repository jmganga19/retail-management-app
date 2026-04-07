export type TemplateKey = 'products' | 'sales' | 'orders' | 'preorders' | 'customers'

interface TemplateDef {
  filename: string
  headers: string[]
  sampleRows: string[][]
}

const templates: Record<TemplateKey, TemplateDef> = {
  products: {
    filename: 'products_template.csv',
    headers: [
      'name',
      'category_name',
      'description',
      'price_tzs',
      'image_url',
      'low_stock_threshold',
      'variant_size',
      'variant_color',
      'variant_sku',
      'variant_stock_qty',
    ],
    sampleRows: [
      ['Cucci Oud', 'Perfumes', 'Long-lasting oud fragrance', '85000', '', '5', '50ml', '', 'CUCCI-OUD-50', '20'],
    ],
  },
  sales: {
    filename: 'sales_template.csv',
    headers: [
      'sale_ref',
      'customer_id_optional',
      'payment_method_cash_card_mobile_money',
      'discount_tzs',
      'notes',
      'variant_id',
      'quantity',
    ],
    sampleRows: [['SALE-001', '', 'cash', '0', 'Walk-in sale', '101', '2']],
  },
  orders: {
    filename: 'orders_template.csv',
    headers: [
      'order_ref',
      'customer_id',
      'discount_tzs',
      'notes',
      'variant_id',
      'quantity',
      'unit_price_tzs',
    ],
    sampleRows: [['ORDER-001', '1', '5000', 'Phone order', '101', '3', '45000']],
  },
  preorders: {
    filename: 'preorders_template.csv',
    headers: [
      'preorder_ref',
      'customer_id',
      'expected_arrival_date_yyyy_mm_dd',
      'deposit_amount_tzs',
      'notes',
      'variant_id',
      'quantity',
      'unit_price_tzs',
    ],
    sampleRows: [['PRE-001', '1', '2026-05-01', '30000', 'Reserved item', '101', '1', '120000']],
  },
  customers: {
    filename: 'customers_template.csv',
    headers: ['name', 'phone', 'email'],
    sampleRows: [['Amina Said', '255712345678', 'amina@example.com']],
  },
}

const esc = (value: string) => {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

export function getTemplateHeaders(key: TemplateKey): string[] {
  return templates[key].headers
}

export function downloadCsvTemplate(key: TemplateKey) {
  const template = templates[key]
  const rows = [template.headers, ...template.sampleRows]
  const csv = rows.map(row => row.map(esc).join(',')).join('\n')

  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = template.filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
