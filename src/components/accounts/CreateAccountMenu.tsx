import { component$, useSignal, useStylesScoped$, useTask$ } from "@builder.io/qwik";
import { Form } from "@builder.io/qwik-city";
import { _ } from 'compiled-i18n';
import { useCreateAccountAction } from "~/routes/accounts/index@menu";
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
        <label class="label">{_`Gruppe`}</label>
        <div class="control">
          <div class="select is-small is-fullwidth">
            <select value="" name="parentAccountId">
              <option value="">{_`- keine -`}</option>

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
            <label class="label">{_`Code`}</label>
            <p class="control">
              <input name="code" class="input is-small code-input" disabled={createAction.isRunning} type="text" placeholder={_`Code`} />
            </p>
          </div>
          <div class="field">
            <label class="label">{_`Name`}</label>
            <p class="control">
              <input name="name" class="input is-small" disabled={createAction.isRunning} type="text" placeholder={_`Name`} />
            </p>
          </div>
        </div>
      </div>

      <div class="field">
        <label class="label">{_`Beschreibung`}</label>
        <div class="control">
          <textarea class="textarea is-small"></textarea>
        </div>
      </div>

      <div class="buttons mt-5 is-right are-small">
        <button type="submit" class={["button", "is-primary", {
          'is-loading': createAction.isRunning
        }]}>{_`Hinzufügen`}</button>
      </div>
    </Form>
  );
});
