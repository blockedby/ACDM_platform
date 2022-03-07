import { TransactionResponse } from "@ethersproject/abstract-provider";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import { expect } from "chai";
import { Address } from "cluster";
import { BigNumber, Contract, ContractFactory, Transaction } from "ethers";
import { ethers } from "hardhat";

async function passTime(time: number) {
    await ethers.provider.send('evm_increaseTime', [time]);
    await ethers.provider.send("evm_mine", []);
    console.log("                  (" + time + " seconds passed)");
}
async function doAndGetFee(tx: TransactionResponse) {
    const minedTx = await tx.wait();
    const fee: BigNumber = (minedTx).effectiveGasPrice.mul(minedTx.cumulativeGasUsed);
    return fee
}
async function registerUsers(){
    // register block
    await platform.connect(owner).register(ethers.constants.AddressZero);
    await platform.connect(alice).register(owner.address);
    await platform.connect(bob).register(alice.address);    
}
let
    alice: SignerWithAddress,
    bob: SignerWithAddress,
    owner: SignerWithAddress,
    platform: Contract,
    token: Contract,
    platformFactory: ContractFactory,
    tokenFactory: ContractFactory,
    NFTaddress: Address;

describe("Initial Platform initialize", function () {
    before(async function () {
        [alice, owner, bob] = await ethers.getSigners();
        platformFactory = await ethers.getContractFactory("ACDMPlatform2", owner);
        tokenFactory = await ethers.getContractFactory("ZepToken", owner)
        token = await tokenFactory.deploy(owner.address);
        await token.deployed();
        const MINTER = await token.MINTER();
        const BURNER = await token.BURNER();
        platform = await platformFactory.deploy(token.address);
        await platform.deployed();
        await token.connect(owner).setupPlatform(platform.address);
        await platform.connect(owner).startSale();

    });
    // beforeEach(async function () {
    // });
    it("Should check current platform state", async function () {
        let a = 0;
        expect(await platform.viewCurrentPlatformState()).to.eq("Sale");
    });
    it("Should check available token amount", async function () {
        expect(await platform.getAvailableTokenAmount()).to.eq(ethers.utils.parseEther("100000"));
    });
    it("Should check token price", async function () {
        expect(await platform.getCurrentTokenPrice()).to.eq(ethers.utils.parseEther("0.00001"));
    });
    it("Should check token's parameters", async function () {
        const tokenDecimals = await token.decimals();
        expect(tokenDecimals).to.eq(18);  
        expect(await token.balanceOf(platform.address)).to.eq(ethers.utils.parseEther("100000"));
    });
    it("Should check buy calculation", async function () {
        const testTokenAmount: BigNumber = await platform.connect(owner).howManyTokensCanIBuyForEther(ethers.utils.parseEther("0.5"));
        expect(await token.totalSupply()).to.eq(testTokenAmount.mul(2)); // means that we can buy half of tokens for 0.5 eth  
        const testEtherAmount = await platform.howManyEtherToTokenAmount(ethers.utils.parseEther("50000"));
        expect(testEtherAmount).to.eq(ethers.utils.parseEther("0.5"));
    });
    it("Should get left timestamp of stage", async function () {
        const leftTime = await platform.getLeftTimestampOfStage();
    });
    it("Should check Round ID", async function () {
        expect(await platform.getLastRoundId()).to.eq(1);
    });
    it("Should check Order ID", async function () {
        expect(await platform.getLastOrderId()).to.eq(0);
    });
    it("Should not register", async function () {
        // await expect(platform.connect(owner).register()).to.be.revertedWith("");
        await expect(platform.connect(alice).register(owner.address)).to.be.revertedWith("");
        // await expect(platform.connect(bob).register(ethers.constants.AddressZero)).to.be.revertedWith("");

    });
    it("Should check registration", async function () {
        await platform.connect(owner).register(ethers.constants.AddressZero);
        await platform.connect(alice).register(owner.address);
        await platform.connect(bob).register(alice.address);
    });
    it("Should not register twice", async function () {
        await expect(platform.connect(alice).register(owner.address)).to.be.revertedWith("");
    });
    it("Should not register by users address", async function () {
        await expect(platform.connect(alice).register(alice.address)).to.be.revertedWith("");

    });
    it("Should not fetch tokens", async function () {
        await expect(platform.connect(bob).fetchTokens()).to.be.revertedWith("");
    });
});
describe("Check ability to buy tokens from platform", function () {
    let initialBobBalance:BigNumber,
        firstFee:BigNumber;
    before(async function () {
        [alice, owner, bob] = await ethers.getSigners();
        platformFactory = await ethers.getContractFactory("ACDMPlatform2", owner);
        tokenFactory = await ethers.getContractFactory("ZepToken", owner)
        token = await tokenFactory.deploy(owner.address);
        await token.deployed();
        const MINTER = await token.MINTER();
        const BURNER = await token.BURNER();
        platform = await platformFactory.deploy(token.address);
        await platform.deployed();
        await token.connect(owner).setupPlatform(platform.address);
        await platform.connect(owner).startSale();
        // register block
        await platform.connect(owner).register(ethers.constants.AddressZero);
        await platform.connect(alice).register(owner.address);
        await platform.connect(bob).register(alice.address);
        initialBobBalance = await ethers.provider.getBalance(bob.address);
        firstFee = await doAndGetFee(await platform.connect(bob).buyAtContract({ value: ethers.utils.parseEther("0.5") }));

    });
    this.beforeEach(async function () {
    });
    it("Should check buyer token balance", async function () {
        expect(await token.balanceOf(bob.address)).to.eq(ethers.utils.parseEther("50000"));
    });
    it("Should check platform token balance", async function () {
        expect(await ethers.provider.getBalance(platform.address)).to.eq(ethers.utils.parseEther("0.5"));
    });
    it("Should check buyer ether balance", async function () {
        expect(await ethers.provider.getBalance(bob.address)).to.eq(initialBobBalance.sub(ethers.utils.parseEther("0.5")).sub(firstFee));
    });
    it("Should check platform ether balance", async function () {
        expect(await ethers.provider.getBalance(platform.address)).to.eq((ethers.utils.parseEther("0.5")));
    });
    it("Should check referal reward", async function () {
        expect(await platform.connect(owner).viewMyEthBalance()).to.eq(ethers.utils.parseEther(String(0.5 / 100*3)));
        expect(await platform.connect(alice).viewMyEthBalance()).to.eq(ethers.utils.parseEther(String(0.5 / 20)))
        expect(await platform.connect(bob).viewMyEthBalance()).to.eq(0)
    });
    it("Should check available token amount", async function () {
        expect(await platform.getAvailableTokenAmount()).to.eq(ethers.utils.parseEther("50000"));
    });
    it("Should not buy with 0 msg.value", async function () {
        await expect(platform.connect(bob).buyAtContract({ value: ethers.utils.parseEther("0") })).to.be.revertedWith("");
    });
    it("Should not more tokens than platform has", async function () {
        await expect(platform.connect(bob).buyAtContract({ value: ethers.utils.parseEther("1") })).to.be.revertedWith("");
    });
    it("Should cancel orders during Sale stage", async function () {
        await expect(platform.connect(bob).createOrder(
            88, 22
          )).to.be.revertedWith("");
    });
    // it("Should check", async function () {
    // });
    // it("Should check", async function () {
    // });
});
describe("Check ability to buy all tokens during Sale", function () {
    let initialOwnerBalance:BigNumber,
        firstFee:BigNumber,
        secondFee:BigNumber;
    let 
        firstRewards :BigNumber[] = [],
        secondRewards :BigNumber[] = [];
    before(async function () {
        [alice, owner, bob] = await ethers.getSigners();
        platformFactory = await ethers.getContractFactory("ACDMPlatform2", owner);
        tokenFactory = await ethers.getContractFactory("ZepToken", owner)
        token = await tokenFactory.deploy(owner.address);
        await token.deployed();
        const MINTER = await token.MINTER();
        const BURNER = await token.BURNER();
        platform = await platformFactory.deploy(token.address);
        await platform.deployed();
        await token.connect(owner).setupPlatform(platform.address);
        await platform.connect(owner).startSale();
        await registerUsers();
        initialOwnerBalance = await ethers.provider.getBalance(owner.address);
        firstFee = await doAndGetFee(await platform.connect(bob).buyAtContract({ value: ethers.utils.parseEther("0.5") }));
        secondFee = await doAndGetFee(await platform.connect(bob).buyAtContract({ value: ethers.utils.parseEther("0.5") }));
    });
    this.beforeEach(async function () {
    });
    it("Should check state", async function () {
        expect(await platform.viewCurrentPlatformState()).to.eq("Trade");
    });
    it("Should check platform ether balance", async function () {
        expect(await ethers.provider.getBalance(platform.address)).to.eq((ethers.utils.parseEther("1")));
    });
    it("Should check rewards", async function () {
        expect(await platform.connect(owner).viewMyEthBalance()).to.eq(ethers.utils.parseEther(String(0.5 / 100*3 *2)));
        expect(await platform.connect(alice).viewMyEthBalance()).to.eq(ethers.utils.parseEther(String(0.5 / 20 *2)))
        expect(await platform.connect(bob).viewMyEthBalance()).to.eq(0)
    });
    it("Should check buyer balance", async function () {
        expect(await token.balanceOf(bob.address)).to.eq(ethers.utils.parseEther("100000"));
    });
    it("Should check platform balance", async function () {
        expect(await ethers.provider.getBalance(platform.address)).to.eq(ethers.utils.parseEther("1"));
    });
    it("Should check ability to gain reward", async function () {
        const aliceBalance1:BigNumber = await ethers.provider.getBalance(alice.address);
        const aliceReward:BigNumber = await platform.connect(alice).viewMyEthBalance();
        const aliceFee:BigNumber = await doAndGetFee(await platform.connect(alice).fetchEther());
        const aliceBalance2:BigNumber = await ethers.provider.getBalance(alice.address);
        expect(aliceBalance1.add(aliceReward)).to.eq(aliceBalance2.add(aliceFee));
        await expect (platform.connect(bob).fetchEther()).to.be.revertedWith("");
        await platform.connect(owner).fetchEther();
    });
    it("Should not get available tokens during Trade", async function () {
        await expect(platform.getAvailableTokenAmount()).to.be.revertedWith("");
    });
    it("Should not get getCurrentTokenPrice during Trade", async function () {
        await expect(platform.getCurrentTokenPrice()).to.be.revertedWith("");
    });
    it("Should not get howManyEtherToTokenAmount during Trade", async function () {
        await expect(platform.howManyEtherToTokenAmount(1)).to.be.revertedWith("");
    });
    it("Should not get howManyTokensCanIBuyForEther during Trade", async function () {
        await expect(platform.howManyTokensCanIBuyForEther(ethers.utils.parseEther("199"))).to.be.revertedWith("");
    });
    it("Should not buy at contract during Trade", async function () {
        expect(platform.connect(bob).buyAtContract({ value: ethers.utils.parseEther("0.5") })).to.be.revertedWith("");
    });
    // it("Should check", async function () {
    // });
});


describe("Check order functions", function () {
    let initialOwnerBalance:BigNumber,
    bobsOrderTokenPrice: BigNumber,
    bobsTokenAmount: BigNumber,
        firstFee:BigNumber,
        secondFee:BigNumber;
    before(async function () {
        [alice, owner, bob] = await ethers.getSigners();
        platformFactory = await ethers.getContractFactory("ACDMPlatform2", owner);
        tokenFactory = await ethers.getContractFactory("ZepToken", owner)
        token = await tokenFactory.deploy(owner.address);
        await token.deployed();
        const MINTER = await token.MINTER();
        const BURNER = await token.BURNER();
        platform = await platformFactory.deploy(token.address);
        await platform.deployed();
        await token.connect(owner).setupPlatform(platform.address);
        await platform.connect(owner).startSale();
        await registerUsers();
        initialOwnerBalance = await ethers.provider.getBalance(owner.address);
        // buy to change state
        firstFee = await doAndGetFee(await platform.connect(bob).buyAtContract({ value: ethers.utils.parseEther("0.5") }));
        secondFee = await doAndGetFee(await platform.connect(bob).buyAtContract({ value: ethers.utils.parseEther("0.5") }));  
        // gain reward to calculate easear  
        await platform.connect(alice).fetchEther() 
        await platform.connect(owner).fetchEther() 
        // set order
        bobsOrderTokenPrice = (ethers.utils.parseEther("0.0002"));
        bobsTokenAmount = ethers.utils.parseEther("10000");
        const approval = await token.connect(bob).approve(platform.address, bobsTokenAmount);
        await approval.wait();
        // console.log(aa)
        await platform.connect(bob).createOrder(
            bobsTokenAmount, bobsOrderTokenPrice
          );
    });
    this.beforeEach(async function () {
    });
    it("Should check platform token balance", async function () {
        expect(await token.balanceOf(platform.address)).to.eq(bobsTokenAmount);
    });
    it("Should check order info", async function () {
        const answer = await platform.getOrderInfo(1);
        expect(answer[0]).to.eq(bobsTokenAmount);
        expect(answer[1]).to.eq(0);
        expect(answer[2]).to.eq(bobsOrderTokenPrice);
        expect(answer[3]).to.eq(true);
    });
    it("Should not set order because of wrong data", async function () {
        await expect(platform.connect(bob).createOrder(
            0, bobsOrderTokenPrice
          )).to.be.revertedWith("");
        await expect(platform.connect(bob).createOrder(
            bobsTokenAmount, 0
          )).to.be.revertedWith("");
    });
    
    describe("Should buy tokens at order", async function () {
        let 
        aliceTokenAmount:BigNumber,
        aliceVlaue:BigNumber,
        beforeAliceBalance:BigNumber,
        desiredTokenAmount:BigNumber,
        aliceTxFee:BigNumber;
        before(async function () {
            aliceTokenAmount = ethers.utils.parseEther("5000");
            aliceVlaue = ((bobsOrderTokenPrice).mul(aliceTokenAmount)).div(ethers.utils.parseEther("1"));
            beforeAliceBalance = await ethers.provider.getBalance(alice.address);
            // desiredTokenAmount = (await platform.tokenAmountByEtherAtOrder(1, aliceVlaue));
            aliceTxFee = await doAndGetFee(await
                platform.connect(alice).buyAtOrder(1,
                    { value: aliceVlaue })
                );
        });
        it("Should check alice token balance", async function () {
            expect(await token.balanceOf(alice.address)).to.eq(aliceTokenAmount)
            // expect(aliceTokenAmount).to.eq(desiredTokenAmount);

        });
        it("Should check order info", async function () {
            const answerToAlice = await platform.getOrderInfo(1);
            expect(answerToAlice[0]).to.eq(bobsTokenAmount);
            expect(answerToAlice[1]).to.eq(aliceTokenAmount);
            expect(answerToAlice[2]).to.eq(bobsOrderTokenPrice);
        });
        it("Should get left timestamp", async function () {
            const timeLeft: BigNumber = await platform.getLeftTimestampOfStage();
        });
        describe("End of trade period", function () {
            // let initialOwnerBalance:BigNumber,
            //     firstFee:BigNumber;
            before(async function () {
                const timeLeft: BigNumber = await platform.getLeftTimestampOfStage();
                await passTime(timeLeft.toNumber());
                await platform.connect(owner).changeStageRequest();

            });
            this.beforeEach(async function () {
            });
            it("Should check stage of platform", async function () {
                expect(await platform.viewCurrentPlatformState()).to.eq("Sale");
            });
            it("Should check that order closed", async function () {
                const answerToAlice = await platform.getOrderInfo(1);
                expect(answerToAlice[3]).to.eq(false);
            });
            it("Should view token balance after closing order and fetch tokens", async function () {
                const tokens = (await platform.connect(bob).viewMyTokenBalance());
                const tokensLeft:BigNumber = bobsTokenAmount.sub(aliceTokenAmount);
                expect(tokens).to.eq(tokensLeft);
                const tokenbalance1:BigNumber = await token.balanceOf(bob.address);
                await platform.connect(bob).fetchTokens();
                expect(await token.balanceOf(bob.address)).to.eq(tokenbalance1.add(tokensLeft))

            });
            it("Should check", async function () {
                console.log("test");
            });
            
        });
        describe("Should buy all tokens at order", async function () {
            let 
                aliceTokenAmount:BigNumber,
                aliceVlaue:BigNumber,
                beforeAliceBalance:BigNumber,
                desiredTokenAmount:BigNumber,
                aliceTxFee:BigNumber;
                before(async function () {
                [alice, owner, bob] = await ethers.getSigners();
            platformFactory = await ethers.getContractFactory("ACDMPlatform2", owner);
            tokenFactory = await ethers.getContractFactory("ZepToken", owner)
            token = await tokenFactory.deploy(owner.address);
            await token.deployed();
            const MINTER = await token.MINTER();
            const BURNER = await token.BURNER();
            platform = await platformFactory.deploy(token.address);
            await platform.deployed();
            await token.connect(owner).setupPlatform(platform.address);
            await platform.connect(owner).startSale();
            await registerUsers();
            initialOwnerBalance = await ethers.provider.getBalance(owner.address);
            // buy to change state
            firstFee = await doAndGetFee(await platform.connect(bob).buyAtContract({ value: ethers.utils.parseEther("0.5") }));
            secondFee = await doAndGetFee(await platform.connect(bob).buyAtContract({ value: ethers.utils.parseEther("0.5") }));  
            // gain reward to calculate easear  
            await platform.connect(alice).fetchEther() 
            await platform.connect(owner).fetchEther() 
            // set order
            bobsOrderTokenPrice = (ethers.utils.parseEther("0.0002"));
            bobsTokenAmount = ethers.utils.parseEther("10000");
            const approval = await token.connect(bob).approve(platform.address, bobsTokenAmount);
            await approval.wait();
            await platform.connect(bob).createOrder(
                bobsTokenAmount, bobsOrderTokenPrice
            );
            await platform.connect(alice).buyAtOrder(1)
            await platform.connect(alice).buyAtOrder(1,
                { value: bobsTokenAmount.mul(bobsOrderTokenPrice).div(ethers.utils.parseEther("1")) });
            
                
            });
            it("Should check alice token balance", async function () {
                expect(await token.balanceOf(alice.address)).to.eq(bobsTokenAmount)
                // expect(aliceTokenAmount).to.eq(desiredTokenAmount);
    
            });
            it("Should check order info", async function () {
                const answerToAlice = await platform.getOrderInfo(1);
                expect(answerToAlice[0]).to.eq(bobsTokenAmount);
                expect(answerToAlice[1]).to.eq(bobsTokenAmount);
                expect(answerToAlice[2]).to.eq(bobsOrderTokenPrice);
                expect(answerToAlice[3]).to.eq(false);
            });
            it("Should get left timestamp", async function () {
                const timeLeft: BigNumber = await platform.getLeftTimestampOfStage();
            });
            it("Should withdraw admin balance", async function () {
                await platform.connect(owner).adminWithdrawPlatformBalance();
            });
        });
    });

});

// describe("Check ability to buy tokens from platform", function () {
//     let initialOwnerBalance:BigNumber,
//         firstFee:BigNumber;
//     before(async function () {
        
//     });
//     this.beforeEach(async function () {
//     });
//     it("Should check", async function () {
//     });
    
// });
// describe("Check ability to buy tokens from platform", function () {
//     let initialOwnerBalance:BigNumber,
//         firstFee:BigNumber;
//     before(async function () {
        
//     });
//     this.beforeEach(async function () {
//     });
//     it("Should check", async function () {
//     });
    
// });
// describe("Check ability to buy tokens from platform", function () {
//     let initialOwnerBalance:BigNumber,
//         firstFee:BigNumber;
//     before(async function () {
        
//     });
//     this.beforeEach(async function () {
//     });
//     it("Should check", async function () {
//     });
    
// });
// describe("Check ability to buy tokens from platform", function () {
//     let initialOwnerBalance:BigNumber,
//         firstFee:BigNumber;
//     before(async function () {
        
//     });
//     this.beforeEach(async function () {
//     });
//     it("Should check", async function () {
//     });
    
// });
// describe("Check ability to buy tokens from platform", function () {
//     let initialOwnerBalance:BigNumber,
//         firstFee:BigNumber;
//     before(async function () {
        
//     });
//     this.beforeEach(async function () {
//     });
//     it("Should check", async function () {
//     });
    
// });