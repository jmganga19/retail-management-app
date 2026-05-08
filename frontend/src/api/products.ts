import client from './client'
import type { Product, ProductCreate } from '../types'

interface ProductFilters {
  category_id?: number
  name?: string
  is_active?: boolean
  skip?: number
  limit?: number
}

export const getProducts = (filters: ProductFilters = {}) =>
  client.get<Product[]>('/products/', { params: filters }).then(r => r.data)

export const getLowStockProducts = () =>
  client.get<Product[]>('/products/low-stock').then(r => r.data)

export const getProduct = (id: number) =>
  client.get<Product>(`/products/${id}`).then(r => r.data)

export const createProduct = (data: ProductCreate) =>
  client.post<Product>('/products/', data).then(r => r.data)

export const updateProduct = (id: number, data: Partial<ProductCreate & { is_active: boolean }>) =>
  client.put<Product>(`/products/${id}`, data).then(r => r.data)

export const deleteProduct = (id: number) => client.delete(`/products/${id}`)

