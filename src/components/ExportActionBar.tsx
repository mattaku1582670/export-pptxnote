import { Button, Spinner } from '@heroui/react'
import {
  CheckIcon,
  CopyIcon,
  DocumentIcon,
  DownloadIcon,
  ResetIcon,
  UndoIcon,
} from './icons'

interface ExportActionBarProps {
  onCopyAll: () => void
  onDownloadText: () => void
  onDownloadDocx: () => void
  onRevertAll: () => void
  onReset: () => void
  hasEdits: boolean
  isCopied: boolean
  isExporting: boolean
}

export function ExportActionBar({
  onCopyAll,
  onDownloadText,
  onDownloadDocx,
  onRevertAll,
  onReset,
  hasEdits,
  isCopied,
  isExporting,
}: ExportActionBarProps) {
  return (
    <section
      aria-label="出力操作"
      className="rounded-2xl border border-default-200 bg-content1 p-4 shadow-sm"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        <Button
          isDisabled={isExporting}
          variant="secondary"
          onPress={onCopyAll}
        >
          {isCopied ? (
            <CheckIcon className="size-4" />
          ) : (
            <CopyIcon className="size-4" />
          )}
          {isCopied ? 'コピーしました' : '全文コピー'}
        </Button>
        <Button
          isDisabled={isExporting}
          variant="outline"
          onPress={onDownloadText}
        >
          <DownloadIcon className="size-4" />
          テキスト（.txt）で保存
        </Button>
        <Button
          isDisabled={isExporting}
          variant="primary"
          onPress={onDownloadDocx}
        >
          {isExporting ? (
            <Spinner aria-label="Wordファイルを作成中" size="sm" />
          ) : (
            <DocumentIcon className="size-4" />
          )}
          {isExporting
            ? 'Wordファイルを作成中…'
            : 'Word（.docx）で保存'}
        </Button>
        {hasEdits && (
          <Button
            isDisabled={isExporting}
            variant="outline"
            onPress={onRevertAll}
          >
            <UndoIcon className="size-4" />
            すべての編集を元に戻す
          </Button>
        )}
        <Button
          className="sm:ml-auto"
          isDisabled={isExporting}
          variant="ghost"
          onPress={onReset}
        >
          <ResetIcon className="size-4" />
          別のファイルを読み込む
        </Button>
      </div>
    </section>
  )
}
