import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { cancelOrder, convertOrderToSale, createOrder, getOrder, getOrders, updateOrderStatus } from '../api/orders'
import type { OrderConvertToSale, OrderCreate, OrderStatus } from '../types'

export const useOrders = (params?: { status?: string; q?: string }) =>
  useQuery({ queryKey: ['orders', params], queryFn: () => getOrders(params) })

export const useOrder = (id: number) =>
  useQuery({ queryKey: ['orders', id], queryFn: () => getOrder(id), enabled: !!id })

export const useCreateOrder = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: OrderCreate) => createOrder(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['orders'] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })
}

export const useUpdateOrderStatus = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, status }: { id: number; status: OrderStatus }) =>
      updateOrderStatus(id, status),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['orders'] }),
  })
}

export const useConvertOrderToSale = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: OrderConvertToSale }) =>
      convertOrderToSale(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['orders'] })
      qc.invalidateQueries({ queryKey: ['sales'] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
      qc.invalidateQueries({ queryKey: ['products'] })
    },
  })
}

export const useCancelOrder = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: cancelOrder,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['orders'] }),
  })
}
