export type TemplateKey = 'products' | 'sales' | 'orders' | 'preorders' | 'customers' | 'stock_orders'

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
      'price_tzs',
    ],
    sampleRows: [
      ['Cucci Oud', 'Perfumes', '85000'],
    ],
  },
  sales: {
    filename: 'sales_template.csv',
    headers: [
      'product_name_optional',
      'category_name_optional',
      'quantity',
      'unit_price_tzs',
      'payment_status_optional',
    ],
    sampleRows: [['Cucci Oud', 'Perfumes', '2', '85000', 'unpaid']],
  },
  orders: {
    filename: 'orders_template.csv',
    headers: [
      'order_ref',
      'customer_id',
      'product_id',
      'quantity',
      'unit_price_tzs',
    ],
    sampleRows: [['ORDER-001', '1', '12', '3', '45000']],
  },
  preorders: {
    filename: 'preorders_template.csv',
    headers: [
      'preorder_ref',
      'customer_id',
      'product_id',
      'quantity',
      'unit_price_tzs',
      'deposit_amount_tzs',
    ],
    sampleRows: [['PRE-001', '1', '12', '1', '120000', '30000']],
  },
  customers: {
    filename: 'customers_template.csv',
    headers: ['name', 'phone'],
    sampleRows: [['Amina Said', '255712345678']],
  },
  stock_orders: {
    filename: 'stock_orders_template.csv',
    headers: [
      'stock_ref',
      'item_name',
      'category_id_optional',
      'quantity',
      'buying_price_tzs',
      'selling_price_tzs',
    ],
    sampleRows: [['STK-001', 'Aveeno', '1', '20', '19800', '45000']],
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

