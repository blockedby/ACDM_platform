import { ethers } from "hardhat";

async function main() {
  const [signer] = await ethers.getSigners();
  const platformFactory = await ethers.getContractFactory("ACDMPlatform2", signer);
  const tokenFactory = await ethers.getContractFactory("ZepToken", signer)
  const token = await tokenFactory.deploy(signer.address);
  await token.deployed();
  console.log("token deployed to:", token.address);
  const platform = await platformFactory.deploy(token.address);
  await platform.deployed();
  await token.connect(signer).setupPlatform(platform.address);
  console.log("platform deployed to:", platform.address);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
