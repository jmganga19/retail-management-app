import client from './client'
import type { Sale, SaleCreate, SaleListItem } from '../types'

interface SaleFilters {
  date_from?: string
  date_to?: string
  payment_method?: string
  q?: string
  skip?: number
  limit?: number
}

export const getSales = (filters: SaleFilters = {}) =>
  client.get<SaleListItem[]>('/sales/', { params: filters }).then(r => r.data)

export const getSale = (id: number) =>
  client.get<Sale>(`/sales/${id}`).then(r => r.data)

export const createSale = (data: SaleCreate) =>
  client.post<Sale>('/sales/', data).then(r => r.data)

export const voidSale = (id: number) => client.delete(`/sales/${id}`)

