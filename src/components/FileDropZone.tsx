import { Button } from '@heroui/react'
import { useRef, useState, type DragEvent } from 'react'
import { DocumentIcon, UploadIcon } from './icons'

interface FileDropZoneProps {
  onFileSelected: (file: File) => void
  disabled: boolean
}

export function FileDropZone({
  onFileSelected,
  disabled,
}: FileDropZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const dragDepth = useRef(0)
  const [isDragOver, setIsDragOver] = useState(false)

  const openFilePicker = () => {
    if (!disabled) {
      inputRef.current?.click()
    }
  }

  const handleDragEnter = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    if (disabled) return
    dragDepth.current += 1
    setIsDragOver(true)
  }

  const handleDragLeave = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    if (disabled) return
    dragDepth.current = Math.max(0, dragDepth.current - 1)
    if (dragDepth.current === 0) {
      setIsDragOver(false)
    }
  }

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    dragDepth.current = 0
    setIsDragOver(false)
    if (disabled) return
    const file = event.dataTransfer.files.item(0)
    if (file !== null) {
      onFileSelected(file)
    }
  }

  return (
    <section aria-labelledby="file-selection-heading">
      <h2 id="file-selection-heading" className="mb-4 text-xl font-semibold">
        PowerPoint ファイルを選択
      </h2>
      <input
        ref={inputRef}
        accept=".pptx"
        aria-describedby="file-drop-instruction file-drop-format"
        aria-label="PowerPointファイル（.pptx）を選択"
        className="sr-only"
        disabled={disabled}
        id="pptx-file-input"
        tabIndex={-1}
        type="file"
        onChange={(event) => {
          const file = event.target.files?.item(0)
          if (file !== null && file !== undefined) {
            onFileSelected(file)
          }
          event.target.value = ''
        }}
      />
      <div
        aria-disabled={disabled}
        className={[
          'flex min-h-48 flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-10 text-center transition',
          isDragOver
            ? 'border-accent bg-accent/10'
            : 'border-default-300 bg-content1 hover:border-accent/70 hover:bg-content2',
          disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer',
        ].join(' ')}
        onClick={openFilePicker}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={(event) => event.preventDefault()}
        onDrop={handleDrop}
      >
        <div className="mb-5 rounded-full bg-accent/10 p-4 text-accent">
          {isDragOver ? (
            <DownloadIconForDrop />
          ) : (
            <UploadIcon className="size-8" />
          )}
        </div>
        <p id="file-drop-instruction" className="text-lg font-semibold">
          {isDragOver
            ? 'ここにドロップしてください'
            : 'ファイルをここにドラッグ＆ドロップ'}
        </p>
        <p id="file-drop-format" className="mt-2 text-sm text-foreground-600">
          対応形式：.pptx
        </p>
        <Button
          className="mt-5"
          isDisabled={disabled}
          onClick={(event) => event.stopPropagation()}
          onPress={openFilePicker}
        >
          <DocumentIcon className="size-4" />
          ファイルを選択
        </Button>
        <p className="mt-5 text-xs text-foreground-500">
          ファイルはアップロードされず、このブラウザ内だけで処理されます。
        </p>
      </div>
    </section>
  )
}

function DownloadIconForDrop() {
  return <DocumentIcon className="size-8" />
}
