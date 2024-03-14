import { eventKind, NostrFetcher } from "npm:nostr-fetch@0.15.0";
import {
  contactsJsonPath,
  readEventJson,
  relayUrls,
  sleepJsonPath,
  writeEventJson,
} from "../libs/helpers.ts";
import { checkActive } from "../libs/nostr.ts";

const contacts = await readEventJson(contactsJsonPath);
const followees = contacts.tags.map(([, pubkey]) => pubkey);

const randomFollowees = Array.from(
  { length: 10 },
  (_v, _k) => followees[Math.floor(Math.random() * followees.length)],
);
console.log("[followees]", followees.length, randomFollowees);

const fetcher = NostrFetcher.init();

const pubkeysMap = await checkActive(fetcher, relayUrls, randomFollowees);
const inactiveFollowees = [...pubkeysMap].filter(([, active]) => !active).map((
  [pubkey],
) => pubkey);
console.log("[inactive]", inactiveFollowees.length, pubkeysMap);

fetcher.shutdown();

if (inactiveFollowees.length === 0) {
  Deno.exit();
}

await writeEventJson(
  contactsJsonPath,
  eventKind.contacts,
  contacts.tags.filter(([, pubkey]) => !inactiveFollowees.includes(pubkey)),
);

const sleep = await readEventJson(sleepJsonPath);
const addingSleeper = inactiveFollowees.filter((pubkey) =>
  !sleep.tags.some(([tagName, p]) => tagName === "p" && pubkey === p)
);
console.log(
  "[sleep]",
  addingSleeper.length,
  inactiveFollowees.length,
  addingSleeper,
);
if (addingSleeper.length > 0) {
  await writeEventJson(
    sleepJsonPath,
    eventKind.categorizedPeopleList,
    [...sleep.tags, ...addingSleeper.map((pubkey) => ["p", pubkey])],
  );
}
