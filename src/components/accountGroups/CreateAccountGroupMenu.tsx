import { component$, useSignal, useTask$ } from "@builder.io/qwik";
import { Form } from "@builder.io/qwik-city";
import { _ } from 'compiled-i18n';
import { useCreateAccountGroupRouteAction } from "~/routes/accountGroups/index@menu";

export interface CreateAccountGroupMenuFormProps {}

export default component$<CreateAccountGroupMenuFormProps>(() => {
  const action = useCreateAccountGroupRouteAction();
  const refSig = useSignal<HTMLFormElement>();

  useTask$(({ track }) => {
    const success = track(() => action.value?.success);
    if (success) {
      if (refSig.value) {
        refSig.value.reset();
      }
    }
  });

  return (
    <>
      <Form action={action} ref={refSig}>
        <div class="field">
          <label class="label">{_`Name`}</label>
          <div class="control">
            <input name="name" class="input is-small" disabled={action.isRunning} type="text" />
          </div>

          {action.value?.fieldErrors?.name && <p class="help is-danger">{action.value?.fieldErrors?.name}</p>}
        </div>

        <div class="field">
          <label class="label">{_`Beschreibung`}</label>
          <div class="control">
            <textarea name="description" class="textarea is-small" disabled={action.isRunning} rows={10} />
          </div>

          {action.value?.fieldErrors?.description && <p class="help is-danger">{action.value?.fieldErrors?.description}</p>}
        </div>

        <div class="buttons mt-5 is-right are-small">
          <button type="submit" class={["button", "is-primary", {
            'is-loading': action.isRunning
          }]}>{_`Hinzufügen`}</button>
        </div>
      </Form>
    </>
  );
});
