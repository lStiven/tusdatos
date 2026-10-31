import { zodResolver } from '@hookform/resolvers/zod'
import { CloudOff, Mail, Mic, Pencil, Plus, Trash2 } from 'lucide-react'
import { motion } from 'motion/react'
import { useCallback, useState } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'
import { errorMessage } from '@/api/errors'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { FormField, TextareaField } from '@/components/form-field'
import { FormNotice } from '@/components/form-notice'
import { PageHeader } from '@/components/page-header'
import { Pagination } from '@/components/pagination'
import { SearchInput } from '@/components/search-input'
import { StatePanel } from '@/components/state-panel'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { es } from '@/i18n/es'
import { formLevelError, showFieldErrors } from '@/lib/form-errors'
import { useListParams } from '@/lib/use-list-params'
import {
  useDeleteSpeaker,
  useSaveSpeaker,
  useSpeakers,
  type Speaker,
} from './api'

const PAGE_SIZE = 20
const t = es.speakers
const list = { hidden: {}, show: { transition: { staggerChildren: 0.05 } } }
const item = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0 } }

export function SpeakersPage() {
  const { params, setParams, offset, setOffset } = useListParams([])
  const name = params.get('q') ?? ''
  const { data, error, isPending, isError, refetch } = useSpeakers({
    name: name || undefined,
    limit: PAGE_SIZE,
    offset,
  })
  const remove = useDeleteSpeaker()
  // `null`: closed; `'new'`: creating; a speaker: editing them.
  const [editing, setEditing] = useState<Speaker | 'new' | null>(null)

  const setName = useCallback(
    (value: string) =>
      setParams(value.trim() ? { q: value.trim() } : {}, { replace: true }),
    [setParams],
  )

  return (
    <>
      <PageHeader
        title={t.title}
        description={t.subtitle}
        actions={
          <Button onClick={() => setEditing('new')}>
            <Plus aria-hidden />
            {t.create}
          </Button>
        }
      />
      <div className="mb-6">
        <SearchInput
          value={name}
          onChange={setName}
          label={t.search}
          placeholder={t.searchPlaceholder}
        />
      </div>

      {isPending ? (
        <div aria-busy className="space-y-3">
          <Skeleton className="h-20 rounded-xl" />
          <Skeleton className="h-20 rounded-xl" />
        </div>
      ) : isError ? (
        <StatePanel
          icon={CloudOff}
          title={t.loadError}
          description={errorMessage(error)}
          action={{ label: t.retry, onClick: () => void refetch() }}
          heading="h2"
        />
      ) : data.items.length === 0 ? (
        <StatePanel
          icon={Mic}
          title={t.emptyTitle}
          description={t.emptyDescription}
          heading="h2"
        />
      ) : (
        <>
          <motion.ul
            key={`${name}|${offset}`}
            className="grid gap-3 md:grid-cols-2"
            variants={list}
            initial="hidden"
            animate="show"
          >
            {data.items.map((speaker) => (
              <motion.li key={speaker.id} variants={item}>
                <Card className="h-full flex-row items-start gap-3 p-4 shadow-sm transition-shadow hover:shadow-md">
                  <div className="min-w-0 flex-1 space-y-1">
                    <h2 className="font-semibold">{speaker.full_name}</h2>
                    <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                      <Mail aria-hidden className="size-3.5" />
                      {speaker.email ?? t.noEmail}
                    </p>
                    {speaker.bio && (
                      <p className="line-clamp-2 text-sm text-muted-foreground">
                        {speaker.bio}
                      </p>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={t.edit(speaker.full_name)}
                    onClick={() => setEditing(speaker)}
                  >
                    <Pencil aria-hidden />
                  </Button>
                  <ConfirmDialog
                    trigger={
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-danger hover:text-danger"
                        aria-label={t.delete(speaker.full_name)}
                      >
                        <Trash2 aria-hidden />
                      </Button>
                    }
                    title={t.deleteDialog.title(speaker.full_name)}
                    description={t.deleteDialog.description}
                    confirmLabel={t.deleteDialog.confirm}
                    cancelLabel={t.deleteDialog.keep}
                    danger
                    onConfirm={() =>
                      remove.mutate(speaker.id, {
                        onSuccess: () => toast.success(t.deleted),
                      })
                    }
                  />
                </Card>
              </motion.li>
            ))}
          </motion.ul>
          <Pagination
            total={data.total}
            limit={PAGE_SIZE}
            offset={offset}
            onChange={setOffset}
          />
        </>
      )}

      <Dialog
        open={editing !== null}
        onOpenChange={(open) => !open && setEditing(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editing === 'new' ? t.form.createTitle : t.form.editTitle}
            </DialogTitle>
            <DialogDescription>{t.form.description}</DialogDescription>
          </DialogHeader>
          {editing !== null && (
            <SpeakerForm
              speaker={editing === 'new' ? undefined : editing}
              onDone={() => setEditing(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}

const schema = z.object({
  full_name: z.string().trim().min(1, t.form.validation.fullName).max(200),
  email: z.union([z.literal(''), z.email(t.form.validation.email)]),
  bio: z.string().max(5_000),
})

type Values = z.infer<typeof schema>

function SpeakerForm({
  speaker,
  onDone,
}: {
  speaker?: Speaker
  onDone: () => void
}) {
  const save = useSaveSpeaker(speaker?.id)
  const { register, handleSubmit, setError, formState } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      full_name: speaker?.full_name ?? '',
      email: speaker?.email ?? '',
      bio: speaker?.bio ?? '',
    },
  })

  const submit = handleSubmit((values) =>
    save.mutate(
      {
        full_name: values.full_name.trim(),
        // Empty clears the field (the API accepts `null`).
        email: values.email.trim() || null,
        bio: values.bio.trim() || null,
      },
      {
        onSuccess: () => {
          toast.success(speaker ? t.saved : t.created)
          onDone()
        },
        onError: (error) =>
          showFieldErrors(error, setError, Object.keys(schema.shape)),
      },
    ),
  )

  return (
    <form noValidate onSubmit={submit} className="grid gap-4">
      <FormNotice message={formLevelError(save.error)} />
      <FormField
        label={t.form.fullName}
        error={formState.errors.full_name?.message}
        {...register('full_name')}
      />
      <FormField
        label={t.form.email}
        type="email"
        error={formState.errors.email?.message}
        {...register('email')}
      />
      <TextareaField
        label={t.form.bio}
        error={formState.errors.bio?.message}
        {...register('bio')}
      />
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onDone}>
          {t.form.close}
        </Button>
        <Button type="submit" disabled={save.isPending}>
          {save.isPending ? t.form.saving : t.form.save}
        </Button>
      </DialogFooter>
    </form>
  )
}
