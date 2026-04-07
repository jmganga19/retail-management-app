import { useRef, useState } from 'react'
import { csvToObjects } from '../../utils/csv'
import { getTemplateHeaders, type TemplateKey } from '../../utils/excelTemplates'
import Button from './Button'

export interface ImportOutcome {
  created: number
  failed: number
  errors: string[]
}

interface ImportCsvButtonProps {
  template: TemplateKey
  onImport: (rows: Record<string, string>[]) => Promise<ImportOutcome>
  size?: 'sm' | 'md' | 'lg'
}

const normalizeHeader = (value: string) => value.replace(/^\uFEFF/, '').trim().toLowerCase()

export default function ImportCsvButton({ template, onImport, size = 'sm' }: ImportCsvButtonProps) {
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [loading, setLoading] = useState(false)

  const pickFile = () => inputRef.current?.click()

  const handleFile = async (file: File) => {
    setLoading(true)
    try {
      const text = await file.text()
      const { headers, rows } = csvToObjects(text)
      const required = getTemplateHeaders(template).map(normalizeHeader)
      const found = new Set(headers.map(normalizeHeader))
      const missing = required.filter(h => !found.has(h))

      if (missing.length > 0) {
        alert(`Import failed. Missing columns: ${missing.join(', ')}`)
        return
      }

      if (rows.length === 0) {
        alert('Import failed. CSV has no data rows.')
        return
      }

      const normalizedRows = rows.map(row => {
        const mapped: Record<string, string> = {}
        Object.entries(row).forEach(([k, v]) => {
          mapped[normalizeHeader(k)] = v
        })
        return mapped
      })

      const result = await onImport(normalizedRows)
      const previewErrors = result.errors.slice(0, 5)
      const errorText = previewErrors.length ? `\nErrors:\n- ${previewErrors.join('\n- ')}` : ''
      alert(`Import complete. Created: ${result.created}, Failed: ${result.failed}${errorText}`)
    } catch (error) {
      alert(`Import failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setLoading(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept=".csv,text/csv"
        className="hidden"
        onChange={e => {
          const file = e.target.files?.[0]
          if (file) void handleFile(file)
        }}
      />
      <Button variant="secondary" size={size} loading={loading} onClick={pickFile}>
        Import CSV
      </Button>
    </>
  )
}
