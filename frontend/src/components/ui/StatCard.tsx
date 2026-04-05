import { ReactNode } from 'react'

interface StatCardProps {
  title: string
  value: string | number
  icon: ReactNode
  colorClass?: string
  subtitle?: string
}

export default function StatCard({ title, value, icon, colorClass = 'bg-brand-100 text-brand-600', subtitle }: StatCardProps) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 flex items-start gap-4">
      <div className={`p-3 rounded-lg ${colorClass}`}>{icon}</div>
      <div>
        <p className="text-sm text-gray-500 font-medium">{title}</p>
        <p className="text-2xl font-bold text-gray-900 mt-0.5">{value}</p>
        {subtitle && <p className="text-xs text-gray-400 mt-1">{subtitle}</p>}
      </div>
    </div>
  )
}
