#![no_std]
use soroban_sdk::{
    contract, contractclient, contractimpl, contracttype, symbol_short, Address, Env, Symbol
};

// Define client interface for inter-contract calls to Syndicate Manager.
#[contractclient(name = "SyndicateManagerClient")]
pub trait SyndicateManagerInterface {
    fn get_fee_config(env: Env) -> (Address, u32);
}

#[derive(Clone, Copy, PartialEq, Eq, Debug)]
#[contracttype]
pub enum PoolState {
    Active = 0,
    Funded = 1,
    Closed = 2,
    Distributed = 3,
}

impl PoolState {
    pub fn to_u32(&self) -> u32 {
        match self {
            PoolState::Active => 0,
            PoolState::Funded => 1,
            PoolState::Closed => 2,
            PoolState::Distributed => 3,
        }
    }
}

// Ensure the standard library imports Val for into_val conversions
use soroban_sdk::Val;

#[derive(Clone)]
#[contracttype]
pub enum DataKey {
    Lead,
    Startup,
    Token,
    TargetAmount,
    MinInvest,
    MaxInvest,
    Manager,
    State,
    TotalInvested,
    TotalReturns,
    InvestorBalance(Address),
    InvestorClaimed(Address),
}

#[contract]
pub struct DealPool;

#[contractimpl]
impl DealPool {
    /// Initialize a newly deployed Deal Pool.
    /// Can only be called once.
    pub fn initialize(
        env: Env,
        lead: Address,
        startup: Address,
        token: Address,
        target_amount: i128,
        min_invest: i128,
        max_invest: i128,
        manager: Address,
    ) {
        if env.storage().instance().has(&DataKey::Lead) {
            panic!("already initialized");
        }
        if target_amount <= 0 || min_invest <= 0 || max_invest < min_invest {
            panic!("invalid configuration limits");
        }

        env.storage().instance().set(&DataKey::Lead, &lead);
        env.storage().instance().set(&DataKey::Startup, &startup);
        env.storage().instance().set(&DataKey::Token, &token);
        env.storage().instance().set(&DataKey::TargetAmount, &target_amount);
        env.storage().instance().set(&DataKey::MinInvest, &min_invest);
        env.storage().instance().set(&DataKey::MaxInvest, &max_invest);
        env.storage().instance().set(&DataKey::Manager, &manager);
        env.storage().instance().set(&DataKey::State, &PoolState::Active);
        env.storage().instance().set(&DataKey::TotalInvested, &0i128);
        env.storage().instance().set(&DataKey::TotalReturns, &0i128);
    }

    /// Read config state values.
    pub fn get_metadata(env: Env) -> (Address, Address, Address, i128, i128, i128, u32, i128, i128) {
        let lead: Address = env.storage().instance().get(&DataKey::Lead).unwrap();
        let startup: Address = env.storage().instance().get(&DataKey::Startup).unwrap();
        let token: Address = env.storage().instance().get(&DataKey::Token).unwrap();
        let target: i128 = env.storage().instance().get(&DataKey::TargetAmount).unwrap();
        let min_inv: i128 = env.storage().instance().get(&DataKey::MinInvest).unwrap();
        let max_inv: i128 = env.storage().instance().get(&DataKey::MaxInvest).unwrap();
        let state: PoolState = env.storage().instance().get(&DataKey::State).unwrap();
        let invested: i128 = env.storage().instance().get(&DataKey::TotalInvested).unwrap();
        let returns: i128 = env.storage().instance().get(&DataKey::TotalReturns).unwrap();
        
        (lead, startup, token, target, min_inv, max_inv, state.to_u32(), invested, returns)
    }

    /// Deposit funds into the pool.
    pub fn deposit(env: Env, investor: Address, amount: i128) {
        investor.require_auth();

        // 1. Validate State
        let state: PoolState = env.storage().instance().get(&DataKey::State).unwrap();
        if state != PoolState::Active {
            panic!("pool is not accepting deposits");
        }

        // 2. Validate bounds
        let min_inv: i128 = env.storage().instance().get(&DataKey::MinInvest).unwrap();
        let max_inv: i128 = env.storage().instance().get(&DataKey::MaxInvest).unwrap();
        let target: i128 = env.storage().instance().get(&DataKey::TargetAmount).unwrap();
        let total_invested: i128 = env.storage().instance().get(&DataKey::TotalInvested).unwrap();

        let key = DataKey::InvestorBalance(investor.clone());
        let current_balance: i128 = env.storage().persistent().get(&key).unwrap_or(0i128);
        let new_balance = current_balance + amount;

        if new_balance < min_inv {
            panic!("deposit below minimum investment limit");
        }
        if new_balance > max_inv {
            panic!("deposit exceeds maximum investment limit");
        }
        if total_invested + amount > target {
            panic!("deposit exceeds pool target goal");
        }

        // 3. Transfer token from investor to pool contract
        let token_addr: Address = env.storage().instance().get(&DataKey::Token).unwrap();
        let token_client = soroban_sdk::token::Client::new(&env, &token_addr);
        token_client.transfer(&investor, &env.current_contract_address(), &amount);

        // 4. Update balances
        env.storage().persistent().set(&key, &new_balance);
        env.storage().instance().set(&DataKey::TotalInvested, &(total_invested + amount));

        // 5. Emit event
        env.events().publish(
            (symbol_short!("deposit"), investor, env.current_contract_address()),
            amount
        );
    }

    /// Retrieve balance of a specific investor.
    pub fn get_balance(env: Env, investor: Address) -> i128 {
        let key = DataKey::InvestorBalance(investor);
        env.storage().persistent().get(&key).unwrap_or(0i128)
    }

    /// Execute the deal: transfers collected funds to startup and platform fee to collector.
    /// Only callable by Lead.
    pub fn execute_deal(env: Env) {
        let lead: Address = env.storage().instance().get(&DataKey::Lead).unwrap();
        lead.require_auth();

        let state: PoolState = env.storage().instance().get(&DataKey::State).unwrap();
        if state != PoolState::Active {
            panic!("pool is not active");
        }

        let total_invested: i128 = env.storage().instance().get(&DataKey::TotalInvested).unwrap();
        let target: i128 = env.storage().instance().get(&DataKey::TargetAmount).unwrap();
        
        // Allow executing if target is met.
        if total_invested < target {
            panic!("funding target not met yet");
        }

        // Inter-contract call to Manager: query platform fee config.
        let manager_addr: Address = env.storage().instance().get(&DataKey::Manager).unwrap();
        let manager_client = SyndicateManagerClient::new(&env, &manager_addr);
        let (fee_collector, fee_bps) = manager_client.get_fee_config();

        let token_addr: Address = env.storage().instance().get(&DataKey::Token).unwrap();
        let token_client = soroban_sdk::token::Client::new(&env, &token_addr);

        // Calculate and pay platform fee
        let fee_amount = (total_invested * (fee_bps as i128)) / 10000;
        let startup_amount = total_invested - fee_amount;

        if fee_amount > 0 {
            token_client.transfer(&env.current_contract_address(), &fee_collector, &fee_amount);
        }

        let startup: Address = env.storage().instance().get(&DataKey::Startup).unwrap();
        token_client.transfer(&env.current_contract_address(), &startup, &startup_amount);

        // Update State
        env.storage().instance().set(&DataKey::State, &PoolState::Funded);

        // Emit execute event
        env.events().publish(
            (symbol_short!("execute"), env.current_contract_address()),
            (total_invested, fee_amount)
        );
    }

    /// Cancel the deal pool (callable by Lead).
    pub fn cancel_deal(env: Env) {
        let lead: Address = env.storage().instance().get(&DataKey::Lead).unwrap();
        lead.require_auth();

        let state: PoolState = env.storage().instance().get(&DataKey::State).unwrap();
        if state != PoolState::Active {
            panic!("pool is not active");
        }

        env.storage().instance().set(&DataKey::State, &PoolState::Closed);

        env.events().publish(
            (symbol_short!("cancelled"), env.current_contract_address()),
            ()
        );
    }

    /// Investor withdraws deposit (only when pool is Closed/Cancelled).
    pub fn withdraw(env: Env, investor: Address) {
        investor.require_auth();

        let state: PoolState = env.storage().instance().get(&DataKey::State).unwrap();
        if state != PoolState::Closed {
            panic!("withdrawals only allowed on closed pools");
        }

        let key = DataKey::InvestorBalance(investor.clone());
        let balance: i128 = env.storage().persistent().get(&key).unwrap_or(0);
        if balance <= 0 {
            panic!("no deposit to withdraw");
        }

        let token_addr: Address = env.storage().instance().get(&DataKey::Token).unwrap();
        let token_client = soroban_sdk::token::Client::new(&env, &token_addr);

        token_client.transfer(&env.current_contract_address(), &investor, &balance);

        env.storage().persistent().set(&key, &0i128);

        env.events().publish(
            (symbol_short!("withdraw"), investor),
            balance
        );
    }

    /// Deposit returns/exit payments (only when pool is Funded).
    pub fn deposit_returns(env: Env, depositor: Address, amount: i128) {
        depositor.require_auth();
        if amount <= 0 {
            panic!("must deposit positive amount of returns");
        }

        let state: PoolState = env.storage().instance().get(&DataKey::State).unwrap();
        if state != PoolState::Funded {
            panic!("returns can only be deposited for funded deals");
        }

        let token_addr: Address = env.storage().instance().get(&DataKey::Token).unwrap();
        let token_client = soroban_sdk::token::Client::new(&env, &token_addr);

        token_client.transfer(&depositor, &env.current_contract_address(), &amount);

        let total_returns: i128 = env.storage().instance().get(&DataKey::TotalReturns).unwrap_or(0);
        env.storage().instance().set(&DataKey::TotalReturns, &(total_returns + amount));
        env.storage().instance().set(&DataKey::State, &PoolState::Distributed);

        env.events().publish(
            (symbol_short!("distrib"), env.current_contract_address()),
            amount
        );
    }

    /// Claim proportional return share (only when pool is Distributed).
    pub fn claim_returns(env: Env, investor: Address) {
        investor.require_auth();

        let state: PoolState = env.storage().instance().get(&DataKey::State).unwrap();
        if state != PoolState::Distributed {
            panic!("no returns distributed yet");
        }

        let balance_key = DataKey::InvestorBalance(investor.clone());
        let balance: i128 = env.storage().persistent().get(&balance_key).unwrap_or(0);
        if balance <= 0 {
            panic!("no pool balance to claim returns on");
        }

        let claimed_key = DataKey::InvestorClaimed(investor.clone());
        if env.storage().persistent().get::<_, bool>(&claimed_key).unwrap_or(false) {
            panic!("returns already claimed");
        }

        let total_invested: i128 = env.storage().instance().get(&DataKey::TotalInvested).unwrap();
        let total_returns: i128 = env.storage().instance().get(&DataKey::TotalReturns).unwrap();

        // Pro-rata return calculation
        let return_share = (balance * total_returns) / total_invested;

        if return_share > 0 {
            let token_addr: Address = env.storage().instance().get(&DataKey::Token).unwrap();
            let token_client = soroban_sdk::token::Client::new(&env, &token_addr);
            token_client.transfer(&env.current_contract_address(), &investor, &return_share);
        }

        env.storage().persistent().set(&claimed_key, &true);

        env.events().publish(
            (symbol_short!("claim"), investor),
            return_share
        );
    }
}

#[cfg(test)]
mod tests;

