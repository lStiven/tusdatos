import { useRef } from 'react'

/**
 * Dialogs opened from state (no `DialogTrigger`: from a menu, a switch, a row
 * button) do not know where focus came from, so on close it fell to <body>.
 * Spread on `DialogContent`/`AlertDialogContent`: it gives focus back.
 */
export function useReturnFocus() {
  const origin = useRef<Element | null>(null)
  return {
    onOpenAutoFocus: () => {
      origin.current = document.activeElement
    },
    onCloseAutoFocus: (event: Event) => {
      if (origin.current instanceof HTMLElement && origin.current.isConnected) {
        event.preventDefault()
        origin.current.focus()
      }
    },
  }
}
