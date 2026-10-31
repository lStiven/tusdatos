import { CircleAlert, Info } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { Alert, AlertDescription } from '@/components/ui/alert'

/** Form-level message, announced on appearance (`role="alert"` / `status`). */
export function FormNotice({
  message,
  tone = 'error',
}: {
  message: string | null
  tone?: 'error' | 'info'
}) {
  const Icon = tone === 'error' ? CircleAlert : Info
  return (
    <AnimatePresence initial={false}>
      {message && (
        <motion.div
          key={message}
          initial={{ opacity: 0, y: -6 }}
          animate={{
            opacity: 1,
            y: 0,
            x: tone === 'error' ? [0, -6, 6, -3, 0] : 0,
          }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
        >
          <Alert
            variant={tone === 'error' ? 'destructive' : 'default'}
            role={tone === 'error' ? 'alert' : 'status'}
          >
            <Icon aria-hidden />
            <AlertDescription>{message}</AlertDescription>
          </Alert>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
