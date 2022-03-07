import { BigNumber } from "ethers";
import { ethers } from "hardhat";
import { task } from "hardhat/config";

task("buyAtContract", "Buy tokens at contract")
    .addParam("value", "value in wei")
    .setAction(async function (taskArguments, hre) {
        const [signer] = await hre.ethers.getSigners();
        const token = await hre.ethers.getContractAt("ZepToken","0x6099967Ca54f81323BaB5f532Dd8f3Ac14DE5392");
        const platform = await hre.ethers.getContractAt("ACDMPlatform2","0x86663393560C385814Da0F28E2aF0A81173E1801");
        if ((await platform.viewCurrentPlatformState())=="Sale"){
            // calculate amount
            let tokenPrice:BigNumber = await platform.getCurrentTokenPrice();
            let tokenAmount:BigNumber = await platform.howManyEtherToTokenAmount(taskArguments.value);
            let availableAmount:BigNumber = await platform.getAvailableTokenAmount();
            
            if (tokenAmount<availableAmount){
                console.log("For ",String(BigNumber.from(taskArguments.value))," ethers");
                console.log("buying ",String(tokenAmount.mul(tokenPrice))," tokens");

                const transactionResponse = await token.connect(signer).buyAtContract(platform.address);
                await transactionResponse.wait();

            } else {
                console.log("Please use less value");
            }
            
        } else{
            console.log("Wrong stage");
        }        
    });
