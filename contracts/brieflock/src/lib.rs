use near_sdk::borsh::{BorshDeserialize, BorshSerialize};
use near_sdk::collections::UnorderedMap;
use near_sdk::json_types::{U128, U64};
use near_sdk::serde::{Deserialize, Serialize};
use near_sdk::{
    assert_one_yocto, env, near, require, AccountId, BorshStorageKey, Gas, NearToken,
    PanicOnDefault, Promise,
};

const SCHEMA_VERSION: u32 = 1;
const TERMS_VERSION: u32 = 1;
const MAX_LIST_LIMIT: u64 = 50;
const MIN_STORAGE_RESERVE_YOCTO: u128 = 20_000_000_000_000_000_000_000;
const CALLBACK_GAS: Gas = Gas::from_tgas(30);

#[derive(BorshSerialize, BorshStorageKey)]
enum StorageKey {
    Milestones,
}

#[derive(BorshDeserialize, BorshSerialize, Clone, Copy, PartialEq, Eq)]
enum MilestoneStatus {
    Funded,
    Submitted,
    Approved,
    PayoutPending,
    RefundPending,
    Paid,
    Refunded,
}

#[derive(BorshDeserialize, BorshSerialize, Clone, Copy, PartialEq, Eq)]
enum SettlementKind {
    Payout,
    Refund,
}

#[derive(BorshDeserialize, BorshSerialize, Clone)]
struct PendingSettlement {
    attempt_id: u64,
    kind: SettlementKind,
    amount_yocto: u128,
    recipient: AccountId,
    restore_status: MilestoneStatus,
}

#[derive(BorshDeserialize, BorshSerialize, Clone)]
struct Milestone {
    schema_version: u32,
    terms_version: u32,
    client_id: AccountId,
    creator_id: AccountId,
    amount_yocto: u128,
    brief_hash: String,
    created_at_ns: u64,
    submit_by_ns: u64,
    review_until_ns: u64,
    status: MilestoneStatus,
    delivery_version: u64,
    delivery_hash: Option<String>,
    submitted_at_ns: Option<u64>,
    approved_version: Option<u64>,
    approved_hash: Option<String>,
    approved_at_ns: Option<u64>,
    pending: Option<PendingSettlement>,
    next_attempt_id: u64,
    storage_reserve_yocto: u128,
    last_settlement_error: Option<String>,
}

#[derive(Serialize, Deserialize, Clone, Copy, PartialEq, Eq, Debug)]
#[serde(crate = "near_sdk::serde")]
pub enum MilestoneStatusView {
    Funded,
    Submitted,
    Approved,
    PayoutPending,
    RefundPending,
    Paid,
    Refunded,
}

#[derive(Serialize, Deserialize, Clone, Copy, PartialEq, Eq)]
#[serde(crate = "near_sdk::serde")]
pub enum SettlementKindView {
    Payout,
    Refund,
}

#[derive(Serialize, Deserialize, Clone)]
#[serde(crate = "near_sdk::serde")]
pub struct MilestoneView {
    pub milestone_id: String,
    pub schema_version: u32,
    pub terms_version: u32,
    pub client_id: AccountId,
    pub creator_id: AccountId,
    pub amount_yocto: U128,
    pub brief_hash: String,
    pub created_at_ns: U64,
    pub submit_by_ns: U64,
    pub review_until_ns: U64,
    pub status: MilestoneStatusView,
    pub delivery_version: Option<U64>,
    pub delivery_hash: Option<String>,
    pub submitted_at_ns: Option<U64>,
    pub approved_version: Option<U64>,
    pub approved_hash: Option<String>,
    pub approved_at_ns: Option<U64>,
    pub pending_attempt_id: Option<U64>,
    pub pending_kind: Option<SettlementKindView>,
    pub pending_amount_yocto: Option<U128>,
    pub pending_recipient: Option<AccountId>,
    pub storage_reserve_yocto: U128,
    pub last_settlement_error: Option<String>,
}

#[derive(Serialize, Deserialize, Clone)]
#[serde(crate = "near_sdk::serde")]
pub struct ContractConfigView {
    pub schema_version: u32,
    pub terms_version: u32,
    pub min_storage_reserve_yocto: U128,
    pub storage_byte_cost_yocto: U128,
    pub contract_id: AccountId,
}

#[derive(Serialize)]
#[serde(crate = "near_sdk::serde")]
struct SettlementCallbackArgs {
    milestone_id: String,
    attempt_id: U64,
}

#[near(contract_state)]
#[derive(PanicOnDefault)]
pub struct Contract {
    milestones: UnorderedMap<String, Milestone>,
}

#[near]
impl Contract {
    #[init]
    pub fn new() -> Self {
        Self {
            milestones: UnorderedMap::new(StorageKey::Milestones),
        }
    }

    /// Atomically creates a funded commission. The attached amount must include the principal
    /// plus a separate storage reserve. Terms are never mutable after this call.
    #[payable]
    pub fn create_and_fund(
        &mut self,
        milestone_id: String,
        creator_id: AccountId,
        amount_yocto: U128,
        brief_hash: String,
        submit_by_ns: U64,
        review_until_ns: U64,
    ) {
        validate_milestone_id(&milestone_id);
        validate_hash(&brief_hash, "brief_hash");
        require!(
            creator_id != env::current_account_id(),
            "Contract cannot be the creator"
        );
        require!(
            self.milestones.get(&milestone_id).is_none(),
            "Milestone ID already exists"
        );

        let now = env::block_timestamp();
        let submit_by = submit_by_ns.0;
        let review_until = review_until_ns.0;
        require!(now < submit_by, "submit_by_ns must be in the future");
        require!(
            submit_by < review_until,
            "review_until_ns must be after submit_by_ns"
        );

        let amount = amount_yocto.0;
        require!(amount > 0, "Principal must be positive");
        let attached = env::attached_deposit().as_yoctonear();
        require!(attached >= amount, "Attached deposit is below principal");
        let storage_reserve = attached - amount;
        require!(
            storage_reserve >= MIN_STORAGE_RESERVE_YOCTO,
            "Attach a separate storage reserve of at least 0.02 NEAR"
        );

        let milestone = Milestone {
            schema_version: SCHEMA_VERSION,
            terms_version: TERMS_VERSION,
            client_id: env::predecessor_account_id(),
            creator_id,
            amount_yocto: amount,
            brief_hash,
            created_at_ns: now,
            submit_by_ns: submit_by,
            review_until_ns: review_until,
            status: MilestoneStatus::Funded,
            delivery_version: 0,
            delivery_hash: None,
            submitted_at_ns: None,
            approved_version: None,
            approved_hash: None,
            approved_at_ns: None,
            pending: None,
            next_attempt_id: 1,
            storage_reserve_yocto: storage_reserve,
            last_settlement_error: None,
        };

        let storage_before = env::storage_usage();
        self.save_milestone(&milestone_id, milestone, storage_before);
        env::log_str(&format!("brieflock:funded:{milestone_id}"));
    }

    /// Records a new creator delivery commitment. The version must be optimistic-concurrency
    /// checked by the caller so a stale creator UI cannot overwrite a newer submission.
    #[payable]
    pub fn submit_delivery(
        &mut self,
        milestone_id: String,
        expected_previous_version: U64,
        delivery_hash: String,
    ) {
        assert_one_yocto();
        validate_hash(&delivery_hash, "delivery_hash");

        let mut milestone = self.get_milestone_internal(&milestone_id);
        require!(
            env::predecessor_account_id() == milestone.creator_id,
            "Only the fixed creator can submit delivery"
        );
        require!(
            matches!(
                milestone.status,
                MilestoneStatus::Funded | MilestoneStatus::Submitted
            ),
            "Delivery cannot be changed in the current state"
        );
        require!(
            milestone.pending.is_none(),
            "Settlement is pending; mutable actions are blocked"
        );
        require!(
            env::block_timestamp() < milestone.submit_by_ns,
            "Submission deadline passed"
        );
        require!(
            expected_previous_version.0 == milestone.delivery_version,
            "Optimistic version conflict"
        );

        milestone.delivery_version = milestone
            .delivery_version
            .checked_add(1)
            .expect("Delivery version overflow");
        milestone.delivery_hash = Some(delivery_hash);
        milestone.submitted_at_ns = Some(env::block_timestamp());
        milestone.approved_version = None;
        milestone.approved_hash = None;
        milestone.approved_at_ns = None;
        milestone.status = MilestoneStatus::Submitted;
        milestone.last_settlement_error = None;

        let storage_before = env::storage_usage();
        self.save_milestone(&milestone_id, milestone, storage_before);
        env::log_str(&format!("brieflock:delivery_submitted:{milestone_id}"));
    }

    /// Approves only the exact current version and digest. One yocto prevents a function-call
    /// access key from silently exercising this human-authority method.
    #[payable]
    pub fn approve_delivery(&mut self, milestone_id: String, version: U64, delivery_hash: String) {
        assert_one_yocto();
        validate_hash(&delivery_hash, "delivery_hash");

        let mut milestone = self.get_milestone_internal(&milestone_id);
        require!(
            env::predecessor_account_id() == milestone.client_id,
            "Only the original client can approve"
        );
        require!(
            milestone.status == MilestoneStatus::Submitted,
            "Delivery is not awaiting approval"
        );
        require!(milestone.pending.is_none(), "Settlement is pending");
        require!(
            env::block_timestamp() < milestone.review_until_ns,
            "Review deadline passed"
        );
        require!(
            milestone.delivery_version == version.0,
            "Delivery version is stale"
        );
        require!(
            milestone.delivery_hash.as_deref() == Some(delivery_hash.as_str()),
            "Delivery hash mismatch"
        );

        milestone.approved_version = Some(version.0);
        milestone.approved_hash = Some(delivery_hash);
        milestone.approved_at_ns = Some(env::block_timestamp());
        milestone.status = MilestoneStatus::Approved;

        let storage_before = env::storage_usage();
        self.save_milestone(&milestone_id, milestone, storage_before);
        env::log_str(&format!("brieflock:approved:{milestone_id}"));
    }

    /// Starts a single permissionless settlement. Destination and amount are read from stored
    /// terms; the method accepts neither a recipient nor an amount override.
    pub fn release(
        &mut self,
        milestone_id: String,
        version: U64,
        delivery_hash: String,
    ) -> Promise {
        validate_hash(&delivery_hash, "delivery_hash");
        let mut milestone = self.get_milestone_internal(&milestone_id);
        require!(
            milestone.status == MilestoneStatus::Approved,
            "Commission is not approved"
        );
        require!(milestone.pending.is_none(), "Settlement is already pending");
        require!(
            milestone.approved_version == Some(version.0),
            "Approved version mismatch"
        );
        require!(
            milestone.approved_hash.as_deref() == Some(delivery_hash.as_str()),
            "Approved hash mismatch"
        );

        let attempt_id = milestone.next_attempt_id;
        milestone.next_attempt_id = milestone
            .next_attempt_id
            .checked_add(1)
            .expect("Attempt ID overflow");
        let recipient = milestone.creator_id.clone();
        let amount = milestone.amount_yocto;
        milestone.pending = Some(PendingSettlement {
            attempt_id,
            kind: SettlementKind::Payout,
            amount_yocto: amount,
            recipient: recipient.clone(),
            restore_status: MilestoneStatus::Approved,
        });
        milestone.status = MilestoneStatus::PayoutPending;
        milestone.last_settlement_error = None;

        let storage_before = env::storage_usage();
        self.save_milestone(&milestone_id, milestone, storage_before);
        env::log_str(&format!(
            "brieflock:payout_pending:{milestone_id}:{attempt_id}"
        ));
        settlement_promise(milestone_id, attempt_id, recipient, amount)
    }

    /// Refunds an unapproved commission after its applicable boundary. The original client is
    /// the only refund authority in this MVP.
    #[payable]
    pub fn refund_expired(&mut self, milestone_id: String) -> Promise {
        assert_one_yocto();
        let mut milestone = self.get_milestone_internal(&milestone_id);
        require!(
            env::predecessor_account_id() == milestone.client_id,
            "Only the client can refund"
        );
        require!(milestone.pending.is_none(), "Settlement is already pending");

        let now = env::block_timestamp();
        let eligible = match milestone.status {
            MilestoneStatus::Funded => now >= milestone.submit_by_ns,
            MilestoneStatus::Submitted => now >= milestone.review_until_ns,
            _ => false,
        };
        require!(eligible, "Refund boundary has not been reached");
        self.begin_refund(&mut milestone);

        let recipient = milestone.client_id.clone();
        let amount = milestone.amount_yocto;
        let attempt_id = milestone
            .pending
            .as_ref()
            .expect("Pending refund missing")
            .attempt_id;
        let storage_before = env::storage_usage();
        self.save_milestone(&milestone_id, milestone, storage_before);
        env::log_str(&format!(
            "brieflock:refund_pending:{milestone_id}:{attempt_id}"
        ));
        settlement_promise(milestone_id, attempt_id, recipient, amount)
    }

    /// Lets the creator cancel before approval, returning principal only to the original client.
    #[payable]
    pub fn creator_cancel(&mut self, milestone_id: String) -> Promise {
        assert_one_yocto();
        let mut milestone = self.get_milestone_internal(&milestone_id);
        require!(
            env::predecessor_account_id() == milestone.creator_id,
            "Only the creator can cancel"
        );
        require!(
            matches!(
                milestone.status,
                MilestoneStatus::Funded | MilestoneStatus::Submitted
            ),
            "Approved or terminal work cannot be cancelled"
        );
        require!(milestone.pending.is_none(), "Settlement is already pending");
        self.begin_refund(&mut milestone);

        let recipient = milestone.client_id.clone();
        let amount = milestone.amount_yocto;
        let attempt_id = milestone
            .pending
            .as_ref()
            .expect("Pending refund missing")
            .attempt_id;
        let storage_before = env::storage_usage();
        self.save_milestone(&milestone_id, milestone, storage_before);
        env::log_str(&format!(
            "brieflock:creator_cancel_pending:{milestone_id}:{attempt_id}"
        ));
        settlement_promise(milestone_id, attempt_id, recipient, amount)
    }

    /// Resolves exactly one pending transfer. This is private and checks the attempt ID so stale
    /// callbacks cannot mutate a newer settlement attempt.
    #[private]
    pub fn on_settlement(&mut self, milestone_id: String, attempt_id: U64) {
        require!(
            env::promise_results_count() == 1,
            "Expected one transfer result"
        );
        let mut milestone = self.get_milestone_internal(&milestone_id);
        let Some(pending) = milestone.pending.clone() else {
            return;
        };
        if pending.attempt_id != attempt_id.0 {
            return;
        }

        let succeeded = env::promise_result_checked(0, 1024).is_ok();
        if succeeded {
            milestone.status = match pending.kind {
                SettlementKind::Payout => MilestoneStatus::Paid,
                SettlementKind::Refund => MilestoneStatus::Refunded,
            };
            milestone.last_settlement_error = None;
        } else {
            milestone.status = pending.restore_status;
            milestone.last_settlement_error =
                Some("Transfer failed; principal remains claimable.".to_string());
        }
        milestone.pending = None;

        let storage_before = env::storage_usage();
        self.save_milestone(&milestone_id, milestone, storage_before);
        env::log_str(&format!(
            "brieflock:settlement_resolved:{milestone_id}:{succeeded}"
        ));
    }

    pub fn get_milestone(&self, milestone_id: String) -> Option<MilestoneView> {
        self.milestones
            .get(&milestone_id)
            .map(|milestone| to_view(milestone_id, &milestone))
    }

    pub fn list_milestones(&self, from_index: U64, limit: U64) -> Vec<MilestoneView> {
        require!(limit.0 <= MAX_LIST_LIMIT, "Limit exceeds 50");
        self.milestones
            .keys()
            .skip(from_index.0 as usize)
            .take(limit.0 as usize)
            .filter_map(|id| {
                self.milestones
                    .get(&id)
                    .map(|milestone| to_view(id, &milestone))
            })
            .collect()
    }

    pub fn get_config(&self) -> ContractConfigView {
        ContractConfigView {
            schema_version: SCHEMA_VERSION,
            terms_version: TERMS_VERSION,
            min_storage_reserve_yocto: U128(MIN_STORAGE_RESERVE_YOCTO),
            storage_byte_cost_yocto: U128(env::storage_byte_cost().as_yoctonear()),
            contract_id: env::current_account_id(),
        }
    }

    fn get_milestone_internal(&self, milestone_id: &str) -> Milestone {
        self.milestones
            .get(&milestone_id.to_string())
            .unwrap_or_else(|| env::panic_str("Milestone not found"))
    }

    fn save_milestone(
        &mut self,
        milestone_id: &str,
        mut milestone: Milestone,
        storage_before: u64,
    ) {
        self.milestones
            .insert(&milestone_id.to_string(), &milestone);
        let storage_added = env::storage_usage().saturating_sub(storage_before);
        let storage_cost = u128::from(storage_added) * env::storage_byte_cost().as_yoctonear();
        require!(
            milestone.storage_reserve_yocto >= storage_cost,
            "Storage reserve is insufficient"
        );
        milestone.storage_reserve_yocto -= storage_cost;
        self.milestones
            .insert(&milestone_id.to_string(), &milestone);
    }

    fn begin_refund(&self, milestone: &mut Milestone) {
        let restore_status = milestone.status;
        let attempt_id = milestone.next_attempt_id;
        milestone.next_attempt_id = milestone
            .next_attempt_id
            .checked_add(1)
            .expect("Attempt ID overflow");
        milestone.pending = Some(PendingSettlement {
            attempt_id,
            kind: SettlementKind::Refund,
            amount_yocto: milestone.amount_yocto,
            recipient: milestone.client_id.clone(),
            restore_status,
        });
        milestone.status = MilestoneStatus::RefundPending;
        milestone.last_settlement_error = None;
    }
}

fn settlement_promise(
    milestone_id: String,
    attempt_id: u64,
    recipient: AccountId,
    amount: u128,
) -> Promise {
    let callback_args = SettlementCallbackArgs {
        milestone_id,
        attempt_id: U64(attempt_id),
    };
    Promise::new(recipient)
        .transfer(NearToken::from_yoctonear(amount))
        .then(Promise::new(env::current_account_id()).function_call(
            "on_settlement".to_string(),
            near_sdk::serde_json::to_vec(&callback_args).expect("Callback arguments serialize"),
            NearToken::from_yoctonear(0),
            CALLBACK_GAS,
        ))
}

fn validate_milestone_id(milestone_id: &str) {
    require!(
        !milestone_id.is_empty() && milestone_id.len() <= 64,
        "Invalid milestone ID length"
    );
    require!(
        milestone_id
            .bytes()
            .all(|byte| byte.is_ascii_alphanumeric() || byte == b'-' || byte == b'_'),
        "Milestone ID contains invalid characters"
    );
}

fn validate_hash(hash: &str, field: &str) {
    require!(
        hash.len() == 64,
        &format!("{field} must be a 64-character SHA-256 hex digest")
    );
    require!(
        hash.bytes()
            .all(|byte| byte.is_ascii_digit() || (b'a'..=b'f').contains(&byte)),
        &format!("{field} must use lowercase hexadecimal")
    );
}

fn to_view(milestone_id: String, milestone: &Milestone) -> MilestoneView {
    MilestoneView {
        milestone_id,
        schema_version: milestone.schema_version,
        terms_version: milestone.terms_version,
        client_id: milestone.client_id.clone(),
        creator_id: milestone.creator_id.clone(),
        amount_yocto: U128(milestone.amount_yocto),
        brief_hash: milestone.brief_hash.clone(),
        created_at_ns: U64(milestone.created_at_ns),
        submit_by_ns: U64(milestone.submit_by_ns),
        review_until_ns: U64(milestone.review_until_ns),
        status: milestone.status.into(),
        delivery_version: (milestone.delivery_version > 0)
            .then_some(U64(milestone.delivery_version)),
        delivery_hash: milestone.delivery_hash.clone(),
        submitted_at_ns: milestone.submitted_at_ns.map(U64),
        approved_version: milestone.approved_version.map(U64),
        approved_hash: milestone.approved_hash.clone(),
        approved_at_ns: milestone.approved_at_ns.map(U64),
        pending_attempt_id: milestone
            .pending
            .as_ref()
            .map(|pending| U64(pending.attempt_id)),
        pending_kind: milestone
            .pending
            .as_ref()
            .map(|pending| pending.kind.into()),
        pending_amount_yocto: milestone
            .pending
            .as_ref()
            .map(|pending| U128(pending.amount_yocto)),
        pending_recipient: milestone
            .pending
            .as_ref()
            .map(|pending| pending.recipient.clone()),
        storage_reserve_yocto: U128(milestone.storage_reserve_yocto),
        last_settlement_error: milestone.last_settlement_error.clone(),
    }
}

impl From<MilestoneStatus> for MilestoneStatusView {
    fn from(status: MilestoneStatus) -> Self {
        match status {
            MilestoneStatus::Funded => Self::Funded,
            MilestoneStatus::Submitted => Self::Submitted,
            MilestoneStatus::Approved => Self::Approved,
            MilestoneStatus::PayoutPending => Self::PayoutPending,
            MilestoneStatus::RefundPending => Self::RefundPending,
            MilestoneStatus::Paid => Self::Paid,
            MilestoneStatus::Refunded => Self::Refunded,
        }
    }
}

impl From<SettlementKind> for SettlementKindView {
    fn from(kind: SettlementKind) -> Self {
        match kind {
            SettlementKind::Payout => Self::Payout,
            SettlementKind::Refund => Self::Refund,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use near_sdk::json_types::{U128, U64};
    use near_sdk::test_utils::{accounts, VMContextBuilder};
    use near_sdk::{test_vm_config, testing_env, NearToken, PromiseResult, RuntimeFeesConfig};
    use std::panic::{catch_unwind, AssertUnwindSafe};

    const AMOUNT: u128 = 2_400_000_000_000_000_000_000_000;
    const STORAGE: u128 = 50_000_000_000_000_000_000_000;
    const ONE_YOCTO: u128 = 1;

    fn context(predecessor: AccountId, deposit: u128, timestamp: u64) -> VMContextBuilder {
        let mut builder = VMContextBuilder::new();
        builder
            .current_account_id(accounts(0))
            .predecessor_account_id(predecessor.clone())
            .signer_account_id(predecessor)
            .attached_deposit(NearToken::from_yoctonear(deposit))
            .block_timestamp(timestamp);
        builder
    }

    fn hash(byte: char) -> String {
        std::iter::repeat(byte).take(64).collect()
    }

    fn fund_contract() -> Contract {
        testing_env!(context(accounts(1), AMOUNT + STORAGE, 10).build());
        let mut contract = Contract::new();
        contract.create_and_fund(
            "kanso-001".to_string(),
            accounts(2),
            U128(AMOUNT),
            hash('a'),
            U64(100),
            U64(200),
        );
        contract
    }

    fn submit_and_approve(mut contract: Contract) -> Contract {
        testing_env!(context(accounts(2), ONE_YOCTO, 50).build());
        contract.submit_delivery("kanso-001".to_string(), U64(0), hash('b'));
        testing_env!(context(accounts(1), ONE_YOCTO, 60).build());
        contract.approve_delivery("kanso-001".to_string(), U64(1), hash('b'));
        contract
    }

    #[test]
    fn funding_locks_terms_and_keeps_principal_separate() {
        let contract = fund_contract();
        let milestone = contract.get_milestone("kanso-001".to_string()).unwrap();

        assert_eq!(milestone.milestone_id, "kanso-001");
        assert_eq!(milestone.client_id, accounts(1));
        assert_eq!(milestone.creator_id, accounts(2));
        assert_eq!(milestone.amount_yocto, U128(AMOUNT));
        assert!(milestone.storage_reserve_yocto.0 < STORAGE);
        assert_eq!(milestone.status, MilestoneStatusView::Funded);
        assert_eq!(milestone.brief_hash, hash('a'));
    }

    #[test]
    fn only_client_can_approve_exact_current_version() {
        let mut contract = fund_contract();

        testing_env!(context(accounts(2), ONE_YOCTO, 50).build());
        contract.submit_delivery("kanso-001".to_string(), U64(0), hash('b'));

        testing_env!(context(accounts(3), ONE_YOCTO, 60).build());
        let unauthorized = catch_unwind(AssertUnwindSafe(|| {
            contract.approve_delivery("kanso-001".to_string(), U64(1), hash('b'));
        }));
        assert!(unauthorized.is_err());

        testing_env!(context(accounts(1), ONE_YOCTO, 60).build());
        let stale = catch_unwind(AssertUnwindSafe(|| {
            contract.approve_delivery("kanso-001".to_string(), U64(0), hash('a'));
        }));
        assert!(stale.is_err());

        contract.approve_delivery("kanso-001".to_string(), U64(1), hash('b'));
        assert_eq!(
            contract
                .get_milestone("kanso-001".to_string())
                .unwrap()
                .status,
            MilestoneStatusView::Approved
        );
    }

    #[test]
    fn approval_freezes_delivery_and_release_is_fixed() {
        let mut contract = submit_and_approve(fund_contract());

        testing_env!(context(accounts(2), ONE_YOCTO, 70).build());
        let replacement = catch_unwind(AssertUnwindSafe(|| {
            contract.submit_delivery("kanso-001".to_string(), U64(1), hash('c'));
        }));
        assert!(replacement.is_err());

        testing_env!(context(accounts(4), 0, 70).build());
        let _ = contract.release("kanso-001".to_string(), U64(1), hash('b'));
        let pending = contract.get_milestone("kanso-001".to_string()).unwrap();
        assert_eq!(pending.status, MilestoneStatusView::PayoutPending);
        assert_eq!(pending.pending_recipient, Some(accounts(2)));
        assert_eq!(pending.pending_amount_yocto, Some(U128(AMOUNT)));

        testing_env!(
            context(accounts(0), 0, 71).build(),
            test_vm_config(),
            RuntimeFeesConfig::test(),
            Default::default(),
            vec![PromiseResult::Successful(vec![])]
        );
        contract.on_settlement("kanso-001".to_string(), U64(1));
        assert_eq!(
            contract
                .get_milestone("kanso-001".to_string())
                .unwrap()
                .status,
            MilestoneStatusView::Paid
        );
    }

    #[test]
    fn failed_payout_restores_approval_without_duplicate_settlement() {
        let mut contract = submit_and_approve(fund_contract());
        testing_env!(context(accounts(4), 0, 70).build());
        let _ = contract.release("kanso-001".to_string(), U64(1), hash('b'));

        testing_env!(
            context(accounts(0), 0, 71).build(),
            test_vm_config(),
            RuntimeFeesConfig::test(),
            Default::default(),
            vec![PromiseResult::Failed]
        );
        contract.on_settlement("kanso-001".to_string(), U64(1));
        assert_eq!(
            contract
                .get_milestone("kanso-001".to_string())
                .unwrap()
                .status,
            MilestoneStatusView::Approved
        );
    }

    #[test]
    fn expired_unapproved_commission_can_refund_only_to_client() {
        let mut contract = fund_contract();

        testing_env!(context(accounts(3), ONE_YOCTO, 101).build());
        let unauthorized = catch_unwind(AssertUnwindSafe(|| {
            let _ = contract.refund_expired("kanso-001".to_string());
        }));
        assert!(unauthorized.is_err());

        testing_env!(context(accounts(1), ONE_YOCTO, 101).build());
        let _ = contract.refund_expired("kanso-001".to_string());
        assert_eq!(
            contract
                .get_milestone("kanso-001".to_string())
                .unwrap()
                .status,
            MilestoneStatusView::RefundPending
        );

        testing_env!(
            context(accounts(0), 0, 102).build(),
            test_vm_config(),
            RuntimeFeesConfig::test(),
            Default::default(),
            vec![PromiseResult::Successful(vec![])]
        );
        contract.on_settlement("kanso-001".to_string(), U64(1));
        assert_eq!(
            contract
                .get_milestone("kanso-001".to_string())
                .unwrap()
                .status,
            MilestoneStatusView::Refunded
        );
    }
}
