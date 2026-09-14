import { HugeiconsIcon } from '@hugeicons/react'
import { Copy01Icon, McpServerIcon, TerminalIcon } from '@hugeicons/core-free-icons'
import { toast } from 'sonner'
import { Tip } from '#/components/tip'
import { Button } from '#/components/ui/button'
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemMedia,
  ItemTitle,
} from '#/components/ui/item'

export function CopyButton({ text, label }: { text: string; label: string }) {
  async function copy() {
    try {
      await navigator.clipboard.writeText(text)
      toast.success(`${label} copied.`)
    } catch {
      toast.error('Could not copy. Select the text and copy it by hand.')
    }
  }
  return (
    <Tip label={`Copy ${label.toLowerCase()}`}>
      <Button variant="ghost" size="icon" onClick={copy} aria-label={`Copy ${label}`}>
        <HugeiconsIcon icon={Copy01Icon} strokeWidth={2} />
      </Button>
    </Tip>
  )
}

// Copy-paste setup for MCP clients. Sign-in happens in the client with GitHub.
export function McpSetup({ origin }: { origin: string }) {
  const url = `${origin}/mcp`
  const rows = [
    {
      icon: McpServerIcon,
      title: 'Server URL',
      label: 'URL',
      text: url,
      hint: 'Any client with OAuth support. Sign in with GitHub once, then the tools act as you.',
    },
    {
      icon: TerminalIcon,
      title: 'Claude Code',
      label: 'Command',
      text: `claude mcp add --transport http --scope user artifacts ${url}`,
      hint: 'Run once, then /mcp in a new session to sign in.',
    },
    {
      icon: TerminalIcon,
      title: 'Cursor',
      label: 'Snippet',
      text: `{ "mcpServers": { "artifacts": { "url": "${url}" } } }`,
      hint: 'Add to ~/.cursor/mcp.json, then sign in from the MCP settings page.',
    },
  ]
  return (
    <ItemGroup className="gap-0 divide-y overflow-hidden rounded-lg border">
      {rows.map((row) => (
        <Item key={row.title} className="rounded-none">
          <ItemMedia variant="icon">
            <HugeiconsIcon icon={row.icon} strokeWidth={2} />
          </ItemMedia>
          <ItemContent className="min-w-0">
            <ItemTitle>{row.title}</ItemTitle>
            <ItemDescription className="block truncate font-mono">{row.text}</ItemDescription>
            <ItemDescription>{row.hint}</ItemDescription>
          </ItemContent>
          <ItemActions>
            <CopyButton text={row.text} label={row.label} />
          </ItemActions>
        </Item>
      ))}
    </ItemGroup>
  )
}
