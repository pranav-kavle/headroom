import { Configuration, PlaidApi, PlaidEnvironments } from "plaid";

// Which Plaid environment to talk to, driven by PLAID_ENV (e.g. "sandbox" or
// "production"). Defaults to sandbox so a missing or unrecognized value never
// accidentally hits production and real bank data.
const plaidEnv = (process.env.PLAID_ENV || "sandbox") as keyof typeof PlaidEnvironments;
const basePath = PlaidEnvironments[plaidEnv] ?? PlaidEnvironments.sandbox;

const configuration = new Configuration({
  basePath,
  baseOptions: {
    headers: {
      "PLAID-CLIENT-ID": process.env.PLAID_CLIENT_ID,
      "PLAID-SECRET": process.env.PLAID_SECRET,
    },
  },
});

export const plaidClient = new PlaidApi(configuration);
