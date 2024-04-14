import { contactsJsonPath, readEventJson, sleepJsonPath, writeEventJson } from "../libs/helpers.ts";

const contacts = await readEventJson(contactsJsonPath);
const sleep = await readEventJson(sleepJsonPath);

const followees = contacts.tags.map(([, pubkey]) => pubkey);

await writeEventJson(
  sleepJsonPath,
  sleep.kind,
  sleep.tags.filter(([tagName, pubkey]) => !(tagName === "p" && followees.includes(pubkey))),
);
