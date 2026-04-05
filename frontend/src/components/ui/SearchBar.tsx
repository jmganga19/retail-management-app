import { InputHTMLAttributes } from 'react'

interface SearchBarProps extends InputHTMLAttributes<HTMLInputElement> {
  onClear?: () => void
}

export default function SearchBar({ onClear, value, className = '', ...props }: SearchBarProps) {
  return (
    <div className="relative">
      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 115 11a6 6 0 0112 0z" />
        </svg>
      </span>
      <input
        value={value}
        className={[
          'pl-9 pr-8 py-2 rounded-lg border border-gray-300 text-sm shadow-sm w-full',
          'focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent',
          className,
        ].join(' ')}
        {...props}
      />
      {value && onClear && (
        <button
          onClick={onClear}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}
    </div>
  )
}
