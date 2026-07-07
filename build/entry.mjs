// Bundle entry. apex-grid declares "sideEffects: false", so a bare `import 'apex-grid/define'`
// gets tree-shaken away. Call the library's one-call setup() explicitly: it registers <apex-grid>
// (and sub-components) and adopts a default host stylesheet (height:100%; min-height:240px) so the
// row virtualizer has a bounded height. Bundled with tree-shaking disabled so no internal
// sub-component registrations are dropped.
import { setup } from 'apex-grid';
export * from 'apex-grid';

if (typeof customElements !== 'undefined' && !customElements.get('apex-grid')) {
  setup();
}
