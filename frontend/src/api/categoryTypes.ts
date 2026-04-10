import client from './client'

export const getCategoryTypes = () =>
  client.get<string[]>('/category-types/').then(r => r.data)

export const createCategoryType = (name: string) =>
  client.post<string[]>('/category-types/', { name }).then(r => r.data)

export const updateCategoryType = (oldName: string, name: string) =>
  client.put<string[]>(`/category-types/${encodeURIComponent(oldName)}`, { name }).then(r => r.data)

export const deleteCategoryType = (name: string) =>
  client.delete<string[]>(`/category-types/${encodeURIComponent(name)}`).then(r => r.data)
