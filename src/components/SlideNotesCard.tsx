import { Alert, Button, Card, Chip, TextArea } from '@heroui/react'
import type { ExtractedSlide } from '../types'
import {
  CheckIcon,
  CopyIcon,
  UndoIcon,
  WarningIcon,
} from './icons'
import { countCharacters } from './countCharacters'

interface SlideNotesCardProps {
  slide: ExtractedSlide
  onNotesChange: (text: string) => void
  onRevert: () => void
  onCopy: () => void
  isCopied: boolean
}

export function SlideNotesCard({
  slide,
  onNotesChange,
  onRevert,
  onCopy,
  isCopied,
}: SlideNotesCardProps) {
  const isEdited = slide.editedNotes !== slide.originalNotes
  const heading =
    slide.title.length > 0
      ? `スライド ${slide.slideNumber}：${slide.title}`
      : `スライド ${slide.slideNumber}`

  return (
    <Card>
      <Card.Header className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <Card.Title className="break-words">{heading}</Card.Title>
          <Card.Description className="mt-1">
            {countCharacters(slide.editedNotes)}文字
          </Card.Description>
        </div>
        <Chip
          color={slide.hasNotes ? 'success' : 'default'}
          size="sm"
          variant="soft"
        >
          <span className="inline-flex items-center gap-1.5">
            {slide.hasNotes ? (
              <CheckIcon className="size-4" />
            ) : (
              <WarningIcon className="size-4" />
            )}
            <Chip.Label>
              {slide.hasNotes ? 'ノートあり' : 'ノートなし'}
            </Chip.Label>
          </span>
        </Chip>
      </Card.Header>
      <Card.Content className="flex flex-col gap-4">
        {slide.parseError !== undefined && (
          <Alert role="alert" status="warning">
            <Alert.Indicator>
              <WarningIcon className="size-5" />
            </Alert.Indicator>
            <Alert.Content>
              <Alert.Title>解析に関する注意</Alert.Title>
              <Alert.Description>
                このスライドは解析できませんでした。
              </Alert.Description>
            </Alert.Content>
          </Alert>
        )}
        <TextArea
          aria-label={`スライド ${slide.slideNumber} の発表者ノート`}
          className="min-h-36 resize-y"
          fullWidth
          placeholder={slide.hasNotes ? '発表者ノートを入力' : 'ノートなし'}
          value={slide.editedNotes}
          onChange={(event) => onNotesChange(event.target.value)}
        />
      </Card.Content>
      <Card.Footer className="flex flex-wrap gap-2">
        <Button size="sm" variant="secondary" onPress={onCopy}>
          {isCopied ? (
            <CheckIcon className="size-4" />
          ) : (
            <CopyIcon className="size-4" />
          )}
          {isCopied ? 'コピーしました' : 'このスライドをコピー'}
        </Button>
        {isEdited && (
          <Button size="sm" variant="ghost" onPress={onRevert}>
            <UndoIcon className="size-4" />
            元に戻す
          </Button>
        )}
      </Card.Footer>
    </Card>
  )
}
