import { component$, useSignal, useTask$ } from "@builder.io/qwik";
import { Form } from "@builder.io/qwik-city";
import { useCreateImportSourceAction } from "~/routes/admin/importSources/index@menu";

export default component$(() => {
  const createAction = useCreateImportSourceAction();
  
  const refSig = useSignal<HTMLFormElement>();

  useTask$(({ track }) => {
    const success = track(() => createAction.value?.success);
    if (success) {
      if (refSig.value) {
        refSig.value.reset();
      }
    }
  });

  return <>
    <Form action={createAction} ref={refSig}>
      <div class="field">
        <label class="label">Name</label>
        <p class="control">
          <input name="name" min={1} class="input is-small" disabled={createAction.isRunning} type="text" placeholder="Name" />
        </p>
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
          <input name="periodStart" class="input is-small" disabled={createAction.isRunning} type="date" placeholder="Periodenbeginn" />
        </p>
      </div>

      <div class="buttons mt-5 is-right are-small">
        <button type="submit" class={["button", "is-primary", {
          'is-loading': createAction.isRunning
        }]}>Hinzufügen</button>
      </div>
    </Form>
  </>
});
