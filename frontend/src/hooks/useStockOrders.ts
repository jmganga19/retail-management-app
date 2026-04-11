import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createStockOrder, getStockOrder, getStockOrders, receiveStockOrder, updateStockOrder } from '../api/stockOrders'
import type { StockOrderCreate, StockOrderUpdate } from '../types'

export const useStockOrders = (params?: { q?: string; status?: string; skip?: number; limit?: number }) =>
  useQuery({ queryKey: ['stock-orders', params], queryFn: () => getStockOrders(params) })

export const useStockOrder = (id: number) =>
  useQuery({ queryKey: ['stock-orders', id], queryFn: () => getStockOrder(id), enabled: !!id })

export const useCreateStockOrder = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: StockOrderCreate) => createStockOrder(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['stock-orders'] })
      qc.invalidateQueries({ queryKey: ['products'] })
      qc.invalidateQueries({ queryKey: ['products', 'low-stock'] })
      qc.invalidateQueries({ queryKey: ['audit-logs'] })
    },
  })
}



export const useUpdateStockOrder = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: StockOrderUpdate }) => updateStockOrder(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['stock-orders'] })
      qc.invalidateQueries({ queryKey: ['products'] })
      qc.invalidateQueries({ queryKey: ['products', 'low-stock'] })
      qc.invalidateQueries({ queryKey: ['audit-logs'] })
    },
  })
}

export const useReceiveStockOrder = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, notes }: { id: number; notes?: string }) => receiveStockOrder(id, notes),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['stock-orders'] })
      qc.invalidateQueries({ queryKey: ['products'] })
      qc.invalidateQueries({ queryKey: ['products', 'low-stock'] })
      qc.invalidateQueries({ queryKey: ['audit-logs'] })
    },
  })
}


