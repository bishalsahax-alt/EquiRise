import { execSync } from "child_process";
import * as dotenv from "dotenv";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

dotenv.config();

// Ensure .cargo/bin is in process.env.PATH
const cargoBin = path.join(os.homedir(), ".cargo", "bin");
if (process.env.PATH) {
  process.env.PATH = `${cargoBin}${path.delimiter}${process.env.PATH}`;
} else {
  process.env.PATH = cargoBin;
}

function runCommand(command: string): string {
  console.log(`> Executing: ${command}`);
  try {
    const output = execSync(command, { encoding: "utf8", stdio: "pipe" });
    return output.trim();
  } catch (err: any) {
    console.error(`Command failed: ${err.message}`);
    if (err.stdout) console.error(`STDOUT: ${err.stdout}`);
    if (err.stderr) console.error(`STDERR: ${err.stderr}`);
    throw err;
  }
}

async function deploy() {
  console.log("==================================================");
  console.log("Compiling & Deploying EquiRise Soroban Contracts");
  console.log("==================================================");

  const secret = process.env.ADMIN_SECRET_KEY;
  const adminPublic = process.env.ADMIN_PUBLIC_KEY;
  const feeCollector = process.env.FEE_COLLECTOR_ADDRESS || adminPublic;

  if (!secret || !adminPublic || !feeCollector) {
    throw new Error("Missing required ADMIN_SECRET_KEY, ADMIN_PUBLIC_KEY, or FEE_COLLECTOR_ADDRESS in env.");
  }

  // 1. Build Contracts
  console.log("\nBuilding WebAssembly targets...");
  execSync("stellar contract build", {
    cwd: path.join(process.cwd(), "contracts"),
    stdio: "inherit",
    env: process.env
  });

  // Define Wasm paths
  const rootDir = process.cwd();
  const managerWasm = path.join(rootDir, "contracts/target/wasm32v1-none/release/syndicate_manager.wasm");
  const poolWasm = path.join(rootDir, "contracts/target/wasm32v1-none/release/deal_pool.wasm");

  // 2. Install Syndicate Manager WASM
  console.log("\nInstalling Syndicate Manager WASM on Testnet...");
  const installManagerOutput = runCommand(
    `stellar contract install --wasm ${managerWasm} --source ${secret} --network testnet`
  );
  console.log(`Syndicate Manager WASM Hash: ${installManagerOutput}`);

  // 3. Install Deal Pool WASM (to get WASM hash for manager dynamic deployment)
  console.log("\nInstalling Deal Pool WASM on Testnet...");
  const installPoolWasmHash = runCommand(
    `stellar contract install --wasm ${poolWasm} --source ${secret} --network testnet`
  );
  console.log(`Deal Pool WASM Hash: ${installPoolWasmHash}`);

  // 4. Deploy Syndicate Manager instance
  console.log("\nDeploying Syndicate Manager Instance...");
  const managerAddress = runCommand(
    `stellar contract deploy --wasm-hash ${installManagerOutput} --source ${secret} --network testnet`
  );
  console.log(`Syndicate Manager Address: ${managerAddress}`);

  // 5. Initialize Syndicate Manager
  // initialize(admin, fee_collector, platform_fee: 200 bps)
  console.log("\nInitializing Syndicate Manager contract...");
  runCommand(
    `stellar contract invoke --id ${managerAddress} --source ${secret} --network testnet -- initialize --admin ${adminPublic} --fee_collector ${feeCollector} --platform_fee 200`
  );
  console.log("Syndicate Manager initialized with 2% platform fee.");

  // 6. Set Deal Pool WASM Hash in Syndicate Manager
  console.log("\nRegistering Deal Pool WASM Hash on Syndicate Manager...");
  runCommand(
    `stellar contract invoke --id ${managerAddress} --source ${secret} --network testnet -- set_wasm_hash --wasm_hash ${installPoolWasmHash}`
  );
  console.log("Deal Pool WASM registered on Factory.");

  // Update .env with contract addresses
  const envPath = path.join(rootDir, ".env");
  let envData = fs.readFileSync(envPath, "utf8");
  envData += `NEXT_PUBLIC_SYNDICATE_MANAGER_ADDRESS=${managerAddress}\n`;
  envData += `NEXT_PUBLIC_DEAL_POOL_WASM_HASH=${installPoolWasmHash}\n`;
  
  fs.writeFileSync(envPath, envData);
  fs.writeFileSync(path.join(rootDir, "frontend/.env.local"), envData);

  console.log("\n==================================================");
  console.log("DEPLOYMENT COMPLETED SUCCESSFULLY");
  console.log(`Syndicate Manager Address: ${managerAddress}`);
  console.log(`Deal Pool WASM Hash: ${installPoolWasmHash}`);
  console.log("Saved addresses to .env and frontend/.env.local.");
  console.log("==================================================");
}

deploy().catch(console.error);
