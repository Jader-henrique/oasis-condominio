import * as XLSX from 'xlsx'

// Exporta array de objetos para Excel com cabeçalho azul/branco
export function exportarParaExcel(dados, nomeArquivo, nomeAba='Dados') {
  if (!dados || !dados.length) {
    alert('Nada para exportar')
    return
  }
  const wb = XLSX.utils.book_new()
  const ws = XLSX.utils.json_to_sheet(dados)

  // Estilizar cabeçalho: cor azul, texto branco, negrito
  const range = XLSX.utils.decode_range(ws['!ref'])
  for (let C = range.s.c; C <= range.e.c; C++) {
    const cellRef = XLSX.utils.encode_cell({ r:0, c:C })
    if (!ws[cellRef]) continue
    ws[cellRef].s = {
      fill: { fgColor: { rgb: '0C447C' } },
      font: { color: { rgb: 'FFFFFF' }, bold: true },
      alignment: { vertical: 'center', horizontal: 'center' },
      border: {
        top:    { style:'thin', color:{ rgb:'FFFFFF' } },
        bottom: { style:'thin', color:{ rgb:'FFFFFF' } },
        left:   { style:'thin', color:{ rgb:'FFFFFF' } },
        right:  { style:'thin', color:{ rgb:'FFFFFF' } },
      }
    }
  }

  // Largura automática das colunas
  const cols = Object.keys(dados[0]).map(k => ({
    wch: Math.max(k.length, ...dados.map(d => String(d[k] ?? '').length)) + 2
  }))
  ws['!cols'] = cols

  XLSX.utils.book_append_sheet(wb, ws, nomeAba.slice(0,30))
  XLSX.writeFile(wb, nomeArquivo)
}
