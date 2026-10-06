import { MemoryRouter, useScreenFocus } from './route'
import { App, type Me } from './App'

/**
 * Demonstration only: Margaret's phone and Anna's family view side by side,
 * each a full copy of the app with its own screen. A tap on one shows up on
 * the other straight away.
 */
export function Showcase({ me }: { me: Me }) {
  useScreenFocus('showcase')
  const parent = me.parent?.parentName ?? 'Parent'
  const family = me.family?.name ?? 'Family'
  return (
    <div className="showcase">
      <header className="showcase-head">
        <div>
          <h1 tabIndex={-1}>Alongside, side by side</h1>
          <p>
            Left: what {parent} sees on the phone, all on one screen. Right: what {family} sees in the family area. Ask for a lift
            with Taxi and watch {family}’s side update. Everything here is
            fictional.
          </p>
        </div>
        <a className="btn secondary" href="#/">
          Back to the single view
        </a>
      </header>
      <div className="showcase-grid">
        <figure className="device">
          <figcaption>{parent}’s phone</figcaption>
          <div className="device-frame">
            <MemoryRouter initial="/" className="pane" label={`${parent}’s phone`}>
              <App />
            </MemoryRouter>
          </div>
        </figure>
        <figure className="device wide">
          <figcaption>{family}’s family area</figcaption>
          <div className="device-frame laptop">
            <MemoryRouter initial="/family" className="pane" label={`${family}’s family area`}>
              <App />
            </MemoryRouter>
          </div>
        </figure>
      </div>
    </div>
  )
}
