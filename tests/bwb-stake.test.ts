import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { BwbStake } from "../target/types/bwb_stake";

import {
  clusterApiUrl,
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  SYSVAR_RENT_PUBKEY  
} from '@solana/web3.js';

import {
  getPayer,
  initializeSigner,
  hexToBytes
} from '../utils/utils';

import {u64, TOKEN_PROGRAM_ID} from "@solana/spl-token";
import { expect } from "chai";

describe("bwb-stake", async () => {

  let payer: Keypair = await getPayer();
  let cosigner: Keypair = await initializeSigner('../keys/wallet-pair-cosigner.json');
  let admin = await initializeSigner('../keys/fund_account.json');
  let receiver: Keypair = await initializeSigner('../keys/receiver-keypair.json');
  let pool_admin: Keypair = receiver;
  let operator: Keypair = await initializeSigner('../keys/operate-keypair.json');
  let programIdSelf: Keypair = await initializeSigner('../keys/bwb_stake-keypair.json');

  let user01: Keypair = await initializeSigner('../keys/userKp.json');//J9DKMBBqdnFDuPxBNqxeMTsL3vWQatz3tJJEBhg71S24
  let user02: Keypair = await initializeSigner('../keys/userKp02.json');//BKprKM553wXVWayY3X38KDRYfkC4cCqh5vpKwa7Qygr2
  let user01_ata = new PublicKey("EXwCW3QYc14XnJvCR4umvWxPBGyrRbU7MuNmkXvDd1i9");
  let user02_ata = new PublicKey("E1T9XWnS1nFwSL41nXYs5qoLQC6WrTJxkvQwo32TNzJD");
  let user : Keypair = user01;
  let user_ata = user01_ata;

  console.log("payer is : " + payer.publicKey);
  console.log("cosigner is : " + cosigner.publicKey);
  console.log("admin is : " + admin.publicKey);
  console.log("receiver is : " + receiver.publicKey.toBase58());
  console.log("operator is : " + operator.publicKey.toBase58());
  console.log("pool_admin is : " + pool_admin.publicKey.toBase58());
  console.log("programIdSelf is : " + programIdSelf.publicKey.toBase58());

  let token_mint = new PublicKey("83QLg6QKjfFCgoFWTx8x2EAytbAwVgA5G1mtAcsnybtp");//devnet
  //let token_mint = new PublicKey("G1GV35DHibxUDJtMC9DBRzruqhLhEe6tr85WQ73XoPJ3");//mainnet TT02
  let payer_ata = new PublicKey("AR1aJmL5jWmV53bQXSQaHNvB6uqmbC9yH1yVqhRnHvvi");
  let receiver_ata = new PublicKey('Bx66barTesm9yjcvRd8QSedgpxphBY8EfgbvgXUthDGe');

  process.env.ANCHOR_WALLET = process.env.HOME + '/.config/solana/id.json';
  process.env.ANCHOR_PROVIDER_URL = 'https://api.devnet.solana.com';

  // Configure the client to use the local cluster.
  anchor.setProvider(anchor.AnchorProvider.env());

  const program = anchor.workspace.BwbStake as Program<BwbStake>;

  const connection = new Connection(clusterApiUrl('devnet'), 'confirmed');
  // const connection = new Connection(clusterApiUrl('mainnet-beta'), 'confirmed');

  console.log("===program is: ", program.programId);

  let [adminInfoPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("admin_info")],
    program.programId
  );
  console.log("adminInfoPda is : " + adminInfoPda);

  let [vaultTokenAccountPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("vault_token_account")],
    program.programId
  );

  it("Is initialized!", async () => {
    // Add your test here.
    let tx = await program.methods.initialize(
      cosigner.publicKey, admin.publicKey,receiver.publicKey,operator.publicKey, pool_admin.publicKey
    ).accounts({
      payer: payer.publicKey,
      adminInfo: adminInfoPda,
      stakeTokenMint: token_mint,
      vaultTokenAccount:vaultTokenAccountPda,
      systemProgram: SystemProgram.programId,
      tokenProgram: TOKEN_PROGRAM_ID
    }).signers([payer])
    .rpc();
    console.log("Your transaction signature", tx);

    let adminInfoPdaData = await program.account.adminInfo.fetch(adminInfoPda);
    console.log("adminInfoPdaData is ", adminInfoPdaData);

    expect(adminInfoPdaData.admin.toString()).equals(admin.publicKey.toBase58());
    expect(adminInfoPdaData.cosigner.toString()).equals(cosigner.publicKey.toBase58());
    expect(adminInfoPdaData.receiver.toString()).equals(receiver.publicKey.toBase58());
    expect(adminInfoPdaData.operator.toString()).equals(operator.publicKey.toBase58());
    expect(adminInfoPdaData.poolAdmin.toString()).equals(pool_admin.publicKey.toBase58());

  });

  it("Create New Pool", async () => {
    let now_time = Date.now();
    let time_stamp = (now_time/1000).toFixed();
    console.log("now_time is",time_stamp);
    // PoolType, 
    // 0 => 7 days  15%,
    // 1 => 30 days 25%,
    // 2 => 7 days  35%,
    const stake_cap_bn = new u64("100000000000000");
    const reward_cap_bn = new u64("25000000000000");
    const one_day_bn = new u64("120");//test 2m per day, 
    const duration_time = new u64("3600");// test 30 days
    const duration_time_86400 = new u64("86400");// test 
    let start_at = new u64(time_stamp).add(new u64(300));
    let end_at = start_at.add(duration_time_86400);

    let adminInfoPdaData = await program.account.adminInfo.fetch(adminInfoPda);
    //console.log("adminInfoPdaData is ", adminInfoPdaData);
    let poolId_ = adminInfoPdaData.nextPoolId;
    let [newPoolPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("new_pool"), adminInfoPdaData.nextPoolId.toBuffer()],
      program.programId
    );

    let tx = await program.methods.createNewPool(
      stake_cap_bn, reward_cap_bn, start_at, end_at,duration_time
    ).accounts({
      poolAdmin: pool_admin.publicKey,
      adminInfo:adminInfoPda,
      newPool:newPoolPda,
      systemProgram:SystemProgram.programId,
      rent:SYSVAR_RENT_PUBKEY,
    }).signers([pool_admin])
    .rpc();
    console.log("Your transaction signature", tx);

    let newPoolPdaData = await program.account.poolInfo.fetch(newPoolPda);
    //console.log("newPoolPdaData is ", newPoolPdaData);

    expect(newPoolPdaData.stakeCap.toString()).equals(stake_cap_bn);
    expect(newPoolPdaData.rewardCap.toString()).equals(reward_cap_bn);
    expect(newPoolPdaData.stakeVisible.toString()).equals(stake_cap_bn);
    expect(newPoolPdaData.rewardVisible.toString()).equals(reward_cap_bn);
    expect(newPoolPdaData.stakeStartAt.toString()).equals(start_at);
    expect(newPoolPdaData.stakeEndAt.toString()).equals(end_at);
    expect(newPoolPdaData.duration.toString()).equals(duration_time);
    expect(newPoolPdaData.isPaused).equals(false);
    expect(newPoolPdaData.poolId).equals(poolId_); 
  });

  it("Update Pool", async () => {
    let now_time = Date.now();
    let time_stamp = (now_time/1000).toFixed();
    console.log("now_time is",time_stamp);
    // PoolType, 
    // 0 => 7 days  15%,
    // 1 => 30 days 25%,
    // 2 => 7 days  35%,
    let poolId_ = new u64(0);
    let [newPoolPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("new_pool"), poolId_.toBuffer()],
      program.programId
    );
    let poolInfoPdaData = await program.account.poolInfo.fetch(newPoolPda);
    console.log("poolInfoPdaData is ", poolInfoPdaData);

    const stake_cap_bn = new u64("100000000000000");
    const reward_cap_bn = new u64("25000000000000");
    const one_day_bn = new u64("120");//test 2m per day, 
    const duration_time = new u64("3600");// test 30 days
    const duration_time_86400 = new u64("86400");// test 
    let start_at = new u64(poolInfoPdaData.stakeStartAt);
    let end_at = start_at.add(duration_time_86400).add(duration_time_86400);

    let tx = await program.methods.updatePool(
      poolId_,stake_cap_bn, reward_cap_bn, start_at, end_at, duration_time
    ).accounts({
      poolAdmin: pool_admin.publicKey,
      adminInfo:adminInfoPda,
      pool:newPoolPda,
      systemProgram:SystemProgram.programId,
      rent:SYSVAR_RENT_PUBKEY,
    }).signers([pool_admin])
    .rpc();
    console.log("Your transaction signature", tx);

    let newPoolPdaData = await program.account.poolInfo.fetch(newPoolPda);

    expect(newPoolPdaData.stakeCap.toString()).equals(stake_cap_bn);
    expect(newPoolPdaData.rewardCap.toString()).equals(reward_cap_bn);
    expect(newPoolPdaData.stakeStartAt.toString()).equals(poolInfoPdaData.stakeStartAt);
    expect(newPoolPdaData.stakeEndAt.toString()).equals(end_at);
    expect(newPoolPdaData.poolId).equals(poolId_); 
  });

  it("Stake", async () => {
    let now_time = Date.now();
    let time_stamp = (now_time/1000).toFixed();
    console.log("now_time is",time_stamp);

    const stake_cap_bn = new u64("100000000000000");
    const reward_cap_bn = new u64("25000000000000");
    const duration_time = new u64("3600");// test 30 days

      // >= second order
      let [userInfoPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("user_info"), user.publicKey.toBuffer()],
        program.programId
      );
      let userInfoPdaData = await program.account.userInfo.fetch(userInfoPda);
      console.log("userInfoPda is ", userInfoPda);
      let orderId = userInfoPdaData.nextOrderId;
      let [orderInfoPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("new_order"), user.publicKey.toBuffer(), orderId.toBuffer()],
        program.programId
      );
      console.log("orderInfoPda is ", orderInfoPda);

      let transferAmount = new anchor.BN(5e9);
      let poolId = new u64(0);
      let [poolPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("new_pool"), poolId.toBuffer()],
        program.programId
      );
      console.log("poolPda is ", poolPda);
      
      console.log("userInfoPdaData is ", userInfoPdaData);

      let tx = await program.methods.stake(
        poolId,
        transferAmount,
      ).accounts({
        adminInfo: adminInfoPda,
        pool:poolPda,
        userInfo:userInfoPda,
        stakeTokenMint: token_mint,
        user:user.publicKey,//payer,// sender
        newOrder:orderInfoPda,
        vaultTokenAccount: vaultTokenAccountPda,
        userTokenWallet:user_ata,// one token acount
        cosigner:cosigner.publicKey,
        systemProgram: SystemProgram.programId,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers([user,cosigner])
      .rpc({
        skipPreflight:false
      }).catch(e => console.error(e));

      console.log("Your transaction signature", tx);

      let orderInfoPdaData = await program.account.orderInfo.fetch(orderInfoPda);
      console.log("orderInfoPdaData is ", orderInfoPdaData);

      expect(orderInfoPdaData.poolId).equals(poolId);
      expect(orderInfoPdaData.staker).equals(user.publicKey);
      expect(orderInfoPdaData.stakeAmount.toString()).equals(transferAmount);
      expect(orderInfoPdaData.rewardAmount.toString()).equals(transferAmount.div(new anchor.BN(4)));
      expect(orderInfoPdaData.startTime.toString()).equals(time_stamp);
      expect(orderInfoPdaData.unstakeTime.toString()).equals(new u64(time_stamp).add(duration_time));
      expect(orderInfoPdaData.isUnstake).equals(false);
      expect(orderInfoPdaData.claimedReward).equals(0); 

      userInfoPdaData = await program.account.userInfo.fetch(userInfoPda);
      expect(userInfoPdaData.nextOrderId).equals(poolId.add(new anchor.BN(1))); 

      let poolPdaData = await program.account.poolInfo.fetch(poolPda);
      expect(poolPdaData.stakeVisible).equals(stake_cap_bn.sub(transferAmount)); 
      expect(poolPdaData.rewardVisible).equals(reward_cap_bn.sub(orderInfoPdaData.rewardAmount)); 

  });

  it("Claim reward", async () => {
    let now_time = Date.now();
    let time_stamp = (now_time/1000).toFixed();
    console.log("now_time is",time_stamp);

    // >= second order
    let [userInfoPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("user_info"), user.publicKey.toBuffer()],
      program.programId
    );
    let userInfoPdaData = await program.account.userInfo.fetch(userInfoPda);
    console.log("userInfoPda is ", userInfoPda);

    let orderId = userInfoPdaData.nextOrderId;
    let [orderInfoPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("new_order"), user.publicKey.toBuffer(), orderId.toBuffer()],
      program.programId
    );
    console.log("orderInfoPda is ", orderInfoPda);

    let orderInfoPdaData = await program.account.orderInfo.fetch(orderInfoPda);
    console.log("orderInfoPdaData is ", orderInfoPdaData);


    // let rewardAmount = new anchor.BN(5e9);
    const duration_time = new u64("3600");// test 30 days
    let ONE_DAY = new anchor.BN(120);// seconds
    let passedDays= new anchor.BN(time_stamp)
                      .sub(new anchor.BN(orderInfoPdaData.startTime))
                      .div(new anchor.BN(ONE_DAY));
    let periodDays = duration_time.div(ONE_DAY);
    let passedDaysReward = new anchor.BN(orderInfoPdaData.rewardAmount).mul(passedDays).div(periodDays);
    let rewardAmount = passedDaysReward.sub(new anchor.BN(orderInfoPdaData.claimedReward));

    let poolId = new u64(0);
    let [poolPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("new_pool"), poolId.toBuffer()],
      program.programId
    );
    console.log("poolPda is ", poolPda);

    let beforeTotalClaimedReward = new u64(userInfoPdaData.totalClaimedReward);

    let tx = await program.methods.claimReward(
      poolId,
      rewardAmount,
    ).accounts({
      adminInfo: adminInfoPda,
      pool:poolPda,
      userInfo:userInfoPda,
      stakeTokenMint: token_mint,
      user:user.publicKey,//payer,// sender
      order:orderInfoPda,
      vaultTokenAccount: vaultTokenAccountPda,
      userTokenWallet:user_ata,// one token acount
      cosigner:cosigner.publicKey,
      systemProgram: SystemProgram.programId,
      tokenProgram: TOKEN_PROGRAM_ID,
    })
    .signers([user,cosigner])
    .rpc({
      skipPreflight:false
    }).catch(e => console.error(e));

    console.log("Your transaction signature", tx);

    orderInfoPdaData = await program.account.orderInfo.fetch(orderInfoPda);
    console.log("orderInfoPdaData is ", orderInfoPdaData);

    expect(orderInfoPdaData.poolId).equals(poolId);
    expect(orderInfoPdaData.staker).equals(user.publicKey);
    expect(orderInfoPdaData.isUnstake).equals(false);
    expect(orderInfoPdaData.claimedReward).equals(rewardAmount);

    userInfoPdaData = await program.account.userInfo.fetch(userInfoPda);
    console.log("userInfoPda is ", userInfoPda);

    let afterTotalClaimedReward = new u64(userInfoPdaData.totalClaimedReward);
    expect(afterTotalClaimedReward.sub(beforeTotalClaimedReward)).equals(rewardAmount);

  });

  it("unstake", async () => {
    let now_time = Date.now();
    let time_stamp = (now_time/1000).toFixed();
    console.log("now_time is",time_stamp);

    // >= second order
    let [userInfoPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("user_info"), user.publicKey.toBuffer()],
      program.programId
    );
    let userInfoPdaData = await program.account.userInfo.fetch(userInfoPda);
    console.log("userInfoPda is ", userInfoPda);
    let beforeTotalClaimedReward = new u64(userInfoPdaData.totalClaimedReward);

    let orderId = userInfoPdaData.nextOrderId;
    let [orderInfoPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("new_order"), user.publicKey.toBuffer(), orderId.toBuffer()],
      program.programId
    );
    console.log("orderInfoPda is ", orderInfoPda);

    let orderInfoPdaData = await program.account.orderInfo.fetch(orderInfoPda);

    let totalRewardAmount = new anchor.BN(orderInfoPdaData.rewardAmount);
    let rewardAmount = totalRewardAmount.sub(new anchor.BN(orderInfoPdaData.claimedReward));

    let poolId = new u64(0);
    let [poolPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("new_pool"), poolId.toBuffer()],
      program.programId
    );
    console.log("poolPda is ", poolPda);

    let unstakeAmount = new anchor.BN(orderInfoPdaData.stakeAmount);
    if(new anchor.BN(time_stamp).gt(orderInfoPdaData.unstakeTime)) {
      let tx = await program.methods.unstake(
        poolId,
        unstakeAmount,
        rewardAmount,
      ).accounts({
        adminInfo: adminInfoPda,
        pool:poolPda,
        userInfo:userInfoPda,
        stakeTokenMint: token_mint,
        user:user.publicKey,//payer,// sender
        order:orderInfoPda,
        vaultTokenAccount: vaultTokenAccountPda,
        userTokenWallet:user_ata,// one token acount
        cosigner:cosigner.publicKey,
        systemProgram: SystemProgram.programId,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers([user,cosigner])
      .rpc({
        skipPreflight:false
      }).catch(e => console.error(e));
  
      console.log("Your transaction signature", tx);
  
      orderInfoPdaData = await program.account.orderInfo.fetch(orderInfoPda);
      console.log("orderInfoPdaData is ", orderInfoPdaData);
  
      expect(orderInfoPdaData.poolId).equals(poolId);
      expect(orderInfoPdaData.staker).equals(user.publicKey);
      expect(orderInfoPdaData.isUnstake).equals(true);
      expect(orderInfoPdaData.claimedReward).equals(orderInfoPdaData.rewardAmount); 

      userInfoPdaData = await program.account.userInfo.fetch(userInfoPda);
      let afterTotalClaimedReward = new u64(userInfoPdaData.totalClaimedReward);
      expect(afterTotalClaimedReward.sub(beforeTotalClaimedReward)).equals(rewardAmount);

    } else {
      console.log("Cannot unstake now!");
    }

  });

});
