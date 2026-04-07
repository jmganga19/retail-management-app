import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  cancelPreorder,
  createPreorder,
  getPreorder,
  getPreorders,
  updateDeposit,
  updatePreorderStatus,
} from '../api/preorders'
import type { PreOrderCreate, PreOrderStatus } from '../types'

export const usePreorders = (params?: { status?: string; q?: string }) =>
  useQuery({ queryKey: ['preorders', params], queryFn: () => getPreorders(params) })

export const usePreorder = (id: number) =>
  useQuery({ queryKey: ['preorders', id], queryFn: () => getPreorder(id), enabled: !!id })

export const useCreatePreorder = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: PreOrderCreate) => createPreorder(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['preorders'] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })
}

export const useUpdatePreorderStatus = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, status }: { id: number; status: PreOrderStatus }) =>
      updatePreorderStatus(id, status),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['preorders'] }),
  })
}

export const useUpdateDeposit = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, deposit_amount }: { id: number; deposit_amount: number }) =>
      updateDeposit(id, deposit_amount),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['preorders'] }),
  })
}

export const useCancelPreorder = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: cancelPreorder,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['preorders'] }),
  })
}
