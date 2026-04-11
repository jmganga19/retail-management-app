import { useMemo, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { createCustomer, getCustomers } from '../api/customers'
import { createOrder } from '../api/orders'
import { createPreorder } from '../api/preorders'
import { createProduct, getProducts } from '../api/products'
import { createSale } from '../api/sales'
import { createStockOrder } from '../api/stockOrders'
import { getCategories } from '../api/categories'
import Button from '../components/ui/Button'
import Select from '../components/ui/Select'
import { csvToObjects } from '../utils/csv'
import { downloadCsvTemplate, type TemplateKey } from '../utils/excelTemplates'
import { normalizePaymentMethod, parseNumericLike, parsePositiveIntLike, trimToUndefined } from '../utils/importParsers'

type MigrationKey = TemplateKey

interface MigrationDef {
  key: MigrationKey
  label: string
  required: string[]
  aliases: Record<string, string[]>
}

interface ValidationIssue {
  rowNumber: number
  message: string
}

interface ImportResult {
  created: number
  failed: number
  errors: string[]
  failedRows: Array<Record<string, string>>
}

const defs: Record<MigrationKey, MigrationDef> = {
  products: {
    key: 'products',
    label: 'Products',
    required: ['name', 'category_name', 'price_tzs'],
    aliases: {
      name: ['product_name', 'item_name', 'item'],
      category_name: ['category', 'categoryname'],
      description: ['desc'],
      price_tzs: ['price', 'selling_price', 'selling_price_tzs'],
      variant_size: ['size'],
      variant_color: ['color'],
      variant_sku: ['sku'],
      variant_stock_qty: ['stock_qty', 'qty'],
    },
  },
  customers: {
    key: 'customers',
    label: 'Customers',
    required: ['name'],
    aliases: {
      name: ['customer_name', 'full_name'],
      phone: ['phone_number', 'mobile'],
      email: ['email_address'],
    },
  },
  sales: {
    key: 'sales',
    label: 'Sales',
    required: ['sale_ref', 'payment_method_cash_card_mobile_money', 'quantity'],
    aliases: {
      sale_ref: ['reference', 'sale_number', 'sale_no'],
      payment_method_cash_card_mobile_money: ['payment_method', 'payment'],
      customer_id_optional: ['customer_id'],
      discount_tzs: ['discount'],
      variant_id: ['variant', 'sku_id'],
      variant_sku_optional: ['variant_sku', 'sku', 'product_sku'],
      product_name_optional: ['product_name', 'item_name', 'name'],
      unit_price_tzs: ['unit_price', 'price', 'selling_price'],
      quantity: ['qty'],
    },
  },
  orders: {
    key: 'orders',
    label: 'Orders',
    required: ['order_ref', 'customer_id', 'quantity', 'unit_price_tzs'],
    aliases: {
      order_ref: ['reference', 'order_number', 'order_no'],
      customer_id: ['customer'],
      unit_price_tzs: ['unit_price', 'price'],
      variant_id: ['variant', 'sku_id'],
      variant_sku_optional: ['variant_sku', 'sku', 'product_sku'],
      quantity: ['qty'],
    },
  },
  preorders: {
    key: 'preorders',
    label: 'Pre-orders',
    required: ['preorder_ref', 'customer_id', 'quantity', 'unit_price_tzs'],
    aliases: {
      preorder_ref: ['reference', 'pre_order_ref', 'preorder_number'],
      customer_id: ['customer'],
      expected_arrival_date_yyyy_mm_dd: ['expected_arrival_date', 'arrival_date'],
      deposit_amount_tzs: ['deposit_amount', 'deposit'],
      unit_price_tzs: ['unit_price', 'price'],
      variant_id: ['variant', 'sku_id'],
      variant_sku_optional: ['variant_sku', 'sku', 'product_sku'],
      quantity: ['qty'],
    },
  },
  stock_orders: {
    key: 'stock_orders',
    label: 'Stock Orders',
    required: ['stock_ref', 'quantity', 'buying_price_tzs', 'selling_price_tzs'],
    aliases: {
      stock_ref: ['reference', 'stock_order_ref'],
      item_name: ['name', 'product_name'],
      category_id_optional: ['category_id', 'category'],
      variant_sku_optional: ['sku', 'variant_sku'],
      variant_size_optional: ['size', 'variant_size'],
      variant_color_optional: ['color', 'variant_color'],
      buying_price_tzs: ['buying_price', 'cost_price'],
      selling_price_tzs: ['selling_price', 'price_tzs'],
      quantity: ['qty'],
    },
  },
}

const normalize = (v: string) => v.replace(/^\uFEFF/, '').trim().toLowerCase()
const unique = <T,>(values: T[]) => Array.from(new Set(values))

const getApiError = (error: unknown, fallback: string): string => {
  const maybe = error as { response?: { data?: { detail?: unknown } }; message?: string }
  const detail = maybe?.response?.data?.detail
  if (typeof detail === 'string') return detail
  if (typeof maybe?.message === 'string' && maybe.message.trim().length > 0) return maybe.message
  return fallback
}

const buildAutoMapping = (headers: string[], targetHeaders: string[], aliases: Record<string, string[]>) => {
  const byNorm = new Map<string, string>()
  headers.forEach(h => byNorm.set(normalize(h), h))

  const mapping: Record<string, string> = {}
  targetHeaders.forEach(target => {
    const exact = byNorm.get(normalize(target))
    if (exact) {
      mapping[target] = exact
      return
    }

    const aliasHit = (aliases[target] ?? []).map(normalize).find(a => byNorm.has(a))
    mapping[target] = aliasHit ? byNorm.get(aliasHit) ?? '' : ''
  })
  return mapping
}


const fetchAllActiveProducts = async () => {
  const pageSize = 200
  let skip = 0
  const all: Awaited<ReturnType<typeof getProducts>> = []

  while (true) {
    const chunk = await getProducts({ is_active: true, skip, limit: pageSize })
    all.push(...chunk)
    if (chunk.length < pageSize) break
    skip += pageSize
  }

  return all
}
const downloadCsvFile = (headers: string[], rows: string[][], filename: string) => {
  const esc = (value: string) => {
    if (value.includes(',') || value.includes('"') || value.includes('\n')) return '"' + value.replace(/"/g, '""') + '"'
    return value
  }
  const csv = [headers.join(','), ...rows.map(row => row.map(cell => esc(String(cell ?? ''))).join(','))].join('\n')
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

const exportFailedRows = (rows: Array<Record<string, string>>) => {
  if (rows.length === 0) return
  const headers = unique(rows.flatMap(r => Object.keys(r)))
  const esc = (value: string) => {
    if (value.includes(',') || value.includes('"') || value.includes('\n')) return `"${value.replace(/"/g, '""')}"`
    return value
  }
  const csv = [headers.join(','), ...rows.map(row => headers.map(h => esc(String(row[h] ?? ''))).join(','))].join('\n')
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `migration_failed_rows_${Date.now()}.csv`
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

export default function DataMigrationPage() {
  const qc = useQueryClient()
  const [kind, setKind] = useState<MigrationKey>('products')
  const [sourceHeaders, setSourceHeaders] = useState<string[]>([])
  const [rawRows, setRawRows] = useState<Record<string, string>[]>([])
  const [mapping, setMapping] = useState<Record<string, string>>({})
  const [validationIssues, setValidationIssues] = useState<ValidationIssue[]>([])
  const [importResult, setImportResult] = useState<ImportResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [exportingVariants, setExportingVariants] = useState(false)
  const [salesHistoricalMode, setSalesHistoricalMode] = useState(true)

  const targetHeaders = useMemo(() => {
    if (!defs[kind]) return []
    return defs[kind].required.concat(
      ({
        products: ['description', 'image_url', 'low_stock_threshold', 'variant_size', 'variant_color', 'variant_sku', 'variant_stock_qty'],
        customers: ['phone', 'email'],
        sales: ['customer_id_optional', 'discount_tzs', 'notes', 'variant_id', 'variant_sku_optional', 'product_name_optional', 'unit_price_tzs'],
        orders: ['discount_tzs', 'notes', 'variant_id', 'variant_sku_optional'],
        preorders: ['expected_arrival_date_yyyy_mm_dd', 'deposit_amount_tzs', 'notes', 'variant_id', 'variant_sku_optional'],
        stock_orders: ['variant_id', 'item_name', 'category_id_optional', 'variant_sku_optional', 'variant_size_optional', 'variant_color_optional', 'notes'],
      } as Record<MigrationKey, string[]>)[kind],
    )
  }, [kind])

  const mappedRows = useMemo(() => {
    return rawRows.map((row, idx) => {
      const out: Record<string, string> = { __row_number: String(idx + 2) }
      targetHeaders.forEach(target => {
        const src = mapping[target]
        out[target] = src ? (row[src] ?? '').trim() : ''
      })
      return out
    })
  }, [rawRows, targetHeaders, mapping])

  const previewRows = useMemo(() => mappedRows.slice(0, 8), [mappedRows])

  const onFile = async (file: File) => {
    const text = await file.text()
    const { headers, rows } = csvToObjects(text)
    setSourceHeaders(headers)
    setRawRows(rows)
    setValidationIssues([])
    setImportResult(null)
    setMapping(buildAutoMapping(headers, targetHeaders, defs[kind].aliases))
  }

  const runValidation = () => {
    const issues: ValidationIssue[] = []
    const required = defs[kind].required

    mappedRows.forEach(row => {
      const rowNumber = Number(row.__row_number)
      required.forEach(field => {
        if (!trimToUndefined(row[field])) issues.push({ rowNumber, message: `${field} is required` })
      })

      if (kind === 'products') {
        const price = parseNumericLike(row.price_tzs)
        if (Number.isNaN(price) || price <= 0) issues.push({ rowNumber, message: 'price_tzs must be a positive number' })
      }
      if (kind === 'customers') {
        const email = trimToUndefined(row.email)
        if (email && !email.includes('@')) issues.push({ rowNumber, message: 'email format looks invalid' })
      }
      if (kind === 'sales') {
        const variantId = parsePositiveIntLike(row.variant_id)
        const variantSku = trimToUndefined(row.variant_sku_optional)
        const productName = trimToUndefined(row.product_name_optional)
        if (!salesHistoricalMode && Number.isNaN(variantId) && !variantSku) {
          issues.push({ rowNumber, message: 'variant_id or variant_sku_optional is required' })
        }
        if (salesHistoricalMode && Number.isNaN(variantId) && !variantSku && !productName) {
          issues.push({ rowNumber, message: 'variant_id/variant_sku_optional/product_name_optional is required' })
        }
        if (Number.isNaN(parsePositiveIntLike(row.quantity))) issues.push({ rowNumber, message: 'quantity must be positive integer' })
        if (salesHistoricalMode) {
          const unitPrice = parseNumericLike(row.unit_price_tzs)
          if (Number.isNaN(unitPrice) || unitPrice <= 0) issues.push({ rowNumber, message: 'unit_price_tzs must be positive number in Historical mode' })
        }
      }
      if (kind === 'orders' || kind === 'preorders') {
        if (Number.isNaN(parsePositiveIntLike(row.customer_id))) issues.push({ rowNumber, message: 'customer_id must be positive integer' })
        const variantId = parsePositiveIntLike(row.variant_id)
        const variantSku = trimToUndefined(row.variant_sku_optional)
        if (Number.isNaN(variantId) && !variantSku) issues.push({ rowNumber, message: 'variant_id or variant_sku_optional is required' })
        if (Number.isNaN(parsePositiveIntLike(row.quantity))) issues.push({ rowNumber, message: 'quantity must be positive integer' })
        if (Number.isNaN(parseNumericLike(row.unit_price_tzs))) issues.push({ rowNumber, message: 'unit_price_tzs must be numeric' })
      }
      if (kind === 'stock_orders') {
        const qty = parsePositiveIntLike(row.quantity)
        const buying = parseNumericLike(row.buying_price_tzs)
        const selling = parseNumericLike(row.selling_price_tzs)
        if (Number.isNaN(qty)) issues.push({ rowNumber, message: 'quantity must be positive integer' })
        if (Number.isNaN(buying) || buying <= 0) issues.push({ rowNumber, message: 'buying_price_tzs must be positive number' })
        if (Number.isNaN(selling) || selling <= 0) issues.push({ rowNumber, message: 'selling_price_tzs must be positive number' })
      }
    })

    setValidationIssues(issues)
    return issues
  }

  const executeImport = async (): Promise<ImportResult> => {
    const failRows: Array<Record<string, string>> = []
    const errors: string[] = []
    let created = 0

    const needsVariantLookup = kind === 'sales' || kind === 'orders' || kind === 'preorders'
    const variantBySku = new Map<string, number>()
    if (needsVariantLookup) {
      const productsForLookup = await fetchAllActiveProducts()
      productsForLookup.forEach(p => {
        p.variants.forEach(v => {
          const sku = (v.sku ?? '').trim().toLowerCase()
          if (sku && !variantBySku.has(sku)) variantBySku.set(sku, v.id)
        })
      })
    }

    if (kind === 'customers') {
      const existing = await getCustomers()
      const existingKeys = new Set(existing.map(c => `${c.name.toLowerCase()}|${(c.phone ?? '').toLowerCase()}|${(c.email ?? '').toLowerCase()}`))
      for (const row of mappedRows) {
        try {
          const name = trimToUndefined(row.name)
          if (!name) throw new Error('name is required')
          const phone = trimToUndefined(row.phone)
          const email = trimToUndefined(row.email)
          const k = `${name.toLowerCase()}|${(phone ?? '').toLowerCase()}|${(email ?? '').toLowerCase()}`
          if (existingKeys.has(k)) continue
          await createCustomer({ name, phone, email })
          existingKeys.add(k)
          created += 1
        } catch (e) {
          const msg = `Row ${row.__row_number}: ${getApiError(e, 'failed')}`
          errors.push(msg)
          failRows.push({ ...row, error: msg })
        }
      }
      await qc.invalidateQueries({ queryKey: ['customers'] })
      return { created, failed: errors.length, errors, failedRows: failRows }
    }

    if (kind === 'products') {
      const categories = await getCategories()
      const categoryMap = new Map(categories.map(c => [c.name.toLowerCase(), c.id]))
      const grouped = new Map<string, Record<string, string>[]>()
      mappedRows.forEach(row => {
        const key = `${(row.name || '').trim().toLowerCase()}|${(row.category_name || '').trim().toLowerCase()}`
        const list = grouped.get(key) ?? []
        list.push(row)
        grouped.set(key, list)
      })

      for (const [, group] of grouped) {
        const first = group[0]
        try {
          const name = trimToUndefined(first.name)
          const catName = trimToUndefined(first.category_name)
          const price = parseNumericLike(first.price_tzs)
          if (!name || !catName || Number.isNaN(price) || price <= 0) throw new Error('invalid required product fields')
          const categoryId = categoryMap.get(catName.toLowerCase())
          if (!categoryId) throw new Error(`Category not found: ${catName}`)

          const variants = group
            .filter(r => trimToUndefined(r.variant_size) || trimToUndefined(r.variant_color) || trimToUndefined(r.variant_sku) || trimToUndefined(r.variant_stock_qty))
            .map(r => ({
              size: trimToUndefined(r.variant_size),
              color: trimToUndefined(r.variant_color),
              sku: trimToUndefined(r.variant_sku),
              stock_qty: parseNumericLike(r.variant_stock_qty, 0),
            }))

          await createProduct({
            name,
            category_id: categoryId,
            description: trimToUndefined(first.description),
            price,
            image_url: trimToUndefined(first.image_url),
            low_stock_threshold: parseNumericLike(first.low_stock_threshold, 5),
            variants,
          })
          created += 1
        } catch (e) {
          group.forEach(r => {
            const msg = `Row ${r.__row_number}: ${getApiError(e, 'failed')}`
            errors.push(msg)
            failRows.push({ ...r, error: msg })
          })
        }
      }

      await qc.invalidateQueries({ queryKey: ['products'] })
      return { created, failed: errors.length, errors, failedRows: failRows }
    }

    if (kind === 'sales') {
      const groups = new Map<string, Record<string, string>[]>()
      mappedRows.forEach(row => {
        const ref = trimToUndefined(row.sale_ref)
        if (!ref) {
          const msg = `Row ${row.__row_number}: sale_ref is required`
          errors.push(msg)
          failRows.push({ ...row, error: msg })
          return
        }
        const list = groups.get(ref) ?? []
        list.push(row)
        groups.set(ref, list)
      })

      for (const [ref, list] of groups) {
        try {
          const first = list[0]
          const items = list.map((row, idx) => {
            const parsedVariantId = parsePositiveIntLike(row.variant_id)
            const sku = (trimToUndefined(row.variant_sku_optional) ?? '').toLowerCase()
            const resolvedVariantId = Number.isNaN(parsedVariantId) ? (sku ? (variantBySku.get(sku) ?? NaN) : NaN) : parsedVariantId
            const quantity = parsePositiveIntLike(row.quantity)

            if (Number.isNaN(quantity)) throw new Error(`invalid quantity at line ${idx + 1}`)

            if (salesHistoricalMode) {
              const unitPrice = parseNumericLike(row.unit_price_tzs)
              const productName = trimToUndefined(row.product_name_optional)
              if (Number.isNaN(unitPrice) || unitPrice <= 0) throw new Error(`unit_price_tzs must be positive at line ${idx + 1}`)
              if (Number.isNaN(resolvedVariantId) && !productName && !sku) {
                throw new Error(`variant_id/variant_sku_optional/product_name_optional required at line ${idx + 1}`)
              }
              return {
                variant_id: Number.isNaN(resolvedVariantId) ? undefined : resolvedVariantId,
                quantity,
                unit_price: unitPrice,
                product_name: productName,
                variant_sku: trimToUndefined(row.variant_sku_optional),
              }
            }

            if (Number.isNaN(resolvedVariantId)) {
              throw new Error(`invalid variant reference (variant_id or variant_sku_optional) at line ${idx + 1}`)
            }
            return { variant_id: resolvedVariantId, quantity }
          })

          await createSale({
            customer_id: Number.isNaN(parsePositiveIntLike(first.customer_id_optional)) ? undefined : parsePositiveIntLike(first.customer_id_optional),
            payment_method: normalizePaymentMethod(first.payment_method_cash_card_mobile_money),
            discount: Number.isNaN(parseNumericLike(first.discount_tzs)) ? undefined : parseNumericLike(first.discount_tzs),
            notes: trimToUndefined(first.notes),
            is_historical: salesHistoricalMode,
            items,
          })
          created += 1
        } catch (e) {
          list.forEach(r => {
            const msg = `Row ${r.__row_number} (${ref}): ${getApiError(e, 'failed')}`
            errors.push(msg)
            failRows.push({ ...r, error: msg })
          })
        }
      }
      await qc.invalidateQueries({ queryKey: ['sales'] })
      await qc.invalidateQueries({ queryKey: ['products'] })
      return { created, failed: errors.length, errors, failedRows: failRows }
    }

    if (kind === 'orders') {
      const groups = new Map<string, Record<string, string>[]>()
      mappedRows.forEach(row => {
        const ref = trimToUndefined(row.order_ref)
        if (!ref) {
          const msg = `Row ${row.__row_number}: order_ref is required`
          errors.push(msg)
          failRows.push({ ...row, error: msg })
          return
        }
        const list = groups.get(ref) ?? []
        list.push(row)
        groups.set(ref, list)
      })

      for (const [ref, list] of groups) {
        try {
          const first = list[0]
          const customerId = parsePositiveIntLike(first.customer_id)
          if (Number.isNaN(customerId)) throw new Error('invalid customer_id')

          const items = list.map((row, idx) => {
            const parsedVariantId = parsePositiveIntLike(row.variant_id)
            const sku = (trimToUndefined(row.variant_sku_optional) ?? '').toLowerCase()
            const resolvedVariantId = Number.isNaN(parsedVariantId) ? (sku ? (variantBySku.get(sku) ?? NaN) : NaN) : parsedVariantId
            const quantity = parsePositiveIntLike(row.quantity)
            const unitPrice = parseNumericLike(row.unit_price_tzs)
            if (Number.isNaN(resolvedVariantId) || Number.isNaN(quantity) || Number.isNaN(unitPrice) || unitPrice <= 0) throw new Error(`invalid item fields at line ${idx + 1}`)
            return { variant_id: resolvedVariantId, quantity, unit_price: unitPrice }
          })

          await createOrder({
            customer_id: customerId,
            discount: Number.isNaN(parseNumericLike(first.discount_tzs)) ? undefined : parseNumericLike(first.discount_tzs),
            notes: trimToUndefined(first.notes),
            items,
          })
          created += 1
        } catch (e) {
          list.forEach(r => {
            const msg = `Row ${r.__row_number} (${ref}): ${getApiError(e, 'failed')}`
            errors.push(msg)
            failRows.push({ ...r, error: msg })
          })
        }
      }
      await qc.invalidateQueries({ queryKey: ['orders'] })
      return { created, failed: errors.length, errors, failedRows: failRows }
    }

    if (kind === 'preorders') {
      const groups = new Map<string, Record<string, string>[]>()
      mappedRows.forEach(row => {
        const ref = trimToUndefined(row.preorder_ref)
        if (!ref) {
          const msg = `Row ${row.__row_number}: preorder_ref is required`
          errors.push(msg)
          failRows.push({ ...row, error: msg })
          return
        }
        const list = groups.get(ref) ?? []
        list.push(row)
        groups.set(ref, list)
      })

      for (const [ref, list] of groups) {
        try {
          const first = list[0]
          const customerId = parsePositiveIntLike(first.customer_id)
          if (Number.isNaN(customerId)) throw new Error('invalid customer_id')

          const items = list.map((row, idx) => {
            const parsedVariantId = parsePositiveIntLike(row.variant_id)
            const sku = (trimToUndefined(row.variant_sku_optional) ?? '').toLowerCase()
            const resolvedVariantId = Number.isNaN(parsedVariantId) ? (sku ? (variantBySku.get(sku) ?? NaN) : NaN) : parsedVariantId
            const quantity = parsePositiveIntLike(row.quantity)
            const unitPrice = parseNumericLike(row.unit_price_tzs)
            if (Number.isNaN(resolvedVariantId) || Number.isNaN(quantity) || Number.isNaN(unitPrice) || unitPrice <= 0) throw new Error(`invalid item fields at line ${idx + 1}`)
            return { variant_id: resolvedVariantId, quantity, unit_price: unitPrice }
          })

          await createPreorder({
            customer_id: customerId,
            expected_arrival_date: trimToUndefined(first.expected_arrival_date_yyyy_mm_dd),
            deposit_amount: Number.isNaN(parseNumericLike(first.deposit_amount_tzs)) ? undefined : parseNumericLike(first.deposit_amount_tzs),
            notes: trimToUndefined(first.notes),
            items,
          })
          created += 1
        } catch (e) {
          list.forEach(r => {
            const msg = `Row ${r.__row_number} (${ref}): ${getApiError(e, 'failed')}`
            errors.push(msg)
            failRows.push({ ...r, error: msg })
          })
        }
      }
      await qc.invalidateQueries({ queryKey: ['preorders'] })
      return { created, failed: errors.length, errors, failedRows: failRows }
    }

    const products = await fetchAllActiveProducts()
    const variants = products.flatMap(p => p.variants.map(v => ({ id: v.id, sku: (v.sku ?? '').toLowerCase(), name: p.name.toLowerCase() })))
    const variantBySkuStock = new Map(variants.filter(v => v.sku).map(v => [v.sku, v.id]))
    const variantByName = new Map<string, number>()
    variants.forEach(v => { if (!variantByName.has(v.name)) variantByName.set(v.name, v.id) })

    const groups = new Map<string, Record<string, string>[]>()
    mappedRows.forEach(row => {
      const ref = trimToUndefined(row.stock_ref)
      if (!ref) {
        const msg = `Row ${row.__row_number}: stock_ref is required`
        errors.push(msg)
        failRows.push({ ...row, error: msg })
        return
      }
      const list = groups.get(ref) ?? []
      list.push(row)
      groups.set(ref, list)
    })

    for (const [ref, group] of groups) {
      try {
        const first = group[0]
        const items = group.map((row, idx) => {
          const qty = parsePositiveIntLike(row.quantity)
          const buying = parseNumericLike(row.buying_price_tzs)
          const selling = parseNumericLike(row.selling_price_tzs)
          if (Number.isNaN(qty) || Number.isNaN(buying) || buying <= 0 || Number.isNaN(selling) || selling <= 0) {
            throw new Error(`invalid quantity/buying_price_tzs/selling_price_tzs at line ${idx + 1}`)
          }

          const sku = (trimToUndefined(row.variant_sku_optional) ?? '').toLowerCase()
          const itemName = (trimToUndefined(row.item_name) ?? '').toLowerCase()
          let variantId = parsePositiveIntLike(row.variant_id)
          if (Number.isNaN(variantId)) {
            variantId = sku ? (variantBySkuStock.get(sku) ?? NaN) : NaN
            if (Number.isNaN(variantId) && itemName) variantId = variantByName.get(itemName) ?? NaN
          }

          if (!Number.isNaN(variantId)) return { variant_id: variantId, quantity: qty, buying_price: buying, selling_price: selling }

          const categoryId = parsePositiveIntLike(row.category_id_optional)
          if (Number.isNaN(categoryId)) throw new Error(`category_id_optional required for new item at line ${idx + 1}`)
          if (!itemName) throw new Error(`item_name required for new item at line ${idx + 1}`)

          return {
            item_name: row.item_name,
            category_id: categoryId,
            variant_size: trimToUndefined(row.variant_size_optional),
            variant_color: trimToUndefined(row.variant_color_optional),
            variant_sku: trimToUndefined(row.variant_sku_optional),
            quantity: qty,
            buying_price: buying,
            selling_price: selling,
          }
        })

        await createStockOrder({ notes: trimToUndefined(first.notes), items })
        created += 1
      } catch (e) {
        group.forEach(r => {
          const msg = `Row ${r.__row_number} (${ref}): ${getApiError(e, 'failed')}`
          errors.push(msg)
          failRows.push({ ...r, error: msg })
        })
      }
    }

    await qc.invalidateQueries({ queryKey: ['stock-orders'] })
    await qc.invalidateQueries({ queryKey: ['products'] })
    return { created, failed: errors.length, errors, failedRows: failRows }
  }

  const exportVariantsCsv = async () => {
    setExportingVariants(true)
    try {
      const products = await fetchAllActiveProducts()
      const headers = ['product_name', 'sku', 'variant_id']
      const rows = products.flatMap(product =>
        (product.variants ?? []).map(variant => [product.name ?? '', variant.sku ?? '', String(variant.id)]),
      )
      downloadCsvFile(headers, rows, 'variants_mapping_' + Date.now() + '.csv')
    } finally {
      setExportingVariants(false)
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">Data Migration</h2>
        <p className="text-sm text-gray-600">Upload CSV, map columns, validate rows, then import safely.</p>
      </div>

      <div className="bg-white border border-gray-100 rounded-xl p-4 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
          <Select
            label="Dataset"
            value={kind}
            onChange={e => {
              const k = e.target.value as MigrationKey
              setKind(k)
              setSourceHeaders([])
              setRawRows([])
              setMapping({})
              setValidationIssues([])
              setImportResult(null)
            }}
            options={Object.values(defs).map(d => ({ value: d.key, label: d.label }))}
          />
          <div>
            <label className="text-sm font-medium text-gray-700">CSV File</label>
            <input
              className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              type="file"
              accept=".csv,text/csv"
              onChange={e => {
                const file = e.target.files?.[0]
                if (file) void onFile(file)
              }}
            />
          </div>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              loading={exportingVariants}
              onClick={async () => {
                await exportVariantsCsv()
              }}
            >
              Export Variants CSV
            </Button>
            <Button variant="secondary" onClick={() => downloadCsvTemplate(kind)}>
              Download Template
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                setSourceHeaders([])
                setRawRows([])
                setMapping({})
                setValidationIssues([])
                setImportResult(null)
              }}
            >
              Reset
            </Button>
          </div>
        </div>

        {kind === 'sales' && (
          <label className="inline-flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-gray-300"
              checked={salesHistoricalMode}
              onChange={e => setSalesHistoricalMode(e.target.checked)}
            />
            Historical sales import mode (no stock deduction; supports product_name + unit_price without variant)
          </label>
        )}

        {rawRows.length > 0 && (
          <>
            <div className="text-sm text-gray-600">Loaded <span className="font-semibold">{rawRows.length}</span> rows with <span className="font-semibold">{sourceHeaders.length}</span> columns.</div>

            <div className="overflow-x-auto border border-gray-100 rounded-lg">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-2 text-left">Target Column</th>
                    <th className="px-3 py-2 text-left">Source Column</th>
                    <th className="px-3 py-2 text-left">Required</th>
                  </tr>
                </thead>
                <tbody>
                  {targetHeaders.map(target => (
                    <tr key={target} className="border-t border-gray-100">
                      <td className="px-3 py-2 font-mono text-xs">{target}</td>
                      <td className="px-3 py-2">
                        <select
                          className="rounded border border-gray-300 px-2 py-1 text-sm w-full"
                          value={mapping[target] ?? ''}
                          onChange={e => setMapping(prev => ({ ...prev, [target]: e.target.value }))}
                        >
                          <option value="">(not mapped)</option>
                          {sourceHeaders.map(h => (
                            <option key={h} value={h}>{h}</option>
                          ))}
                        </select>
                      </td>
                      <td className="px-3 py-2">{defs[kind].required.includes(target) ? 'Yes' : 'No'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => runValidation()}>
                Validate Rows
              </Button>
              <Button
                loading={loading}
                onClick={async () => {
                  const issues = runValidation()
                  if (issues.length > 0) return
                  setLoading(true)
                  try {
                    const result = await executeImport()
                    setImportResult(result)
                  } finally {
                    setLoading(false)
                  }
                }}
              >
                Run Import
              </Button>
            </div>

            {validationIssues.length > 0 && (
              <div className="rounded border border-red-200 bg-red-50 p-3">
                <p className="text-sm font-semibold text-red-700">Validation Issues ({validationIssues.length})</p>
                <ul className="mt-2 text-sm text-red-700 list-disc pl-5">
                  {validationIssues.slice(0, 20).map((i, idx) => (
                    <li key={`${i.rowNumber}-${idx}`}>Row {i.rowNumber}: {i.message}</li>
                  ))}
                </ul>
              </div>
            )}

            {importResult && (
              <div className="rounded border border-gray-200 bg-gray-50 p-3 space-y-2">
                <p className="text-sm"><span className="font-semibold">Import finished.</span> Created: {importResult.created}, Failed: {importResult.failed}</p>
                {importResult.errors.length > 0 && (
                  <>
                    <ul className="text-sm text-red-700 list-disc pl-5">
                      {importResult.errors.slice(0, 15).map((e, idx) => <li key={idx}>{e}</li>)}
                    </ul>
                    <Button variant="secondary" size="sm" onClick={() => exportFailedRows(importResult.failedRows)}>
                      Download Failed Rows CSV
                    </Button>
                  </>
                )}
              </div>
            )}

            <div className="overflow-x-auto border border-gray-100 rounded-lg">
              <table className="min-w-full text-xs">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-2 py-1 text-left">#</th>
                    {targetHeaders.map(h => <th key={h} className="px-2 py-1 text-left font-mono">{h}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {previewRows.map(row => (
                    <tr key={row.__row_number} className="border-t border-gray-100">
                      <td className="px-2 py-1">{row.__row_number}</td>
                      {targetHeaders.map(h => <td key={`${row.__row_number}-${h}`} className="px-2 py-1">{row[h]}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  )
}






