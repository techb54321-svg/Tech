# Hey Body Studio (demo)

A clickable demo for pitching to paediatricians and investors. A consult becomes a
personalised, clinician-approved explainer video for the child, in the style of the
*Hey Heart, Why Do You Beat?* book, plus a plain-English summary for parents.

**Everything is simulated in the browser.** There is no real recording, no AI model call,
and no patient data is stored or sent.

## The flow

1. **Consult** (`#consult`): replays a sample consult (a 5-year-old with an innocent heart
   murmur) as a live transcript. Hey Body picks out the diagnosis, the key messages, the
   family's questions, the plan and the safety-net advice. Or paste consult notes instead.
2. **Review** (`#review`): the storyboard. Every scene comes from a clinician-approved
   library. The clinician switches scenes on or off, edits the wording, edits the parent
   summary, and signs off.
3. **Family video** (`#family`): the personalised video (book art with slow camera moves,
   narration through the browser's text-to-speech, word-highlighted captions, heartbeat and
   "whoosh" sound effects), with the parent summary underneath.
4. **Scene library** (`#library`): the approved / in-production topics.

## Running it

Serve the folder and open `index.html`:

```bash
cd hey-heart-studio && python3 -m http.server 8000
```

The page is written for the claude.ai Artifact host, which adds the `<!doctype html>`
wrapper; browsers still render it fine opened directly.

## Files

- `index.html`: the whole app (HTML, CSS, JS).
- `scenes/`: pages taken from the *Hey Heart* book proof (© 2026 Dr Sarah Hanieh).
  Each scene is shown as a 16:9 crop that leaves out most of the book's printed text, so
  the narration can use the child's own name.

## Medical content

The scene scripts and parent summary in `index.html` (`SCENES`, `T`, `defaultSummary`)
are draft wording for the demo and need clinical review before any real use.
