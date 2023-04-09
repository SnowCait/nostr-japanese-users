import { SimplePool } from "nostr-tools";

const relays = [
    'wss://relay.nostr.band',
    'wss://relay.damus.io',
    'wss://nos.lol',
    'wss://relay.snort.social',
    'wss://relay.nostr.wirednet.jp',
];

const pool = new SimplePool({ eoseSubTimeout: 10000 });

const contactListEvents = await pool.list(relays, [
  {
      kinds: [3],
      authors: [pubkey]
  }
]);
contactListEvents.sort((x, y) => x.created_at - y.created_at);
console.log(contactListEvents);

const events = await pool.list(relays, [
    {
        kinds: [0]
    }
]);
console.log(events);
