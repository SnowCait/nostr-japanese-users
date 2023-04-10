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

const pool = new SimplePool({ eoseSubTimeout: 10000 });

const contactsEvents = await pool.list(relays, [
  {
    kinds: [Kind.Contacts],
    authors: [pubkey]
  }
]);
contactsEvents.sort((x, y) => x.created_at - y.created_at);
console.log('[contacts]', contactsEvents);

const metadataEvents = await pool.list(relays, [
  {
    kinds: [Kind.Metadata]
  }
]);
console.log('[metadata]', metadataEvents);
