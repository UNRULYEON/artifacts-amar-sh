import { CopyButton } from '#/components/mcp-setup'
import { Item, ItemActions, ItemContent } from '#/components/ui/item'

const capture = `export AGENT_BROWSER_SESSION=compare
agent-browser open <url>
agent-browser set viewport 1280 800 2
agent-browser wait --text "<text on the page>"
agent-browser screenshot before.png
agent-browser snapshot > before.txt
# apply the change: deploy, toggle a flag, or edit the page
agent-browser open <url>
agent-browser wait --text "<text on the page>"
agent-browser screenshot after.png
agent-browser diff screenshot --baseline before.png --output diff.png
agent-browser diff snapshot --baseline before.txt > diff.txt
agent-browser close`

const zip = `zip -0 <change>.zip <page>/before.png <page>/after.png <page>/diff.png <page>/diff.txt`

const steps = [
  {
    title: 'Capture with agent-browser',
    text: capture,
    label: 'Steps',
    hint: 'One named session keeps cookies, viewport, and theme equal. The two diffs are optional.',
  },
  {
    title: 'Upload',
    text: zip,
    label: 'Command',
    hint: 'Over MCP, call upload_comparison with the files as beforeBase64, afterBase64, diffBase64, and snapshotDiff. For big files, zip them like this and upload the zip with a token or get_upload_url.',
  },
]

// The same recipe the MCP discover tool gives to agents, for people.
export function CompareRecipe() {
  return (
    <div className="flex flex-col gap-3">
      {steps.map((step, index) => (
        <div key={step.title} className="flex flex-col gap-1.5">
          <h3 className="text-xs font-medium">
            <span className="text-muted-foreground tabular-nums">{index + 1}. </span>
            {step.title}
          </h3>
          <Item variant="muted" size="sm" className="flex-nowrap items-start">
            <ItemContent className="min-w-0">
              <pre className="overflow-x-auto text-left font-mono text-xs/relaxed">{step.text}</pre>
            </ItemContent>
            <ItemActions>
              <CopyButton text={step.text} label={step.label} />
            </ItemActions>
          </Item>
          <p className="text-xs text-muted-foreground">{step.hint}</p>
        </div>
      ))}
      <p className="text-xs text-muted-foreground">
        The viewer shows each pair side by side or as a swipe. A pixel diff adds an After/Diff
        switch, and a tree diff shows under the images. See{' '}
        <a
          href="https://agent-browser.dev/diffing"
          className="underline underline-offset-4"
          target="_blank"
          rel="noreferrer"
        >
          agent-browser.dev/diffing
        </a>
        .
      </p>
    </div>
  )
}
