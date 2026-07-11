#![cfg(test)]
use super::*;
use soroban_sdk::{
    contract, contractimpl, testutils::Address as _, Address, Env, IntoVal
};

// Mock Syndicate Manager for inter-contract testing
#[contract]
pub struct MockManager;

#[contractimpl]
impl MockManager {
    pub fn get_fee_config(env: Env) -> (Address, u32) {
        // Return a mock collector address and a 2% (200 BPS) platform fee
        let collector = Address::generate(&env);
        (collector, 200u32)
    }
}

#[test]
fn test_pool_initialization() {
    let env = Env::default();
    env.mock_all_auths();

    let lead = Address::generate(&env);
    let startup = Address::generate(&env);
    let token = Address::generate(&env);
    let manager = Address::generate(&env);

    let pool_address = env.register_contract(None, DealPool);
    let pool_client = DealPoolClient::new(&env, &pool_address);

    pool_client.initialize(&lead, &startup, &token, &10000i128, &100i128, &1000i128, &manager);

    let (m_lead, m_startup, m_token, m_target, m_min, m_max, m_state, m_invested, m_returns) = pool_client.get_metadata();
    
    assert_eq!(m_lead, lead);
    assert_eq!(m_startup, startup);
    assert_eq!(m_token, token);
    assert_eq!(m_target, 10000i128);
    assert_eq!(m_min, 100i128);
    assert_eq!(m_max, 1000i128);
    assert_eq!(m_state, PoolState::Active as u32);
    assert_eq!(m_invested, 0i128);
    assert_eq!(m_returns, 0i128);
}

#[test]
fn test_deposit_and_execute_deal() {
    let env = Env::default();
    env.mock_all_auths();

    let lead = Address::generate(&env);
    let startup = Address::generate(&env);
    let manager_addr = env.register_contract(None, MockManager);

    // Register standard Stellar Asset Contract (SAC) token
    let token_admin = Address::generate(&env);
    let token_addr = env.register_stellar_asset_contract(token_admin);
    let token_client = soroban_sdk::token::Client::new(&env, &token_addr);
    let token_admin_client = soroban_sdk::token::StellarAssetClient::new(&env, &token_addr);

    // Deploy Deal Pool
    let pool_address = env.register_contract(None, DealPool);
    let pool_client = DealPoolClient::new(&env, &pool_address);

    // Target = 1000, Min = 100, Max = 1000
    pool_client.initialize(&lead, &startup, &token_addr, &1000i128, &100i128, &1000i128, &manager_addr);

    // Create investors and mint tokens
    let investor_1 = Address::generate(&env);
    let investor_2 = Address::generate(&env);

    token_admin_client.mint(&investor_1, &600i128);
    token_admin_client.mint(&investor_2, &400i128);

    assert_eq!(token_client.balance(&investor_1), 600i128);
    assert_eq!(token_client.balance(&investor_2), 400i128);

    // Deposits
    pool_client.deposit(&investor_1, &600i128);
    pool_client.deposit(&investor_2, &400i128);

    assert_eq!(pool_client.get_balance(&investor_1), 600i128);
    assert_eq!(pool_client.get_balance(&investor_2), 400i128);
    
    let (_, _, _, _, _, _, state, invested, _) = pool_client.get_metadata();
    assert_eq!(invested, 1000i128);
    assert_eq!(state, PoolState::Active as u32);

    // Execute deal (requires target of 1000 to be met, which it is)
    pool_client.execute_deal();

    let (_, _, _, _, _, _, state_after, _, _) = pool_client.get_metadata();
    assert_eq!(state_after, PoolState::Funded as u32);

    // Platform fee collector gets 2% (20 BPS) of 1000 = 20 tokens
    // Startup gets remaining 980 tokens
    assert_eq!(token_client.balance(&startup), 980i128);
    assert_eq!(token_client.balance(&pool_address), 0i128);
}

#[test]
fn test_cancel_and_withdraw() {
    let env = Env::default();
    env.mock_all_auths();

    let lead = Address::generate(&env);
    let startup = Address::generate(&env);
    let manager = Address::generate(&env);
    let token_admin = Address::generate(&env);
    let token_addr = env.register_stellar_asset_contract(token_admin);
    let token_client = soroban_sdk::token::Client::new(&env, &token_addr);
    let token_admin_client = soroban_sdk::token::StellarAssetClient::new(&env, &token_addr);

    let pool_address = env.register_contract(None, DealPool);
    let pool_client = DealPoolClient::new(&env, &pool_address);

    pool_client.initialize(&lead, &startup, &token_addr, &1000i128, &100i128, &1000i128, &manager);

    let investor = Address::generate(&env);
    token_admin_client.mint(&investor, &500i128);

    pool_client.deposit(&investor, &500i128);
    assert_eq!(token_client.balance(&investor), 0i128);

    // Cancel deal
    pool_client.cancel_deal();

    let (_, _, _, _, _, _, state, _, _) = pool_client.get_metadata();
    assert_eq!(state, PoolState::Closed as u32);

    // Withdraw deposit
    pool_client.withdraw(&investor);
    assert_eq!(token_client.balance(&investor), 500i128);
    assert_eq!(pool_client.get_balance(&investor), 0i128);
}

#[test]
fn test_distribute_returns() {
    let env = Env::default();
    env.mock_all_auths();

    let lead = Address::generate(&env);
    let startup = Address::generate(&env);
    let manager_addr = env.register_contract(None, MockManager);
    let token_admin = Address::generate(&env);
    let token_addr = env.register_stellar_asset_contract(token_admin);
    let token_client = soroban_sdk::token::Client::new(&env, &token_addr);
    let token_admin_client = soroban_sdk::token::StellarAssetClient::new(&env, &token_addr);

    let pool_address = env.register_contract(None, DealPool);
    let pool_client = DealPoolClient::new(&env, &pool_address);

    pool_client.initialize(&lead, &startup, &token_addr, &1000i128, &100i128, &1000i128, &manager_addr);

    let investor_1 = Address::generate(&env);
    let investor_2 = Address::generate(&env);
    token_admin_client.mint(&investor_1, &750i128);
    token_admin_client.mint(&investor_2, &250i128);

    pool_client.deposit(&investor_1, &750i128);
    pool_client.deposit(&investor_2, &250i128);

    pool_client.execute_deal();

    // Startup yields returns (e.g. 2000 tokens returns)
    let returns_provider = Address::generate(&env);
    token_admin_client.mint(&returns_provider, &2000i128);

    // Deposit returns to the pool
    pool_client.deposit_returns(&returns_provider, &2000i128);

    let (_, _, _, _, _, _, state, _, returns_total) = pool_client.get_metadata();
    assert_eq!(state, PoolState::Distributed as u32);
    assert_eq!(returns_total, 2000i128);

    // Claim returns
    // Investor 1 share = (750 * 2000) / 1000 = 1500
    // Investor 2 share = (250 * 2000) / 1000 = 500
    pool_client.claim_returns(&investor_1);
    pool_client.claim_returns(&investor_2);

    assert_eq!(token_client.balance(&investor_1), 1500i128);
    assert_eq!(token_client.balance(&investor_2), 500i128);
}
