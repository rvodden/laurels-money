# Laurels money

A small phone app showing what's left to spend this week and this pay month. It reads
the family budget sheet ("Laurel's Bills") directly from Google, using the Google
account of whoever is signed in. **This repository contains no financial data**, only
the page. People without access to the sheet see nothing.

It's a progressive web app hosted on GitHub Pages at https://money.vodden.com. Add it to
the home screen and it opens full screen with its own icon.

## What it reads

These named ranges in Laurel's Bills (the sheet id is in `config.js`):

- **`DashWeek`:** this week's lines. The first row names the columns; the last row is
  the total.
- **`DashMonth`:** this pay month's lines, in the same shape.
- **`EmmaFileId`:** the id of Emma's export sheet. The app shows when that file last
  changed, as "Emma last synced …".

The layout can change freely in the sheet, as long as the named ranges and their column
names stay.

## One-off setup

### 1. GitHub Pages

1. Go to **Settings → Pages** in this repository.
2. Set **Source** to *Deploy from a branch*, **Branch** to `main`, and the folder to `/ (root)`.
3. Set **Custom domain** to `money.vodden.com`. The `CNAME` file already says this.
4. Once the certificate is ready, tick **Enforce HTTPS**.

### 2. DNS for vodden.com

Add one record wherever vodden.com's DNS is managed:

| Type | Name | Value |
|---|---|---|
| CNAME | `money` | `rvodden.github.io` |

### 3. Google sign-in (OAuth client)

1. Go to https://console.cloud.google.com and create a project, for example "Laurels money".
2. Under **APIs & Services → Library**, enable the **Google Sheets API** and the **Google Drive API**.
3. Set up **APIs & Services → OAuth consent screen**:
   - choose **External**
   - set the app name to "Laurels money" and the support email to yours
   - add the scopes `.../auth/spreadsheets.readonly` and `.../auth/drive.metadata.readonly`
   - leave the app **in testing**
   - under **Test users**, add `richard@vodden.com` and `kvrbsn@gmail.com`
4. Create the client under **APIs & Services → Credentials → Create credentials → OAuth client ID**:
   - **Application type:** Web application
   - **Authorised JavaScript origins:** `https://money.vodden.com`
   - **Authorised redirect URIs:** `https://money.vodden.com/`
5. Copy the client id into `config.js` (`clientId`) and commit.

The first time each person signs in, Google warns that the app hasn't been verified.
That's expected for a private app in testing mode: choose **Continue**.

## On the phone

- **iPhone:** open https://money.vodden.com in Safari, sign in, then **Share → Add to Home Screen**.
- **Android:** open it in Chrome, sign in, then **⋮ → Install app**.

Sign-in lasts about an hour. After that, the app quietly gets a fresh one when it next
opens, without asking again unless Google needs you to confirm.

## How it works

- `index.html`, `styles.css` and `app.js` are the page.
- `config.js` holds the OAuth client id and the sheet id. Neither is a secret.
- `manifest.webmanifest` and `icons/` make it installable.
- `sw.js` keeps the page available offline. Google data is never cached by the service
  worker; the last figures are kept only in the phone's own storage.
- Sign-in uses Google's OAuth redirect flow, which works inside home-screen apps. The
  token is kept on the phone for its hour and only allows reading the sheets and file
  details the person can already see.
