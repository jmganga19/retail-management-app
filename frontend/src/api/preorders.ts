import client from './client'
import type { PreOrder, PreOrderCreate, PreOrderListItem, PreOrderStatus } from '../types'

export const getPreorders = (params?: { status?: string }) =>
  client.get<PreOrderListItem[]>('/preorders', { params }).then(r => r.data)

export const getPreorder = (id: number) =>
  client.get<PreOrder>(`/preorders/${id}`).then(r => r.data)

export const createPreorder = (data: PreOrderCreate) =>
  client.post<PreOrder>('/preorders', data).then(r => r.data)

export const updatePreorderStatus = (id: number, status: PreOrderStatus) =>
  client.patch<PreOrder>(`/preorders/${id}/status`, { status }).then(r => r.data)

export const updateDeposit = (id: number, deposit_amount: number) =>
  client.patch<PreOrder>(`/preorders/${id}/deposit`, { deposit_amount }).then(r => r.data)

export const cancelPreorder = (id: number) => client.delete(`/preorders/${id}`)
