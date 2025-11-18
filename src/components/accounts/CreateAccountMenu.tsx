import { component$, useSignal, useStylesScoped$, useTask$ } from "@builder.io/qwik";
import { Form } from "@builder.io/qwik-city";
import { useCreateAccountAction } from "~/routes/accounts";
import styles from "./CreateAccountMenu.scss?inline";



export interface Account {
  id: string;
  depth: number;
  code: string;
  name: string;
}

export interface CreateAccountFormProps {
  accounts: Account[];
}

export default component$<CreateAccountFormProps>((compProps) => {
  useStylesScoped$(styles);

  const createAction = useCreateAccountAction();

  const refSig = useSignal<HTMLFormElement>();

  useTask$(({ track }) => {
    const success = track(() => createAction.value?.success);
    if (success) {
      if (refSig.value) {
        refSig.value.reset();
      }
    }
  });

  return (
    <Form action={createAction} ref={refSig}>
      <div class="field">
        <label class="label">Gruppe</label>
        <div class="control">
          <div class="select is-small is-fullwidth">
            <select value="" name="parentAccountId">
              <option value="">- keine -</option>

              {compProps.accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {`${"\u00A0".repeat(account.depth * 6)}└─ ${account.code} | ${account.name}`}
                </option>
              ))}
            </select>
          </div>
        </div>

        {createAction.value?.fieldErrors?.parentAccountId && <p class="help is-danger">{createAction.value?.fieldErrors?.parentAccountId}</p>}
      </div>

      <div class="field is-grouped">
        <div class="field-body">
          <div class="field">
            <label class="label">Code</label>
            <p class="control">
              <input name="code" class="input is-small code-input" disabled={createAction.isRunning} type="text" placeholder="Code" />
            </p>
          </div>
          <div class="field">
            <label class="label">Name</label>
            <p class="control">
              <input name="name" class="input is-small" disabled={createAction.isRunning} type="text" placeholder="Name" />
            </p>
          </div>
        </div>
      </div>

      <div class="field">
        <label class="label">Beschreibung</label>
        <div class="control">
          <textarea class="textarea is-small"></textarea>
        </div>
      </div>

      <div class="buttons mt-5 is-right are-small">
        <button type="submit" class={["button", "is-primary", {
          'is-loading': createAction.isRunning
        }]}>Hinzufügen</button>
      </div>
    </Form>
  );
});
