import 'websocket-polyfill';
import { SimplePool, Kind, getPublicKey, nip19 } from 'nostr-tools';

/** @type {string} */
const privateKey = process.env.NOSTR_PRIVATE_KEY;
const seckey = privateKey.startsWith('nsec') ? nip19.decode(privateKey).data : privateKey;
const pubkey = getPublicKey(seckey);
console.log('[pubkey]', pubkey);

const relays = [
  'wss://relay.nostr.band',
  'wss://relay.damus.io',
  'wss://nos.lol',
  'wss://relay.snort.social',
  'wss://relay.nostr.wirednet.jp',
];

const contactsPool = new SimplePool();

const contactsEvents = await contactsPool.list(relays, [
  {
    kinds: [Kind.Contacts],
    authors: [pubkey]
  }
]);
contactsPool.close(relays);
contactsEvents.sort((x, y) => x.created_at - y.created_at);
console.log('[contacts]', JSON.stringify(contactsEvents));

const metadataPool = new SimplePool({ eoseSubTimeout: 60000 });
const metadataEvents = await metadataPool.list(relays, [
  {
    kinds: [Kind.Metadata]
  }
]);
console.log('[metadata]', metadataEvents.length);

const japaneseMetadataEvents = metadataEvents
  .filter(event => /[\p{Script_Extensions=Hiragana}\p{Script_Extensions=Katakana}]/u.test(
    event.content.replace(/[、。，．「」]/ug, '')
  ));

console.log('[japanese]', japaneseMetadataEvents.length, japaneseMetadataEvents.map(x => {
  const { display_name, name, about } = JSON.parse(x.content);
  return `${display_name} (@${name}): ${about}`;
}));

metadataPool.close(relays);
