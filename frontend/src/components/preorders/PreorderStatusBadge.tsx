import Badge from '../ui/Badge'
import type { PreOrderStatus } from '../../types'

const colorMap: Record<PreOrderStatus, 'yellow' | 'blue' | 'green' | 'red'> = {
  pending: 'yellow',
  arrived: 'blue',
  collected: 'green',
  cancelled: 'red',
}

export default function PreorderStatusBadge({ status }: { status: PreOrderStatus }) {
  return <Badge label={status} color={colorMap[status] ?? 'gray'} />
}
