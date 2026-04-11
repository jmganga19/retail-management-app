import client from './client'
import type { StockOrder, StockOrderCreate, StockOrderListItem, StockOrderUpdate } from '../types'

export const getStockOrders = (params?: { q?: string; status?: string; skip?: number; limit?: number }) =>
  client.get<StockOrderListItem[]>('/stock-orders/', { params }).then(r => r.data)

export const getStockOrder = (id: number) =>
  client.get<StockOrder>(`/stock-orders/${id}`).then(r => r.data)

export const createStockOrder = (data: StockOrderCreate) =>
  client.post<StockOrder>('/stock-orders/', data).then(r => r.data)

export const updateStockOrder = (id: number, data: StockOrderUpdate) =>
  client.put<StockOrder>(`/stock-orders/${id}`, data).then(r => r.data)

export const receiveStockOrder = (id: number, notes?: string) =>
  client.post<StockOrder>(`/stock-orders/${id}/receive`, { notes }).then(r => r.data)
