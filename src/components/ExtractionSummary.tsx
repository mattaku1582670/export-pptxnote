import { Button, Card } from '@heroui/react'
import {
  slideNumbersWithoutNotes,
  type ExtractionResult,
} from '../types'
import { DocumentIcon } from './icons'

interface ExtractionSummaryProps {
  result: ExtractionResult
  onShowWithoutNotes: () => void
}

const MAX_VISIBLE_SLIDE_NUMBERS = 20

export function ExtractionSummary({
  result,
  onShowWithoutNotes,
}: ExtractionSummaryProps) {
  const summaryItems = [
    ['元のファイル名', result.fileName],
    ['総スライド数', `${result.slideCount} 枚`],
    ['ノートあり', `${result.slidesWithNotes} 枚`],
    ['ノートなし', `${result.slidesWithoutNotes} 枚`],
  ]
  const withoutNotes = slideNumbersWithoutNotes(result)
  const visibleNumbers = withoutNotes.slice(0, MAX_VISIBLE_SLIDE_NUMBERS)
  const remainingCount = withoutNotes.length - visibleNumbers.length

  return (
    <Card>
      <Card.Content>
        {/*
         * 左に見出し、右に 2x2 の集計を置く。ファイル名が長くなりうるため、
         * 右側の幅を左側の 3 倍確保している（minmax(0,...) は grid の子が
         * 最小コンテンツ幅で押し広げられて truncate が効かなくなるのを防ぐため）。
         */}
        <div className="grid items-center gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,3fr)]">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-accent/10 p-2 text-accent">
              <DocumentIcon className="size-5" />
            </div>
            <Card.Title>抽出結果</Card.Title>
          </div>
          <dl className="grid gap-3 sm:grid-cols-2">
            {summaryItems.map(([term, description]) => (
              <div
                key={term}
                className="min-w-0 rounded-xl bg-content2 px-4 py-3"
              >
                <dt className="text-xs font-medium text-foreground-500">
                  {term}
                </dt>
                <dd
                  className="mt-1 truncate font-semibold"
                  title={description}
                >
                  {description}
                </dd>
              </div>
            ))}
          </dl>
        </div>
        {withoutNotes.length > 0 && (
          <div className="mt-4 flex flex-col gap-3 rounded-xl bg-content2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-foreground-700">
              <span className="font-medium">ノートなしのスライド:</span>{' '}
              {visibleNumbers.join(', ')}
              {remainingCount > 0 && `、ほか ${remainingCount} 件`}
            </p>
            <Button
              className="shrink-0"
              size="sm"
              variant="outline"
              onPress={onShowWithoutNotes}
            >
              ノートなしのみ表示
            </Button>
          </div>
        )}
      </Card.Content>
    </Card>
  )
}
