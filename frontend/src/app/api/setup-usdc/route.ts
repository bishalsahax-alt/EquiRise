import { NextResponse } from "next/server";
import {
  Account,
  Asset,
  Operation,
  TransactionBuilder,
  rpc as stellarRpc,
  Keypair,
} from "@stellar/stellar-sdk";

/**
 * POST /api/setup-usdc
 * Establishes a USDC trustline for the user's account and mints test USDC.
 *
 * On Stellar, before an account can hold a non-native asset it must add a
 * "trustline" via a ChangeTrust operation signed by the account owner.
 * This endpoint:
 *   1. Builds a ChangeTrust tx for the user → user signs via wallet.
 *   2. After trustline is confirmed, the admin mints test USDC to the user.
 *
 * Body: { userAddress: string, action: "trustline" | "mint" }
 */
export async function POST(request: Request) {
  try {
    const { userAddress, action } = await request.json();
    if (!userAddress) {
      return NextResponse.json({ error: "Missing user address" }, { status: 400 });
    }

    const rpcUrl = process.env.NEXT_PUBLIC_RPC_URL || "https://soroban-testnet.stellar.org";
    const network = process.env.NEXT_PUBLIC_STELLAR_NETWORK || "testnet";
    const networkPassphrase =
      network === "standalone"
        ? "Standalone Network ; Standalone Network"
        : "Test SDF Network ; September 2015";

    const server = new stellarRpc.Server(rpcUrl);

    // The USDC SAC token wraps classic asset USDC:GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5
    const USDC_ISSUER = "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5";
    const usdcAsset = new Asset("USDC", USDC_ISSUER);

    if (action === "trustline") {
      // Build a ChangeTrust transaction for the user to sign with their wallet
      const accountData = await server.getAccount(userAddress);

      const tx = new TransactionBuilder(
        new Account(userAddress, accountData.sequenceNumber()),
        {
          fee: "100000",
          networkPassphrase,
        }
      )
        .addOperation(
          Operation.changeTrust({
            asset: usdcAsset,
          })
        )
        .setTimeout(100)
        .build();

      // Return unsigned XDR for the user's wallet to sign
      return NextResponse.json({
        success: true,
        unsignedXdr: tx.toXDR(),
        message: "Sign this transaction to establish USDC trustline",
      });
    }

    if (action === "mint") {
      // Admin mints test USDC to the user
      const adminSecret = process.env.ADMIN_SECRET_KEY;
      const adminPublic = process.env.ADMIN_PUBLIC_KEY;

      if (!adminSecret || !adminPublic) {
        return NextResponse.json(
          { error: "Server admin credentials are not configured" },
          { status: 500 }
        );
      }

      // On testnet, the USDC issuer is a third-party account we don't control.
      // Instead, we'll send a payment from the admin account (which should have USDC).
      // If admin doesn't have USDC either, we use the Stellar testnet anchor.
      // For demo purposes, we'll use a direct payment from admin if funded.

      const adminKeypair = Keypair.fromSecret(adminSecret);
      const adminAccountData = await server.getAccount(adminPublic);

      const mintAmount = "10000"; // 10,000 USDC for testing

      const tx = new TransactionBuilder(
        new Account(adminPublic, adminAccountData.sequenceNumber()),
        {
          fee: "100000",
          networkPassphrase,
        }
      )
        .addOperation(
          Operation.payment({
            destination: userAddress,
            asset: usdcAsset,
            amount: mintAmount,
          })
        )
        .setTimeout(100)
        .build();

      tx.sign(adminKeypair);

      const response = await server.sendTransaction(tx);
      if (response.status === "ERROR") {
        return NextResponse.json(
          { error: "Mint transaction failed", details: String(response.errorResult ?? "") },
          { status: 500 }
        );
      }

      // Poll for confirmation
      const txHash = tx.hash().toString("hex");
      for (let i = 0; i < 10; i++) {
        const statusResponse = await server.getTransaction(txHash);
        if (statusResponse.status === stellarRpc.Api.GetTransactionStatus.SUCCESS) {
          return NextResponse.json({
            success: true,
            message: `${mintAmount} test USDC sent to your account`,
            hash: txHash,
          });
        }
        if (statusResponse.status === stellarRpc.Api.GetTransactionStatus.FAILED) {
          return NextResponse.json(
            { error: "Mint transaction failed on chain" },
            { status: 500 }
          );
        }
        await new Promise((resolve) => setTimeout(resolve, 1500));
      }

      return NextResponse.json({ error: "Mint transaction timed out" }, { status: 504 });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (err: any) {
    console.error("Error in setup-usdc API:", err);
    return NextResponse.json(
      { error: err.message || "Internal server error" },
      { status: 500 }
    );
  }
}
