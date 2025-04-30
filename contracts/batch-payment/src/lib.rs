#![no_std]
use soroban_sdk::{
    contract, contractimpl, contracttype, log, Address, Env, Map, Symbol, Vec, BytesN, token, Val,
};

#[derive(Clone)]
#[contracttype]
pub struct Payment {
    pub destination: Address,
    pub amount: i128,
    pub asset: BytesN<32>,
    pub memo: Option<String>,
}

#[derive(Clone)]
#[contracttype]
pub struct Claim {
    pub id: BytesN<32>,
    pub destination: Address,
    pub amount: i128,
    pub asset: BytesN<32>,
    pub memo: Option<String>,
    pub status: Symbol,
    pub created_at: u64,
}

#[derive(Clone)]
#[contracttype]
pub struct AdminSettings {
    pub admin: Address,
    pub fee_percentage: u32,  // Represented as basis points (e.g., 100 = 1%)
    pub fee_address: Address,
}

#[derive(Clone)]
#[contracttype]
pub enum DataKey {
    Admin,                    // Storage for admin settings
    Claims,                   // Map of all claims
    ClaimsByStatus(Symbol),   // Lists of claim IDs by status
    ClaimsByDestination(Address), // Lists of claim IDs by destination
}

#[contract]
pub struct BatchPaymentContract;

#[contractimpl]
impl BatchPaymentContract {
    pub fn initialize(env: Env, admin: Address, fee_address: Address, fee_percentage: u32) {
        // Ensure contract is not already initialized
        if let Some(_) = env.storage().instance().get::<DataKey, AdminSettings>(&DataKey::Admin) {
            log!(&env, "Contract already initialized");
            return;
        }

        // Validate fee percentage is reasonable (max 10%)
        if fee_percentage > 1000 {
            panic!("Fee percentage too high, maximum is 10% (1000 basis points)");
        }

        // Store admin settings
        let admin_settings = AdminSettings {
            admin: admin.clone(),
            fee_address,
            fee_percentage,
        };
        env.storage().instance().set(&DataKey::Admin, &admin_settings);

        // Initialize empty collections
        env.storage().instance().set(&DataKey::Claims, &Map::<BytesN<32>, Claim>::new(&env));
        env.storage().instance().set(&DataKey::ClaimsByStatus(Symbol::new(&env, "pending")), &Vec::<BytesN<32>>::new(&env));
        env.storage().instance().set(&DataKey::ClaimsByStatus(Symbol::new(&env, "processed")), &Vec::<BytesN<32>>::new(&env));
        env.storage().instance().set(&DataKey::ClaimsByStatus(Symbol::new(&env, "failed")), &Vec::<BytesN<32>>::new(&env));

        log!(&env, "Contract initialized with admin: {}", admin);
    }

    pub fn create_claims(
        env: Env,
        sender: Address,
        destinations: Vec<Address>,
        amounts: Vec<i128>,
        asset: BytesN<32>,
        memos: Vec<Option<String>>,
    ) -> Vec<BytesN<32>> {
        self.check_auth(&env, &sender);

        // Validate input arrays have the same length
        let len = destinations.len();
        if amounts.len() != len || memos.len() != len {
            panic!("Destinations, amounts, and memos must have the same length");
        }

        // Get storage
        let mut claims = env.storage().instance().get::<DataKey, Map<BytesN<32>, Claim>>(&DataKey::Claims).unwrap();
        let mut pending_claims = env.storage().instance().get::<DataKey, Vec<BytesN<32>>>(&DataKey::ClaimsByStatus(Symbol::new(&env, "pending"))).unwrap();
        
        let mut claim_ids = Vec::new(&env);

        for i in 0..len {
            let destination = destinations.get(i).unwrap();
            let amount = amounts.get(i).unwrap();
            let memo = memos.get(i).unwrap();
            
            // Generate unique ID for the claim
            let id = env.crypto().sha256(&env.ledger().sequence().to_be_bytes());
            
            // Create claim record
            let claim = Claim {
                id: id.clone(),
                destination: destination.clone(),
                amount,
                asset: asset.clone(),
                memo,
                status: Symbol::new(&env, "pending"),
                created_at: env.ledger().timestamp(),
            };
            
            // Store the claim
            claims.set(id.clone(), claim);
            
            // Update indexes
            pending_claims.push_back(id.clone());
            
            // Add to destination index
            let key = DataKey::ClaimsByDestination(destination.clone());
            let mut dest_claims = if let Some(v) = env.storage().instance().get::<DataKey, Vec<BytesN<32>>>(&key) {
                v
            } else {
                Vec::new(&env)
            };
            dest_claims.push_back(id.clone());
            env.storage().instance().set(&key, &dest_claims);
            
            // Add to result
            claim_ids.push_back(id);
        }
        
        // Save updated collections
        env.storage().instance().set(&DataKey::Claims, &claims);
        env.storage().instance().set(&DataKey::ClaimsByStatus(Symbol::new(&env, "pending")), &pending_claims);
        
        claim_ids
    }

    pub fn process_claims(
        env: Env,
        sender: Address,
        claim_ids: Vec<BytesN<32>>,
    ) -> Vec<BytesN<32>> {
        self.check_auth(&env, &sender);
        
        // Get admin settings for fee calculation
        let admin_settings = env.storage().instance().get::<DataKey, AdminSettings>(&DataKey::Admin).unwrap();
        
        // Get storage
        let mut claims = env.storage().instance().get::<DataKey, Map<BytesN<32>, Claim>>(&DataKey::Claims).unwrap();
        let mut pending_claims = env.storage().instance().get::<DataKey, Vec<BytesN<32>>>(&DataKey::ClaimsByStatus(Symbol::new(&env, "pending"))).unwrap();
        let mut processed_claims = env.storage().instance().get::<DataKey, Vec<BytesN<32>>>(&DataKey::ClaimsByStatus(Symbol::new(&env, "processed"))).unwrap();
        let mut failed_claims = env.storage().instance().get::<DataKey, Vec<BytesN<32>>>(&DataKey::ClaimsByStatus(Symbol::new(&env, "failed"))).unwrap();
        
        let mut processed_ids = Vec::new(&env);
        
        for i in 0..claim_ids.len() {
            let id = claim_ids.get(i).unwrap();
            
            if let Some(mut claim) = claims.get(id.clone()) {
                // Only process pending claims
                if claim.status != Symbol::new(&env, "pending") {
                    continue;
                }
                
                // Try to transfer tokens
                let success = self.send_payment(
                    &env,
                    &sender,
                    &claim.destination,
                    claim.amount,
                    &claim.asset,
                    &admin_settings,
                );
                
                // Update claim status
                if success {
                    claim.status = Symbol::new(&env, "processed");
                    processed_claims.push_back(id.clone());
                    processed_ids.push_back(id.clone());
                } else {
                    claim.status = Symbol::new(&env, "failed");
                    failed_claims.push_back(id.clone());
                }
                
                // Remove from pending index
                for j in 0..pending_claims.len() {
                    if pending_claims.get(j).unwrap() == id {
                        pending_claims.remove(j);
                        break;
                    }
                }
                
                // Update claim in storage
                claims.set(id.clone(), claim);
            }
        }
        
        // Save updated collections
        env.storage().instance().set(&DataKey::Claims, &claims);
        env.storage().instance().set(&DataKey::ClaimsByStatus(Symbol::new(&env, "pending")), &pending_claims);
        env.storage().instance().set(&DataKey::ClaimsByStatus(Symbol::new(&env, "processed")), &processed_claims);
        env.storage().instance().set(&DataKey::ClaimsByStatus(Symbol::new(&env, "failed")), &failed_claims);
        
        processed_ids
    }

    pub fn get_claims_by_status(env: Env, status: Symbol) -> Vec<Claim> {
        let claims = env.storage().instance().get::<DataKey, Map<BytesN<32>, Claim>>(&DataKey::Claims).unwrap();
        let claim_ids = env.storage().instance().get::<DataKey, Vec<BytesN<32>>>(&DataKey::ClaimsByStatus(status.clone())).unwrap();
        
        let mut result = Vec::new(&env);
        for i in 0..claim_ids.len() {
            let id = claim_ids.get(i).unwrap();
            if let Some(claim) = claims.get(id) {
                result.push_back(claim);
            }
        }
        
        result
    }

    pub fn get_claims_by_destination(env: Env, destination: Address) -> Vec<Claim> {
        let claims = env.storage().instance().get::<DataKey, Map<BytesN<32>, Claim>>(&DataKey::Claims).unwrap();
        let key = DataKey::ClaimsByDestination(destination.clone());
        
        if let Some(claim_ids) = env.storage().instance().get::<DataKey, Vec<BytesN<32>>>(&key) {
            let mut result = Vec::new(&env);
            for i in 0..claim_ids.len() {
                let id = claim_ids.get(i).unwrap();
                if let Some(claim) = claims.get(id) {
                    result.push_back(claim);
                }
            }
            return result;
        }
        
        Vec::new(&env)
    }

    pub fn get_claim(env: Env, id: BytesN<32>) -> Option<Claim> {
        let claims = env.storage().instance().get::<DataKey, Map<BytesN<32>, Claim>>(&DataKey::Claims).unwrap();
        claims.get(id)
    }

    pub fn update_admin_settings(
        env: Env,
        sender: Address,
        new_admin: Option<Address>,
        new_fee_address: Option<Address>,
        new_fee_percentage: Option<u32>,
    ) {
        // Only current admin can update settings
        let mut settings = env.storage().instance().get::<DataKey, AdminSettings>(&DataKey::Admin).unwrap();
        self.check_admin(&env, &sender, &settings.admin);
        
        // Update fields that were provided
        if let Some(admin) = new_admin {
            settings.admin = admin;
        }
        
        if let Some(fee_address) = new_fee_address {
            settings.fee_address = fee_address;
        }
        
        if let Some(fee_percentage) = new_fee_percentage {
            // Validate fee percentage is reasonable (max 10%)
            if fee_percentage > 1000 {
                panic!("Fee percentage too high, maximum is 10% (1000 basis points)");
            }
            settings.fee_percentage = fee_percentage;
        }
        
        // Save updated settings
        env.storage().instance().set(&DataKey::Admin, &settings);
        
        log!(&env, "Admin settings updated");
    }

    fn check_auth(&self, env: &Env, sender: &Address) {
        sender.require_auth();
        
        // Check if sender is initialized, if not - initialize empty storage
        if env.storage().instance().get::<DataKey, AdminSettings>(&DataKey::Admin).is_none() {
            // Initialize with default settings
            let admin_settings = AdminSettings {
                admin: sender.clone(),
                fee_address: sender.clone(),
                fee_percentage: 0, // No fee by default
            };
            env.storage().instance().set(&DataKey::Admin, &admin_settings);
            
            // Initialize empty collections
            env.storage().instance().set(&DataKey::Claims, &Map::<BytesN<32>, Claim>::new(env));
            env.storage().instance().set(&DataKey::ClaimsByStatus(Symbol::new(env, "pending")), &Vec::<BytesN<32>>::new(env));
            env.storage().instance().set(&DataKey::ClaimsByStatus(Symbol::new(env, "processed")), &Vec::<BytesN<32>>::new(env));
            env.storage().instance().set(&DataKey::ClaimsByStatus(Symbol::new(env, "failed")), &Vec::<BytesN<32>>::new(env));
            
            log!(env, "Contract initialized with default settings");
        }
    }

    fn check_admin(&self, env: &Env, sender: &Address, admin: &Address) {
        sender.require_auth();
        
        // Check if sender is admin
        if sender != admin {
            panic!("Only admin can perform this operation");
        }
    }

    fn send_payment(
        &self,
        env: &Env,
        sender: &Address,
        destination: &Address,
        amount: i128,
        asset: &BytesN<32>,
        admin_settings: &AdminSettings,
    ) -> bool {
        // Calculate fee if applicable
        let fee = if admin_settings.fee_percentage > 0 {
            (amount * (admin_settings.fee_percentage as i128)) / 10000
        } else {
            0
        };
        
        let payment_amount = amount - fee;
        
        // Require authorization from the sender
        sender.require_auth();
        
        // Create token client
        let token_client = token::Client::new(env, asset);
        
        // Try to transfer tokens to the destination
        match token_client.transfer(sender, destination, payment_amount) {
            Ok(_) => {
                // If fee is applicable, send it to the fee address
                if fee > 0 {
                    match token_client.transfer(sender, &admin_settings.fee_address, fee) {
                        Ok(_) => {},
                        Err(e) => {
                            log!(env, "Failed to transfer fee: {:?}", e);
                            // We still consider the payment successful even if fee transfer fails
                        }
                    }
                }
                true
            },
            Err(e) => {
                log!(env, "Failed to transfer payment: {:?}", e);
                false
            }
        }
    }
}

#[cfg(test)]
mod test {
    use super::*;
    use soroban_sdk::{testutils::{Address as _, BytesN as _}, vec, map};

    #[test]
    fn test_initialize() {
        let env = Env::default();
        let contract_id = env.register_contract(None, BatchPaymentContract);
        let client = BatchPaymentContractClient::new(&env, &contract_id);

        let admin = Address::random(&env);
        let fee_address = Address::random(&env);
        
        // Initialize contract
        client.initialize(&admin, &fee_address, 100);
        
        // Try to initialize again (should not panic, but do nothing)
        client.initialize(&admin, &fee_address, 200);
    }

    #[test]
    fn test_create_and_process_claims() {
        let env = Env::default();
        let contract_id = env.register_contract(None, BatchPaymentContract);
        let client = BatchPaymentContractClient::new(&env, &contract_id);

        let admin = Address::random(&env);
        let fee_address = Address::random(&env);
        let asset = BytesN::random(&env);
        
        // Create token contract for testing
        let token_id = env.register_stellar_asset_contract(asset.clone());
        
        // Initialize contract
        client.initialize(&admin, &fee_address, 100);
        
        // Create test data
        let destinations = vec![
            &env,
            Address::random(&env),
            Address::random(&env),
        ];
        let amounts = vec![&env, 100, 200];
        let memos = vec![
            &env,
            Some("Memo 1".to_string()),
            Some("Memo 2".to_string()),
        ];
        
        // Create claims
        let claim_ids = client.create_claims(&admin, &destinations, &amounts, &asset, &memos);
        assert_eq!(claim_ids.len(), 2);
        
        // Check claims were created
        let pending_claims = client.get_claims_by_status(&Symbol::new(&env, "pending"));
        assert_eq!(pending_claims.len(), 2);
        
        // Process claims (will fail since we haven't funded the admin account)
        let processed_ids = client.process_claims(&admin, &claim_ids);
        assert_eq!(processed_ids.len(), 0);
        
        // Check claims were marked as failed
        let failed_claims = client.get_claims_by_status(&Symbol::new(&env, "failed"));
        assert_eq!(failed_claims.len(), 2);
    }

    #[test]
    fn test_admin_settings() {
        let env = Env::default();
        let contract_id = env.register_contract(None, BatchPaymentContract);
        let client = BatchPaymentContractClient::new(&env, &contract_id);

        let admin = Address::random(&env);
        let fee_address = Address::random(&env);
        
        // Initialize contract
        client.initialize(&admin, &fee_address, 100);
        
        // Update admin settings
        let new_admin = Address::random(&env);
        let new_fee_address = Address::random(&env);
        client.update_admin_settings(&admin, Some(new_admin.clone()), Some(new_fee_address.clone()), Some(200));
        
        // Try to update again with old admin (should fail)
        let result = std::panic::catch_unwind(|| {
            client.update_admin_settings(&admin, None, None, Some(300));
        });
        assert!(result.is_err());
    }
}