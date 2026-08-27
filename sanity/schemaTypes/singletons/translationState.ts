import {defineField, defineType} from 'sanity'

/**
 * Bookkeeping, not content: what the German said the last time each field was
 * translated.
 *
 * It is what lets a publish translate only the sentence that changed instead
 * of every sentence on the page. It lives in its own document so no page
 * schema has to carry a field nobody edits, and it never appears in the menu.
 */
export default defineType({
  name: 'translationState',
  title: 'Übersetzungsstand',
  type: 'document',
  // Never offered in the "create new" menu, and never opened by hand.
  __experimental_omnisearch_visibility: false,
  fields: [
    defineField({
      name: 'fingerprints',
      title: 'Fingerabdrücke',
      type: 'text',
      description: 'Wird automatisch gepflegt. Bitte nicht von Hand ändern.',
      readOnly: true,
    }),
  ],
  preview: {prepare: () => ({title: 'Übersetzungsstand'})},
})
