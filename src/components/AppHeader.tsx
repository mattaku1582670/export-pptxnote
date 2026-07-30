import { Button } from '@heroui/react'
import { MoonIcon, SunIcon } from './icons'

interface AppHeaderProps {
  isDark: boolean
  onThemeToggle: () => void
}

export function AppHeader({ isDark, onThemeToggle }: AppHeaderProps) {
  return (
    <header className="mb-8 flex flex-col gap-5 border-b border-default-200 pb-7 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
          PowerPoint 発表者ノート抽出
        </h1>
        <p className="mt-3 max-w-2xl text-sm text-foreground-600 sm:text-base">
          pptxファイルから各スライドの発表者ノートを抽出し、編集して Word・テキストとして書き出せます。
        </p>
      </div>
      <Button
        aria-label={
          isDark
            ? 'ライトモードに切り替える'
            : 'ダークモードに切り替える'
        }
        className="shrink-0 self-end sm:self-start"
        isIconOnly
        variant="outline"
        onPress={onThemeToggle}
      >
        {isDark ? (
          <SunIcon className="size-5" />
        ) : (
          <MoonIcon className="size-5" />
        )}
      </Button>
    </header>
  )
}
