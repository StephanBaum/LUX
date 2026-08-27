import {defineField, defineType} from 'sanity'

/**
 * Bookkeeping for the calendar link: which channels Google is calling us on,
 * and how far we have read each calendar.
 *
 * Google's push notification says only "something changed", never what — the
 * answer comes from asking with the token from the previous answer, which is
 * why the token has to be kept somewhere that survives a deploy.
 */
export default defineType({
  name: 'syncState',
  title: 'Kalender-Verbindung',
  type: 'document',
  __experimental_omnisearch_visibility: false,
  fields: [
    defineField({
      name: 'channels',
      title: 'Kanäle',
      type: 'text',
      description: 'Wird automatisch gepflegt. Bitte nicht von Hand ändern.',
      readOnly: true,
    }),
    defineField({
      name: 'registeredAt',
      title: 'Zuletzt angemeldet',
      type: 'datetime',
      readOnly: true,
    }),
    defineField({name: 'lastError', title: 'Letzter Fehler', type: 'text', readOnly: true}),
  ],
  preview: {prepare: () => ({title: 'Kalender-Verbindung'})},
})
