import { Card } from '@heroui/react'
import type { ExtractionResult } from '../types'
import { DocumentIcon } from './icons'

interface ExtractionSummaryProps {
  result: ExtractionResult
}

export function ExtractionSummary({ result }: ExtractionSummaryProps) {
  const summaryItems = [
    ['元のファイル名', result.fileName],
    ['総スライド数', `${result.slideCount} 枚`],
    ['ノートあり', `${result.slidesWithNotes} 枚`],
    ['ノートなし', `${result.slidesWithoutNotes} 枚`],
  ]

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
      </Card.Content>
    </Card>
  )
}
