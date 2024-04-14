import { NostrFetcher } from "nostr-fetch";
import { checkActive, fetchFollowers } from "../libs/nostr.ts";
import {
  contactsJsonPath,
  randomArray,
  readEventJson,
  relayUrls,
  writeEventJson,
} from "../libs/helpers.ts";

const contacts = await readEventJson(contactsJsonPath);
const followees = contacts.tags.map(([, pubkey]) => pubkey);
console.log("[last followees]", followees.length);

const fetcher = NostrFetcher.init();

// Follow active followers
const followers = await fetchFollowers(fetcher, relayUrls, contacts.pubkey);
const notFollowingFollowers = followers.filter((pubkey) => !followees.includes(pubkey));
console.log("[followers]", notFollowingFollowers.length, followers.length);
const randomFollowers = randomArray(notFollowingFollowers, 10);
const followersMap = await checkActive(fetcher, relayUrls, randomFollowers);
const activeFollowers = [...followersMap]
  .filter(([, active]) => active)
  .map(([pubkey]) => pubkey);
console.log("[active followers]", activeFollowers.length, followersMap);

fetcher.shutdown();

if (activeFollowers.length > 0) {
  console.log("[new followees]", activeFollowers.length, activeFollowers);
  const tags = [
    ...contacts.tags,
    ...activeFollowers.map((pubkey) => ["p", pubkey]),
  ];
  console.log("[followees]", tags.length);
  await writeEventJson(contactsJsonPath, contacts.kind, tags);
}
