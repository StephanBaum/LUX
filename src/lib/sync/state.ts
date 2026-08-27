import {sanityWriteClient} from '../sanity/client'

/** Where the push channels and read positions are kept between deploys. */

export const STATE_ID = 'sync-state'

export type Channel = {
  calendarId: string
  channelId: string
  resourceId: string
  /** Milliseconds since the epoch, as Google reports it. */
  expiresAt: number
  syncToken?: string
}

export type Channels = Record<string, Channel>

export async function readChannels(): Promise<Channels> {
  const raw = await sanityWriteClient.fetch('*[_id == $id][0].channels', {id: STATE_ID})
  try {
    const parsed = JSON.parse(raw ?? '{}')
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

export async function writeChannels(channels: Channels, extra: Record<string, unknown> = {}) {
  await sanityWriteClient.createIfNotExists({_id: STATE_ID, _type: 'syncState'})
  await sanityWriteClient
    .patch(STATE_ID)
    .set({channels: JSON.stringify(channels, null, 2), ...extra})
    .commit()
}
