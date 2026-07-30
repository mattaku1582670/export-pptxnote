import { Button, Label, SearchField } from '@heroui/react'
import type { SlideFilter } from '../types'

interface SlideFilterBarProps {
  filter: SlideFilter
  onFilterChange: (filter: SlideFilter) => void
  searchQuery: string
  onSearchQueryChange: (query: string) => void
  visibleCount: number
  totalCount: number
}

const filters: { value: SlideFilter; label: string }[] = [
  { value: 'all', label: 'すべてのスライド' },
  { value: 'withNotes', label: 'ノートありのみ' },
  { value: 'withoutNotes', label: 'ノートなしのみ' },
  { value: 'edited', label: '編集したもののみ' },
]

export function SlideFilterBar({
  filter,
  onFilterChange,
  searchQuery,
  onSearchQueryChange,
  visibleCount,
  totalCount,
}: SlideFilterBarProps) {
  return (
    <section
      aria-label="スライドの絞り込み"
      className="rounded-2xl border border-default-200 bg-content1 p-4"
    >
      <div className="flex flex-col gap-4">
        <div
          aria-label="表示条件で絞り込む"
          className="flex flex-wrap gap-2"
          role="group"
        >
          {filters.map((item) => (
            <Button
              key={item.value}
              aria-pressed={filter === item.value}
              size="sm"
              variant={filter === item.value ? 'primary' : 'outline'}
              onPress={() => onFilterChange(item.value)}
            >
              {item.label}
            </Button>
          ))}
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <SearchField
            className="w-full sm:max-w-md"
            fullWidth
            value={searchQuery}
            onChange={onSearchQueryChange}
          >
            <Label>スライドを検索</Label>
            <SearchField.Group>
              <SearchField.SearchIcon />
              <SearchField.Input placeholder="番号・タイトル・ノート本文" />
              <SearchField.ClearButton aria-label="検索語をクリア" />
            </SearchField.Group>
          </SearchField>
          <p
            aria-live="polite"
            className="shrink-0 text-sm text-foreground-600"
          >
            {totalCount} 件中 {visibleCount} 件を表示
          </p>
        </div>
      </div>
    </section>
  )
}
