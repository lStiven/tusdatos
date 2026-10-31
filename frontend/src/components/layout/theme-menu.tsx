import { Monitor, Moon, Sun } from 'lucide-react'
import { useTheme } from 'next-themes'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { es } from '@/i18n/es'

const options = [
  { value: 'light', label: es.theme.light, icon: Sun },
  { value: 'dark', label: es.theme.dark, icon: Moon },
  { value: 'system', label: es.theme.system, icon: Monitor },
] as const

export function ThemeMenu() {
  const { theme = 'system', setTheme } = useTheme()
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={es.theme.label}>
          <Sun
            aria-hidden
            className="scale-100 rotate-0 transition-transform duration-300 dark:scale-0 dark:-rotate-90"
          />
          <Moon
            aria-hidden
            className="absolute scale-0 rotate-90 transition-transform duration-300 dark:scale-100 dark:rotate-0"
          />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>{es.theme.label}</DropdownMenuLabel>
        <DropdownMenuRadioGroup value={theme} onValueChange={setTheme}>
          {options.map(({ value, label, icon: Icon }) => (
            <DropdownMenuRadioItem key={value} value={value}>
              <Icon aria-hidden />
              {label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
