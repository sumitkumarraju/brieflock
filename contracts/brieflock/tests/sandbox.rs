use anyhow::Result;
use near_workspaces::types::NearToken;
use near_workspaces::{Account, Contract, Worker};
use serde_json::json;

const AMOUNT_YOCTO: u128 = 2_400_000_000_000_000_000_000_000;
const STORAGE_YOCTO: u128 = 50_000_000_000_000_000_000_000;
const ONE_YOCTO: u128 = 1;
const WASM: &[u8] =
    include_bytes!("../target/wasm32-unknown-unknown/release/brieflock_contract.wasm");

async fn deployed() -> Result<(
    Worker<impl near_workspaces::DevNetwork>,
    Contract,
    Account,
    Account,
    Account,
)> {
    let worker = near_workspaces::sandbox().await?;
    let contract = worker.dev_deploy(WASM).await?;
    contract
        .call("new")
        .max_gas()
        .transact()
        .await?
        .into_result()?;
    let client = worker.dev_create_account().await?;
    let creator = worker.dev_create_account().await?;
    let attacker = worker.dev_create_account().await?;
    Ok((worker, contract, client, creator, attacker))
}

async fn fund(
    contract: &Contract,
    client: &Account,
    creator: &Account,
    submit_by: u64,
    review_until: u64,
) -> Result<()> {
    client
        .call(contract.id(), "create_and_fund")
        .args_json(json!({
            "milestone_id": "kanso-001",
            "creator_id": creator.id(),
            "amount_yocto": AMOUNT_YOCTO.to_string(),
            "brief_hash": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
            "submit_by_ns": submit_by.to_string(),
            "review_until_ns": review_until.to_string()
        }))
        .deposit(NearToken::from_yoctonear(AMOUNT_YOCTO + STORAGE_YOCTO))
        .max_gas()
        .transact()
        .await?
        .into_result()?;
    Ok(())
}

#[tokio::test]
async fn sandbox_normal_flow_pays_exact_fixed_creator_once() -> Result<()> {
    let (worker, contract, client, creator, attacker) = deployed().await?;
    let now = worker.view_block().await?.timestamp();
    fund(
        &contract,
        &client,
        &creator,
        now + 100_000_000_000,
        now + 200_000_000_000,
    )
    .await?;

    creator
        .call(contract.id(), "submit_delivery")
        .args_json(json!({
            "milestone_id": "kanso-001",
            "expected_previous_version": "0",
            "delivery_hash": "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"
        }))
        .deposit(NearToken::from_yoctonear(ONE_YOCTO))
        .max_gas()
        .transact()
        .await?
        .into_result()?;

    client
        .call(contract.id(), "approve_delivery")
        .args_json(json!({
            "milestone_id": "kanso-001",
            "version": "1",
            "delivery_hash": "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"
        }))
        .deposit(NearToken::from_yoctonear(ONE_YOCTO))
        .max_gas()
        .transact()
        .await?
        .into_result()?;

    attacker
        .call(contract.id(), "release")
        .args_json(json!({
            "milestone_id": "kanso-001",
            "version": "1",
            "delivery_hash": "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"
        }))
        .max_gas()
        .transact()
        .await?
        .into_result()?;

    let state: serde_json::Value = contract
        .view("get_milestone")
        .args_json(json!({ "milestone_id": "kanso-001" }))
        .await?
        .json()?;
    assert_eq!(state["status"], "Paid");
    assert_eq!(state["creator_id"], creator.id().to_string());

    let replay = attacker
        .call(contract.id(), "release")
        .args_json(json!({
            "milestone_id": "kanso-001",
            "version": "1",
            "delivery_hash": "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"
        }))
        .max_gas()
        .transact()
        .await?
        .into_result();
    assert!(replay.is_err(), "a terminal commission must reject replay");

    Ok(())
}

#[tokio::test]
async fn sandbox_rejects_unauthorized_and_stale_approvals() -> Result<()> {
    let (worker, contract, client, creator, attacker) = deployed().await?;
    let now = worker.view_block().await?.timestamp();
    fund(
        &contract,
        &client,
        &creator,
        now + 100_000_000_000,
        now + 200_000_000_000,
    )
    .await?;

    creator
        .call(contract.id(), "submit_delivery")
        .args_json(json!({
            "milestone_id": "kanso-001",
            "expected_previous_version": "0",
            "delivery_hash": "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"
        }))
        .deposit(NearToken::from_yoctonear(ONE_YOCTO))
        .max_gas()
        .transact()
        .await?
        .into_result()?;

    let unauthorized = attacker
        .call(contract.id(), "approve_delivery")
        .args_json(json!({
            "milestone_id": "kanso-001",
            "version": "1",
            "delivery_hash": "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"
        }))
        .deposit(NearToken::from_yoctonear(ONE_YOCTO))
        .max_gas()
        .transact()
        .await?
        .into_result();
    assert!(
        unauthorized.is_err(),
        "attacker cannot approve another client's work"
    );

    creator
        .call(contract.id(), "submit_delivery")
        .args_json(json!({
            "milestone_id": "kanso-001",
            "expected_previous_version": "1",
            "delivery_hash": "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc"
        }))
        .deposit(NearToken::from_yoctonear(ONE_YOCTO))
        .max_gas()
        .transact()
        .await?
        .into_result()?;

    let stale = client
        .call(contract.id(), "approve_delivery")
        .args_json(json!({
            "milestone_id": "kanso-001",
            "version": "1",
            "delivery_hash": "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"
        }))
        .deposit(NearToken::from_yoctonear(ONE_YOCTO))
        .max_gas()
        .transact()
        .await?
        .into_result();
    assert!(
        stale.is_err(),
        "a version 1 browser review cannot approve version 2 state"
    );

    Ok(())
}
