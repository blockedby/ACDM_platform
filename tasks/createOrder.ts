import { BigNumber } from "ethers";
import { ethers } from "hardhat";
import { task } from "hardhat/config";

task("createOrder", "Creates order during ")
    .addParam("amount", "token amount")
    .addParam("price", "price in wei")
    .setAction(async function (taskArguments, hre) {
        const [signer] = await hre.ethers.getSigners();
        const token = await hre.ethers.getContractAt("ZepToken","0x6099967Ca54f81323BaB5f532Dd8f3Ac14DE5392");
        const platform = await hre.ethers.getContractAt("ACDMPlatform2","0x86663393560C385814Da0F28E2aF0A81173E1801");
        if ((await platform.viewCurrentPlatformState())=="Trade"){
            let tx = await platform.connect(signer).createOrder(
                taskArguments.amount, taskArguments.price
              )
            await tx.wait();
            console.log("success! please check event");
        } else{
            console.log("Wrong stage");
        }        
    });
