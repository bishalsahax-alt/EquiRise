import { NextResponse } from "next/server";
import {
  Address,
  Account,
  Operation,
  TransactionBuilder,
  rpc as stellarRpc,
  Keypair,
} from "@stellar/stellar-sdk";

export async function POST(request: Request) {
  try {
    const { userAddress } = await request.json();
    if (!userAddress) {
      return NextResponse.json({ error: "Missing user address" }, { status: 400 });
    }

    const adminSecret = process.env.ADMIN_SECRET_KEY || "SA54GYSXGK3CFQTWHDPRGTDNYV4KIHH5THNTN336JGXHFR3LC3F4BEXR";
    const adminPublic = process.env.ADMIN_PUBLIC_KEY || "GAO2PEHKPCXWXUIPCREQN5DPLXWIGHU2EFD3U6FR6MCMKL6URVVP5EPK";
    const managerAddress = process.env.NEXT_PUBLIC_SYNDICATE_MANAGER_ADDRESS || "CBF3DCZXOLOQLTNKVY4UPCC5KTTANOIT3KV3CKS7GKJI3SHX5JPFGM6M";
    const rpcUrl = process.env.NEXT_PUBLIC_RPC_URL || "https://soroban-testnet.stellar.org";
    const network = process.env.NEXT_PUBLIC_STELLAR_NETWORK || "testnet";

    const networkPassphrase =
      network === "standalone"
        ? "Standalone Network ; Standalone Network"
        : "Test SDF Network ; September 2015";

    const server = new stellarRpc.Server(rpcUrl);

    // Fetch admin account details
    const accountData = await server.getAccount(adminPublic);

    // Build contract invocation operation
    const op = Operation.invokeContractFunction({
      contract: managerAddress,
      function: "add_lead",
      args: [Address.fromString(userAddress).toScVal()],
    });

    // Build transaction
    const tx = new TransactionBuilder(
      new Account(adminPublic, accountData.sequenceNumber()),
      {
        fee: "100000",
        networkPassphrase,
      }
    )
      .addOperation(op)
      .setTimeout(100)
      .build();

    // Sign the transaction
    const adminKeypair = Keypair.fromSecret(adminSecret);
    tx.sign(adminKeypair);

    // Submit transaction
    const response = await server.sendTransaction(tx);
    if (response.status === "ERROR") {
      return NextResponse.json(
        { error: "Transaction submission failed", details: response.errorResult },
        { status: 500 }
      );
    }

    // Wait/poll for transaction confirmation
    let confirmed = false;
    for (let i = 0; i < 10; i++) {
      const statusResponse = await server.getTransaction(tx.hash().toString("hex"));
      if (statusResponse.status === stellarRpc.Api.GetTransactionStatus.SUCCESS) {
        confirmed = true;
        break;
      }
      if (statusResponse.status === stellarRpc.Api.GetTransactionStatus.FAILED) {
        return NextResponse.json(
          { error: "Transaction execution failed on chain", details: statusResponse.resultMetaXdr },
          { status: 500 }
        );
      }
      await new Promise((resolve) => setTimeout(resolve, 1500));
    }

    if (!confirmed) {
      return NextResponse.json({ error: "Transaction timed out on testnet" }, { status: 504 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("Error in approve-lead API:", err);
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 });
  }
}
