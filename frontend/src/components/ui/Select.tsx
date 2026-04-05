import { forwardRef, SelectHTMLAttributes } from 'react'

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string
  error?: string
  options: { value: string | number; label: string }[]
  placeholder?: string
}

const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, error, options, placeholder, className = '', ...props }, ref) => (
    <div className="flex flex-col gap-1">
      {label && <label className="text-sm font-medium text-gray-700">{label}</label>}
      <select
        ref={ref}
        className={[
          'rounded-lg border px-3 py-2 text-sm shadow-sm bg-white',
          'focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent',
          error ? 'border-red-400' : 'border-gray-300',
          className,
        ].join(' ')}
        {...props}
      >
        {placeholder && <option value="">{placeholder}</option>}
        {options.map(o => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  ),
)

Select.displayName = 'Select'
export default Select
