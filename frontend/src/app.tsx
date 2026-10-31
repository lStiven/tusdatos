import { useState, type ReactNode } from 'react'
import { QueryClientProvider } from '@tanstack/react-query'
import { MotionConfig } from 'motion/react'
import { Toaster } from '@/components/ui/sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
import { createQueryClient } from '@/lib/query-client'
import { useTheme } from '@/lib/theme'

/** Everything a page needs around it; tests mount the same tree with a memory router. */
export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(createQueryClient)
  const { resolvedTheme } = useTheme()
  return (
    <QueryClientProvider client={queryClient}>
      <MotionConfig reducedMotion="user">
        <TooltipProvider>
          {children}
          <Toaster
            theme={resolvedTheme}
            richColors
            closeButton
            position="top-right"
          />
        </TooltipProvider>
      </MotionConfig>
    </QueryClientProvider>
  )
}
