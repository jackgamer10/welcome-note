# MAGXXIC VOT DKIM Key Storage

Place your DKIM private key files in this folder.

## File Naming Convention
You can name the keys based on the domain they belong to, or use a default name as specified in `magxxic/config.json`.

Example:
- `dedicatedpowermtamail.com.pem`
- `dkim_private.pem`

## Config Setup
Ensure the `dkim_selector` and `dkim_private_key_path` in `magxxic/config.json` match the keys provided here.

```json
{
  "dkim_enabled": true,
  "dkim_selector": "dkim",
  "dkim_private_key_path": "magxxic/dkim/dedicatedpowermtamail.com.pem"
}
```
