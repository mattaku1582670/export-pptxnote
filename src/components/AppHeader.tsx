import { Button, Chip } from '@heroui/react'
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
        <Chip
          className="mt-4 h-auto max-w-full whitespace-normal py-2"
          color="success"
          variant="soft"
        >
          <Chip.Label>
            すべての処理はこのブラウザ内で行われます。
          </Chip.Label>
        </Chip>
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
