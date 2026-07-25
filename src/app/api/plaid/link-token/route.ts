import { NextResponse } from "next/server";
import { CountryCode, Products } from "plaid";
import { getOrCreateUser } from "@/lib/auth";
import { plaidClient } from "@/lib/plaid";

export async function POST() {
  const user = await getOrCreateUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const response = await plaidClient.linkTokenCreate({
    user: { client_user_id: user.id },
    client_name: "Headroom",
    products: [Products.Transactions],
    country_codes: [CountryCode.Us],
    language: "en",
  });

  return NextResponse.json({ linkToken: response.data.link_token });
}
