import client from './client'
import type { Customer, CustomerCreate } from '../types'

export const getCustomers = (params?: { name?: string; phone?: string }) =>
  client.get<Customer[]>('/customers', { params }).then(r => r.data)

export const getCustomer = (id: number) =>
  client.get<Customer>(`/customers/${id}`).then(r => r.data)

export const createCustomer = (data: CustomerCreate) =>
  client.post<Customer>('/customers', data).then(r => r.data)

export const updateCustomer = (id: number, data: Partial<CustomerCreate>) =>
  client.put<Customer>(`/customers/${id}`, data).then(r => r.data)

export const deleteCustomer = (id: number) => client.delete(`/customers/${id}`)
