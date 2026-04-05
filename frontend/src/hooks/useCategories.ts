import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createCategory, deleteCategory, getCategories, updateCategory } from '../api/categories'
import type { Category } from '../types'

export const useCategories = () =>
  useQuery({ queryKey: ['categories'], queryFn: getCategories })

export const useCreateCategory = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: createCategory,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['categories'] }),
  })
}

export const useUpdateCategory = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<Omit<Category, 'id' | 'created_at'>> }) =>
      updateCategory(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['categories'] }),
  })
}

export const useDeleteCategory = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: deleteCategory,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['categories'] }),
  })
}
