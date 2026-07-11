import { useAppStore } from "@/state/useAppStore";
import { CONTRACT_ADDRESSES } from "./contracts";

export class EventSubscriber {
  private static intervalId: ReturnType<typeof setInterval> | null = null;
  private static lastLedger: number = 0;
  private static activeContracts: string[] = [CONTRACT_ADDRESSES.manager];

  /**
   * Start polling Soroban events via dynamic import of stellar-sdk.
   */
  static start() {
    if (this.intervalId) return;

    const store = useAppStore.getState();

    store.stellarService.getServerAsync().then(async (server: any) => {
      const ledgerInfo = await server.getLatestLedger();
      this.lastLedger = ledgerInfo.sequence - 5;

      this.intervalId = setInterval(async () => {
        try {
          // Dynamically import stellar-sdk so sodium-native stays server-only
          const { xdr, scValToNative } = await import("@stellar/stellar-sdk");

          const latestInfo = await server.getLatestLedger();
          if (latestInfo.sequence <= this.lastLedger) return;

          const response = await server.getEvents({
            startLedger: this.lastLedger + 1,
            filters: [
              {
                type: "contract",
                contractIds: this.activeContracts,
              },
            ],
            limit: 50,
          });

          if (response.events && response.events.length > 0) {
            for (const event of response.events) {
              this.processEvent(event, xdr, scValToNative);
            }
            const maxLedger = Math.max(
              ...response.events.map((e: any) => e.ledger)
            );
            this.lastLedger = maxLedger;
          } else {
            this.lastLedger = latestInfo.sequence;
          }
        } catch (error) {
          console.warn("Error polling Soroban events:", error);
        }
      }, 5000);
    });
  }

  static stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  static subscribeToContract(address: string) {
    if (!this.activeContracts.includes(address)) {
      this.activeContracts.push(address);
    }
  }

  private static processEvent(rawEvent: any, xdr: any, scValToNative: any) {
    const store = useAppStore.getState();
    try {
      const topics = rawEvent.topic.map((t: string) =>
        scValToNative(xdr.ScVal.fromXDR(t, "base64"))
      );
      const value = scValToNative(xdr.ScVal.fromXDR(rawEvent.value, "base64"));
      const eventName = topics[0] as string;

      switch (eventName) {
        case "deployed": {
          const lead = topics[1];
          const poolAddress = topics[2];
          store.addEvent(
            "deploy",
            "New Syndicate Pool",
            `Lead ${String(lead).slice(0, 6)}... created a pool at ${String(poolAddress).slice(0, 8)}...`
          );
          this.subscribeToContract(String(poolAddress));
          break;
        }
        case "deposit": {
          const investor = topics[1];
          const amount = Number(value);
          store.addEvent(
            "deposit",
            "Syndicate Deposit Received",
            `Investor ${String(investor).slice(0, 6)}... deposited ${amount} USDC.`
          );
          break;
        }
        case "execute": {
          const pool = topics[1];
          store.addEvent(
            "execute",
            "Deal Syndicate Executed",
            `Pool ${String(pool).slice(0, 6)}... funds successfully sent to Startup.`
          );
          break;
        }
        case "cancelled":
          store.addEvent(
            "cancel",
            "Syndicate Pool Closed",
            "Campaign completed or cancelled by the lead manager."
          );
          break;
        case "withdraw": {
          const investor = topics[1];
          const amount = Number(value);
          store.addEvent(
            "withdraw",
            "Deposit Refunded",
            `Investor ${String(investor).slice(0, 6)}... withdrew ${amount} USDC.`
          );
          break;
        }
        case "claim": {
          const investor = topics[1];
          const amount = Number(value);
          store.addEvent(
            "claim",
            "Returns Claimed",
            `Investor ${String(investor).slice(0, 6)}... claimed ${amount} USDC exit share.`
          );
          break;
        }
        default:
          console.log("Unhandled event type:", eventName);
      }
    } catch (err) {
      console.warn("Failed to parse event:", err);
    }
  }
}
