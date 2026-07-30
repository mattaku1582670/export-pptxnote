export type CopyResult = 'clipboard-api' | 'exec-command' | 'failed'

function copyWithExecCommand(text: string): CopyResult {
  if (
    typeof document === 'undefined' ||
    typeof document.execCommand !== 'function'
  ) {
    return 'failed'
  }

  const textarea = document.createElement('textarea')
  textarea.value = text
  textarea.setAttribute('readonly', '')
  textarea.style.position = 'fixed'
  textarea.style.left = '-9999px'
  textarea.style.top = '0'

  try {
    document.body.append(textarea)
    textarea.select()
    textarea.setSelectionRange(0, textarea.value.length)

    // file:// など Clipboard API が使えない環境を支えるため、非推奨 API をフォールバックとして使用する。
    return document.execCommand('copy') ? 'exec-command' : 'failed'
  } catch {
    return 'failed'
  } finally {
    textarea.remove()
  }
}

export async function copyText(text: string): Promise<CopyResult> {
  if (
    typeof navigator !== 'undefined' &&
    typeof navigator.clipboard?.writeText === 'function'
  ) {
    try {
      await navigator.clipboard.writeText(text)
      return 'clipboard-api'
    } catch {
      // Clipboard API が拒否された場合は、同期コピーへフォールバックする。
    }
  }

  return copyWithExecCommand(text)
}
