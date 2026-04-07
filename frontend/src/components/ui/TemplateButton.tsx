import Button from './Button'
import { downloadCsvTemplate, type TemplateKey } from '../../utils/excelTemplates'

interface TemplateButtonProps {
  template: TemplateKey
  label?: string
  size?: 'sm' | 'md' | 'lg'
}

export default function TemplateButton({ template, label = 'Download Excel Template', size = 'sm' }: TemplateButtonProps) {
  return (
    <Button variant="secondary" size={size} onClick={() => downloadCsvTemplate(template)}>
      {label}
    </Button>
  )
}
