# edge-reports

- Reporting tools for partner rev share

- `yarn` or `npm install`
- `yarn build` or `npm run build`
- Rename `config.json.sample` to `config.json` and enter relevant API keys
- If only interested in submitting your own exchange reporting plugin:
- Come up with a prefix for your organization (eg ShapeShift = "SS", "BitRefill" = "BR"), and create a [prefix]Raw.json file in the `cache` folder and enter an object with an empty `"txs": []` array.
- In the `src` folder create a file `myOrganization.js` with the code to fetch transactions from your API and format transactions to match the `StandardTx` type (can view in `checkSwapService.js` file)
- In `reporter.js` import the transaction fetching procedure from your `myOrganization.js` file and include near the top of the `main` function. Also make sure you have your organization's transactions printed out with `printTxDataMap` in the `report` method (in `reporter.js`).
- When in doubt, look at how other teams have implemented their reporting procedure. If you have any further questions please feel free to reach out to the Edge team at our `dev` Slack channel:
https://edgesecure.slack.com/messages/C3LJWEXEK
