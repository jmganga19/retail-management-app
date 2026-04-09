import client from './client'
import type { Category } from '../types'

export const getCategories = () => client.get<Category[]>('/categories/').then(r => r.data)
export const createCategory = (data: Omit<Category, 'id' | 'created_at'>) =>
  client.post<Category>('/categories/', data).then(r => r.data)
export const updateCategory = (id: number, data: Partial<Omit<Category, 'id' | 'created_at'>>) =>
  client.put<Category>(`/categories/${id}`, data).then(r => r.data)
export const deleteCategory = (id: number) => client.delete(`/categories/${id}`)

