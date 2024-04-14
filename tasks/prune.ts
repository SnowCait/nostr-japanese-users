import { contactsJsonPath, readEventJson, sleepJsonPath, writeEventJson } from "../libs/helpers.ts";

const contacts = await readEventJson(contactsJsonPath);
const sleep = await readEventJson(sleepJsonPath);

const followees = contacts.tags.map(([, pubkey]) => pubkey);

const activePubkeyTags = sleep.tags.filter(([tagName, pubkey]) =>
  tagName === "p" && followees.includes(pubkey)
);
console.log("[prune]", activePubkeyTags.length);
if (activePubkeyTags.length > 0) {
  await writeEventJson(
    sleepJsonPath,
    sleep.kind,
    sleep.tags.filter(([tagName, pubkey]) => !(tagName === "p" && followees.includes(pubkey))),
  );
}
