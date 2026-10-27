# Waitlist emails

Plain-text emails 1 to 3 from `../launch-plan.md`, in Indonesian, ready to paste into a sender. The first two lines of each file (`Subject:` and `When:`) are not part of the body.

| File                  | Send                                                         | Fill in                            |
| --------------------- | ------------------------------------------------------------ | ---------------------------------- |
| `01-welcome.txt`      | Right after sign-up, and once as a batch to the current list | nothing                            |
| `02-ramadan-week.txt` | About 1 Feb 2027                                             | `{{STORE_STATUS}}`: variant A or B |
| `03-live.txt`         | The day both stores are live                                 | nothing                            |

Every email ends with an unsubscribe line: reply "berhenti" and delete the row (`DELETE FROM waitlist WHERE email = '...'`, see `apps/web/README.md`).

## Export the recipients

```bash
# production account credentials required: CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN
apps/web/scripts/export-waitlist.sh --locale id > /tmp/waitlist.csv   # email,platform,city,locale,created_at
```

The file is personal data: keep it outside the repo and delete it after the send. The emails are Indonesian only; `--locale en` lists the English sign-ups that have no email text yet.

## Sender

No email sender exists in this repo (the site only stores the signup in D1), so nothing sends these automatically. Pick one before the first send; until then, mail them by hand from the support address.
