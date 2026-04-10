import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createCategoryType, deleteCategoryType, getCategoryTypes, updateCategoryType } from '../api/categoryTypes'

export const useCategoryTypes = () =>
  useQuery({ queryKey: ['category-types'], queryFn: getCategoryTypes })

export const useCreateCategoryType = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: createCategoryType,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['category-types'] }),
  })
}

export const useUpdateCategoryType = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ oldName, name }: { oldName: string; name: string }) => updateCategoryType(oldName, name),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['category-types'] })
      qc.invalidateQueries({ queryKey: ['categories'] })
    },
  })
}

export const useDeleteCategoryType = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: deleteCategoryType,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['category-types'] }),
  })
}
