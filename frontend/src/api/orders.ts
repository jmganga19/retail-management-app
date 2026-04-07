import client from './client'
import type { Order, OrderConvertToSale, OrderCreate, OrderListItem, OrderStatus, Sale } from '../types'

export const getOrders = (params?: { status?: string; customer_id?: number }) =>
  client.get<OrderListItem[]>('/orders', { params }).then(r => r.data)

export const getOrder = (id: number) =>
  client.get<Order>(`/orders/${id}`).then(r => r.data)

export const createOrder = (data: OrderCreate) =>
  client.post<Order>('/orders', data).then(r => r.data)

export const updateOrderStatus = (id: number, status: OrderStatus) =>
  client.patch<Order>(`/orders/${id}/status`, { status }).then(r => r.data)

export const convertOrderToSale = (id: number, data: OrderConvertToSale) =>
  client.post<Sale>(`/orders/${id}/convert-to-sale`, data).then(r => r.data)

export const cancelOrder = (id: number) => client.delete(`/orders/${id}`)
