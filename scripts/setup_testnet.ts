import { Keypair } from "stellar-sdk";
import * as fs from "fs";
import * as path from "path";

async function setupTestnetAccount() {
  console.log("--------------------------------------------------");
  console.log("Setting up Testnet Admin Credentials for EquiRise");
  console.log("--------------------------------------------------");

  // Generate new keypair
  const keypair = Keypair.random();
  const publicKey = keypair.publicKey();
  const secretKey = keypair.secret();

  console.log(`Generated Public Key: ${publicKey}`);
  console.log(`Generated Secret Key: ${secretKey.slice(0, 10)}...`);

  // Request Friendbot funding
  console.log("\nFunding account via Friendbot...");
  const response = await fetch(`https://friendbot.stellar.org/?addr=${publicKey}`);
  
  if (response.ok) {
    console.log("Success! Account funded with 10,000 XLM.");
  } else {
    console.error("Failed to fund account via Friendbot. Proceeding to save credentials...");
  }

  // Create .env content
  const envContent = `# EquiRise Environment Configurations
NEXT_PUBLIC_STELLAR_NETWORK=testnet
NEXT_PUBLIC_RPC_URL=https://soroban-testnet.stellar.org
NEXT_PUBLIC_EXPLORER_URL=https://stellar.expert/explorer/testnet

# Deployer Keys
ADMIN_PUBLIC_KEY=${publicKey}
ADMIN_SECRET_KEY=${secretKey}
FEE_COLLECTOR_ADDRESS=${publicKey}
MOCK_USDC_TOKEN_ADDRESS=CUSDCASSETXXXXXXTESTNETXXXXXXEQUI1
`;

  const rootPath = path.resolve(__dirname, "../");
  fs.writeFileSync(path.join(rootPath, ".env"), envContent);
  fs.writeFileSync(path.join(rootPath, "frontend/.env.local"), envContent);

  console.log("\nCreated .env configurations in root and frontend/.env.local.");
  console.log("You can now proceed to run the deployment scripts.");
  console.log("--------------------------------------------------");
}

setupTestnetAccount().catch(console.error);
