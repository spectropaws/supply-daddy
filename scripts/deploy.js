const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
    console.log("Deploying ShipmentAnchor...");

    const ShipmentAnchor = await hre.ethers.getContractFactory("ShipmentAnchor");
    const anchor = await ShipmentAnchor.deploy();
    await anchor.waitForDeployment();

    const address = await anchor.getAddress();
    console.log(`ShipmentAnchor deployed to: ${address}`);

    // Write the contract address and ABI to server for backend integration
    const artifactsDir = path.join(__dirname, "..", "server", "contract_artifacts");
    if (!fs.existsSync(artifactsDir)) {
        fs.mkdirSync(artifactsDir, { recursive: true });
    }

    // Save deployed address
    fs.writeFileSync(
        path.join(artifactsDir, "deployed_address.json"),
        JSON.stringify({ address, network: hre.network.name }, null, 2)
    );

    // Copy ABI
    const artifact = await hre.artifacts.readArtifact("ShipmentAnchor");
    fs.writeFileSync(
        path.join(artifactsDir, "ShipmentAnchor.json"),
        JSON.stringify({ abi: artifact.abi }, null, 2)
    );

    console.log(`Contract artifacts written to ${artifactsDir}`);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
