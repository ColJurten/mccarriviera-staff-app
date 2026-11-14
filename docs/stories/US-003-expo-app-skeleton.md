# US-003 · Create the Expo app skeleton, for the web first

| Epic | Priority | Phase | Size | Status |
|---|---|---|---|---|
| E0 · Foundations | Must | P0 | M | To do |

- **Depends on:** [US-002](US-002-repository-and-agent-guidance.md)
- **Decisions:** [ADR-0002](../adr/0002-mobile-stack-expo.md) · [ADR-0021](../adr/0021-web-app.md) · [ADR-0011](../adr/0011-localisation.md) · [ADR-0012](../adr/0012-authentication-and-authorisation.md)
- **Open points:** N-01, R-18 (see [open questions](../discovery/open-questions.md))

## Story

As the developer, I want one Expo app with navigation, theme and translations in place, running in a browser at phone and laptop widths, so that features can be added screen by screen, for the web first and the iPhone later.

## Acceptance criteria

- [ ] An Expo app (latest stable SDK at project start) in `app/`, with TypeScript, Expo Router and continuous native generation (no committed `ios/` folder). The web target is built first ([ADR-0025](../adr/0025-web-app-first.md)): its export produces the static files that the server serves.
- [ ] These screens exist as stubs: Sign-in, Accueil, Véhicules and the vehicle detail, Clients and the client detail, Contrats and the contract detail, the Départ flow, the Retour flow, Settings.
- [ ] The app shell follows the [design reference](../design/README.md): four destinations (Accueil, Véhicules, Clients, Contrats), a tab bar at the bottom on narrow screens and a sidebar on the left on wide ones, with one breakpoint set in the theme.
- [ ] Theme tokens (colours, fonts, shapes) come from the design reference and are used by every component: no screen writes a colour or a font by hand. They are the placeholder theme until the brand assets arrive (default for R-18). The fonts are bundled with the app. Text scales with the text-size setting of the device or the browser.
- [ ] Translations are set up with French as the app language (default for N-01). A test fails if a key is missing from a catalogue.
- [ ] TanStack Query (in memory, no persister) and a typed API client, using the zod schemas shared with the API, are wired. On the web, the API is reached at `/api/` on the app's own address, so the session cookie applies, and nothing is kept in browser storage ([US-016](US-016-client-data-in-the-browser.md)).
- [ ] Screens use React Native components and Expo Router only, so that the same code builds the iPhone app later. Code that differs per platform (session storage, camera, file picking, sharing, PDF viewer, signature pad, app lock) sits behind small platform modules, with their web implementation ([ADR-0021](../adr/0021-web-app.md), [ADR-0025](../adr/0025-web-app-first.md)).
- [ ] CI builds the web app, bundles the iOS target to prove that the shared code still builds for the iPhone, and runs a first browser test that opens the app at a phone width and at a laptop width.
- [ ] A global error screen in French never shows raw stack traces or personal data.
- [ ] `docs/screens.md` lists the screens and the navigation between them, as a Mermaid diagram that matches the stubs.

## Notes

- The skeleton is checked in a desktop browser and in a phone's browser. Its first check on an iPhone comes with [US-005](US-005-eas-builds-and-internal-distribution.md), in the iPhone phase.
- No EAS project, native build or Apple account is needed for this story.
