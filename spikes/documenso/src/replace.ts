import { Client, ApiError } from './client.js';
import { create, fixture, assertOwned } from './create.js';
import {
  config,
  loadState,
  save,
  main,
  cliLanguage,
  SafeError,
  type Language,
  type State,
} from './config.js';

export async function replace(
  client: Client,
  state: State,
  lang: Language,
  make = create,
  record = save,
): Promise<State> {
  if (state.deleted || state.language === lang)
    throw new SafeError('Choose the other language of a live waiting envelope');
  const envelope = await client.get(state.id);
  assertOwned(envelope, state);
  if (
    !['DRAFT', 'PENDING'].includes(envelope.status) ||
    envelope.recipients.some((r) => r.signingStatus !== 'NOT_SIGNED') ||
    envelope.fields.some((f) => f.inserted)
  )
    throw new SafeError(
      'Refusing replacement after signing has begun/completed',
    );
  await client.delete(state.id);
  await record('state.json', { ...state, deleted: true });
  await record('replacement.json', {
    oldId: state.id,
    phase: 'deleted',
    newLanguage: lang,
  });
  try {
    const old = await client.get(state.id);
    if (!old.deletedAt)
      throw new SafeError(
        'Old envelope remains accessible; replacement stopped',
      );
  } catch (error) {
    if (!(error instanceof ApiError && error.status === 404)) throw error;
  }
  try {
    const next = await make(client, lang, state.externalId);
    await record('replacement.json', {
      oldId: state.id,
      newId: next.id,
      phase: 'replaced',
    });
    return next;
  } catch {
    throw new SafeError(
      'Old envelope deleted; replacement failed. Inspect creation.json/replacement.json before recovery',
    );
  }
}
main(import.meta.url, async () => {
  const lang = cliLanguage();
  await fixture(lang); // Validate replacement before deleting anything.
  const cfg = await config();
  const next = await replace(
    new Client(cfg.origin, cfg.token),
    await loadState(),
    lang,
  );
  console.log(next.signingUrl);
});
