// ---- Categories ----
export interface Category {
  id: number
  name: string
  slug: string
  type: string
  created_at: string
}

// ---- Products ----
export interface Variant {
  id: number
  product_id: number
  size: string | null
  color: string | null
  sku: string | null
  stock_qty: number
}

export interface Product {
  id: number
  category_id: number
  name: string
  description: string | null
  price: string
  image_url: string | null
  low_stock_threshold: number
  is_active: boolean
  created_at: string
  variants: Variant[]
}

export interface ProductCreate {
  name: string
  category_id: number
  description?: string
  price: number
  image_url?: string
  low_stock_threshold?: number
  variants: VariantCreate[]
}

export interface VariantCreate {
  size?: string
  color?: string
  sku?: string
  stock_qty: number
}

export interface VariantUpdate {
  size?: string
  color?: string
  sku?: string
  stock_qty?: number
}

// ---- Customers ----
export interface Customer {
  id: number
  name: string
  phone: string | null
  email: string | null
  created_at: string
}

export interface CustomerCreate {
  name: string
  phone?: string
  email?: string
}

// ---- Sales ----
export interface SaleItemCreate {
  variant_id: number
  quantity: number
}

export interface SaleItem {
  id: number
  variant_id: number
  quantity: number
  unit_price: string
  subtotal: string
  variant: Variant | null
}

export interface Sale {
  id: number
  sale_number: string
  customer_id: number | null
  payment_method: string
  subtotal: string
  discount: string
  total: string
  notes: string | null
  sold_at: string
  items: SaleItem[]
}

export interface SaleListItem {
  id: number
  sale_number: string
  customer_id: number | null
  customer_name: string | null
  product_names: string
  payment_method: string
  total: string
  sold_at: string
}

export interface SaleCreate {
  customer_id?: number
  payment_method: 'cash' | 'card' | 'mobile_money'
  discount?: number
  notes?: string
  items: SaleItemCreate[]
}

// ---- Orders ----
export type OrderStatus = 'pending' | 'confirmed' | 'processing' | 'completed' | 'cancelled'

export interface OrderItemCreate {
  variant_id: number
  quantity: number
  unit_price: number
}

export interface OrderItem {
  id: number
  variant_id: number
  quantity: number
  unit_price: string
  subtotal: string
  variant: Variant | null
}

export interface Order {
  id: number
  order_number: string
  customer_id: number
  sale_id: number | null
  status: OrderStatus
  subtotal: string
  discount: string
  total: string
  notes: string | null
  created_at: string
  updated_at: string
  items: OrderItem[]
}

export interface OrderListItem {
  id: number
  order_number: string
  customer_id: number
  customer_name: string | null
  product_names: string
  sale_id: number | null
  status: OrderStatus
  total: string
  created_at: string
}

export interface OrderCreate {
  customer_id: number
  discount?: number
  notes?: string
  items: OrderItemCreate[]
}

export interface OrderConvertToSale {
  payment_method: 'cash' | 'card' | 'mobile_money'
  notes?: string
}

// ---- Pre-orders ----
export type PreOrderStatus = 'pending' | 'arrived' | 'collected' | 'cancelled'

export interface PreOrderItemCreate {
  variant_id: number
  quantity: number
  unit_price: number
}

export interface PreOrderItem {
  id: number
  variant_id: number
  quantity: number
  unit_price: string
  subtotal: string
  variant: Variant | null
}

export interface PreOrder {
  id: number
  preorder_number: string
  customer_id: number
  status: PreOrderStatus
  expected_arrival_date: string | null
  deposit_amount: string
  total_amount: string
  balance_due: string
  notes: string | null
  created_at: string
  updated_at: string
  items: PreOrderItem[]
}

export interface PreOrderListItem {
  id: number
  preorder_number: string
  customer_id: number
  customer_name: string | null
  product_names: string
  status: PreOrderStatus
  total_amount: string
  deposit_amount: string
  balance_due: string
  expected_arrival_date: string | null
  created_at: string
}

export interface PreOrderCreate {
  customer_id: number
  expected_arrival_date?: string
  deposit_amount?: number
  notes?: string
  items: PreOrderItemCreate[]
}

// ---- Dashboard ----
export interface RecentTransaction {
  id: number
  sale_number: string
  customer_name: string | null
  payment_method: string
  total: string
  sold_at: string
}

export interface DashboardSummary {
  today_sales_total: string
  today_sales_count: number
  total_orders_count: number
  pending_preorders_count: number
  low_stock_count: number
  recent_transactions: RecentTransaction[]
}






