import { eventKind, NostrEventExt, NostrFetcher } from "nostr-fetch";
import { activeDays, includesJapanese, isProxy } from "./helpers.ts";

export async function fetchJapaneseMetadataEvents(
  fetcher: NostrFetcher,
  relayUrls: string[],
  since: number,
): Promise<NostrEventExt<false>[]> {
  const metadataEvents = await fetcher.fetchAllEvents(relayUrls, {
    kinds: [eventKind.metadata],
  }, { since });
  const japanesMetadataEvents = metadataEvents.filter((event) =>
    !isProxy(event.tags) && includesJapanese(event.content)
  );
  return japanesMetadataEvents;
}

export async function checkActive(
  fetcher: NostrFetcher,
  relayUrls: string[],
  pubkeys: string[],
): Promise<Map<string, boolean>> {
  const pubkeysMap = new Map<string, boolean>(
    pubkeys.map((pubkey) => [pubkey, false]),
  );
  if (pubkeys.length === 0) {
    return pubkeysMap;
  }
  const notesIterator = fetcher.fetchLatestEventsPerAuthor(
    { authors: pubkeys, relayUrls },
    { kinds: [eventKind.metadata, eventKind.text] },
    20,
  );
  for await (const { author, events } of notesIterator) {
    if (
      events.filter((event) =>
        (event.kind === eventKind.metadata ||
          event.tags.filter(([tagName]) => ["p", "t", "r"].includes(tagName))
              .length === 0) &&
        event.created_at >
          Math.floor(Date.now() / 1000 - activeDays * 24 * 60 * 60) &&
        !isProxy(event.tags) && includesJapanese(event.content)
      ).length > 0
    ) {
      pubkeysMap.set(author, true);
    }
  }
  return pubkeysMap;
}

export async function manyReportedPubkeys(
  fetcher: NostrFetcher,
  relayUrls: string[],
  pubkeys: string[],
): Promise<string[]> {
  if (pubkeys.length === 0) {
    return [];
  }

  const reportingEvents = await fetcher.fetchAllEvents(relayUrls, {
    kinds: [eventKind.report],
    "#p": pubkeys,
  }, {});
  const reportedPubkeys = reportingEvents.flatMap(
    (event) => event.tags.filter(([tagName]) => tagName === "p").map(([, pubkey]) => pubkey),
  ).reduce((map, p) => {
    const increment = 1;
    if (map.has(p)) {
      const count = map.get(p);
      map.set(p, count + increment);
    } else {
      map.set(p, increment);
    }
    return map;
  }, new Map());
  const manyReportedPubkeys = [...reportedPubkeys]
    .filter(([, count]) => count > 56)
    .map(([pubkey]) => pubkey);
  console.log("[reported]", reportedPubkeys, manyReportedPubkeys);
  return manyReportedPubkeys;
}

export async function fetchFollowers(
  fetcher: NostrFetcher,
  relayUrls: string[],
  pubkey: string,
): Promise<string[]> {
  const contactsEvents = await fetcher.fetchAllEvents(relayUrls, {
    kinds: [eventKind.contacts],
    "#p": [pubkey],
  }, {});
  return [...new Set(contactsEvents.map((event) => event.pubkey))];
}
