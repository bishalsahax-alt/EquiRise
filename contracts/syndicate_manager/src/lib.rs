#![no_std]
use soroban_sdk::{
    contract, contractimpl, contracttype, symbol_short, Address, BytesN, Env, IntoVal, Symbol, Val
};

#[derive(Clone)]
#[contracttype]
pub enum DataKey {
    Admin,
    WasmHash,
    PoolCount,
    IsLead(Address),
    PlatformFee,    // platform fee in basis points, e.g. 200 for 2%
    FeeCollector,   // address where platform fee is sent
}

#[contract]
pub struct SyndicateManager;

#[contractimpl]
impl SyndicateManager {
    /// Initialize the manager with an admin and fee configurations.
    pub fn initialize(env: Env, admin: Address, fee_collector: Address, platform_fee: u32) {
        if env.storage().instance().has(&DataKey::Admin) {
            panic!("already initialized");
        }
        if platform_fee > 10000 {
            panic!("fee cannot exceed 100%");
        }
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::FeeCollector, &fee_collector);
        env.storage().instance().set(&DataKey::PlatformFee, &platform_fee);
        env.storage().instance().set(&DataKey::PoolCount, &0u32);
    }

    /// Retrieve the current admin address.
    pub fn get_admin(env: Env) -> Address {
        env.storage()
            .instance()
            .get(&DataKey::Admin)
            .unwrap_or_else(|| panic!("not initialized"))
    }

    /// Update the platform admin (only callable by current admin).
    pub fn set_admin(env: Env, new_admin: Address) {
        let admin = Self::get_admin(env.clone());
        admin.require_auth();
        env.storage().instance().set(&DataKey::Admin, &new_admin);
    }

    /// Add a lead investor to the approved list (only callable by admin).
    pub fn add_lead(env: Env, lead: Address) {
        let admin = Self::get_admin(env.clone());
        admin.require_auth();
        env.storage().instance().set(&DataKey::IsLead(lead.clone()), &true);
        
        env.events().publish(
            (symbol_short!("lead_add"), lead),
            ()
        );
    }

    /// Remove a lead investor (only callable by admin).
    pub fn remove_lead(env: Env, lead: Address) {
        let admin = Self::get_admin(env.clone());
        admin.require_auth();
        env.storage().instance().set(&DataKey::IsLead(lead.clone()), &false);
        
        env.events().publish(
            (symbol_short!("lead_rem"), lead),
            ()
        );
    }

    /// Check if an address is an approved lead investor.
    pub fn is_lead(env: Env, address: Address) -> bool {
        env.storage()
            .instance()
            .get(&DataKey::IsLead(address))
            .unwrap_or(false)
    }

    /// Set the WASM hash of the Deal Pool contract to deploy (only callable by admin).
    pub fn set_wasm_hash(env: Env, wasm_hash: BytesN<32>) {
        let admin = Self::get_admin(env.clone());
        admin.require_auth();
        env.storage().instance().set(&DataKey::WasmHash, &wasm_hash);
    }

    /// Get the current Deal Pool WASM hash.
    pub fn get_wasm_hash(env: Env) -> BytesN<32> {
        env.storage()
            .instance()
            .get(&DataKey::WasmHash)
            .unwrap_or_else(|| panic!("wasm hash not set"))
    }

    /// Update fee configuration (only callable by admin).
    pub fn set_fee_config(env: Env, fee_collector: Address, platform_fee: u32) {
        let admin = Self::get_admin(env.clone());
        admin.require_auth();
        if platform_fee > 10000 {
            panic!("fee cannot exceed 100%");
        }
        env.storage().instance().set(&DataKey::FeeCollector, &fee_collector);
        env.storage().instance().set(&DataKey::PlatformFee, &platform_fee);
    }

    /// Retrieve the fee configuration: (fee_collector, platform_fee)
    pub fn get_fee_config(env: Env) -> (Address, u32) {
        let collector: Address = env.storage().instance().get(&DataKey::FeeCollector).unwrap();
        let fee: u32 = env.storage().instance().get(&DataKey::PlatformFee).unwrap();
        (collector, fee)
    }

    /// Deploy a new Deal Pool contract.
    /// Only callable by approved lead investors.
    pub fn deploy_pool(
        env: Env,
        lead: Address,
        startup: Address,
        token: Address,
        target_amount: i128,
        min_invest: i128,
        max_invest: i128,
    ) -> Address {
        lead.require_auth();
        if !Self::is_lead(env.clone(), lead.clone()) {
            panic!("not approved lead investor");
        }

        let wasm_hash = Self::get_wasm_hash(env.clone());
        let pool_count: u32 = env.storage().instance().get(&DataKey::PoolCount).unwrap_or(0);
        
        // Use pool count as salt to ensure unique address deployment.
        let mut salt_bytes = [0u8; 32];
        salt_bytes[0..4].copy_from_slice(&pool_count.to_be_bytes());
        let salt = BytesN::from_array(&env, &salt_bytes);

        // Deploy the contract.
        let pool_id = env.deployer().with_current_contract(salt).deploy(wasm_hash);

        // Inter-contract call: initialize the deal pool.
        env.invoke_contract::<()>(
            &pool_id,
            &Symbol::new(&env, "initialize"),
            (
                lead.clone(),
                startup,
                token,
                target_amount,
                min_invest,
                max_invest,
                env.current_contract_address(), // passing manager address for fee/config queries
            )
                .into_val(&env),
        );

        // Increment pool count.
        env.storage().instance().set(&DataKey::PoolCount, &(pool_count + 1));

        // Emit deploy event.
        env.events().publish(
            (symbol_short!("deployed"), lead, pool_id.clone()),
            (target_amount, min_invest, max_invest)
        );

        pool_id
    }

    /// Upgrade contract code (only admin).
    pub fn upgrade(env: Env, new_wasm_hash: BytesN<32>) {
        let admin = Self::get_admin(env.clone());
        admin.require_auth();
        env.deployer().update_current_contract_wasm(new_wasm_hash);
    }
}

#[cfg(test)]
mod tests;

