import { Card, ProgressBar, Spinner } from '@heroui/react'
import type { AppStatus, ParseProgress } from '../types'

interface ProcessingStatusProps {
  progress: ParseProgress | null
  status: AppStatus
}

const statusMessages: Partial<Record<AppStatus, string>> = {
  reading: 'PowerPointを読み込んでいます…',
  parsing: 'スライドを解析しています…',
  exporting: 'Wordファイルを作成しています…',
}

export function ProcessingStatus({
  progress,
  status,
}: ProcessingStatusProps) {
  const message =
    progress?.message ?? statusMessages[status] ?? '処理しています…'
  const hasDeterminateProgress = (progress?.total ?? 0) > 0
  const percentage =
    progress === null || progress.total === 0
      ? 0
      : (progress.current / progress.total) * 100

  return (
    <Card className="border border-accent/20">
      <Card.Content className="p-6">
        <div aria-live="polite" className="flex flex-col gap-4">
          <div className="flex items-center gap-3">
            {!hasDeterminateProgress && (
              <Spinner aria-label="処理中" color="accent" size="sm" />
            )}
            <p className="font-medium">{message}</p>
          </div>
          {hasDeterminateProgress && (
            <ProgressBar
              aria-label={message}
              color="accent"
              maxValue={100}
              value={percentage}
            >
              <div className="mb-2 flex justify-between text-sm text-foreground-600">
                <span>進捗</span>
                <ProgressBar.Output />
              </div>
              <ProgressBar.Track>
                <ProgressBar.Fill />
              </ProgressBar.Track>
            </ProgressBar>
          )}
        </div>
      </Card.Content>
    </Card>
  )
}
