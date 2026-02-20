// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract ShipmentAnchor {
    struct ShipmentCheckpoint {
        string shipmentId;
        string locationCode;
        uint256 timestamp;
        uint256 weightKg;
        bytes32 documentHash;
        address scannedBy;
    }

    // shipmentId => checkpoints[]
    mapping(string => ShipmentCheckpoint[]) private checkpoints;

    event CheckpointAppended(
        string indexed shipmentId,
        string locationCode,
        uint256 timestamp,
        uint256 weightKg,
        bytes32 documentHash,
        address scannedBy
    );

    /**
     * @notice Append a new checkpoint for a shipment.
     * @param _shipmentId  Unique shipment identifier
     * @param _locationCode  Location code of the checkpoint node
     * @param _weightKg  Weight in kilograms at this checkpoint
     * @param _documentHash  SHA-256 hash of supporting documents
     */
    function appendCheckpoint(
        string calldata _shipmentId,
        string calldata _locationCode,
        uint256 _weightKg,
        bytes32 _documentHash
    ) external {
        ShipmentCheckpoint memory cp = ShipmentCheckpoint({
            shipmentId: _shipmentId,
            locationCode: _locationCode,
            timestamp: block.timestamp,
            weightKg: _weightKg,
            documentHash: _documentHash,
            scannedBy: msg.sender
        });

        checkpoints[_shipmentId].push(cp);

        emit CheckpointAppended(
            _shipmentId,
            _locationCode,
            block.timestamp,
            _weightKg,
            _documentHash,
            msg.sender
        );
    }

    /**
     * @notice Get a specific checkpoint by index.
     */
    function getCheckpoint(
        string calldata _shipmentId,
        uint256 _index
    )
        external
        view
        returns (
            string memory locationCode,
            uint256 timestamp,
            uint256 weightKg,
            bytes32 documentHash,
            address scannedBy
        )
    {
        require(
            _index < checkpoints[_shipmentId].length,
            "Index out of bounds"
        );
        ShipmentCheckpoint storage cp = checkpoints[_shipmentId][_index];
        return (
            cp.locationCode,
            cp.timestamp,
            cp.weightKg,
            cp.documentHash,
            cp.scannedBy
        );
    }

    /**
     * @notice Get the number of checkpoints for a shipment.
     */
    function getCheckpointCount(
        string calldata _shipmentId
    ) external view returns (uint256) {
        return checkpoints[_shipmentId].length;
    }
}
