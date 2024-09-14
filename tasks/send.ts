import relays from "../relays.json" with { type: "json" };
import { contactsJsonPath, readEventJson } from "../libs/helpers.ts";
import { send } from "../libs/nostr.ts";

const contacts = await readEventJson(contactsJsonPath);
console.log(contacts.tags.length, relays);

const results = await Promise.allSettled(relays.map((relay) => send(relay, contacts)));
if (!results.some(({ status }) => status === "fulfilled")) {
  Deno.exit(1);
}
