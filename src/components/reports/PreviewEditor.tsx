import { component$, isServer, QRL, Resource, useResource$, useSignal, useStylesScoped$, useTask$ } from "@builder.io/qwik";
import styles from "./PreviewEditor.scss?inline";
import { Editor } from "@monaco-editor/react";
import { qwikify$ } from "@builder.io/qwik-react";
import { _ } from 'compiled-i18n';



export const QEditor = qwikify$(Editor);

export interface PreviewEditorProps {
  height?: string;
  defaultValue?: string;
  reportTemplateId?: string;
  onChange$?: QRL<(value: string) => void>;
}

export default component$<PreviewEditorProps>((props) => {
  useStylesScoped$(styles);

  const editorValue = useSignal<string>(props.defaultValue ?? '');
  const debouncedEditorValue = useSignal<string>(props.defaultValue ?? '');
  const selectedPreviewType = useSignal<string>('html');

  useTask$(({ track, cleanup }) => {
    track(() => editorValue.value);
    props.onChange$?.(editorValue.value);

    const debounced = setTimeout(() => {
      debouncedEditorValue.value = editorValue.value;
    }, 300);

    cleanup(() => clearTimeout(debounced));
  });

  const previewBlobUrlResource = useResource$<string>(async ({ track }) => {
    if (isServer) {
      return '';
    }

    track(() => debouncedEditorValue.value);
    track(() => selectedPreviewType.value);

    try {
      const b = await fetch(`/reportTemplates/${props.reportTemplateId}/preview/${selectedPreviewType.value}`, {
        method: 'POST',
        body: debouncedEditorValue.value,
        credentials: "same-origin"
      });

      return URL.createObjectURL(await b.blob());
    } catch (e) {
      console.error(e);
    }

    return '';
  });

  return (<>
    <div class="preview-container">
      <p class="label">Vorlage</p>
      <div class="columns">
        <div class="column">
          <QEditor theme="vs-dark" defaultValue={props.defaultValue ?? ''} saveViewState={true} height={props.height} defaultLanguage="handlebars" onChange$={(editor) => editorValue.value = editor ?? ''}></QEditor>
        </div>
        <div class="column">
          <div class="preview-container-content">
            <div class="tabs is-boxed mb-2">
              <ul>
                <li class={selectedPreviewType.value === 'html' ? 'is-active' : ''}>
                  <a onClick$={() => selectedPreviewType.value = 'html'}>
                    <span>{_`HTML`}</span>
                  </a>
                </li>
                <li class={selectedPreviewType.value === 'pdf' ? 'is-active' : ''}>
                  <a onClick$={() => selectedPreviewType.value = 'pdf'}>
                    <span>{_`PDF`}</span>
                  </a>
                </li>
              </ul>
            </div>
            <div class="preview-frame-container" style="position: relative;">
              <Resource value={previewBlobUrlResource} onResolved={(value) => {
                return <iframe src={value}/>;
              }} onPending={() => <p>{_`lädt...`}</p>} />
            </div>
          </div>
        </div>
      </div>
    </div>
  </>);
})
