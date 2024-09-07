import { eventKind, NostrFetcher } from "nostr-fetch";
import {
  contactsJsonPath,
  randomArray,
  readEventJson,
  relayUrls,
  sleepJsonPath,
  writeEventJson,
} from "../libs/helpers.ts";
import { checkActive, manyReportedPubkeys } from "../libs/nostr.ts";

const contacts = await readEventJson(contactsJsonPath);
const followees = contacts.tags.map(([, pubkey]) => pubkey);

const randomFollowees = randomArray(followees, 20);
console.log("[followees]", followees.length, randomFollowees);

const fetcher = NostrFetcher.init();

const pubkeysMap = await checkActive(fetcher, relayUrls, randomFollowees);
const inactiveFollowees = [...pubkeysMap].filter(([, active]) => !active).map((
  [pubkey],
) => pubkey);
console.log("[inactive/proxy]", inactiveFollowees.length, pubkeysMap);

// Ensure non-reported
const activeFollowees = [...pubkeysMap].filter(([, active]) => active).map((
  [pubkey],
) => pubkey);
let reportedPubkeys: string[] = [];
if (activeFollowees.length > 0) {
  reportedPubkeys = await manyReportedPubkeys(
    fetcher,
    relayUrls,
    activeFollowees,
  );
  console.log("[many reported pubkeys]", reportedPubkeys);
}

const unfollowPubkeys = [...inactiveFollowees, ...reportedPubkeys];
console.log("[unfollow]", unfollowPubkeys.length, unfollowPubkeys);

fetcher.shutdown();

if (unfollowPubkeys.length === 0) {
  Deno.exit();
}

await writeEventJson(
  contactsJsonPath,
  eventKind.contacts,
  contacts.tags.filter(([, pubkey]) => !unfollowPubkeys.includes(pubkey)),
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
