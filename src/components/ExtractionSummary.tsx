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
      <Card.Header className="flex items-center gap-3">
        <div className="rounded-lg bg-accent/10 p-2 text-accent">
          <DocumentIcon className="size-5" />
        </div>
        <Card.Title>抽出結果</Card.Title>
      </Card.Header>
      <Card.Content>
        <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
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
