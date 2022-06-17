# Version Check Server

## Requirements

1. Signup for a [Cloudflare Workers](https://workers.cloudflare.com/) account.
2. Complete the [Getting Started](https://developers.cloudflare.com/workers/wrangler/get-started/) Instructions.
3. Create two KVs in your Cloudflare Dashboard, VERSION_KV, ADMIN_KV
4. Create two preview KVs in your terminal

```bash
$ wrangler kv:namespace create VERSION_KV --preview
$ wrangler kv:namespace create ADMIN_KV --preview
```

5. Update `wrangler.toml` with your KV `preview_ids`. If this is a new installation, update the `id` values from your dashboard.
6. Create the following entries in the ADMIN_KV and ADMIN_KV_preview:

```bash
Key : Value
user:[username for login]
pass:[password for login]
```

7. Add the Cloudflare API Token and Account ID from your dashboard to your repository Secrets as `CF_API_TOKEN` and `CF_ACCOUNT_ID`. ​

## Usage

To start in local dev

## Contributing

Pull requests are welcome. For major changes, please open an issue first to discuss what you would like to change.

Please make sure to update tests as appropriate.

## License

[MIT](https://choosealicense.com/licenses/mit/
