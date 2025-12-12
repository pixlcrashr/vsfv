import { component$, useSignal } from "@builder.io/qwik";
import type { Account, Budget, ReportTemplate } from "~/routes/reports";



export interface RenderReportMenuProps {
  reportTemplates: ReportTemplate[];
  accounts: Account[];
  budgets: Budget[];
}

export default component$<RenderReportMenuProps>((props) => {
  const selectedBudgetIds = useSignal<string[]>(props.budgets.length > 0 ? [props.budgets[0].id] : []);
  const selectedAccountIds = useSignal<string[]>(props.accounts.map(x => x.id));

  return <>
    <form method="POST" action="/api/reports/render" target="_blank">
      <div class="field">
        <label class="label">Export-Typ</label>
        <div class="control">
          <div class="select is-small">
            <select name="exportType">
              <option value="pdf" selected>PDF</option>
              <option value="html">HTML</option>
            </select>
          </div>
        </div>
      </div>

      <div class="field">
        <label class="label">Berichtsvorlage</label>
        <div class="control">
          <div class="select is-small">
            <select name="reportTemplateId" required>
              <option selected disabled>- bitte auswahlen -</option>
              {props.reportTemplates.map((reportTemplate) => <option key={reportTemplate.id} value={reportTemplate.id}>{reportTemplate.name}</option>)}
            </select>
          </div>
        </div>
      </div>

      <div class="field">
        <label class="label">Ausgewählte Budgets</label>
        <div class="control select is-small is-multiple is-fullwidth">
          <select name="selectedBudgetIds[]" multiple size={6}>
            {props.budgets.map(b => <option selected={selectedBudgetIds.value.includes(b.id)} key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </div>
        <p class="help">STRG gedrückt halten um mehrere Budgets auszuwählen.</p>
      </div>

      <div class="field">
        <label class="label">Ausgewählte Konten</label>
        <div class="control select is-small is-multiple is-fullwidth">
          <select name="selectedAccountIds[]" multiple size={6}>
            {props.accounts.map(a => <option selected={selectedAccountIds.value.includes(a.id)} key={a.id} value={a.id}>
              {`${"\u00A0".repeat(a.depth * 6)}└─ ${a.code} | ${a.name}`}
            </option>)}
          </select>
        </div>
        <p class="help">STRG gedrückt halten um mehrere Konten auszuwählen.</p>
      </div>

      <div class="checkboxes is-flex-direction-column">
        <label class="checkbox">
          <input name="targetValuesEnabled" type="checkbox" />
          Soll-Werte anzeigen
        </label>

        <label class="checkbox">
          <input name="actualValuesEnabled" type="checkbox" />
          Ist-Werte anzeigen
        </label>

        <label class="checkbox">
          <input name="differenceValuesEnabled" type="checkbox" />
          Differenz-Werte anzeigen
        </label>

        <label class="checkbox">
          <input name="accountDescriptionsEnabled" type="checkbox" />
          Kontenbeschreibungen anzeigen
        </label>

        <label class="checkbox">
          <input name="budgetDescriptionsEnabled" type="checkbox" />
          Budgetbeschreibungen anzeigen
        </label>
      </div>

      <div class="buttons mt-4">
        <button class="button is-link" type="submit">Anzeigen</button>
      </div>
    </form>
  </>;
});
