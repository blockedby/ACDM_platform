import { task } from "hardhat/config";

task("setup_platform", "Grants minter/burner role to platform")
.setAction(async function (taskArguments, hre) {
    const [signer] = await hre.ethers.getSigners();
    const token = await hre.ethers.getContractAt("ZepToken","0x6099967Ca54f81323BaB5f532Dd8f3Ac14DE5392");
    const platform = await hre.ethers.getContractAt("ACDMPlatform2","0x86663393560C385814Da0F28E2aF0A81173E1801");
      
    const transactionResponse = await token.connect(signer).setupPlatform(platform.address);
    await transactionResponse.wait();
    await platform.connect(signer).startSale();
    
    console.log(`trading started!`);
});
