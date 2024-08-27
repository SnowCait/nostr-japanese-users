import dotenv from "dotenv";
import { NostrEvent } from "nostr-fetch";
import { finalizeEvent, nip19 } from "npm:nostr-tools@2.3.1";
import { hexToBytes } from "npm:@noble/hashes@1.3.2/utils";
import relays from "../relays.json" with { type: "json" };
import readonlyRelays from "../relays.readonly.json" with { type: "json" };

dotenv.config();

export const contactsJsonPath = "docs/contacts.json";
export const sleepJsonPath = "docs/sleep.json";

export const activeDays = 14;

export const relayUrls = [...relays, ...readonlyRelays];

export async function readEventJson(path: string): Promise<NostrEvent> {
  const json = await Deno.readTextFile(path);
  return JSON.parse(json);
}

export async function writeEventJson(
  path: string,
  kind: number,
  tags: string[][],
): Promise<void> {
  const privateKey = Deno.env.get("NOSTR_PRIVATE_KEY");
  if (privateKey === undefined) {
    console.error("NOSTR_PRIVATE_KEY is not defined.");
    Deno.exit(1);
  }

  const seckey = privateKey.startsWith("nsec")
    ? nip19.decode(privateKey).data as Uint8Array
    : hexToBytes(privateKey);

  const event = await finalizeEvent({
    kind,
    content: "",
    tags,
    created_at: Math.floor(Date.now() / 1000),
  }, seckey);
  await Deno.writeTextFile(path, JSON.stringify(event, null, 2));
}

export function isProxy(tags: string[][]): boolean {
  return tags.some(([tagName]) => tagName === "proxy" || tagName === "mostr");
}

export function isAnonymousClient(tags: string[][]): boolean {
  return tags.some(([tagName, tagContent]) =>
    tagName === "client" && ["nchan.shino3.net"].includes(tagContent)
  );
}

export function includesJapanese(content: string): boolean {
  return /[ぁ-ゔァ-ヺ]/u.test(content);
}

export function isNsfw(content: string): boolean {
  return /nsfw|🔞/ig.test(content);
}

export function randomArray<T>(array: T[], count: number) {
  return Array.from(
    { length: count },
    (_v, _k) => array[Math.floor(Math.random() * array.length)],
  );
}
