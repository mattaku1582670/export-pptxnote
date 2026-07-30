import { Card, Checkbox, Label } from '@heroui/react'
import type { ExportOptions } from '../types'

interface ExportOptionsPanelProps {
  options: ExportOptions
  onChange: (options: ExportOptions) => void
  disabled: boolean
}

interface OptionDefinition {
  key: keyof ExportOptions
  label: string
}

const optionDefinitions: OptionDefinition[] = [
  {
    key: 'includeEmptySlides',
    label: 'ノートのないスライドも出力する',
  },
  {
    key: 'pageBreakPerSlide',
    label: 'スライドごとに改ページする',
  },
  {
    key: 'includeSlideTitles',
    label: 'スライドタイトルを出力する',
  },
  {
    key: 'includeSummary',
    label: '文書の先頭に集計情報を出力する',
  },
]

export function ExportOptionsPanel({
  options,
  onChange,
  disabled,
}: ExportOptionsPanelProps) {
  return (
    <Card>
      <Card.Header>
        <Card.Title>出力オプション</Card.Title>
        <Card.Description>
          保存する文書に含める内容を選択します。
        </Card.Description>
      </Card.Header>
      <Card.Content className="grid gap-3 sm:grid-cols-2">
        {optionDefinitions.map((definition) => (
          <Checkbox
            key={definition.key}
            isDisabled={disabled}
            isSelected={options[definition.key]}
            onChange={(isSelected) =>
              onChange({ ...options, [definition.key]: isSelected })
            }
          >
            <Checkbox.Content>
              <Checkbox.Control>
                <Checkbox.Indicator />
              </Checkbox.Control>
              <Label>{definition.label}</Label>
            </Checkbox.Content>
          </Checkbox>
        ))}
        <p className="text-xs text-foreground-500 sm:col-span-2">
          改ページはWordファイルにのみ反映されます。
        </p>
      </Card.Content>
    </Card>
  )
}
