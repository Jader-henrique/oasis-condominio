import { useState } from 'react'

/**
 * Hook de ordenação para tabelas.
 * @param {string} initialBy - chave da coluna inicial
 * @param {'asc'|'desc'} initialDir - direção inicial
 *
 * Uso:
 *   const { sortBy, sortDir, onSort, ordenar } = useSort('previsto', 'asc')
 *   const lista = ordenar(itensFiltrados)
 *   <SortableTh col="previsto" label="Início Prev." sortBy={sortBy} sortDir={sortDir} onSort={onSort}/>
 */
export function useSort(initialBy, initialDir = 'asc') {
  const [sortBy, setSortBy] = useState(initialBy)
  const [sortDir, setSortDir] = useState(initialDir)

  function onSort(col) {
    if (sortBy === col) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortBy(col)
      setSortDir('asc')
    }
  }

  function ordenar(lista, accessor = null) {
    if (!sortBy) return lista
    const get = accessor ? (item) => accessor(item, sortBy) : (item) => item[sortBy]
    return [...lista].sort((a, b) => {
      let va = get(a)
      let vb = get(b)
      // null/undefined sempre no fim
      const va_empty = va === null || va === undefined || va === ''
      const vb_empty = vb === null || vb === undefined || vb === ''
      if (va_empty && vb_empty) return 0
      if (va_empty) return 1
      if (vb_empty) return -1
      // numérico
      const na = parseFloat(va), nb = parseFloat(vb)
      if (!isNaN(na) && !isNaN(nb) && /^[\d.,\-]+$/.test(String(va)) && /^[\d.,\-]+$/.test(String(vb))) {
        return sortDir === 'asc' ? na - nb : nb - na
      }
      // datas ISO YYYY-MM-DD comparam como string mesmo
      const sa = String(va).toLowerCase()
      const sb = String(vb).toLowerCase()
      return sortDir === 'asc' ? sa.localeCompare(sb) : sb.localeCompare(sa)
    })
  }

  return { sortBy, sortDir, onSort, ordenar }
}

/**
 * Cabeçalho de tabela clicável que mostra ícone de ordenação.
 */
export function SortableTh({ col, label, sortBy, sortDir, onSort, style }) {
  const ativo = sortBy === col
  return (
    <th onClick={() => onSort(col)}
      style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap', ...style }}>
      {label}
      {ativo
        ? <i className={`fa-solid fa-arrow-${sortDir === 'asc' ? 'up' : 'down'}`}
            style={{ marginLeft: 6, fontSize: 10, color: 'var(--azul)' }}></i>
        : <i className="fa-solid fa-sort"
            style={{ marginLeft: 6, fontSize: 9, color: 'var(--texto-ter)', opacity: 0.4 }}></i>
      }
    </th>
  )
}
