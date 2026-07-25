import { NextResponse } from "next/server";
import { getOrCreateUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { plaidClient } from "@/lib/plaid";
import { encryptToken } from "@/lib/token-encryption";

// Plaid account subtypes we can represent today (BankAccountType only models
// checking/savings, per the ERD). Other depository subtypes (money market,
// CD, etc.) are treated as savings-like; non-depository accounts (credit,
// loan, investment) are skipped for now — out of scope for cashflow tracking.
function mapAccountType(subtype: string | null): "checking" | "savings" | null {
  if (subtype === "checking") return "checking";
  if (subtype === "savings" || subtype === "money market" || subtype === "cd") {
    return "savings";
  }
  return null;
}

export async function POST(request: Request) {
  const user = await getOrCreateUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const { publicToken } = await request.json();
  if (!publicToken) {
    return NextResponse.json({ error: "Missing publicToken" }, { status: 400 });
  }

  const exchangeResponse = await plaidClient.itemPublicTokenExchange({
    public_token: publicToken,
  });
  const { access_token: accessToken, item_id: itemId } = exchangeResponse.data;

  const accountsResponse = await plaidClient.accountsGet({ access_token: accessToken });

  const { encrypted, iv, authTag } = encryptToken(accessToken);

  const connection = await prisma.bankConnection.create({
    data: {
      userId: user.id,
      provider: "plaid",
      providerItemId: itemId,
      status: "active",
      lastSyncedAt: new Date(),
      encryptedAccessToken: encrypted,
      accessTokenIv: iv,
      accessTokenAuthTag: authTag,
      accounts: {
        create: accountsResponse.data.accounts
          .map((account) => ({
            providerAccountId: account.account_id,
            type: mapAccountType(account.subtype),
            isCommingled: false,
          }))
          .filter(
            (account): account is typeof account & { type: "checking" | "savings" } =>
              account.type !== null,
          ),
      },
    },
    include: { accounts: true },
  });

  return NextResponse.json({
    connectionId: connection.id,
    accounts: connection.accounts,
  });
}
