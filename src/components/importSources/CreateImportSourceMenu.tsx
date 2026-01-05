import { component$, useComputed$, useSignal, useTask$ } from "@builder.io/qwik";
import { Form } from "@builder.io/qwik-city";
import { useCreateImportSourceAction } from "~/routes/admin/importSources/index@menu";

export default component$(() => {
  const createAction = useCreateImportSourceAction();
  
  const refSig = useSignal<HTMLFormElement>();
  const name = useSignal('');
  const periodStart = useSignal('');
  const fieldErrors = useComputed$(() => (createAction.value?.fieldErrors ?? {}) as Record<string, string | undefined>);
  const isFormValid = useComputed$(() => 
    name.value.trim().length > 0 && 
    periodStart.value !== ''
  );

  useTask$(({ track }) => {
    const success = track(() => createAction.value?.success);
    if (success) {
      if (refSig.value) {
        refSig.value.reset();
      }
      name.value = '';
      periodStart.value = '';
    }
  });

  return <>
    <Form action={createAction} ref={refSig}>
      <div class="field">
        <label class="label">Name</label>
        <p class="control">
          <input name="name" class={['input', 'is-small', { 'is-danger': fieldErrors.value['name'] }]} disabled={createAction.isRunning} type="text" placeholder="Name" value={name.value} onInput$={(e) => name.value = (e.target as HTMLInputElement).value} />
        </p>
        {fieldErrors.value['name'] && <p class="help is-danger">{fieldErrors.value['name']}</p>}
      </div>
      <div class="field">
        <label class="label">Beschreibung</label>
        <p class="control">
          <input name="description" class="input is-small" disabled={createAction.isRunning} type="text" placeholder="Beschreibung" />
        </p>
      </div>

      <div class="field">
        <label class="label">Periodenbeginn</label>
        <p class="control">
          <input name="periodStart" class={['input', 'is-small', { 'is-danger': fieldErrors.value['periodStart'] }]} disabled={createAction.isRunning} type="date" placeholder="Periodenbeginn" value={periodStart.value} onInput$={(e) => periodStart.value = (e.target as HTMLInputElement).value} />
        </p>
        {fieldErrors.value['periodStart'] && <p class="help is-danger">{fieldErrors.value['periodStart']}</p>}
      </div>

      <div class="buttons mt-5 is-right are-small">
        <button type="submit" class={["button", "is-primary", {
          'is-loading': createAction.isRunning
        }]} disabled={!isFormValid.value || createAction.isRunning}>Hinzufügen</button>
      </div>
    </Form>
  </>
});
