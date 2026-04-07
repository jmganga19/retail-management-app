function detectDelimiter(text: string): string {
  const firstLine = text
    .split(/\r?\n/)
    .map(line => line.trim())
    .find(line => line.length > 0)

  if (!firstLine) return ','

  const comma = (firstLine.match(/,/g) ?? []).length
  const semicolon = (firstLine.match(/;/g) ?? []).length
  const tab = (firstLine.match(/\t/g) ?? []).length

  if (semicolon >= comma && semicolon >= tab && semicolon > 0) return ';'
  if (tab >= comma && tab >= semicolon && tab > 0) return '\t'
  return ','
}

export function parseCsv(text: string): string[][] {
  const delimiter = detectDelimiter(text)
  const rows: string[][] = []
  let row: string[] = []
  let current = ''
  let inQuotes = false

  const pushCell = () => {
    row.push(current)
    current = ''
  }

  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i]

    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          current += '"'
          i += 1
        } else {
          inQuotes = false
        }
      } else {
        current += ch
      }
      continue
    }

    if (ch === '"') {
      inQuotes = true
    } else if (ch === delimiter) {
      pushCell()
    } else if (ch === '\n') {
      pushCell()
      if (row.some(cell => cell.trim() !== '')) rows.push(row)
      row = []
    } else if (ch === '\r') {
      // ignore CR in CRLF
    } else {
      current += ch
    }
  }

  pushCell()
  if (row.some(cell => cell.trim() !== '')) rows.push(row)

  return rows
}

export function csvToObjects(text: string): { headers: string[]; rows: Record<string, string>[] } {
  const matrix = parseCsv(text)
  if (matrix.length < 1) {
    return { headers: [], rows: [] }
  }

  const headers = matrix[0].map(h => h.replace(/^\uFEFF/, '').trim())
  const rows = matrix
    .slice(1)
    .filter(r => r.some(cell => cell.trim() !== ''))
    .map(r => {
      const obj: Record<string, string> = {}
      headers.forEach((h, idx) => {
        obj[h] = (r[idx] ?? '').trim()
      })
      return obj
    })

  return { headers, rows }
}
