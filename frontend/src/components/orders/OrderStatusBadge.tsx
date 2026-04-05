import Badge from '../ui/Badge'
import type { OrderStatus } from '../../types'

const colorMap: Record<OrderStatus, 'yellow' | 'blue' | 'purple' | 'green' | 'red'> = {
  pending: 'yellow',
  confirmed: 'blue',
  processing: 'purple',
  completed: 'green',
  cancelled: 'red',
}

export default function OrderStatusBadge({ status }: { status: OrderStatus }) {
  return <Badge label={status} color={colorMap[status] ?? 'gray'} />
}
