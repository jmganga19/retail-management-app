import type { Order, PreOrder, Sale } from '../types'

const fmtMoney = (n: string | number) =>
  Number(n).toLocaleString('en-TZ', { style: 'currency', currency: 'TZS', minimumFractionDigits: 2 })

const fmtDateTime = (v: string) => new Date(v).toLocaleString()
const fmtDate = (v: string | null) => (v ? new Date(v).toLocaleDateString() : '-')

const esc = (v: string | number | null | undefined) =>
  String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')

const itemLabel = (item: {
  variant: { sku: string | null; size: string | null; color: string | null } | null
  product_name_snapshot?: string | null
  sku_snapshot?: string | null
}) => {
  if (!item.variant) {
    const fallback = [item.product_name_snapshot, item.sku_snapshot].filter(Boolean).join(' / ')
    return fallback || 'Historical Item'
  }
  const parts = [item.variant.sku, item.variant.size, item.variant.color].filter(Boolean)
  return parts.length ? parts.join(' / ') : item.product_name_snapshot || 'Default Variant'
}

interface PrintOptions {
  appName?: string
  customerName?: string | null
}

const resolveAppName = (options?: PrintOptions) => options?.appName?.trim() || 'RetailPro'
const resolveCustomerName = (options?: PrintOptions) => options?.customerName?.trim() || '-'

function openPrintable(title: string, bodyHtml: string) {
  const w = window.open('', '_blank', 'width=900,height=700')
  if (!w) return

  w.document.write(`<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<title>${esc(title)}</title>
<style>
  body { font-family: Arial, sans-serif; margin: 24px; color: #111827; }
  h1 { margin: 0 0 8px; font-size: 20px; }
  .muted { color: #6b7280; font-size: 12px; }
  .meta { margin: 16px 0; display: grid; grid-template-columns: repeat(2, minmax(200px, 1fr)); gap: 8px 16px; }
  table { width: 100%; border-collapse: collapse; margin-top: 12px; }
  th, td { border: 1px solid #e5e7eb; padding: 8px; text-align: left; font-size: 12px; }
  th { background: #f9fafb; }
  .right { text-align: right; }
  .totals { margin-top: 12px; width: 320px; margin-left: auto; }
  .totals div { display: flex; justify-content: space-between; padding: 4px 0; font-size: 13px; }
  .totals .final { font-weight: 700; border-top: 1px solid #d1d5db; margin-top: 6px; padding-top: 6px; }
  @media print { body { margin: 0.4in; } }
</style>
</head>
<body>
${bodyHtml}
</body>
</html>`)
  w.document.close()
  w.focus()
  w.print()
}

export function printSaleReceipt(sale: Sale, options?: PrintOptions) {
  const rows = sale.items
    .map(
      i => `<tr>
        <td>${esc(itemLabel(i))}</td>
        <td class="right">${esc(i.quantity)}</td>
        <td class="right">${esc(fmtMoney(i.unit_price))}</td>
        <td class="right">${esc(fmtMoney(i.subtotal))}</td>
      </tr>`,
    )
    .join('')

  openPrintable(
    `Receipt ${sale.sale_number}`,
    `<h1>Sales Receipt</h1>
    <div class="muted">${esc(resolveAppName(options))}</div>
    <div class="meta">
      <div><strong>Receipt #:</strong> ${esc(sale.sale_number)}</div>
      <div><strong>Date:</strong> ${esc(fmtDateTime(sale.sold_at))}</div>
      <div><strong>Payment:</strong> ${esc(sale.payment_method.replace('_', ' '))}</div>
      <div><strong>Customer:</strong> ${esc(resolveCustomerName(options))}</div>
    </div>
    <table>
      <thead>
        <tr><th>Item</th><th class="right">Qty</th><th class="right">Unit Price</th><th class="right">Subtotal</th></tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
    <div class="totals">
      <div><span>Subtotal</span><span>${esc(fmtMoney(sale.subtotal))}</span></div>
      <div><span>Discount</span><span>${esc(fmtMoney(sale.discount))}</span></div>
      <div class="final"><span>Total</span><span>${esc(fmtMoney(sale.total))}</span></div>
    </div>`,
  )
}

export function printOrderInvoice(order: Order, options?: PrintOptions) {
  const rows = order.items
    .map(
      i => `<tr>
        <td>${esc(itemLabel(i))}</td>
        <td class="right">${esc(i.quantity)}</td>
        <td class="right">${esc(fmtMoney(i.unit_price))}</td>
        <td class="right">${esc(fmtMoney(i.subtotal))}</td>
      </tr>`,
    )
    .join('')

  openPrintable(
    `Invoice ${order.order_number}`,
    `<h1>Order Invoice</h1>
    <div class="muted">${esc(resolveAppName(options))}</div>
    <div class="meta">
      <div><strong>Invoice #:</strong> ${esc(order.order_number)}</div>
      <div><strong>Created:</strong> ${esc(fmtDateTime(order.created_at))}</div>
      <div><strong>Status:</strong> ${esc(order.status)}</div>
      <div><strong>Customer:</strong> ${esc(resolveCustomerName(options))}</div>
    </div>
    <table>
      <thead>
        <tr><th>Item</th><th class="right">Qty</th><th class="right">Unit Price</th><th class="right">Subtotal</th></tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
    <div class="totals">
      <div><span>Subtotal</span><span>${esc(fmtMoney(order.subtotal))}</span></div>
      <div><span>Discount</span><span>${esc(fmtMoney(order.discount))}</span></div>
      <div class="final"><span>Total</span><span>${esc(fmtMoney(order.total))}</span></div>
    </div>`,
  )
}

export function printPreorderInvoice(preorder: PreOrder, options?: PrintOptions) {
  const rows = preorder.items
    .map(
      i => `<tr>
        <td>${esc(itemLabel(i))}</td>
        <td class="right">${esc(i.quantity)}</td>
        <td class="right">${esc(fmtMoney(i.unit_price))}</td>
        <td class="right">${esc(fmtMoney(i.subtotal))}</td>
      </tr>`,
    )
    .join('')

  openPrintable(
    `Pre-order ${preorder.preorder_number}`,
    `<h1>Pre-order Invoice</h1>
    <div class="muted">${esc(resolveAppName(options))}</div>
    <div class="meta">
      <div><strong>Pre-order #:</strong> ${esc(preorder.preorder_number)}</div>
      <div><strong>Created:</strong> ${esc(fmtDateTime(preorder.created_at))}</div>
      <div><strong>Status:</strong> ${esc(preorder.status)}</div>
      <div><strong>Expected Arrival:</strong> ${esc(fmtDate(preorder.expected_arrival_date))}</div>
      <div><strong>Customer:</strong> ${esc(resolveCustomerName(options))}</div>
    </div>
    <table>
      <thead>
        <tr><th>Item</th><th class="right">Qty</th><th class="right">Unit Price</th><th class="right">Subtotal</th></tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
    <div class="totals">
      <div><span>Total</span><span>${esc(fmtMoney(preorder.total_amount))}</span></div>
      <div><span>Deposit</span><span>${esc(fmtMoney(preorder.deposit_amount))}</span></div>
      <div class="final"><span>Balance Due</span><span>${esc(fmtMoney(preorder.balance_due))}</span></div>
    </div>`,
  )
}

