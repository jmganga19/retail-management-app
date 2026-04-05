import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createCustomer, deleteCustomer, getCustomers, updateCustomer } from '../api/customers'
import type { CustomerCreate } from '../types'

export const useCustomers = (params?: { name?: string }) =>
  useQuery({ queryKey: ['customers', params], queryFn: () => getCustomers(params) })

export const useCreateCustomer = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: CustomerCreate) => createCustomer(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['customers'] }),
  })
}

export const useUpdateCustomer = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<CustomerCreate> }) =>
      updateCustomer(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['customers'] }),
  })
}

export const useDeleteCustomer = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: deleteCustomer,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['customers'] }),
  })
}
