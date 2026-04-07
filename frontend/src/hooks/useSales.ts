import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createSale, getSale, getSales, voidSale } from '../api/sales'
import type { SaleCreate } from '../types'

interface SaleFilters {
  date_from?: string
  date_to?: string
  payment_method?: string
  q?: string
}

export const useSales = (filters: SaleFilters = {}) =>
  useQuery({ queryKey: ['sales', filters], queryFn: () => getSales(filters) })

export const useSale = (id: number) =>
  useQuery({ queryKey: ['sales', id], queryFn: () => getSale(id), enabled: !!id })

export const useCreateSale = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: SaleCreate) => createSale(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sales'] })
      qc.invalidateQueries({ queryKey: ['products'] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })
}

export const useVoidSale = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: voidSale,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sales'] })
      qc.invalidateQueries({ queryKey: ['products'] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })
}
