import {
  AlertDialog,
  Button,
  Modal,
  TextArea,
} from '@heroui/react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { AppHeader } from './components/AppHeader'
import { ErrorMessage } from './components/ErrorMessage'
import { ExportActionBar } from './components/ExportActionBar'
import { ExportOptionsPanel } from './components/ExportOptionsPanel'
import { ExtractionSummary } from './components/ExtractionSummary'
import { FileDropZone } from './components/FileDropZone'
import { WarningIcon } from './components/icons'
import { ProcessingStatus } from './components/ProcessingStatus'
import { SlideFilterBar } from './components/SlideFilterBar'
import { SlideNotesCard } from './components/SlideNotesCard'
import { buildDocxBlob } from './services/docxExporter'
import { extractNotes, isLargeFile } from './services/pptxParser'
import { buildPlainText, buildSlideHeading } from './services/textExporter'
import {
  DEFAULT_EXPORT_OPTIONS,
  PptxError,
  withRecalculatedCounts,
  type AppStatus,
  type ExportOptions,
  type ExtractionResult,
  type ParseProgress,
  type SlideFilter,
} from './types'
import { copyText } from './utils/clipboard'
import { downloadBlob, downloadText } from './utils/download'
import { buildExportFileName } from './utils/fileName'

const GENERIC_PARSE_ERROR =
  'PowerPointファイルの解析中に問題が発生しました。別のファイルでお試しください。'
const GENERIC_EXPORT_ERROR =
  'Wordファイルの作成中に問題が発生しました。時間をおいてもう一度お試しください。'

function App() {
  const [result, setResult] = useState<ExtractionResult | null>(null)
  const [status, setStatus] = useState<AppStatus>('idle')
  const [progress, setProgress] = useState<ParseProgress | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [warningMessage, setWarningMessage] = useState<string | null>(null)
  const [filter, setFilter] = useState<SlideFilter>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [exportOptions, setExportOptions] = useState<ExportOptions>(
    DEFAULT_EXPORT_OPTIONS,
  )
  const [isDark, setIsDark] = useState<boolean>(
    () =>
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-color-scheme: dark)').matches,
  )
  const [copiedKey, setCopiedKey] = useState<string | null>(null)
  const [manualCopyText, setManualCopyText] = useState<string | null>(null)
  const [isResetConfirmOpen, setIsResetConfirmOpen] = useState(false)
  const copyTimerRef = useRef<number | null>(null)

  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDark)
    // file:// では共有範囲が不安定なため、テーマをブラウザへ永続保存しない。
  }, [isDark])

  useEffect(
    () => () => {
      if (copyTimerRef.current !== null) {
        window.clearTimeout(copyTimerRef.current)
      }
    },
    [],
  )

  const visibleSlides = useMemo(() => {
    if (result === null) return []
    const query = searchQuery.trim().toLocaleLowerCase()

    return result.slides.filter((slide) => {
      const matchesFilter =
        filter === 'all' ||
        (filter === 'withNotes' && slide.hasNotes) ||
        (filter === 'withoutNotes' && !slide.hasNotes)
      const matchesSearch =
        query.length === 0 ||
        String(slide.slideNumber).includes(query) ||
        slide.title.toLocaleLowerCase().includes(query) ||
        slide.editedNotes.toLocaleLowerCase().includes(query)

      return matchesFilter && matchesSearch
    })
  }, [filter, result, searchQuery])

  const showCopied = (key: string) => {
    if (copyTimerRef.current !== null) {
      window.clearTimeout(copyTimerRef.current)
    }
    setCopiedKey(key)
    copyTimerRef.current = window.setTimeout(() => {
      setCopiedKey(null)
      copyTimerRef.current = null
    }, 2000)
  }

  const copyOrShowManual = async (text: string, key: string) => {
    const copyResult = await copyText(text)
    if (copyResult === 'failed') {
      setManualCopyText(text)
      return
    }
    showCopied(key)
  }

  const handleFileSelected = async (file: File) => {
    setStatus('reading')
    setErrorMessage(null)
    setWarningMessage(null)
    setProgress(null)

    if (isLargeFile(file)) {
      setWarningMessage(
        'このファイルはサイズが大きいため、処理に時間がかかる場合があります。',
      )
    }

    try {
      const extractedResult = await extractNotes(file, (nextProgress) => {
        setProgress(nextProgress)
        setStatus(
          nextProgress.phase === 'reading' ? 'reading' : 'parsing',
        )
      })
      setResult(extractedResult)
      setProgress(null)
      setStatus('success')
    } catch (error: unknown) {
      setResult(null)
      setProgress(null)
      setErrorMessage(
        error instanceof PptxError ? error.userMessage : GENERIC_PARSE_ERROR,
      )
      setStatus('error')
    }
  }

  const updateSlideNotes = (slideNumber: number, text: string) => {
    setResult((currentResult) =>
      currentResult === null
        ? null
        : withRecalculatedCounts({
            ...currentResult,
            slides: currentResult.slides.map((slide) =>
              slide.slideNumber === slideNumber
                ? { ...slide, editedNotes: text }
                : slide,
            ),
          }),
    )
  }

  const revertSlideNotes = (slideNumber: number) => {
    setResult((currentResult) =>
      currentResult === null
        ? null
        : withRecalculatedCounts({
            ...currentResult,
            slides: currentResult.slides.map((slide) =>
              slide.slideNumber === slideNumber
                ? { ...slide, editedNotes: slide.originalNotes }
                : slide,
            ),
          }),
    )
  }

  const handleCopyAll = () => {
    if (result === null) return
    void copyOrShowManual(
      buildPlainText(result, exportOptions),
      'all',
    )
  }

  const handleCopySlide = (slideNumber: number) => {
    if (result === null) return
    const slide = result.slides.find(
      (candidate) => candidate.slideNumber === slideNumber,
    )
    if (slide === undefined) return
    const text = [
      buildSlideHeading(slide, exportOptions),
      '',
      slide.editedNotes,
    ].join('\n')
    void copyOrShowManual(text, `slide-${slideNumber}`)
  }

  const handleDownloadText = () => {
    if (result === null) return
    downloadText(
      buildPlainText(result, exportOptions),
      buildExportFileName(result.fileName, 'txt'),
    )
  }

  const handleDownloadDocx = async () => {
    if (result === null) return
    setErrorMessage(null)
    setStatus('exporting')
    setProgress({
      phase: 'exporting',
      current: 0,
      total: 0,
      message: 'Wordファイルを作成しています…',
    })

    try {
      const blob = await buildDocxBlob(result, exportOptions)
      downloadBlob(blob, buildExportFileName(result.fileName, 'docx'))
    } catch {
      setErrorMessage(GENERIC_EXPORT_ERROR)
    } finally {
      setProgress(null)
      setStatus('success')
    }
  }

  const resetApplication = () => {
    if (copyTimerRef.current !== null) {
      window.clearTimeout(copyTimerRef.current)
      copyTimerRef.current = null
    }
    setResult(null)
    setStatus('idle')
    setProgress(null)
    setErrorMessage(null)
    setWarningMessage(null)
    setFilter('all')
    setSearchQuery('')
    setExportOptions(DEFAULT_EXPORT_OPTIONS)
    setCopiedKey(null)
    setManualCopyText(null)
    setIsResetConfirmOpen(false)
  }

  const handleReset = () => {
    const hasEdits =
      result?.slides.some(
        (slide) => slide.editedNotes !== slide.originalNotes,
      ) ?? false
    if (hasEdits) {
      setIsResetConfirmOpen(true)
      return
    }
    resetApplication()
  }

  const isProcessing =
    status === 'reading' || status === 'parsing' || status === 'exporting'

  return (
    <main className="min-h-screen bg-background px-4 py-6 text-foreground sm:px-6 sm:py-10">
      <div className="mx-auto max-w-5xl">
        <AppHeader
          isDark={isDark}
          onThemeToggle={() => setIsDark((current) => !current)}
        />

        <div className="flex flex-col gap-6">
          {warningMessage !== null && (
            <ErrorMessage
              message={warningMessage}
              variant="warning"
              onDismiss={() => setWarningMessage(null)}
            />
          )}
          {errorMessage !== null && (
            <ErrorMessage
              message={errorMessage}
              variant="error"
              onDismiss={() => setErrorMessage(null)}
            />
          )}

          {(status === 'idle' || (status === 'error' && result === null)) && (
            <FileDropZone
              disabled={isProcessing}
              onFileSelected={(file) => void handleFileSelected(file)}
            />
          )}

          {(status === 'reading' || status === 'parsing') && (
            <ProcessingStatus progress={progress} status={status} />
          )}

          {result !== null && (
            <>
              <ExtractionSummary result={result} />
              {status === 'exporting' && (
                <ProcessingStatus progress={progress} status={status} />
              )}
              <ExportOptionsPanel
                disabled={status === 'exporting'}
                options={exportOptions}
                onChange={setExportOptions}
              />
              <ExportActionBar
                isCopied={copiedKey === 'all'}
                isExporting={status === 'exporting'}
                onCopyAll={handleCopyAll}
                onDownloadDocx={() => void handleDownloadDocx()}
                onDownloadText={handleDownloadText}
                onReset={handleReset}
              />
              <SlideFilterBar
                filter={filter}
                searchQuery={searchQuery}
                totalCount={result.slides.length}
                visibleCount={visibleSlides.length}
                onFilterChange={setFilter}
                onSearchQueryChange={setSearchQuery}
              />
              <section
                aria-labelledby="slide-notes-heading"
                className="flex flex-col gap-4"
              >
                <h2
                  id="slide-notes-heading"
                  className="text-xl font-semibold"
                >
                  スライド別の発表者ノート
                </h2>
                {visibleSlides.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-default-300 bg-content1 px-6 py-12 text-center text-foreground-600">
                    条件に一致するスライドがありません。
                  </div>
                ) : (
                  visibleSlides.map((slide) => (
                    <SlideNotesCard
                      key={slide.slideNumber}
                      isCopied={copiedKey === `slide-${slide.slideNumber}`}
                      slide={slide}
                      onCopy={() => handleCopySlide(slide.slideNumber)}
                      onNotesChange={(text) =>
                        updateSlideNotes(slide.slideNumber, text)
                      }
                      onRevert={() =>
                        revertSlideNotes(slide.slideNumber)
                      }
                    />
                  ))
                )}
              </section>
            </>
          )}
        </div>
      </div>

      <Modal
        isOpen={manualCopyText !== null}
        onOpenChange={(isOpen) => {
          if (!isOpen) setManualCopyText(null)
        }}
      >
        <Modal.Backdrop>
          <Modal.Container placement="center" size="lg">
            <Modal.Dialog>
              <Modal.Header>
                <Modal.Heading>手動でコピーしてください</Modal.Heading>
              </Modal.Header>
              <Modal.Body>
                <p className="mb-3 text-sm text-foreground-600">
                  自動コピーが利用できませんでした。以下のテキストを選択してコピーしてください。
                </p>
                <TextArea
                  aria-label="手動コピー用テキスト"
                  className="min-h-64 resize-y"
                  fullWidth
                  readOnly
                  value={manualCopyText ?? ''}
                  onFocus={(event) => event.target.select()}
                />
              </Modal.Body>
              <Modal.Footer>
                <Button
                  variant="primary"
                  onPress={() => setManualCopyText(null)}
                >
                  閉じる
                </Button>
              </Modal.Footer>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>

      <AlertDialog
        isOpen={isResetConfirmOpen}
        onOpenChange={setIsResetConfirmOpen}
      >
        <AlertDialog.Backdrop>
          <AlertDialog.Container placement="center" size="md">
            <AlertDialog.Dialog>
              <AlertDialog.Header>
                <AlertDialog.Icon status="warning">
                  <WarningIcon className="size-6" />
                </AlertDialog.Icon>
                <AlertDialog.Heading>
                  編集内容を破棄しますか？
                </AlertDialog.Heading>
              </AlertDialog.Header>
              <AlertDialog.Body>
                編集した発表者ノートは元に戻せません。別のファイルを読み込みますか？
              </AlertDialog.Body>
              <AlertDialog.Footer>
                <Button
                  variant="outline"
                  onPress={() => setIsResetConfirmOpen(false)}
                >
                  キャンセル
                </Button>
                <Button variant="danger" onPress={resetApplication}>
                  編集内容を破棄
                </Button>
              </AlertDialog.Footer>
            </AlertDialog.Dialog>
          </AlertDialog.Container>
        </AlertDialog.Backdrop>
      </AlertDialog>
    </main>
  )
}

export default App
