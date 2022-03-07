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


let
  alice: SignerWithAddress,
  bob: SignerWithAddress,
  owner: SignerWithAddress,
  platform: Contract,
  token: Contract,
  platformFactory: ContractFactory,
  NFTaddress: Address;
describe("Platform", function () {
  before(async function () {
    [alice, owner, bob] = await ethers.getSigners();
    platformFactory = await ethers.getContractFactory("ACDMPlatform", owner);
  });
  beforeEach(async function () {
    platform = await platformFactory.deploy();
    await platform.deployed();
    token = await ethers.getContractAt("ZepToken", await platform.tokenAddress());
  });
  describe("Platform nested", function () {


    it("Should test", async function () {

      const platformFactory = await ethers.getContractFactory("ACDMPlatform", owner);
      const platform = await platformFactory.deploy();
      await platform.deployed();
      const token = await ethers.getContractAt("ZepToken", await platform.tokenAddress());
      // register
      await platform.connect(alice).register(ethers.constants.AddressZero); //without ref address
      await platform.connect(bob).register(alice.address); //alice is referable
      await platform.connect(owner).register(bob.address); // bob and alice should gain fee
      // check availableTokenBalance
      expect(await platform.getAvailableTokenAmount()).to.eq(ethers.utils.parseEther("100000"));
      // check tokenPrice
      expect(await platform.getCurrentTokenPrice()).to.eq(ethers.utils.parseEther("0.00001"));
      // check that we minted
      const tokenDecimals = await token.decimals();
      expect(tokenDecimals).to.eq(18);
      expect(await token.balanceOf(platform.address)).to.eq(ethers.utils.parseEther("100000"));
      // calculate 
      const testTokenAmount: BigNumber = await platform.connect(owner).howManyTokensCanIBuyForEther(ethers.utils.parseEther("0.5"));
      expect(await token.totalSupply()).to.eq(testTokenAmount.mul(2)); // means that we can buy half of tokens for 0.5 eth
      // buy tokens with 0.5 ether
      const initialOwnerBalance = await ethers.provider.getBalance(owner.address);
      const firstFee = await doAndGetFee(await platform.connect(owner).buyAtContract({ value: ethers.utils.parseEther("0.5") }));
      // check owner ether and token balance
      expect(await token.balanceOf(owner.address)).to.eq(ethers.utils.parseEther("50000"));
      expect(await ethers.provider.getBalance(platform.address)).to.eq(ethers.utils.parseEther("0.5"));
      expect(await ethers.provider.getBalance(owner.address)).to.eq(initialOwnerBalance.sub(ethers.utils.parseEther("0.5")).sub(firstFee));
      // // check referalReward
      expect(await platform.etherBalances(bob.address)).to.eq(ethers.utils.parseEther(String(0.5 / 20)))
      expect(await platform.etherBalances(alice.address)).to.eq(ethers.utils.parseEther(String(0.5 / 100 * 3)))
      // // check availableTokenBalance
      expect(await platform.getAvailableTokenAmount()).to.eq(ethers.utils.parseEther("50000"));
      // // buy the rest of tokens
      const initialBobBalance: BigNumber = await ethers.provider.getBalance(bob.address);
      const secondfFee: BigNumber = await doAndGetFee(await platform.connect(bob).buyAtContract({ value: ethers.utils.parseEther("0.5") }));
      // // check state
      expect(await platform.viewCurrentPlatformState()).to.eq("Trade");
      // // check alice's reward
      expect(await platform.etherBalances(alice.address)).to.eq(ethers.utils.parseEther(String(0.5 / 20 + (0.5 / 100 * 3))))
      // // check bob balance
      expect(await token.balanceOf(bob.address)).to.eq(ethers.utils.parseEther("50000"));
      expect(await ethers.provider.getBalance(platform.address)).to.eq(ethers.utils.parseEther("1"));
      const afterBobBalance: BigNumber = await ethers.provider.getBalance(bob.address);
      expect(
        initialBobBalance.sub(afterBobBalance.add(secondfFee.add(ethers.utils.parseEther("0.5"))))
      ).to.eq(0);
      // // DAAAAAAAAAA
      // // create order
      expect(await token.balanceOf(platform.address)).to.eq(0);
      await token.connect(owner).approve(platform.address, ethers.utils.parseEther("10000"));
      // const platformTokenPrice:BigNumber = await platform.currentPrice();
      const ownersOrderTokenPrice: BigNumber = (ethers.utils.parseEther("0.0002"));
      const ownersTokenAmount: BigNumber = ethers.utils.parseEther("10000");
      await platform.connect(owner).createOrder(
        ownersTokenAmount, ownersOrderTokenPrice
      );
      // check price [deprecated]
      // expect(await platform.getEtherPriceOfOrder(1)).to.eq(ownersOrderTokenPrice.mul(ethers.utils.parseEther("10000")));
      // check info
      // expect(await platform.isOrderOpen(1)).to.eq(true);
      const answer = await platform.getOrderInfo(1);
      expect(answer[0]).to.eq(ownersTokenAmount);
      expect(answer[1]).to.eq(0);
      expect(answer[2]).to.eq(ownersOrderTokenPrice);
      const ownersFullPrice = ownersTokenAmount.mul(ownersOrderTokenPrice).div(ethers.utils.parseEther("1"));
      // buy half of order
      const aliceTokenAmount = ethers.utils.parseEther("5000");
      const aliceVlaue = ((ownersOrderTokenPrice).mul(aliceTokenAmount)).div(ethers.utils.parseEther("1"));
      // ethers.utils.formatUnits
      const beforeAliceBalance = await ethers.provider.getBalance(alice.address);
      // console.log("ownersOrderTokenPrice is ", String(ownersOrderTokenPrice));
      // console.log("ownersTokenAmount is     ", String(ownersTokenAmount));
      // console.log("aliceVlaue is            ", String(aliceVlaue));
      // console.log("aliceBalance is          ", String(beforeAliceBalance));
      // console.log("ownersFullPrice is       ", String(ownersFullPrice));
      // console.log("getFullPriceOfOrder is   ", String(await platform.getFullPriceOfOrder(1)));
      // check how many tokens we can buy
      const desiredTokenAmount: BigNumber = (await platform.tokenAmountByEtherAtOrder(1, aliceVlaue));
      const aliceTxFee = await doAndGetFee(await
        platform.connect(alice).buyAtOrder(1,
          { value: aliceVlaue })
      );
      // check token balance
      expect(await token.balanceOf(alice.address)).to.eq(desiredTokenAmount)
      expect(aliceTokenAmount).to.eq(desiredTokenAmount);
      // check orderInfo
      const answerToAlice = await platform.getOrderInfo(1);
      expect(answerToAlice[0]).to.eq(ownersTokenAmount);
      expect(answerToAlice[1]).to.eq(aliceTokenAmount);
      expect(answerToAlice[2]).to.eq(ownersOrderTokenPrice);
      // TODO check reward

      // get left timestamp
      const timeLeft: BigNumber = await platform.getLeftTimestampOfStage();
      console.log(String(timeLeft), " seconds are left");
      // change state 
      await passTime(timeLeft.toNumber());
      // 
      await platform.connect(owner).changeStageRequest();
      expect(await platform.viewCurrentPlatformState()).to.eq("Sale");










      // expect(await platform.getEtherPriceOfOrder(1)).to.eq(ownersTokenAmount.mul(ownersOrderTokenPrice));


      // expect(await platform.getOrderInfo(1)).to.equal([ethers.utils.parseEther("10000"),ethers.utils.parseEther("10000"),ownersOrderTokenPrice]);
    });
  });
});





















// events: register event
// order created
// something buyed
// order closed by buyer
// order closed by contract
// sale is over
// trade is over
// 
// 
// 
// 





















// describe("Greeter", function () {
//   it("Should return the new greeting once it's changed", async function () {
//     const Greeter = await ethers.getContractFactory("Greeter");
//     const greeter = await Greeter.deploy("Hello, world!");
//     await greeter.deployed();

//     expect(await greeter.greet()).to.equal("Hello, world!");

//     const setGreetingTx = await greeter.setGreeting("Hola, mundo!");

//     // wait until the transaction is mined
//     await setGreetingTx.wait();

//     expect(await greeter.greet()).to.equal("Hola, mundo!");
//   });
// });
