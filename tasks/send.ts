import { NostrEvent } from "nostr-fetch";
import relays from "../relays.json" with { type: "json" };
import { contactsJsonPath, readEventJson } from "../libs/helpers.ts";

const contacts = await readEventJson(contactsJsonPath);
console.log(contacts.tags.length, relays);

await Promise.allSettled(relays.map((relay) => send(relay, contacts)));

async function send(relayUrl: string, event: NostrEvent): Promise<void> {
  await new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      console.log("[timeout]", relayUrl);
      reject();
    }, 3000);
    const ws = new WebSocket(relayUrl);
    ws.addEventListener("open", () => {
      ws.send(JSON.stringify(["EVENT", event]));
    });
    ws.addEventListener("message", (e) => {
      console.log("[message]", relayUrl, e.data);
      const [, , ok, reason] = JSON.parse(e.data);
      ws.close();
      clearTimeout(timeoutId);
      if (ok) {
        resolve(e.data);
      } else {
        reject(reason);
      }
    });
    ws.addEventListener("error", (e) => {
      console.error("[error]", e);
      ws.close();
      clearTimeout(timeoutId);
      reject(e);
    });
  });
}
