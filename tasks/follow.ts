import { parseArgs } from "https://deno.land/std@0.219.0/cli/parse_args.ts";
import { eventKind, NostrFetcher } from "nostr-fetch";
import {
  contactsJsonPath,
  readEventJson,
  relayUrls,
  sleepJsonPath,
  writeEventJson,
} from "../libs/helpers.ts";
import {
  checkActive,
  fetchJapaneseMetadataEvents,
  manyReportedPubkeys,
} from "../libs/nostr.ts";

const options: { since: string | number | undefined } = parseArgs(Deno.args);

const contacts = await readEventJson(contactsJsonPath);
const since = options.since === undefined
  ? contacts.created_at
  : Math.floor(new Date(options.since).getTime() / 1000);
console.log(
  "[last followees]",
  contacts.tags.length,
  new Date(since * 1000).toString(),
);

const fetcher = NostrFetcher.init();

const japanesMetadataEvents = await fetchJapaneseMetadataEvents(
  fetcher,
  relayUrls,
  since,
);
const newPubkeys = [
  ...new Set(
    japanesMetadataEvents.filter((event) =>
      !contacts.tags.some(([tagName, pubkey]) =>
        tagName === "p" && pubkey === event.pubkey
      )
    ).map(
      (event) => event.pubkey,
    ),
  ),
];
console.log(
  "[new japanese]",
  newPubkeys.length,
  newPubkeys,
  japanesMetadataEvents.map((event) => event.content),
);

const reportedPubkeys = await manyReportedPubkeys(
  fetcher,
  relayUrls,
  newPubkeys,
);
const pubkeys = newPubkeys.filter((pubkey) =>
  !reportedPubkeys.includes(pubkey)
);
console.log("[japanese]", pubkeys.length, pubkeys);

const pubkeysMap = await checkActive(fetcher, relayUrls, pubkeys);
const addingPubkeys = [...pubkeysMap].filter(([, active]) => active).map((
  [pubkey],
) => pubkey);
console.log("[active japanese]", addingPubkeys.length, pubkeysMap);

const inactiveOrProxyPubkeys = [...pubkeysMap].filter(([, active]) => !active)
  .map(([pubkey]) => pubkey);
console.log("[inactive/proxy japanese]", inactiveOrProxyPubkeys.length);

fetcher.shutdown();

if (addingPubkeys.length > 0) {
  const tags = [
    ...contacts.tags,
    ...addingPubkeys.map((pubkey) => ["p", pubkey]),
  ];
  console.log("[followees]", tags.length);
  await writeEventJson(contactsJsonPath, eventKind.contacts, tags);
}

if (inactiveOrProxyPubkeys.length > 0) {
  const sleep = await readEventJson(sleepJsonPath);
  const addingSleeper = inactiveOrProxyPubkeys.filter((pubkey) =>
    !sleep.tags.some(([tagName, p]) => tagName === "p" && pubkey === p)
  );
  console.log(
    "[sleep]",
    addingSleeper.length,
    inactiveOrProxyPubkeys.length,
    addingSleeper,
  );
  if (addingSleeper.length > 0) {
    const tags = [
      ...sleep.tags,
      ...addingSleeper.map((pubkey) => ["p", pubkey]),
    ];
    console.log(
      "[sleepers]",
      tags.filter(([tagName]) => tagName === "p").length,
    );
    await writeEventJson(
      sleepJsonPath,
      eventKind.categorizedPeopleList,
      tags,
    );
  }
}
