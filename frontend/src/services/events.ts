import { rpc, xdr, scValToNative } from "stellar-sdk";
import { useAppStore } from "@/state/useAppStore";
import { CONTRACT_ADDRESSES } from "./contracts";

export class EventSubscriber {
  private static intervalId: NodeJS.Timeout | null = null;
  private static lastLedger: number = 0;
  private static activeContracts: string[] = [CONTRACT_ADDRESSES.manager];

  /**
   * Start polling Soroban events
   */
  static start(networkChangeCallback?: () => void) {
    if (this.intervalId) return;

    const store = useAppStore.getState();
    const server = store.stellarService.getRpcServer();

    // Fetch current latest ledger to start polling from
    server.getLatestLedger().then((ledgerInfo) => {
      this.lastLedger = ledgerInfo.sequence - 5; // look back slightly
      
      this.intervalId = setInterval(async () => {
        try {
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
              this.processEvent(event);
            }
            // Update last ledger to the highest ledger sequence in the returned events
            const maxLedger = Math.max(...response.events.map((e) => e.ledger));
            this.lastLedger = maxLedger;
          } else {
            this.lastLedger = latestInfo.sequence;
          }
        } catch (error) {
          console.warn("Error polling Soroban events: ", error);
        }
      }, 5000); // Poll every 5s
    });
  }

  /**
   * Stop the polling subscriber
   */
  static stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  /**
   * Dynamically add contracts to subscription pool (e.g. newly deployed Deal Pools)
   */
  static subscribeToContract(address: string) {
    if (!this.activeContracts.includes(address)) {
      this.activeContracts.push(address);
    }
  }

  /**
   * Parse raw XDR Soroban event and add it to Zustand store
   */
  private static processEvent(rawEvent: rpc.Api.EventResponse) {
    const store = useAppStore.getState();
    try {
      const contractId = rawEvent.contractId;
      
      // Parse topics and value
      const topics = rawEvent.topic.map((t) => scValToNative(xdr.ScVal.fromXDR(t, "base64")));
      const value = scValToNative(xdr.ScVal.fromXDR(rawEvent.value, "base64"));
      
      const eventName = topics[0] as string;

      switch (eventName) {
        case "deployed": {
          const lead = topics[1];
          const poolAddress = topics[2];
          store.addEvent(
            "deploy",
            "New Syndicate Pool",
            `Lead ${lead.slice(0, 6)}... created a pool at ${poolAddress.slice(0, 8)}...`
          );
          // Auto subscribe to the new pool events
          this.subscribeToContract(poolAddress);
          break;
        }
        case "deposit": {
          const investor = topics[1];
          const amount = Number(value);
          store.addEvent(
            "deposit",
            "Syndicate Deposit Received",
            `Investor ${investor.slice(0, 6)}... deposited ${amount} USDC.`
          );
          break;
        }
        case "execute": {
          const pool = topics[1];
          store.addEvent(
            "execute",
            "Deal Syndicate Executed",
            `Pool ${pool.slice(0, 6)}... funds successfully sent to Startup.`
          );
          break;
        }
        case "cancelled": {
          store.addEvent(
            "cancel",
            "Syndicate Pool Closed",
            "Campaign completed or cancelled by the lead manager."
          );
          break;
        }
        case "withdraw": {
          const investor = topics[1];
          const amount = Number(value);
          store.addEvent(
            "withdraw",
            "Deposit Refunded",
            `Investor ${investor.slice(0, 6)}... withdrew ${amount} USDC.`
          );
          break;
        }
        case "claim": {
          const investor = topics[1];
          const amount = Number(value);
          store.addEvent(
            "claim",
            "Returns Claimed",
            `Investor ${investor.slice(0, 6)}... claimed ${amount} USDC exit share.`
          );
          break;
        }
        default:
          console.log("Unhandled event type: ", eventName);
      }
    } catch (err) {
      console.warn("Failed to parse event: ", err);
    }
  }
}
