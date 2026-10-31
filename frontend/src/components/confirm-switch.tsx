import { useState } from 'react'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { Switch } from '@/components/ui/switch'

/**
 * Switch whose "on" applies at once and whose "off" asks first, saying what it
 * changes: for permissions and availability, where switching off has effects.
 */
export function ConfirmSwitch({
  checked,
  label,
  ariaLabel,
  disabled,
  onChange,
  confirmOff,
}: {
  checked: boolean
  label: string
  /** Must contain `label` (WCAG 2.5.3, label in name). */
  ariaLabel: string
  disabled?: boolean
  onChange: (checked: boolean) => void
  confirmOff: {
    title: string
    description: string
    confirmLabel: string
    cancelLabel: string
  }
}) {
  const [confirming, setConfirming] = useState(false)
  return (
    <>
      <label className="flex cursor-pointer items-center gap-2 text-sm font-medium">
        <Switch
          checked={checked}
          disabled={disabled}
          aria-label={ariaLabel}
          onCheckedChange={(next) =>
            next ? onChange(true) : setConfirming(true)
          }
        />
        {label}
      </label>
      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        danger
        {...confirmOff}
        onConfirm={() => onChange(false)}
      />
    </>
  )
}
