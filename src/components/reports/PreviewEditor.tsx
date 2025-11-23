import { component$, QRL, Resource, useResource$, useSignal, useStylesScoped$, useTask$ } from "@builder.io/qwik";
import styles from "./PreviewEditor.scss?inline";
import { Editor } from "@monaco-editor/react";
import { qwikify$ } from "@builder.io/qwik-react";



export const QEditor = qwikify$(Editor);

export interface PreviewEditorProps {
  height?: string;
  defaultValue?: string;
  onChange$?: QRL<(value: string) => void>;
}

export default component$<PreviewEditorProps>((props) => {
  useStylesScoped$(styles);

  const editorValue = useSignal<string>(props.defaultValue ?? '');
  const debouncedEditorValue = useSignal<string>(props.defaultValue ?? '');

  useTask$(({ track, cleanup }) => {
    track(() => editorValue.value);
    props.onChange$?.(editorValue.value);

    const debounced = setTimeout(() => {
      debouncedEditorValue.value = editorValue.value;
    }, 1000);

    cleanup(() => clearTimeout(debounced));
  });

  const previewBlobUrlResource = useResource$<string>(async ({ track }) => {
    track(() => debouncedEditorValue.value);

    try {
      const b = await fetch('/api/reportTemplates/preview', {
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

  const previewBlobUrl = useSignal<string>('');

  return (<>
    <div class="preview-container">
      <p class="label">Vorlage</p>
      <div class="columns">
        <div class="column">
          <QEditor theme="vs-dark" defaultValue={props.defaultValue ?? ''} saveViewState={true} height={props.height} defaultLanguage="handlebars" onChange$={(editor) => editorValue.value = editor ?? ''}></QEditor>
        </div>
        <div class="column">
          <Resource value={previewBlobUrlResource} onResolved={(value) => {
            previewBlobUrl.value = value;
            return <></>;
          }} />
          <iframe src={previewBlobUrl.value}></iframe>
        </div>
      </div>
    </div>
  </>);
})
