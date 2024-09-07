# Nostr Japanese users

Follow Japanese users. Working on GitHub Actions.

日本人をフォローする bot です。 GitHub Actions で動いています。

## Development

Install [Deno](https://docs.deno.com/runtime/manual/).

Set environment variable `NOSTR_PRIVATE_KEY` (nsec or hex) or save as `.env`.

```bash
NOSTR_PRIVATE_KEY=nsec1yourprivatekey
```

## Run

These commands run locally.

```bash
deno task follow
deno task follow-followers
deno task follow-sleepers
deno task unfollow
deno task prune
```

If you want to send kind 3 event to relays.

```bash
deno task send
```
