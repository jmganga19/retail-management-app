import client from './client'
import type { Order, OrderCreate, OrderListItem, OrderStatus } from '../types'

export const getOrders = (params?: { status?: string; customer_id?: number }) =>
  client.get<OrderListItem[]>('/orders', { params }).then(r => r.data)

export const getOrder = (id: number) =>
  client.get<Order>(`/orders/${id}`).then(r => r.data)

export const createOrder = (data: OrderCreate) =>
  client.post<Order>('/orders', data).then(r => r.data)

export const updateOrderStatus = (id: number, status: OrderStatus) =>
  client.patch<Order>(`/orders/${id}/status`, { status }).then(r => r.data)

export const cancelOrder = (id: number) => client.delete(`/orders/${id}`)
