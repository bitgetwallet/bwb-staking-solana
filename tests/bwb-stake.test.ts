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

// Helpers
function wait(ms: number) {
  return new Promise( resolve => setTimeout(resolve, ms) );
}

describe("bwb-stake",  () => {
    let payer: Keypair ;
    let cosigner: Keypair;
    let admin : Keypair;
    let receiver: Keypair;
    let pool_admin: Keypair ;
    let operator: Keypair ;
  
    let user01: Keypair ;//J9DKMBBqdnFDuPxBNqxeMTsL3vWQatz3tJJEBhg71S24
    let user02: Keypair ;//BKprKM553wXVWayY3X38KDRYfkC4cCqh5vpKwa7Qygr2
    let user01_ata = new PublicKey("EXwCW3QYc14XnJvCR4umvWxPBGyrRbU7MuNmkXvDd1i9");
    let user02_ata = new PublicKey("E1T9XWnS1nFwSL41nXYs5qoLQC6WrTJxkvQwo32TNzJD");
    let user : Keypair = user01;
    let user_ata = user01_ata;

  before("before",async () =>{
    payer = await getPayer();
    cosigner = await initializeSigner('../keys/wallet-pair-cosigner.json');
    admin = await initializeSigner('../keys/fund_account.json');
    receiver = await initializeSigner('../keys/receiver-keypair.json');
    pool_admin = receiver;
    operator = await initializeSigner('../keys/operate-keypair.json');
  
    user01 = await initializeSigner('../keys/userKp.json');//J9DKMBBqdnFDuPxBNqxeMTsL3vWQatz3tJJEBhg71S24
    user02 = await initializeSigner('../keys/userKp02.json');//BKprKM553wXVWayY3X38KDRYfkC4cCqh5vpKwa7Qygr2
    user01_ata = new PublicKey("EXwCW3QYc14XnJvCR4umvWxPBGyrRbU7MuNmkXvDd1i9");
    user02_ata = new PublicKey("E1T9XWnS1nFwSL41nXYs5qoLQC6WrTJxkvQwo32TNzJD");
    user  = user01;
    user_ata = user01_ata;
  
    console.log("payer is : " + payer.publicKey);
    console.log("cosigner is : " + cosigner.publicKey);
    console.log("admin is : " + admin.publicKey);
    console.log("receiver is : " + receiver.publicKey.toBase58());
    console.log("operator is : " + operator.publicKey.toBase58());
    console.log("pool_admin is : " + pool_admin.publicKey.toBase58());
  })

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

  it("Initialized fail!", async () => {
    let adminInfoPdaData = await program.account.adminInfo.fetch(adminInfoPda);
    console.log("adminInfoPdaData is ", adminInfoPdaData);

    // Add your test here.
   try {
    payer = admin;// 使用非 authority帐户初始化，均会引起programData的帐户检查报错
    let programDataPDA = new PublicKey("H8SSWeMWBfyvTrFY4AGck1SFUitYfuHv4yCwXtEdMJ5");
    let tx = await program.methods.initialize(
      cosigner.publicKey, admin.publicKey,receiver.publicKey,operator.publicKey, pool_admin.publicKey
    ).accounts({
      authority: payer.publicKey,
      adminInfo: adminInfoPda,
      stakeTokenMint: token_mint,
      vaultTokenAccount:vaultTokenAccountPda,
      program:program.programId,
      programData:programDataPDA,
      systemProgram: SystemProgram.programId,
      tokenProgram: TOKEN_PROGRAM_ID
    }).signers([payer])
    .rpc()
   } catch (error) {
    console.log(error.error.errorCode);
    expect(error.error.errorCode.code).equals('ConstraintRaw');
    expect(error.error.errorCode.number).equals(2003);
    expect(error.error.origin).equals('program_data');
   }
    

  });

  it("Initialized!", async () => {
    let adminInfoPdaData = await program.account.adminInfo.fetch(adminInfoPda);
    console.log("adminInfoPdaData is ", adminInfoPdaData);

    let programDataPDA = new PublicKey("H8SSWeMWBfyvTrFY4AGck1SFUitYfuHv4yCwXtEdMJ5");
    let tx = await program.methods.initialize(
      cosigner.publicKey, admin.publicKey,receiver.publicKey,operator.publicKey, pool_admin.publicKey
    ).accounts({
      authority: payer.publicKey,
      adminInfo: adminInfoPda,
      stakeTokenMint: token_mint,
      vaultTokenAccount:vaultTokenAccountPda,
      program:program.programId,
      programData:programDataPDA,
      systemProgram: SystemProgram.programId,
      tokenProgram: TOKEN_PROGRAM_ID
    }).signers([payer])
    .rpc().catch((err) => {console.log(err)});

    console.log("Your transaction signature", tx);

    adminInfoPdaData = await program.account.adminInfo.fetch(adminInfoPda);
    console.log("adminInfoPdaData is ", adminInfoPdaData);

    expect(adminInfoPdaData.admin.toString()).equals(admin.publicKey.toBase58());
    expect(adminInfoPdaData.cosigner.toString()).equals(cosigner.publicKey.toBase58());
    expect(adminInfoPdaData.receiver.toString()).equals(receiver.publicKey.toBase58());
    expect(adminInfoPdaData.operator.toString()).equals(operator.publicKey.toBase58());
    expect(adminInfoPdaData.poolAdmin.toString()).equals(pool_admin.publicKey.toBase58());

  });

  it("Failed to create New Pool", async () => {
    let now_time = Date.now();
    let time_stamp = (now_time/1000).toFixed();
    console.log("now_time is",time_stamp);
    const one_day_test = new u64("120");//test 2m per day
    // PoolType, 
    // 0 => 7 days  15%,
    // 1 => 30 days 25%,
    // 2 => 7 days  35%,
    const stake_cap = new u64("1500000000000000");
    const reward_cap = new u64("4315100000000");
    const duration_days = new u64(7);// test 7 days
    const duration_time = one_day_test.mul(duration_days);// test 7 days
    
    const duration_time_1days = new u64("86400");
    let start_at = new u64(time_stamp).add(new u64(300));
    let end_at = start_at.add(duration_time_1days);

    let adminInfoPdaData = await program.account.adminInfo.fetch(adminInfoPda);
    console.log("adminInfoPdaData is ", adminInfoPdaData);
    let poolId_ = adminInfoPdaData.nextPoolId;
    let [newPoolPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("new_pool"), new u64(poolId_.toString()).toBuffer()],
      program.programId
    );
    console.log("newPoolPda is",newPoolPda);

    let ixPause = await program.methods.setAdminIsPaused(true)
      .accounts({
        adminInfo:adminInfoPda,
        operator:operator.publicKey
      }).instruction();
    
    try {
      let duration_days_error = duration_days.add(new u64(1));
      let tx = await program.methods.createNewPool(
        stake_cap, reward_cap, start_at, end_at,duration_time,duration_days_error
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
      console.log("newPoolPdaData is ", newPoolPdaData);

    } catch (error) {
      console.log(error.error.errorCode);
      expect(error.error.errorCode.code).equals('DurationMustBeMultiDays');
      expect(error.error.errorCode.number).equals(6018);
    }

    try {
      let tx = await program.methods.createNewPool(
        stake_cap, reward_cap, start_at, end_at,duration_time,duration_days
      ).accounts({
        poolAdmin: pool_admin.publicKey,
        adminInfo:adminInfoPda,
        newPool:newPoolPda,
        systemProgram:SystemProgram.programId,
        rent:SYSVAR_RENT_PUBKEY,
      })
      .preInstructions([ixPause])
      .signers([pool_admin,operator])
      .rpc();

    } catch (error) {
      console.log(error.error.errorCode);
      expect(error.error.errorCode.code).equals('ProtocolPaused');
      expect(error.error.errorCode.number).equals(6000);
    }

    try {
      let start_at_error = new u64(time_stamp).sub(new u64(300));
      let tx = await program.methods.createNewPool(
        stake_cap, reward_cap, start_at_error, end_at,duration_time,duration_days
      ).accounts({
        poolAdmin: pool_admin.publicKey,
        adminInfo:adminInfoPda,
        newPool:newPoolPda,
        systemProgram:SystemProgram.programId,
        rent:SYSVAR_RENT_PUBKEY,
      }).signers([pool_admin])
      .rpc();

    } catch (error) {
      console.log(error.error.errorCode);
      expect(error.error.errorCode.code).equals('StartTimeNeedGTENow');
      expect(error.error.errorCode.number).equals(6025);
    }

    try {
      let end_at_error = start_at.sub(new u64(1));
      let tx = await program.methods.createNewPool(
        stake_cap, reward_cap, start_at, end_at_error,duration_time,duration_days
      ).accounts({
        poolAdmin: pool_admin.publicKey,
        adminInfo:adminInfoPda,
        newPool:newPoolPda,
        systemProgram:SystemProgram.programId,
        rent:SYSVAR_RENT_PUBKEY,
      }).signers([pool_admin])
      .rpc();
    } catch (error) {
      console.log(error.error.errorCode);
      expect(error.error.errorCode.code).equals('StartTimeNeedLTEndTime');
      expect(error.error.errorCode.number).equals(6013);
    }

    try {
      let duration_time_0 = new u64(0);
      let tx = await program.methods.createNewPool(
        stake_cap, reward_cap, start_at, end_at,duration_time_0,duration_days
      ).accounts({
        poolAdmin: pool_admin.publicKey,
        adminInfo:adminInfoPda,
        newPool:newPoolPda,
        systemProgram:SystemProgram.programId,
        rent:SYSVAR_RENT_PUBKEY,
      }).signers([pool_admin])
      .rpc();

    } catch (error) {
      console.log(error.error.errorCode);
      expect(error.error.errorCode.code).equals('DurationNeedGT0');
      expect(error.error.errorCode.number).equals(6017);
    }

    try {
      let stake_cap_0 = new u64(0);
      let tx = await program.methods.createNewPool(
        stake_cap_0, reward_cap, start_at, end_at,duration_time,duration_days
      ).accounts({
        poolAdmin: pool_admin.publicKey,
        adminInfo:adminInfoPda,
        newPool:newPoolPda,
        systemProgram:SystemProgram.programId,
        rent:SYSVAR_RENT_PUBKEY,
      }).signers([pool_admin])
      .rpc();

    } catch (error) {
      console.log(error.error.errorCode);
      expect(error.error.errorCode.code).equals('TwoCapsNeedGT0');
      expect(error.error.errorCode.number).equals(6026);
    }

    try {
      let reward_cap_0 = new u64(0);
      let tx = await program.methods.createNewPool(
        stake_cap, reward_cap_0, start_at, end_at,duration_time,duration_days
      ).accounts({
        poolAdmin: pool_admin.publicKey,
        adminInfo:adminInfoPda,
        newPool:newPoolPda,
        systemProgram:SystemProgram.programId,
        rent:SYSVAR_RENT_PUBKEY,
      }).signers([pool_admin])
      .rpc();

    } catch (error) {
      console.log(error.error.errorCode);
      expect(error.error.errorCode.code).equals('TwoCapsNeedGT0');
      expect(error.error.errorCode.number).equals(6026);
    }
  });

  it("Create New Pool", async () => {
    let now_time = Date.now();
    let time_stamp = (now_time/1000).toFixed();
    console.log("now_time is",time_stamp);
    const one_day_test = new u64("120");//test 2m per day
    // PoolType, 
    // 0 => 7 days  15%,
    // 1 => 30 days 25%,
    // 2 => 7 days  35%,
    const stake_cap = new u64("1500000000000000");
    const reward_cap = new u64("4315100000000");
    const duration_days = new u64(7);// test 7 days
    const duration_time = one_day_test.mul(duration_days);// test 7 days
    
    const duration_time_1days = new u64("86400");
    let start_at = new u64(time_stamp).add(new u64(300));
    let end_at = start_at.add(duration_time_1days);

    let adminInfoPdaData = await program.account.adminInfo.fetch(adminInfoPda);
    console.log("adminInfoPdaData is ", adminInfoPdaData);
    let poolId_ = adminInfoPdaData.nextPoolId;
    let [newPoolPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("new_pool"), new u64(poolId_.toString()).toBuffer()],
      program.programId
    );
    console.log("newPoolPda is",newPoolPda);
    
    try {
      let tx = await program.methods.createNewPool(
        stake_cap, reward_cap, start_at, end_at,duration_time,duration_days
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
      console.log("newPoolPdaData is ", newPoolPdaData);

      expect(newPoolPdaData.stakeCap.eq(stake_cap)).equals(true);
      expect(newPoolPdaData.rewardCap.eq(reward_cap)).equals(true);
      expect(newPoolPdaData.stakeVisible.eq(stake_cap)).equals(true);
      expect(newPoolPdaData.rewardVisible.eq(reward_cap)).equals(true);
      expect(newPoolPdaData.stakeStartAt.eq(start_at)).equals(true);
      expect(newPoolPdaData.stakeEndAt.eq(end_at)).equals(true);
      expect(newPoolPdaData.duration.eq(duration_time)).equals(true);
      expect(newPoolPdaData.isPaused).equals(false);
    } catch (error) {
      console.log(error.error.errorCode);
      expect(error.error.errorCode.code).equals('DurationMustBeMultiDays');
      expect(error.error.errorCode.number).equals(6018);
    }

  });

  it("Failed to update Pool", async () => {
    let now_time = Date.now();
    let time_stamp = (now_time/1000).toFixed();
    console.log("now_time is",time_stamp);
    const one_day_test = new u64("120");//test 2m per day
    // PoolType, 
    // 0 => 7 days  15%,
    // 1 => 30 days 25%,
    // 2 => 7 days  35%,
    const stake_cap = new u64("1500000000000000");
    const reward_cap = new u64("4315100000000");
    const duration_days = new u64(7);// test 7 days
    const duration_time = one_day_test.mul(duration_days);// test 7 days
    
    const duration_time_1days = new u64("86400");
    let start_at = new u64(time_stamp).add(new u64(300));
    let end_at = start_at.add(duration_time_1days);

    let poolId = new u64(3);

    let adminInfoPdaData = await program.account.adminInfo.fetch(adminInfoPda);
    console.log("adminInfoPdaData is ", adminInfoPdaData);
    let [newPoolPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("new_pool"), new u64(poolId).toBuffer()],
      program.programId
    );
    console.log("newPoolPda is",newPoolPda);

    let ixPause = await program.methods.setAdminIsPaused(true)
      .accounts({
        adminInfo:adminInfoPda,
        operator:operator.publicKey
      }).instruction();
    
    let newPoolPdaData = await program.account.poolInfo.fetch(newPoolPda);
    console.log("newPoolPdaData start is ", newPoolPdaData.stakeStartAt.toString());
    
    try {
      let duration_days_error = duration_days.add(new u64(1));
      let tx = await program.methods.updatePool(poolId,
        stake_cap, reward_cap, start_at, end_at,duration_time,duration_days_error
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
      console.log("newPoolPdaData is ", newPoolPdaData);
    } catch (error) {
      console.log(error.error.errorCode);
      expect(error.error.errorCode.code).equals('DurationMustBeMultiDays');
      expect(error.error.errorCode.number).equals(6018);
    }

    try {
      let tx = await program.methods.updatePool(poolId,
        stake_cap, reward_cap, start_at, end_at,duration_time,duration_days
      ).accounts({
        poolAdmin: pool_admin.publicKey,
        adminInfo:adminInfoPda,
        pool:newPoolPda,
        systemProgram:SystemProgram.programId,
        rent:SYSVAR_RENT_PUBKEY,
      })
      .preInstructions([ixPause])
      .signers([pool_admin,operator])
      .rpc();

    } catch (error) {
      console.log(error.error.errorCode);
      expect(error.error.errorCode.code).equals('ProtocolPaused');
      expect(error.error.errorCode.number).equals(6000);
    }

    try {
      let start_at_error = new u64(time_stamp).sub(new u64(300));
      let tx = await program.methods.updatePool(poolId,
        stake_cap, reward_cap, start_at_error, end_at,duration_time,duration_days
      ).accounts({
        poolAdmin: pool_admin.publicKey,
        adminInfo:adminInfoPda,
        pool:newPoolPda,
        systemProgram:SystemProgram.programId,
        rent:SYSVAR_RENT_PUBKEY,
      }).signers([pool_admin])
      .rpc();

    } catch (error) {
      console.log(error.error.errorCode);
      expect(error.error.errorCode.code).equals('StartTimeNeedGTENow');
      expect(error.error.errorCode.number).equals(6025);
    }

    try {
      let end_at_error = start_at.sub(new u64(1));
      let tx = await program.methods.updatePool(poolId,
        stake_cap, reward_cap, start_at, end_at_error,duration_time,duration_days
      ).accounts({
        poolAdmin: pool_admin.publicKey,
        adminInfo:adminInfoPda,
        pool:newPoolPda,
        systemProgram:SystemProgram.programId,
        rent:SYSVAR_RENT_PUBKEY,
      }).signers([pool_admin])
      .rpc();
    } catch (error) {
      console.log(error.error.errorCode);
      expect(error.error.errorCode.code).equals('StartTimeNeedLTEndTime');
      expect(error.error.errorCode.number).equals(6013);
    }

    try {
      let duration_time_0 = new u64(0);
      let tx = await program.methods.updatePool(poolId,
        stake_cap, reward_cap, start_at, end_at,duration_time_0,duration_days
      ).accounts({
        poolAdmin: pool_admin.publicKey,
        adminInfo:adminInfoPda,
        pool:newPoolPda,
        systemProgram:SystemProgram.programId,
        rent:SYSVAR_RENT_PUBKEY,
      }).signers([pool_admin])
      .rpc();

    } catch (error) {
      console.log(error.error.errorCode);
      expect(error.error.errorCode.code).equals('DurationNeedGT0');
      expect(error.error.errorCode.number).equals(6017);
    }

    try {
      let stake_cap_0 = new u64(0);
      let tx = await program.methods.updatePool(poolId,
        stake_cap_0, reward_cap, start_at, end_at,duration_time,duration_days
      ).accounts({
        poolAdmin: pool_admin.publicKey,
        adminInfo:adminInfoPda,
        pool:newPoolPda,
        systemProgram:SystemProgram.programId,
        rent:SYSVAR_RENT_PUBKEY,
      }).signers([pool_admin])
      .rpc();

    } catch (error) {
      console.log(error.error.errorCode);
      expect(error.error.errorCode.code).equals('TwoCapsNeedGT0');
      expect(error.error.errorCode.number).equals(6026);
    }

    try {
      let reward_cap_0 = new u64(0);
      let tx = await program.methods.updatePool(poolId,
        stake_cap, reward_cap_0, start_at, end_at,duration_time,duration_days
      ).accounts({
        poolAdmin: pool_admin.publicKey,
        adminInfo:adminInfoPda,
        pool:newPoolPda,
        systemProgram:SystemProgram.programId,
        rent:SYSVAR_RENT_PUBKEY,
      }).signers([pool_admin])
      .rpc();

    } catch (error) {
      console.log(error.error.errorCode);
      expect(error.error.errorCode.code).equals('TwoCapsNeedGT0');
      expect(error.error.errorCode.number).equals(6026);
    }

    try {
      let reward_cap_0 = new u64(0);
      let tx = await program.methods.updatePool(poolId,
        stake_cap, reward_cap_0, start_at, end_at,duration_time,duration_days
      ).accounts({
        poolAdmin: pool_admin.publicKey,
        adminInfo:adminInfoPda,
        pool:newPoolPda,
        systemProgram:SystemProgram.programId,
        rent:SYSVAR_RENT_PUBKEY,
      }).signers([pool_admin])
      .rpc();

    } catch (error) {
      console.log(error.error.errorCode);
      expect(error.error.errorCode.code).equals('TwoCapsNeedGT0');
      expect(error.error.errorCode.number).equals(6026);
    }

    try {
      let tx = await program.methods.updatePool(poolId,
        stake_cap, reward_cap, start_at, end_at, duration_time, duration_days
      ).accounts({
        poolAdmin: pool_admin.publicKey,
        adminInfo:adminInfoPda,
        pool:newPoolPda,
        systemProgram:SystemProgram.programId,
        rent:SYSVAR_RENT_PUBKEY,
      }).signers([pool_admin])
      .rpc();

    } catch (error) {
      console.log(error.error.errorCode);
      expect(error.error.errorCode.code).equals('PoolAlreadyStartStake');
      expect(error.error.errorCode.number).equals(6020);
    }

  });

  it("Update Pool", async () => {
    let now_time = Date.now();
    let time_stamp = (now_time/1000).toFixed();
    console.log("now_time is",time_stamp);
    const one_day_test = new u64("120");//test 2m per day
    // PoolType, 
    // 0 => 7 days  15%,
    // 1 => 30 days 25%,
    // 2 => 7 days  35%,
    const stake_cap = new u64("1500000000000000");
    const reward_cap = new u64("4315100000000");
    const duration_days = new u64(7);// test 7 days
    const duration_time = one_day_test.mul(duration_days);// test 7 days
    const duration_time_1days = new u64("86400");

    let poolId = new u64(3);
    let [newPoolPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("new_pool"), new u64(poolId).toBuffer()],
      program.programId
    );
    console.log("newPoolPda is",newPoolPda);
    let newPoolPdaData = await program.account.poolInfo.fetch(newPoolPda);
    console.log("newPoolPdaData is ", newPoolPdaData);
    let start_at = new u64(time_stamp).add(new u64(10));
    let end_at = start_at.add(duration_time_1days.mul(new u64(2)));

    let adminInfoPdaData = await program.account.adminInfo.fetch(adminInfoPda);
    console.log("adminInfoPdaData is ", adminInfoPdaData);

    let tx = await program.methods.updatePool(
      poolId,stake_cap, reward_cap, start_at, end_at, duration_time,duration_days
    ).accounts({
      poolAdmin: pool_admin.publicKey,
      adminInfo:adminInfoPda,
      pool:newPoolPda,
      systemProgram:SystemProgram.programId,
      rent:SYSVAR_RENT_PUBKEY,
    }).signers([pool_admin])
    .rpc();
    console.log("Your transaction signature", tx);

    newPoolPdaData = await program.account.poolInfo.fetch(newPoolPda);
    console.log("newPoolPdaData is ", newPoolPdaData);

    expect(newPoolPdaData.poolId.eq(poolId)).equals(true); 
    expect(newPoolPdaData.stakeCap.eq(stake_cap)).equals(true);
    expect(newPoolPdaData.rewardCap.eq(reward_cap)).equals(true);
    expect(newPoolPdaData.stakeVisible.eq(stake_cap)).equals(true);
    expect(newPoolPdaData.rewardVisible.eq(reward_cap)).equals(true);
    expect(newPoolPdaData.stakeStartAt.eq(start_at)).equals(true);
    expect(newPoolPdaData.stakeEndAt.eq(end_at)).equals(true);
    expect(newPoolPdaData.duration.eq(duration_time)).equals(true);
  });

  it("Failed to update admin roles", async () => {
    
    try {
      let new_admin = user01.publicKey;
      let nonAdmin = pool_admin;
      let tx = await program.methods.updateAdmin(
        new_admin
      ).accounts({
        adminInfo:adminInfoPda,
        admin:nonAdmin.publicKey
      }).signers([nonAdmin])
      .rpc();

      console.log("Your transaction signature", tx);
    } catch (error) {
      console.log(error.error.errorCode);
      expect(error.error.errorCode.code).equals('InvalidAdmin');
      expect(error.error.errorCode.number).equals(6005);
      expect(error.error.origin).equals('admin');
    }

    try {
      let new_admin = user01.publicKey;
      let nonAdmin = pool_admin;
      let tx = await program.methods.updateCosigner(
        new_admin
      ).accounts({
        adminInfo:adminInfoPda,
        admin:nonAdmin.publicKey
      }).signers([nonAdmin])
      .rpc();

      console.log("Your transaction signature", tx);
    } catch (error) {
      console.log(error.error.errorCode);
      expect(error.error.errorCode.code).equals('InvalidAdmin');
      expect(error.error.errorCode.number).equals(6005);
      expect(error.error.origin).equals('admin');
    }

    try {
      let new_admin = user01.publicKey;
      let nonAdmin = pool_admin;
      let tx = await program.methods.updateOperator(
        new_admin
      ).accounts({
        adminInfo:adminInfoPda,
        admin:nonAdmin.publicKey
      }).signers([nonAdmin])
      .rpc();

      console.log("Your transaction signature", tx);
    } catch (error) {
      console.log(error.error.errorCode);
      expect(error.error.errorCode.code).equals('InvalidAdmin');
      expect(error.error.errorCode.number).equals(6005);
      expect(error.error.origin).equals('admin');
    }

    try {
      let new_admin = user01.publicKey;
      let nonAdmin = pool_admin;
      let tx = await program.methods.updatePoolAdmin(
        new_admin
      ).accounts({
        adminInfo:adminInfoPda,
        admin:nonAdmin.publicKey
      }).signers([nonAdmin])
      .rpc();

      console.log("Your transaction signature", tx);
    } catch (error) {
      console.log(error.error.errorCode);
      expect(error.error.errorCode.code).equals('InvalidAdmin');
      expect(error.error.errorCode.number).equals(6005);
      expect(error.error.origin).equals('admin');
    }

    try {
      let new_admin = user01.publicKey;
      let nonAdmin = pool_admin;
      let tx = await program.methods.updateReceiver(
        new_admin
      ).accounts({
        adminInfo:adminInfoPda,
        admin:nonAdmin.publicKey
      }).signers([nonAdmin])
      .rpc();

      console.log("Your transaction signature", tx);
    } catch (error) {
      console.log(error.error.errorCode);
      expect(error.error.errorCode.code).equals('InvalidAdmin');
      expect(error.error.errorCode.number).equals(6005);
      expect(error.error.origin).equals('admin');
    }

  });

  it("Failed to update admin roles", async () => {
    
    try {
      let new_admin = user01.publicKey;
      let nonAdmin = pool_admin;
      let tx = await program.methods.updateAdmin(
        new_admin
      ).accounts({
        adminInfo:adminInfoPda,
        admin:nonAdmin.publicKey
      }).signers([nonAdmin])
      .rpc();

      console.log("Your transaction signature", tx);
    } catch (error) {
      console.log(error.error.errorCode);
      expect(error.error.errorCode.code).equals('InvalidAdmin');
      expect(error.error.errorCode.number).equals(6005);
      expect(error.error.origin).equals('admin');
    }

    try {
      let new_admin = user01.publicKey;
      let nonAdmin = pool_admin;
      let tx = await program.methods.updateCosigner(
        new_admin
      ).accounts({
        adminInfo:adminInfoPda,
        admin:nonAdmin.publicKey
      }).signers([nonAdmin])
      .rpc();

      console.log("Your transaction signature", tx);
    } catch (error) {
      console.log(error.error.errorCode);
      expect(error.error.errorCode.code).equals('InvalidAdmin');
      expect(error.error.errorCode.number).equals(6005);
      expect(error.error.origin).equals('admin');
    }

    try {
      let new_admin = user01.publicKey;
      let nonAdmin = pool_admin;
      let tx = await program.methods.updateOperator(
        new_admin
      ).accounts({
        adminInfo:adminInfoPda,
        admin:nonAdmin.publicKey
      }).signers([nonAdmin])
      .rpc();

      console.log("Your transaction signature", tx);
    } catch (error) {
      console.log(error.error.errorCode);
      expect(error.error.errorCode.code).equals('InvalidAdmin');
      expect(error.error.errorCode.number).equals(6005);
      expect(error.error.origin).equals('admin');
    }

    try {
      let new_admin = user01.publicKey;
      let nonAdmin = pool_admin;
      let tx = await program.methods.updatePoolAdmin(
        new_admin
      ).accounts({
        adminInfo:adminInfoPda,
        admin:nonAdmin.publicKey
      }).signers([nonAdmin])
      .rpc();

      console.log("Your transaction signature", tx);
    } catch (error) {
      console.log(error.error.errorCode);
      expect(error.error.errorCode.code).equals('InvalidAdmin');
      expect(error.error.errorCode.number).equals(6005);
      expect(error.error.origin).equals('admin');
    }

    try {
      let new_admin = user01.publicKey;
      let nonAdmin = pool_admin;
      let tx = await program.methods.updateReceiver(
        new_admin
      ).accounts({
        adminInfo:adminInfoPda,
        admin:nonAdmin.publicKey
      }).signers([nonAdmin])
      .rpc();

      console.log("Your transaction signature", tx);
    } catch (error) {
      console.log(error.error.errorCode);
      expect(error.error.errorCode.code).equals('InvalidAdmin');
      expect(error.error.errorCode.number).equals(6005);
      expect(error.error.origin).equals('admin');
    }

  });

  it("Update admin roles", async () => {
    
    try {//updateAdmin
      let adminInfoPdaData = await program.account.adminInfo.fetch(adminInfoPda);
      // console.log("adminInfoPdaData is ", adminInfoPdaData);
      expect(adminInfoPdaData.admin.toString()).equals(admin.publicKey.toBase58());
      let new_admin = user01.publicKey;
      let tx = await program.methods.updateAdmin(
        new_admin
      ).accounts({
        adminInfo:adminInfoPda,
        admin:admin.publicKey
      }).signers([admin])
      .rpc();
      console.log("Your transaction signature", tx);

      adminInfoPdaData = await program.account.adminInfo.fetch(adminInfoPda);
      expect(adminInfoPdaData.admin.toString()).equals(new_admin.toBase58());

      new_admin = admin.publicKey;
      tx = await program.methods.updateAdmin(
        new_admin
      ).accounts({
        adminInfo:adminInfoPda,
        admin:user01.publicKey
      }).signers([user01])
      .rpc();
      console.log("Your transaction signature", tx);
      adminInfoPdaData = await program.account.adminInfo.fetch(adminInfoPda);
      expect(adminInfoPdaData.admin.toString()).equals(admin.publicKey.toBase58());
    } catch (error) {
      console.log(error.error.errorCode);
    }

    try {//updateCosigner
      let adminInfoPdaData = await program.account.adminInfo.fetch(adminInfoPda);
      console.log("adminInfoPdaData is ", adminInfoPdaData);
      expect(adminInfoPdaData.cosigner.toString()).equals(cosigner.publicKey.toBase58());
      let new_cosigner = user01.publicKey;
      let tx = await program.methods.updateCosigner(
        new_cosigner
      ).accounts({
        adminInfo:adminInfoPda,
        admin:admin.publicKey
      }).signers([admin])
      .rpc();
      console.log("Your transaction signature", tx);

      adminInfoPdaData = await program.account.adminInfo.fetch(adminInfoPda);
      expect(adminInfoPdaData.cosigner.toString()).equals(new_cosigner.toBase58());

      new_cosigner = cosigner.publicKey;
      tx = await program.methods.updateCosigner(
        new_cosigner
      ).accounts({
        adminInfo:adminInfoPda,
        admin:admin.publicKey
      }).signers([admin])
      .rpc();
      console.log("Your transaction signature", tx);
      adminInfoPdaData = await program.account.adminInfo.fetch(adminInfoPda);
      expect(adminInfoPdaData.cosigner.toString()).equals(cosigner.publicKey.toBase58());
    } catch (error) {
      console.log(error.error.errorCode);
    }

    try {//updateOperator
      let adminInfoPdaData = await program.account.adminInfo.fetch(adminInfoPda);
      console.log("adminInfoPdaData is ", adminInfoPdaData);
      expect(adminInfoPdaData.operator.toString()).equals(operator.publicKey.toBase58());
      let new_operator = user01.publicKey;
      let tx = await program.methods.updateOperator(
        new_operator
      ).accounts({
        adminInfo:adminInfoPda,
        admin:admin.publicKey
      }).signers([admin])
      .rpc();
      console.log("Your transaction signature", tx);

      adminInfoPdaData = await program.account.adminInfo.fetch(adminInfoPda);
      expect(adminInfoPdaData.operator.toString()).equals(new_operator.toBase58());

      new_operator = operator.publicKey;
      tx = await program.methods.updateOperator(
        new_operator
      ).accounts({
        adminInfo:adminInfoPda,
        admin:admin.publicKey
      }).signers([admin])
      .rpc();
      console.log("Your transaction signature", tx);
      adminInfoPdaData = await program.account.adminInfo.fetch(adminInfoPda);
      expect(adminInfoPdaData.operator.toString()).equals(operator.publicKey.toBase58());
    } catch (error) {
      console.log(error.error.errorCode);
    }

    try {//updatePoolAdmin
      let adminInfoPdaData = await program.account.adminInfo.fetch(adminInfoPda);
      console.log("adminInfoPdaData is ", adminInfoPdaData);
      expect(adminInfoPdaData.poolAdmin.toString()).equals(pool_admin.publicKey.toBase58());
      let new_pool_admin = user01.publicKey;
      let tx = await program.methods.updatePoolAdmin(
        new_pool_admin
      ).accounts({
        adminInfo:adminInfoPda,
        admin:admin.publicKey
      }).signers([admin])
      .rpc();
      console.log("Your transaction signature", tx);

      adminInfoPdaData = await program.account.adminInfo.fetch(adminInfoPda);
      expect(adminInfoPdaData.poolAdmin.toString()).equals(new_pool_admin.toBase58());

      new_pool_admin = pool_admin.publicKey;
      tx = await program.methods.updatePoolAdmin(
        new_pool_admin
      ).accounts({
        adminInfo:adminInfoPda,
        admin:admin.publicKey
      }).signers([admin])
      .rpc();
      console.log("Your transaction signature", tx);
      adminInfoPdaData = await program.account.adminInfo.fetch(adminInfoPda);
      expect(adminInfoPdaData.poolAdmin.toString()).equals(pool_admin.publicKey.toBase58());
    } catch (error) {
      console.log(error.error.errorCode);
    }

    try {//updateReceiver
      let adminInfoPdaData = await program.account.adminInfo.fetch(adminInfoPda);
      console.log("adminInfoPdaData is ", adminInfoPdaData);
      expect(adminInfoPdaData.receiver.toString()).equals(receiver.publicKey.toBase58());
      let new_receiver = user01.publicKey;
      let tx = await program.methods.updateReceiver(
        new_receiver
      ).accounts({
        adminInfo:adminInfoPda,
        admin:admin.publicKey
      }).signers([admin])
      .rpc();
      console.log("Your transaction signature", tx);

      adminInfoPdaData = await program.account.adminInfo.fetch(adminInfoPda);
      expect(adminInfoPdaData.receiver.toString()).equals(new_receiver.toBase58());

      new_receiver = pool_admin.publicKey;
      tx = await program.methods.updateReceiver(
        new_receiver
      ).accounts({
        adminInfo:adminInfoPda,
        admin:admin.publicKey
      }).signers([admin])
      .rpc();
      console.log("Your transaction signature", tx);
      adminInfoPdaData = await program.account.adminInfo.fetch(adminInfoPda);
      expect(adminInfoPdaData.receiver.toString()).equals(receiver.publicKey.toBase58());
    } catch (error) {
      console.log(error.error.errorCode);
    }


  });

  it("Failed to set paused", async () => {

    try {
      let new_admin = user01.publicKey;
      let nonOperator = pool_admin;
      let tx = await program.methods.setAdminIsPaused(
        true
      ).accounts({
        adminInfo:adminInfoPda,
        operator:nonOperator.publicKey
      }).signers([nonOperator])
      .rpc();

      console.log("Your transaction signature", tx);
    } catch (error) {
      console.log(error.error.errorCode);
      expect(error.error.errorCode.code).equals('InvalidOperator');
      expect(error.error.errorCode.number).equals(6006);
      expect(error.error.origin).equals('operator');
    }

    try {
      let poolId = new u64(4)
      let new_admin = user01.publicKey;
      let nonOperator = pool_admin;
      let [poolPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("new_pool"), poolId.toBuffer()],
        program.programId
      );
      console.log("poolPda is",poolPda);

      let tx = await program.methods.setPoolIsPaused(
        poolId,true
      ).accounts({
        adminInfo:adminInfoPda,
        operator:nonOperator.publicKey,
        pool:poolPda
      }).signers([nonOperator])
      .rpc();

      console.log("Your transaction signature", tx);
    } catch (error) {
      console.log(error.error.errorCode);
      expect(error.error.errorCode.code).equals('InvalidOperator');
      expect(error.error.errorCode.number).equals(6006);
      expect(error.error.origin).equals('operator');
    }

  });

  it("Set protocol paused", async () => {
    
    try {
      let adminInfoPdaData = await program.account.adminInfo.fetch(adminInfoPda);
      // console.log("adminInfoPdaData is ", adminInfoPdaData);
      expect(adminInfoPdaData.isPaused).equals(false);
      let tx = await program.methods.setAdminIsPaused(
        true
      ).accounts({
        adminInfo:adminInfoPda,
        operator:operator.publicKey
      }).signers([operator])
      .rpc();
      console.log("Your transaction signature", tx);

      adminInfoPdaData = await program.account.adminInfo.fetch(adminInfoPda);
      expect(adminInfoPdaData.isPaused).equals(true);

      tx = await program.methods.setAdminIsPaused(
        false
      ).accounts({
        adminInfo:adminInfoPda,
        operator:operator.publicKey
      }).signers([operator])
      .rpc();
      console.log("Your transaction signature", tx);

      adminInfoPdaData = await program.account.adminInfo.fetch(adminInfoPda);
      expect(adminInfoPdaData.isPaused).equals(false);
    } catch (error) {
      console.log(error.error.errorCode);
    }

  });

  it("Set pool paused", async () => {
    
    try {
      let poolId = new u64(4)
      let [poolPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("new_pool"), poolId.toBuffer()],
        program.programId
      );
      console.log("poolPda is",poolPda);
      let poolPdaData = await program.account.poolInfo.fetch(poolPda);
      //console.log("newPoolPdaData is ", poolPdaData);

      expect(poolPdaData.isPaused).equals(false); 

      let tx = await program.methods.setPoolIsPaused(
        poolId,true
      ).accounts({
        adminInfo:adminInfoPda,
        operator:operator.publicKey,
        pool:poolPda
      }).signers([operator])
      .rpc();

      console.log("Your transaction signature", tx);

      poolPdaData = await program.account.poolInfo.fetch(poolPda);
      expect(poolPdaData.isPaused).equals(true); 

      tx = await program.methods.setPoolIsPaused(
        poolId,false
      ).accounts({
        adminInfo:adminInfoPda,
        operator:operator.publicKey,
        pool:poolPda
      }).signers([operator])
      .rpc();

      console.log("Your transaction signature", tx);

      poolPdaData = await program.account.poolInfo.fetch(poolPda);
      expect(poolPdaData.isPaused).equals(false); 

    } catch (error) {
      console.log(error.error.errorCode);
    }

  });

  it("Failed to stake", async () => {
    let [userInfoPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("user_info"), user.publicKey.toBuffer()],
      program.programId
    );
    let userInfoPdaData = await program.account.userInfo.fetch(userInfoPda);
    console.log("userInfoPda is ", userInfoPda);
    console.log("userInfoPdaData is ", userInfoPdaData);
    console.log("userInfoPdaData next pool id is ", userInfoPdaData.nextOrderId.toString());
    // >= second order
    let orderId = new u64(userInfoPdaData.nextOrderId.toString());
    // // >= first order
    // let orderId = new u64(0);
    let [orderInfoPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("new_order"), user.publicKey.toBuffer(), orderId.toBuffer()],
      program.programId
    );
    console.log("orderInfoPda is ", orderInfoPda);

    let poolId = new u64(3);
    let [poolPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("new_pool"), poolId.toBuffer()],
      program.programId
    );
    console.log("poolPda is ", poolPda);

    let poolPdaData = await program.account.poolInfo.fetch(poolPda);
    console.log("poolPdaData is ", poolPdaData);

    try {
      let transferAmount = new anchor.BN(0);
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
      });

      console.log("Your transaction signature", tx);
    } catch (error) {
      console.log(error.error.errorCode);
      expect(error.error.errorCode.code).equals('StakeAmountNeedGT0');
      expect(error.error.errorCode.number).equals(6028);
    }

    let ixPause = await program.methods.setAdminIsPaused(true)
      .accounts({
        adminInfo:adminInfoPda,
        operator:operator.publicKey
      }).instruction();

    try {
      let transferAmount = new anchor.BN(5e9);
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
      .preInstructions([ixPause])
      .signers([operator, user,cosigner])
      .rpc({
        skipPreflight:false
      });

      console.log("Your transaction signature", tx);
    } catch (error) {
      console.log(error.error.errorCode);
      expect(error.error.errorCode.code).equals('ProtocolPaused');
      expect(error.error.errorCode.number).equals(6000);
    }

    let ixPoolPaused = await program.methods.setPoolIsPaused(
      poolId,true
    ).accounts({
      adminInfo:adminInfoPda,
      operator:operator.publicKey,
      pool:poolPda
    }).instruction();

    try {
      let transferAmount = new anchor.BN(5e9);
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
      .preInstructions([ixPoolPaused])
      .signers([operator, user,cosigner])
      .rpc({
        skipPreflight:false
      });

      console.log("Your transaction signature", tx);
    } catch (error) {
      console.log(error.error.errorCode);
      expect(error.error.errorCode.code).equals('PoolPaused');
      expect(error.error.errorCode.number).equals(6001);
    }

    try {
      let transferAmount = new anchor.BN(5e13);
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
      });

      console.log("Your transaction signature", tx);
    } catch (error) {
      console.log(error.error.errorCode);
      expect(error.error.errorCode.code).equals('AmountOverBalance');
      expect(error.error.errorCode.number).equals(6002);
    }

    try {
      let transferAmount = new anchor.BN(5e9);
      let poolId_error = new u64(10000);
      [poolPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("new_pool"), poolId_error.toBuffer()],
        program.programId
      );
      console.log("poolPda is ", poolPda);

      let tx = await program.methods.stake(
        poolId_error,
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
      });

      console.log("Your transaction signature", tx);
    } catch (error) {
      console.log(error.error.errorCode);
      // expect(error.error.errorCode.code).equals('InvalidPoolId');
      // expect(error.error.errorCode.number).equals(6022);
      expect(error.error.errorCode.code).equals('AccountNotInitialized');
      expect(error.error.errorCode.number).equals(3012);
    }

    // todo when stake time after stake end at, will revert NotStakeTime

  });

  it("Stake", async () => {
    let [userInfoPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("user_info"), user.publicKey.toBuffer()],
      program.programId
    );
    let userInfoPdaDataBefore = await program.account.userInfo.fetch(userInfoPda);
    console.log("userInfoPda is ", userInfoPda);
    console.log("userInfoPdaDataBefore is ", userInfoPdaDataBefore);
    console.log("userInfoPdaDataBefore next pool id is ", userInfoPdaDataBefore.nextOrderId.toString());
    // >= second order
    let orderId = new u64(userInfoPdaDataBefore.nextOrderId.toString());
    // // >= first order
    let [orderInfoPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("new_order"), user.publicKey.toBuffer(), orderId.toBuffer()],
      program.programId
    );
    console.log("orderInfoPda is ", orderInfoPda);

    let poolId = new u64(3);
    let [poolPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("new_pool"), poolId.toBuffer()],
      program.programId
    );
    console.log("poolPda is ", poolPda);

    let poolPdaDataBedore = await program.account.poolInfo.fetch(poolPda);
    console.log("poolPdaData.dura is ", poolPdaDataBedore.duration.toString());

    let now_time = Date.now();
    let time_stamp = (now_time/1000).toFixed();
    console.log("now_time is",time_stamp);
    const one_day_test = new u64("120");//test 2m per day

    const duration_days = new u64(7);// test 7 days
    const duration_time = one_day_test.mul(duration_days);// test 7 days

    try {
      let transferAmount = new u64(5e9);
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
      });

      console.log("Your transaction signature", tx);

      let orderInfoPdaData = await program.account.orderInfo.fetch(orderInfoPda);
      console.log("orderInfoPdaData is ", orderInfoPdaData);

      // check order info
      expect(orderInfoPdaData.orderId.eq(orderId)).equals(true);
      expect(orderInfoPdaData.poolId.eq(poolId)).equals(true);
      expect(orderInfoPdaData.staker.toString()).equals(user.publicKey.toBase58());
      expect(orderInfoPdaData.stakeAmount.eq(transferAmount)).equals(true);
      expect(orderInfoPdaData.rewardAmount.eq(transferAmount.mul(new u64(poolPdaDataBedore.rewardCap)).div(new u64(poolPdaDataBedore.stakeCap)))).equals(true);
      expect(orderInfoPdaData.unstakeTime.eq(new u64(orderInfoPdaData.startTime).add(duration_time))).equals(true);
      expect(orderInfoPdaData.claimedReward.eq(new u64(0))).equals(true); 

      // check user
      let userInfoPdaData = await program.account.userInfo.fetch(userInfoPda);
      expect(userInfoPdaData.nextOrderId.eq(new u64(userInfoPdaDataBefore.nextOrderId).add(new u64(1)))).equals(true); 
      expect(userInfoPdaData.totalStake.eq(new u64(userInfoPdaDataBefore.totalStake).add(transferAmount))).equals(true); 
      expect(userInfoPdaData.totalReward.eq(new u64(userInfoPdaDataBefore.totalReward).add(orderInfoPdaData.rewardAmount))).equals(true); 

      // check poolInfo
      let poolPdaData = await program.account.poolInfo.fetch(poolPda);
      expect(poolPdaData.stakeVisible.eq(new u64(poolPdaDataBedore.stakeVisible).sub(transferAmount))).equals(true); 
      expect(poolPdaData.rewardVisible.eq(new u64(poolPdaDataBedore.rewardVisible).sub(orderInfoPdaData.rewardAmount))).equals(true);

    } catch (error) {
      console.log(error);
    }

       

  });

  it("Stake first order of one user", async () => {
    user = user02;
    user_ata = user02_ata;
    
    let [userInfoPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("user_info"), user.publicKey.toBuffer()],
      program.programId
    );
    // >= first order
    let orderId = new u64(0);
    // // >= first order
    let [orderInfoPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("new_order"), user.publicKey.toBuffer(), orderId.toBuffer()],
      program.programId
    );
    console.log("orderInfoPda is ", orderInfoPda);

    let poolId = new u64(3);
    let [poolPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("new_pool"), poolId.toBuffer()],
      program.programId
    );
    console.log("poolPda is ", poolPda);

    let poolPdaDataBedore = await program.account.poolInfo.fetch(poolPda);
    console.log("poolPdaData.dura is ", poolPdaDataBedore.duration.toString());

    let now_time = Date.now();
    let time_stamp = (now_time/1000).toFixed();
    console.log("now_time is",time_stamp);
    const one_day_test = new u64("120");//test 2m per day

    const duration_days = new u64(7);// test 7 days
    const duration_time = one_day_test.mul(duration_days);// test 7 days

    try {
      let transferAmount = new u64(5e9);
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
      });

      console.log("Your transaction signature", tx);

      let orderInfoPdaData = await program.account.orderInfo.fetch(orderInfoPda);
      console.log("orderInfoPdaData is ", orderInfoPdaData);

      // check order info
      expect(orderInfoPdaData.orderId.eq(orderId)).equals(true);
      expect(orderInfoPdaData.poolId.eq(poolId)).equals(true);
      expect(orderInfoPdaData.staker.toString()).equals(user.publicKey.toBase58());
      expect(orderInfoPdaData.stakeAmount.eq(transferAmount)).equals(true);
      expect(orderInfoPdaData.rewardAmount.eq(transferAmount.mul(new u64(poolPdaDataBedore.rewardCap)).div(new u64(poolPdaDataBedore.stakeCap)))).equals(true);
      expect(orderInfoPdaData.unstakeTime.eq(new u64(orderInfoPdaData.startTime).add(duration_time))).equals(true);
      expect(orderInfoPdaData.claimedReward.eq(new u64(0))).equals(true); 

      // check user
      let userInfoPdaData = await program.account.userInfo.fetch(userInfoPda);
      expect(userInfoPdaData.nextOrderId.eq(new u64(0).add(new u64(1)))).equals(true); 
      expect(userInfoPdaData.totalStake.eq(new u64(0).add(transferAmount))).equals(true); 
      expect(userInfoPdaData.totalReward.eq(new u64(0).add(orderInfoPdaData.rewardAmount))).equals(true); 

      // check poolInfo
      let poolPdaData = await program.account.poolInfo.fetch(poolPda);
      expect(poolPdaData.stakeVisible.eq(new u64(poolPdaDataBedore.stakeVisible).sub(transferAmount))).equals(true); 
      expect(poolPdaData.rewardVisible.eq(new u64(poolPdaDataBedore.rewardVisible).sub(orderInfoPdaData.rewardAmount))).equals(true);

    } catch (error) {
      console.log(error);
    }  

  });

  it("Failed to claim reward", async () => {
    let now_time = Date.now();
    let time_stamp = (now_time/1000).toFixed();
    console.log("now_time is",time_stamp);

    let ONE_DAY = new anchor.BN(120);// seconds
    const duration_days = new u64(8);// test 7 days
    const duration_time = ONE_DAY.mul(duration_days);// test 7 days

    // >= second order
    let [userInfoPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("user_info"), user.publicKey.toBuffer()],
      program.programId
    );
    let userInfoPdaData = await program.account.userInfo.fetch(userInfoPda);
    console.log("userInfoPda is ", userInfoPda);
    console.log("userInfoPdaData is ", userInfoPdaData);

    let orderId = new u64(14);// <=== need replace new orderId which has reward
    let [orderInfoPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("new_order"), user.publicKey.toBuffer(), orderId.toBuffer()],
      program.programId
    );
    console.log("orderInfoPda is ", orderInfoPda);

    let orderInfoPdaData = await program.account.orderInfo.fetch(orderInfoPda);
    console.log("orderInfoPdaData is ", orderInfoPdaData);


    // let rewardAmount = new anchor.BN(5e9);
    
    let passedDays= new anchor.BN(time_stamp)
                      .sub(new anchor.BN(orderInfoPdaData.startTime))
                      .div(new anchor.BN(ONE_DAY));
    let periodDays = duration_time.div(ONE_DAY);
    let passedDaysReward = new anchor.BN(orderInfoPdaData.rewardAmount).mul(passedDays).div(periodDays);
    let rewardAmount = passedDaysReward.sub(new anchor.BN(orderInfoPdaData.claimedReward));

    let poolId = new u64(3);
    let [poolPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("new_pool"), poolId.toBuffer()],
      program.programId
    );
    console.log("poolPda is ", poolPda);

    // try {// test before stake_start_at
    //   let tx = await program.methods.claimReward(
    //     orderId,
    //     rewardAmount,
    //   ).accounts({
    //     adminInfo: adminInfoPda,
    //     pool:poolPda,
    //     userInfo:userInfoPda,
    //     stakeTokenMint: token_mint,
    //     user:user.publicKey,//payer,// sender
    //     order:orderInfoPda,
    //     vaultTokenAccount: vaultTokenAccountPda,
    //     userTokenWallet:user_ata,// one token acount
    //     cosigner:cosigner.publicKey,
    //     systemProgram: SystemProgram.programId,
    //     tokenProgram: TOKEN_PROGRAM_ID,
    //   })
    //   .signers([operator, user,cosigner])
    //   .rpc({
    //     skipPreflight:false
    //   });
    //   console.log("Your transaction signature", tx);
    // } catch (error) {
    //   console.log(error.error.errorCode);
    //   expect(error.error.errorCode.code).equals('NotStartClaimReward');
    //   expect(error.error.errorCode.number).equals(6010);
    // }

    try {
      rewardAmount = new u64(2222222);
      let tx = await program.methods.claimReward(
        orderId,
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
      });
      console.log("Your transaction signature", tx);
    } catch (error) {
      console.log(error.error.errorCode);
      expect(error.error.errorCode.code).equals('RewardNeedGT0');
      expect(error.error.errorCode.number).equals(6029);
    }

    try {
      rewardAmount = new u64(12345678);
      let tx = await program.methods.claimReward(
        orderId,
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
      });

      console.log("Your transaction signature", tx);
    } catch (error) {
      console.log(error.error.errorCode);
      expect(error.error.errorCode.code).equals('InputRewardAmountNotEqualOrderReward');
      expect(error.error.errorCode.number).equals(6015);
    }

    let ixPause = await program.methods.setAdminIsPaused(true)
      .accounts({
        adminInfo:adminInfoPda,
        operator:operator.publicKey
      }).instruction();

      try {
        let tx = await program.methods.claimReward(
          orderId,
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
        .preInstructions([ixPause])
        .signers([operator, user,cosigner])
        .rpc({
          skipPreflight:false
        });
    
        console.log("Your transaction signature", tx);
      } catch (error) {
        console.log(error.error.errorCode);
        expect(error.error.errorCode.code).equals('ProtocolPaused');
        expect(error.error.errorCode.number).equals(6000);
      }

    let ixPoolPaused = await program.methods.setPoolIsPaused(
      poolId,true
    ).accounts({
      adminInfo:adminInfoPda,
      operator:operator.publicKey,
      pool:poolPda
    }).instruction();

    try {
      let tx = await program.methods.claimReward(
        orderId,
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
      .preInstructions([ixPoolPaused])
      .signers([operator, user,cosigner])
      .rpc({
        skipPreflight:false
      });

      console.log("Your transaction signature", tx);
    } catch (error) {
      console.log(error.error.errorCode);
      expect(error.error.errorCode.code).equals('PoolPaused');
      expect(error.error.errorCode.number).equals(6001);
    }

    try {
      let orderId_error = new u64(10000);
      [orderInfoPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("new_order"), user.publicKey.toBuffer(), orderId_error.toBuffer()],
        program.programId
      );
      console.log("orderInfoPda is ", orderInfoPda);
      let tx = await program.methods.claimReward(
        orderId_error,
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
      });

      console.log("Your transaction signature", tx);
    } catch (error) {
      console.log(error.error.errorCode);
      // expect(error.error.errorCode.code).equals('InvalidPoolId');
      // expect(error.error.errorCode.number).equals(6022);
      expect(error.error.errorCode.code).equals('AccountNotInitialized');
      expect(error.error.errorCode.number).equals(3012);
    }

    try {
      let user_error = user02;
      let [userInfoPda_error] = PublicKey.findProgramAddressSync(
        [Buffer.from("user_info"), user_error.publicKey.toBuffer()],
        program.programId
      );
      orderId = new u64(0);

      let tx = await program.methods.claimReward(
        orderId,
        rewardAmount,
      ).accounts({
        adminInfo: adminInfoPda,
        pool:poolPda,
        userInfo:userInfoPda_error,
        stakeTokenMint: token_mint,
        user:user_error.publicKey,//payer,// sender
        order:orderInfoPda,
        vaultTokenAccount: vaultTokenAccountPda,
        userTokenWallet:user02_ata,// one token acount
        cosigner:cosigner.publicKey,
        systemProgram: SystemProgram.programId,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers([user_error,cosigner])
      .rpc({
        skipPreflight:false
      });

      console.log("Your transaction signature", tx);
    } catch (error) {
      console.log(error.error.errorCode);
      // expect(error.error.errorCode.code).equals('InvalidUser');
      // expect(error.error.errorCode.number).equals(6016);
      expect(error.error.errorCode.code).equals('AccountNotInitialized');
      expect(error.error.errorCode.number).equals(3012.);
    }

    

  });

  it("Claim reward", async () => {
    let now_time = Date.now();
    let time_stamp = (now_time/1000).toFixed();
    console.log("now_time is",time_stamp);

    let ONE_DAY = new anchor.BN(120);// seconds
    const duration_days = new u64(7);// test 7 days
    const duration_time = ONE_DAY.mul(duration_days);// test 7 days

    // >= second order
    let [userInfoPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("user_info"), user.publicKey.toBuffer()],
      program.programId
    );
    let userInfoPdaDataBefore = await program.account.userInfo.fetch(userInfoPda);
    console.log("userInfoPda is ", userInfoPda);
    console.log("userInfoPdaDataBefore is ", userInfoPdaDataBefore);

    let orderId = new u64(14);
    let [orderInfoPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("new_order"), user.publicKey.toBuffer(), orderId.toBuffer()],
      program.programId
    );
    console.log("orderInfoPda is ", orderInfoPda);

    let orderInfoPdaDataBefore = await program.account.orderInfo.fetch(orderInfoPda);
    console.log("orderInfoPdaDataBefore is ", orderInfoPdaDataBefore);

    // let rewardAmount = new anchor.BN(5e9);
    let real_end_time = new anchor.BN(time_stamp);
    if(real_end_time.gt(orderInfoPdaDataBefore.unstakeTime)) {
      real_end_time = new anchor.BN(orderInfoPdaDataBefore.unstakeTime);
    }
    let passedDays= real_end_time.sub(new anchor.BN(orderInfoPdaDataBefore.startTime)).div(new anchor.BN(ONE_DAY));
    let periodDays = duration_time.div(ONE_DAY);
    let passedDaysReward = new anchor.BN(orderInfoPdaDataBefore.rewardAmount).mul(passedDays).div(periodDays);
    let rewardAmount = passedDaysReward.sub(new anchor.BN(orderInfoPdaDataBefore.claimedReward));
    console.log("rewardAmount is",rewardAmount.toString());
    console.log("passedDays is",passedDays.toString());
    console.log("periodDays is",periodDays.toString());
    console.log("passedDaysReward is",passedDaysReward.toString());

    let poolId = new u64(3);
    let [poolPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("new_pool"), poolId.toBuffer()],
      program.programId
    );
    console.log("poolPda is ", poolPda);

    try {
      let tx = await program.methods.claimReward(
        orderId,
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
  
      // check order info
      let orderInfoPdaData = await program.account.orderInfo.fetch(orderInfoPda);
      console.log("orderInfoPdaData is ", orderInfoPdaData);
      expect(orderInfoPdaData.orderId.eq(orderId)).equals(true);
      expect(orderInfoPdaData.poolId.eq(poolId)).equals(true);
      expect(orderInfoPdaData.claimedReward.eq(new u64(orderInfoPdaDataBefore.claimedReward).add(rewardAmount))).equals(true); 
  
      // check user
      let userInfoPdaData = await program.account.userInfo.fetch(userInfoPda);
      expect(userInfoPdaData.totalClaimedReward.eq(new u64(userInfoPdaDataBefore.totalClaimedReward).add(rewardAmount))).equals(true);
    } catch (error) {
      console.log(error);
    }

    

  });

  it("Failed to unstake", async () => {
    let now_time = Date.now();
    let time_stamp = (now_time/1000).toFixed();
    console.log("now_time is",time_stamp);

    let ONE_DAY = new anchor.BN(120);// seconds
    const duration_days = new u64(7);// test 7 days
    const duration_time = ONE_DAY.mul(duration_days);// test 7 days

    let [userInfoPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("user_info"), user.publicKey.toBuffer()],
      program.programId
    );
    let userInfoPdaData = await program.account.userInfo.fetch(userInfoPda);
    console.log("userInfoPda is ", userInfoPda);
    console.log("userInfoPdaData is ", userInfoPdaData);

    let orderId = new u64(14);// <=== need replace new orderId which has reward
    let [orderInfoPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("new_order"), user.publicKey.toBuffer(), orderId.toBuffer()],
      program.programId
    );
    console.log("orderInfoPda is ", orderInfoPda);

    let orderInfoPdaData = await program.account.orderInfo.fetch(orderInfoPda);
    console.log("orderInfoPdaData is ", orderInfoPdaData);
    
    let passedDays= new anchor.BN(time_stamp)
                      .sub(new anchor.BN(orderInfoPdaData.startTime))
                      .div(new anchor.BN(ONE_DAY));
    let periodDays = duration_time.div(ONE_DAY);
    let passedDaysReward = new anchor.BN(orderInfoPdaData.rewardAmount).mul(passedDays).div(periodDays);
    let rewardAmount = passedDaysReward.sub(new anchor.BN(orderInfoPdaData.claimedReward));

    let poolId = new u64(3);// <=== need replace you poolId which has reward
    let [poolPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("new_pool"), poolId.toBuffer()],
      program.programId
    );
    console.log("poolPda is ", poolPda);

    let ixPause = await program.methods.setAdminIsPaused(true)
      .accounts({
        adminInfo:adminInfoPda,
        operator:operator.publicKey
      }).instruction();

    try {
      let unstakeAmount = new anchor.BN(orderInfoPdaData.stakeAmount);
      if(new anchor.BN(time_stamp).gt(orderInfoPdaData.unstakeTime)) {
        let tx = await program.methods.unstake(
          orderId,
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
        .preInstructions([ixPause])
        .signers([operator, user,cosigner])
        .rpc({
          skipPreflight:false
        });
        console.log("Your transaction signature", tx);
      }
  
    } catch (error) {
      console.log(error.error.errorCode);
      expect(error.error.errorCode.code).equals('ProtocolPaused');
      expect(error.error.errorCode.number).equals(6000);
    }

    let ixPoolPaused = await program.methods.setPoolIsPaused(
      poolId,true
    ).accounts({
      adminInfo:adminInfoPda,
      operator:operator.publicKey,
      pool:poolPda
    }).instruction();

    try {
      let unstakeAmount = new anchor.BN(orderInfoPdaData.stakeAmount);
      if(new anchor.BN(time_stamp).gt(orderInfoPdaData.unstakeTime)) {
        let tx = await program.methods.unstake(
          orderId,
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
        .preInstructions([ixPoolPaused])
        .signers([operator, user,cosigner])
        .rpc({
          skipPreflight:false
        });
        console.log("Your transaction signature", tx);
      }

    } catch (error) {
      console.log(error.error.errorCode);
      expect(error.error.errorCode.code).equals('PoolPaused');
      expect(error.error.errorCode.number).equals(6001);
    }

    try {
      let orderId_error = new u64(10000);
      let [orderInfoPda_err] = PublicKey.findProgramAddressSync(
        [Buffer.from("new_order"), user.publicKey.toBuffer(), orderId_error.toBuffer()],
        program.programId
      );
      console.log("orderInfoPda_err is ", orderInfoPda_err);
      let unstakeAmount = new anchor.BN(orderInfoPdaData.stakeAmount);
      if(new anchor.BN(time_stamp).gt(orderInfoPdaData.unstakeTime)) {
        let tx = await program.methods.unstake(
          orderId_error,
          unstakeAmount,
          rewardAmount,
        ).accounts({
          adminInfo: adminInfoPda,
          pool:poolPda,
          userInfo:userInfoPda,
          stakeTokenMint: token_mint,
          user:user.publicKey,//payer,// sender
          order:orderInfoPda_err,
          vaultTokenAccount: vaultTokenAccountPda,
          userTokenWallet:user_ata,// one token acount
          cosigner:cosigner.publicKey,
          systemProgram: SystemProgram.programId,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .preInstructions([ixPoolPaused])
        .signers([operator, user,cosigner])
        .rpc({
          skipPreflight:false
        });
        console.log("Your transaction signature", tx);
      }
    } catch (error) {
      //console.log(error);
      console.log(error.error.errorCode);
      // expect(error.error.errorCode.code).equals('InvalidOrderId');
      // expect(error.error.errorCode.number).equals(6003);
      expect(error.error.errorCode.code).equals('AccountNotInitialized');
      expect(error.error.errorCode.number).equals(3012);
    }

    try {
      let user_error = user02;
      let user_ata_error = user02_ata;
      let [userInfoPda_err] = PublicKey.findProgramAddressSync(
        [Buffer.from("user_info"), user_error.publicKey.toBuffer()],
        program.programId
      );
      let [orderInfoPda_err] = PublicKey.findProgramAddressSync(
        [Buffer.from("new_order"), user_error.publicKey.toBuffer(), orderId.toBuffer()],
        program.programId
      );

      let unstakeAmount = new anchor.BN(orderInfoPdaData.stakeAmount);
      if(new anchor.BN(time_stamp).gt(orderInfoPdaData.unstakeTime)) {
        let tx = await program.methods.unstake(
          orderId,
          unstakeAmount,
          rewardAmount,
        ).accounts({
          adminInfo: adminInfoPda,
          pool:poolPda,
          userInfo:userInfoPda_err,
          stakeTokenMint: token_mint,
          user:user_error.publicKey,//payer,// sender
          order:orderInfoPda_err,
          vaultTokenAccount: vaultTokenAccountPda,
          userTokenWallet:user_ata_error,// one token acount
          cosigner:cosigner.publicKey,
          systemProgram: SystemProgram.programId,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .signers([user_error,cosigner])
        .rpc({
          skipPreflight:false
        });
        console.log("Your transaction signature", tx);
      }
    } catch (error) {
      console.log(error.error.errorCode);
      // expect(error.error.errorCode.code).equals('InvalidUser');
      // expect(error.error.errorCode.number).equals(6016);
      expect(error.error.errorCode.code).equals('AccountNotInitialized');
      expect(error.error.errorCode.number).equals(3012);
    }

    // try {
    //   let unstakeAmount = new anchor.BN(66666);
    //   //let rewardAmount = new anchor.BN(8888);
    //   if(new anchor.BN(time_stamp).gt(orderInfoPdaData.unstakeTime)) {
    //     let tx = await program.methods.unstake(
    //       orderId,
    //       unstakeAmount,
    //       rewardAmount,
    //     ).accounts({
    //       adminInfo: adminInfoPda,
    //       pool:poolPda,
    //       userInfo:userInfoPda,
    //       stakeTokenMint: token_mint,
    //       user:user.publicKey,//payer,// sender
    //       order:orderInfoPda,
    //       vaultTokenAccount: vaultTokenAccountPda,
    //       userTokenWallet:user_ata,// one token acount
    //       cosigner:cosigner.publicKey,
    //       systemProgram: SystemProgram.programId,
    //       tokenProgram: TOKEN_PROGRAM_ID,
    //     })
    //     .signers([user,cosigner])
    //     .rpc({
    //       skipPreflight:false
    //     });
    //     console.log("Your transaction signature", tx);
    //   }
  
    // } catch (error) {
    //   console.log(error.error.errorCode);
    //   expect(error.error.errorCode.code).equals('InputStakeAmountNotEqualOrderAmount');
    //   expect(error.error.errorCode.number).equals(6014);
    // }

    // try {
    //   let unstakeAmount = new anchor.BN(orderInfoPdaData.stakeAmount);
    //   let rewardAmount = new anchor.BN(8888);
    //   if(new anchor.BN(time_stamp).gt(orderInfoPdaData.unstakeTime)) {
    //     let tx = await program.methods.unstake(
    //       orderId,
    //       unstakeAmount,
    //       rewardAmount,
    //     ).accounts({
    //       adminInfo: adminInfoPda,
    //       pool:poolPda,
    //       userInfo:userInfoPda,
    //       stakeTokenMint: token_mint,
    //       user:user.publicKey,//payer,// sender
    //       order:orderInfoPda,
    //       vaultTokenAccount: vaultTokenAccountPda,
    //       userTokenWallet:user_ata,// one token acount
    //       cosigner:cosigner.publicKey,
    //       systemProgram: SystemProgram.programId,
    //       tokenProgram: TOKEN_PROGRAM_ID,
    //     })
    //     .signers([user,cosigner])
    //     .rpc({
    //       skipPreflight:false
    //     });
    //     console.log("Your transaction signature", tx);
    //   }
  
    // } catch (error) {
    //   console.log(error.error.errorCode);
    //   expect(error.error.errorCode.code).equals('InputRewardAmountNotEqualOrderReward');
    //   expect(error.error.errorCode.number).equals(6015);
    // }

    try {
      let unstakeAmount = new anchor.BN(orderInfoPdaData.stakeAmount);
      if(new anchor.BN(time_stamp).gt(orderInfoPdaData.unstakeTime)) {
        let tx = await program.methods.unstake(
          orderId,
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
        });
        console.log("Your transaction signature", tx);
      }
  
    } catch (error) {
      console.log(error.error.errorCode);
      expect(error.error.errorCode.code).equals('OrderAlreadyUnstake');
      expect(error.error.errorCode.number).equals(6021);
    }
  });

  it("unstake", async () => {
    let now_time = Date.now();
    let time_stamp = (now_time/1000).toFixed();
    console.log("now_time is",time_stamp);

    let [userInfoPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("user_info"), user.publicKey.toBuffer()],
      program.programId
    );
    let userInfoPdaDataBefore = await program.account.userInfo.fetch(userInfoPda);
    console.log("userInfoPdaDataBefore is ", userInfoPdaDataBefore);

    let orderId = new u64(13);
    let [orderInfoPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("new_order"), user.publicKey.toBuffer(), orderId.toBuffer()],
      program.programId
    );
    console.log("orderInfoPda is ", orderInfoPda);

    let orderInfoPdaData = await program.account.orderInfo.fetch(orderInfoPda);

    let totalRewardAmount = new anchor.BN(orderInfoPdaData.rewardAmount);
    let rewardAmount = totalRewardAmount.sub(new anchor.BN(orderInfoPdaData.claimedReward));

    let poolId = new u64(3);
    let [poolPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("new_pool"), poolId.toBuffer()],
      program.programId
    );
    console.log("poolPda is ", poolPda);

    let unstakeAmount = new anchor.BN(orderInfoPdaData.stakeAmount);
    if(new anchor.BN(time_stamp).gt(orderInfoPdaData.unstakeTime)) {
      let tx = await program.methods.unstake(
        orderId,
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
  
      // check order info
      expect(orderInfoPdaData.orderId.eq(orderId)).equals(true);
      expect(orderInfoPdaData.poolId.eq(poolId)).equals(true);
      expect(orderInfoPdaData.staker.toString()).equals(user.publicKey.toBase58());
      expect(orderInfoPdaData.claimedReward.eq(new u64(orderInfoPdaData.rewardAmount))).equals(true); 
      expect(orderInfoPdaData.isUnstake).equals(true); 

      // check user
      let userInfoPdaData = await program.account.userInfo.fetch(userInfoPda);
      expect(userInfoPdaData.totalClaimedReward.eq(new u64(userInfoPdaDataBefore.totalClaimedReward).add(rewardAmount))).equals(true); 
      expect(userInfoPdaData.totalStake.eq(new u64(userInfoPdaDataBefore.totalStake).sub(unstakeAmount))).equals(true); 

    } else {
      console.log("Cannot unstake now!");
    }

  });

});
