import photo from './objects/photo'
import expertiseItem from './objects/expertiseItem'
import infoRow from './objects/infoRow'
import cta from './objects/cta'
import pageHeader from './objects/pageHeader'
import menschenSection from './objects/menschenSection'

import siteSettings from './singletons/siteSettings'
import homePage from './singletons/homePage'
import studioPage from './singletons/studioPage'
import mietenPage from './singletons/mietenPage'
import workshopsPage from './singletons/workshopsPage'
import veranstaltungenPage from './singletons/veranstaltungenPage'
import beratungPage from './singletons/beratungPage'
import legalPage from './singletons/legalPage'

import person from './documents/person'
import room from './documents/room'
import equipmentItem from './documents/equipmentItem'
import workshop from './documents/workshop'
import event from './documents/event'
import service from './documents/service'

export const objectTypes = [photo, expertiseItem, infoRow, cta, pageHeader, menschenSection]

export const singletonTypes = [
  siteSettings,
  homePage,
  studioPage,
  mietenPage,
  workshopsPage,
  veranstaltungenPage,
  beratungPage,
  legalPage,
]

/** Types the client must never create or delete from the "+" menu. */
export const singletonTypeNames: Set<string> = new Set(singletonTypes.map((t) => t.name))

export const documentTypes = [person, room, equipmentItem, workshop, event, service]

export const schemaTypes = [...objectTypes, ...singletonTypes, ...documentTypes]
