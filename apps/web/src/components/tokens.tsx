import { HugeiconsIcon } from '@hugeicons/react'
import { Copy01Icon, Key01Icon, PlusSignIcon, Tick02Icon } from '@hugeicons/core-free-icons'
import { useState, type FormEvent } from 'react'
import { toast } from 'sonner'
import type { Token } from '@artifacts/api'
import { ConfirmDialog } from '#/components/confirm-dialog'
import { IconSwap } from '#/components/icon-swap'
import { Tip } from '#/components/tip'
import { FormError } from '#/components/form-error'
import { Button } from '#/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '#/components/ui/dialog'
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '#/components/ui/empty'
import { Field, FieldDescription, FieldGroup, FieldLabel } from '#/components/ui/field'
import { Input } from '#/components/ui/input'
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from '#/components/ui/input-group'
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemMedia,
  ItemTitle,
} from '#/components/ui/item'
import { Spinner } from '#/components/ui/spinner'
import { api } from '#/lib/api'
import { formatDate } from '#/lib/format'
import { useMutation } from '#/lib/use-mutation'

type Created = Token & { token: string }

export function CreateTokenButton() {
  const [open, setOpen] = useState(false)
  const [created, setCreated] = useState<Created | null>(null)
  const { mutate, error, busy } = useMutation()

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const name = String(new FormData(event.currentTarget).get('name'))
    let result: Created | null = null
    const ok = await mutate(async () => {
      result = await api<Created>('/api/tokens', { method: 'POST', body: JSON.stringify({ name }) })
    })
    if (ok && result) {
      setCreated(result)
      toast.success(`Token "${name}" created.`)
    }
  }

  function onOpenChange(next: boolean) {
    setOpen(next)
    if (!next) setCreated(null)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button>
          <HugeiconsIcon icon={PlusSignIcon} strokeWidth={2} data-icon="inline-start" />
          New token
        </Button>
      </DialogTrigger>
      <DialogContent>
        {created ? (
          <>
            <DialogHeader>
              <DialogTitle>Token "{created.name}"</DialogTitle>
              <DialogDescription>
                Copy it now. It is shown once and cannot be recovered.
              </DialogDescription>
            </DialogHeader>
            <SecretField secret={created.token} />
            <DialogFooter>
              <Button type="button" onClick={() => onOpenChange(false)}>
                Done
              </Button>
            </DialogFooter>
          </>
        ) : (
          <form onSubmit={submit} className="flex flex-col gap-4">
            <DialogHeader>
              <DialogTitle>New token</DialogTitle>
              <DialogDescription>Tokens can upload to every project.</DialogDescription>
            </DialogHeader>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="token-name">Name</FieldLabel>
                <Input
                  id="token-name"
                  name="name"
                  placeholder="github-ci"
                  autoCapitalize="none"
                  autoCorrect="off"
                  required
                  autoFocus
                />
                <FieldDescription>Name it after the place it lives.</FieldDescription>
              </Field>
            </FieldGroup>
            <FormError error={error} />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={busy}>
                {busy ? <Spinner data-icon="inline-start" /> : null}
                Create
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}

function SecretField({ secret }: { secret: string }) {
  const [copied, setCopied] = useState(false)

  async function copy() {
    try {
      await navigator.clipboard.writeText(secret)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error('Could not copy. Select the text and copy it by hand.')
    }
  }

  return (
    <InputGroup>
      <InputGroupInput
        readOnly
        value={secret}
        className="font-mono"
        onFocus={(e) => e.currentTarget.select()}
      />
      <InputGroupAddon align="inline-end">
        <Tip label="Copy token">
          <InputGroupButton size="icon-xs" onClick={copy} aria-label="Copy token">
            <IconSwap state={copied ? 'b' : 'a'} a={Copy01Icon} b={Tick02Icon} />
          </InputGroupButton>
        </Tip>
      </InputGroupAddon>
    </InputGroup>
  )
}

export function TokenList({ tokens }: { tokens: Token[] }) {
  if (tokens.length === 0) {
    return (
      <Empty className="border">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <HugeiconsIcon icon={Key01Icon} strokeWidth={2} />
          </EmptyMedia>
          <EmptyTitle>No tokens yet</EmptyTitle>
          <EmptyDescription>CI runners and scripts upload with a token.</EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <CreateTokenButton />
        </EmptyContent>
      </Empty>
    )
  }
  return (
    <ItemGroup className="gap-0 divide-y overflow-hidden rounded-lg border">
      {tokens.map((token) => (
        <TokenRow key={token.id} token={token} />
      ))}
    </ItemGroup>
  )
}

function TokenRow({ token }: { token: Token }) {
  const [open, setOpen] = useState(false)

  return (
    <Item className="rounded-none">
      <ItemMedia variant="icon">
        <HugeiconsIcon icon={Key01Icon} strokeWidth={2} />
      </ItemMedia>
      <ItemContent>
        <ItemTitle>{token.name}</ItemTitle>
        <ItemDescription>
          Created {formatDate(token.createdAt)}. Last used{' '}
          {token.lastUsedAt ? formatDate(token.lastUsedAt) : 'never'}.
        </ItemDescription>
      </ItemContent>
      <ItemActions>
        <ConfirmDialog
          open={open}
          onOpenChange={setOpen}
          trigger={
            <Button variant="outline" size="sm">
              Revoke
            </Button>
          }
          title={`Revoke "${token.name}"?`}
          description="Uploads with this token fail from now on. Other tokens are not affected."
          action="Revoke"
          run={() => api(`/api/tokens/${token.id}`, { method: 'DELETE' })}
          onDone={() => toast.success(`Token "${token.name}" revoked.`)}
        />
      </ItemActions>
    </Item>
  )
}
