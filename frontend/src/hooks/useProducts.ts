import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  addVariant,
  createProduct,
  deleteProduct,
  deleteVariant,
  getLowStockProducts,
  getProduct,
  getProducts,
  updateProduct,
  updateVariant,
} from '../api/products'
import type { ProductCreate, VariantCreate, VariantUpdate } from '../types'

interface ProductFilters {
  category_id?: number
  name?: string
  is_active?: boolean
}

export const useProducts = (filters: ProductFilters = {}) =>
  useQuery({ queryKey: ['products', filters], queryFn: () => getProducts(filters) })

export const useLowStockProducts = () =>
  useQuery({ queryKey: ['products', 'low-stock'], queryFn: getLowStockProducts })

export const useProduct = (id: number) =>
  useQuery({ queryKey: ['products', id], queryFn: () => getProduct(id), enabled: !!id })

export const useCreateProduct = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: ProductCreate) => createProduct(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['products'] }),
  })
}

export const useUpdateProduct = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<ProductCreate & { is_active: boolean }> }) =>
      updateProduct(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['products'] }),
  })
}

export const useDeleteProduct = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: deleteProduct,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['products'] }),
  })
}

export const useAddVariant = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ productId, data }: { productId: number; data: VariantCreate }) =>
      addVariant(productId, data),
    onSuccess: (_data, { productId }) => {
      qc.invalidateQueries({ queryKey: ['products', productId] })
      qc.invalidateQueries({ queryKey: ['products'] })
    },
  })
}

export const useUpdateVariant = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ productId, variantId, data }: { productId: number; variantId: number; data: VariantUpdate }) =>
      updateVariant(productId, variantId, data),
    onSuccess: (_data, { productId }) => {
      qc.invalidateQueries({ queryKey: ['products', productId] })
      qc.invalidateQueries({ queryKey: ['products'] })
    },
  })
}

export const useDeleteVariant = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ productId, variantId }: { productId: number; variantId: number }) =>
      deleteVariant(productId, variantId),
    onSuccess: (_data, { productId }) => {
      qc.invalidateQueries({ queryKey: ['products', productId] })
      qc.invalidateQueries({ queryKey: ['products'] })
    },
  })
}
