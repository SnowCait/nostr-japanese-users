import { NostrFetcher } from "nostr-fetch";
import { checkActive } from "../libs/nostr.ts";
import {
  contactsJsonPath,
  randomArray,
  readEventJson,
  relayUrls,
  sleepJsonPath,
  writeEventJson,
} from "../libs/helpers.ts";

const contacts = await readEventJson(contactsJsonPath);
const followees = contacts.tags.map(([, pubkey]) => pubkey);
console.log("[last followees]", followees.length);

const sleep = await readEventJson(sleepJsonPath);
const sleepers = sleep.tags.filter(([tagName]) => tagName === "p").map(([, pubkey]) => pubkey);
console.log("[sleepers]", sleepers.length);

const fetcher = NostrFetcher.init();

// Follow active sleepers
const randomSleepers = randomArray(sleepers, 10);
const sleepersMap = await checkActive(fetcher, relayUrls, randomSleepers);
const activeSleepers = [...sleepersMap]
  .filter(([, active]) => active)
  .map(([pubkey]) => pubkey)
  .filter((pubkey) => !followees.includes(pubkey)); // Ensure
console.log("[active sleepers]", activeSleepers.length, sleepersMap);

fetcher.shutdown();

if (activeSleepers.length > 0) {
  console.log("[new followees]", activeSleepers.length, activeSleepers);
  const tags = [
    ...contacts.tags,
    ...activeSleepers.map((pubkey) => ["p", pubkey]),
  ];
  console.log("[followees]", tags.length);
  await writeEventJson(contactsJsonPath, contacts.kind, tags);
}
