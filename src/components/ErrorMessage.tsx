import { Alert, Button } from '@heroui/react'
import { WarningIcon } from './icons'

interface ErrorMessageProps {
  message: string
  variant: 'error' | 'warning'
  onDismiss?: () => void
}

export function ErrorMessage({
  message,
  variant,
  onDismiss,
}: ErrorMessageProps) {
  const isError = variant === 'error'

  return (
    <Alert role="alert" status={isError ? 'danger' : 'warning'}>
      <Alert.Indicator>
        <WarningIcon className="size-5" />
      </Alert.Indicator>
      <Alert.Content>
        <Alert.Title>{isError ? '処理できませんでした' : 'ご注意'}</Alert.Title>
        <Alert.Description>{message}</Alert.Description>
      </Alert.Content>
      {onDismiss !== undefined && (
        <Button
          aria-label="メッセージを閉じる"
          size="sm"
          variant="ghost"
          onPress={onDismiss}
        >
          閉じる
        </Button>
      )}
    </Alert>
  )
}
