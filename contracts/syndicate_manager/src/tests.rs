#![cfg(test)]
use super::*;
use soroban_sdk::{testutils::Address as _, Address, Env, BytesN};

#[test]
fn test_manager_admin_rbac() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let fee_collector = Address::generate(&env);
    let manager_address = env.register_contract(None, SyndicateManager);
    let client = SyndicateManagerClient::new(&env, &manager_address);

    client.initialize(&admin, &fee_collector, &200u32);

    assert_eq!(client.get_admin(), admin);
    
    // Check fee config
    let (collector, fee) = client.get_fee_config();
    assert_eq!(collector, fee_collector);
    assert_eq!(fee, 200u32);

    // Verify RBAC for Lead
    let lead = Address::generate(&env);
    assert_eq!(client.is_lead(&lead), false);

    client.add_lead(&lead);
    assert_eq!(client.is_lead(&lead), true);

    client.remove_lead(&lead);
    assert_eq!(client.is_lead(&lead), false);
}
