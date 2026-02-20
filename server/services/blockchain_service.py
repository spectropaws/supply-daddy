"""
Blockchain Service — Web3.py wrapper for ShipmentAnchor contract.

Handles transaction construction, signing, and submission.
Users do NOT need MetaMask — the server wallet sponsors gas.
"""

import json
import os
import logging
from pathlib import Path

logger = logging.getLogger(__name__)

try:
    from web3 import Web3
    _HAS_WEB3 = True
except ImportError:
    _HAS_WEB3 = False
    logger.warning("web3 not installed — using stub blockchain service")


_w3 = None
_contract = None
_account = None


def init_blockchain():
    """Initialize web3 connection and contract instance."""
    global _w3, _contract, _account

    if not _HAS_WEB3:
        logger.warning("web3 not available — blockchain calls will be stubbed")
        return

    rpc_url = os.getenv("RPC_URL", "http://127.0.0.1:8545")
    private_key = os.getenv("PRIVATE_KEY", "")

    if not private_key:
        logger.warning("PRIVATE_KEY not set — blockchain calls will be stubbed")
        return

    _w3 = Web3(Web3.HTTPProvider(rpc_url))
    if not _w3.is_connected():
        logger.error(f"Cannot connect to RPC at {rpc_url}")
        _w3 = None
        return

    _account = _w3.eth.account.from_key(private_key)
    logger.info(f"Blockchain wallet: {_account.address}")

    # Load contract ABI and address
    artifacts_dir = Path(__file__).parent.parent / "contract_artifacts"
    abi_path = artifacts_dir / "ShipmentAnchor.json"
    addr_path = artifacts_dir / "deployed_address.json"

    if not abi_path.exists() or not addr_path.exists():
        logger.warning("Contract artifacts not found — deploy the contract first")
        _contract = None
        return

    with open(abi_path) as f:
        abi_data = json.load(f)
    with open(addr_path) as f:
        addr_data = json.load(f)

    contract_address = _w3.to_checksum_address(addr_data["address"])
    _contract = _w3.eth.contract(address=contract_address, abi=abi_data["abi"])
    logger.info(f"ShipmentAnchor contract loaded at {contract_address}")


async def append_checkpoint(
    shipment_id: str,
    location_code: str,
    weight_kg: int,
    document_hash: bytes,
) -> dict:
    """
    Append a checkpoint to the blockchain.
    Returns tx hash and block number.
    """
    if _contract is None or _w3 is None or _account is None:
        # Stub response
        return {
            "tx_hash": "0x" + "0" * 64,
            "block_number": 0,
            "status": "stubbed",
        }

    try:
        nonce = _w3.eth.get_transaction_count(_account.address)

        # Pad document_hash to 32 bytes
        if len(document_hash) < 32:
            document_hash = document_hash + b'\x00' * (32 - len(document_hash))
        doc_hash_bytes32 = document_hash[:32]

        tx = _contract.functions.appendCheckpoint(
            shipment_id,
            location_code,
            weight_kg,
            doc_hash_bytes32,
        ).build_transaction({
            "from": _account.address,
            "nonce": nonce,
            "gas": 300000,
            "gasPrice": _w3.eth.gas_price,
        })

        signed_tx = _w3.eth.account.sign_transaction(tx, _account.key)
        tx_hash = _w3.eth.send_raw_transaction(signed_tx.raw_transaction)
        receipt = _w3.eth.wait_for_transaction_receipt(tx_hash, timeout=30)

        return {
            "tx_hash": receipt.transactionHash.hex(),
            "block_number": receipt.blockNumber,
            "status": "confirmed" if receipt.status == 1 else "failed",
        }
    except Exception as e:
        logger.error(f"Blockchain tx error: {e}")
        return {
            "tx_hash": None,
            "block_number": None,
            "status": "error",
            "error": str(e),
        }


async def get_checkpoints(shipment_id: str) -> list[dict]:
    """Retrieve all checkpoints for a shipment from the blockchain."""
    if _contract is None or _w3 is None:
        return []

    try:
        count = _contract.functions.getCheckpointCount(shipment_id).call()
        checkpoints = []
        for i in range(count):
            cp = _contract.functions.getCheckpoint(shipment_id, i).call()
            checkpoints.append({
                "index": i,
                "location_code": cp[0],
                "timestamp": cp[1],
                "weight_kg": cp[2],
                "document_hash": cp[3].hex(),
                "scanned_by": cp[4],
            })
        return checkpoints
    except Exception as e:
        logger.error(f"Blockchain read error: {e}")
        return []


async def verify_checkpoint_hash(
    shipment_id: str,
    expected_hash: bytes,
) -> dict:
    """
    Verify a document hash against the LATEST checkpoint stored on-chain.
    Returns {"verified": bool, "on_chain_hash": str | None, "expected_hash": str}.
    """
    expected_hex = expected_hash[:32].hex()

    if _contract is None or _w3 is None:
        # Stub: assume verified if blockchain not available
        return {
            "verified": True,
            "on_chain_hash": None,
            "expected_hash": expected_hex,
            "status": "stubbed",
        }

    try:
        count = _contract.functions.getCheckpointCount(shipment_id).call()
        if count == 0:
            # No previous checkpoint → first checkpoint, auto-verified
            return {
                "verified": True,
                "on_chain_hash": None,
                "expected_hash": expected_hex,
                "status": "first_checkpoint",
            }

        # Get the latest on-chain checkpoint
        latest = _contract.functions.getCheckpoint(shipment_id, count - 1).call()
        on_chain_hash = latest[3].hex()  # documentHash is at index 3

        verified = on_chain_hash == expected_hex

        return {
            "verified": verified,
            "on_chain_hash": on_chain_hash,
            "expected_hash": expected_hex,
            "status": "verified" if verified else "hash_mismatch",
        }
    except Exception as e:
        logger.error(f"Hash verification error: {e}")
        return {
            "verified": False,
            "on_chain_hash": None,
            "expected_hash": expected_hex,
            "status": "error",
            "error": str(e),
        }
