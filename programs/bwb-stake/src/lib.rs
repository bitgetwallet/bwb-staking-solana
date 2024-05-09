use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, TokenAccount, Token, Transfer};
use crate::error::ErrorCode;

pub mod error;

declare_id!("Eqsv4KVNu7tQirC5J5jb4ZT1gSbjUiksSye8oZyFsVc4");

#[program]
pub mod bwb_stake {
    use super::*;
    const ONE_DAY: u64 = 86400;
    // const ONE_DAY: u64 = 120;// 2 m for test

    pub fn initialize(
        ctx: Context<Initialize>, 
        cosigner: Pubkey,
        admin: Pubkey,
        receiver: Pubkey,
        operator: Pubkey,
        pool_admin: Pubkey
    ) -> Result<()> {
        msg!("Instruction: Initialize");
        let admin_info = &mut ctx.accounts.admin_info;
        admin_info.cosigner = cosigner;
        admin_info.admin = admin;
        admin_info.receiver = receiver;
        admin_info.operator = operator;
        admin_info.pool_admin = pool_admin;

        admin_info.stake_token_mint = ctx.accounts.stake_token_mint.key();

        Ok(())
    }

    pub fn create_new_pool(
        ctx: Context<CreateNewPool>, 
        stake_cap: u64,
        reward_cap: u64,
        stake_start_at: i64,
        stake_end_at: i64,
        duration: u64,
    ) -> Result<()> {
        msg!("Instruction: create_new_pool");
        require!(stake_start_at > 0, ErrorCode::StartTimeNeedGT0);
        require!(duration > 0, ErrorCode::DurationNeedGT0);
        require!(stake_end_at > stake_start_at, ErrorCode::StartTimeNeedLTEndTime);

        let admin_info = &mut ctx.accounts.admin_info;
        let new_pool = &mut ctx.accounts.new_pool;
        new_pool.pool_id = admin_info.next_pool_id;
        new_pool.stake_cap = stake_cap;
        new_pool.reward_cap = reward_cap;
        new_pool.stake_visible = stake_cap;
        new_pool.reward_visible = reward_cap;
        new_pool.stake_start_at = stake_start_at;
        new_pool.stake_end_at = stake_end_at;
        new_pool.duration = duration;

        admin_info.next_pool_id += 1;
        msg!("new pool_id is {:?}", new_pool.pool_id);

        Ok(())
    }

    pub fn update_pool(
        ctx: Context<UpdatePool>, 
        pool_id: u64,
        stake_cap: u64,
        reward_cap: u64,
        stake_start_at: i64,
        stake_end_at: i64,
        duration: u64,
    )-> Result<()> {
        msg!("Instruction: update_pool");
        require!(stake_start_at > 0, ErrorCode::StartTimeNeedGT0);
        require!(duration > 0, ErrorCode::DurationNeedGT0);
        require!(stake_end_at > stake_start_at, ErrorCode::StartTimeNeedLTEndTime);

        let clock = Clock::get()?;
        let pool = &mut ctx.accounts.pool;
        require!(clock.unix_timestamp < pool.stake_start_at, ErrorCode::PoolAlreadyStartStake);

        pool.stake_cap = stake_cap;
        pool.reward_cap = reward_cap;
        pool.stake_visible = stake_cap;
        pool.reward_visible = reward_cap;
        pool.stake_start_at = stake_start_at;
        pool.stake_end_at = stake_end_at;
        pool.duration = duration;

        msg!("pool_id is {:?}", pool_id);

        Ok(())
    }

    pub fn update_receiver(ctx: Context<UpdateAdminRole>, new_receiver: Pubkey) -> Result<()> {
        let admin_info = &mut ctx.accounts.admin_info;
        admin_info.receiver = new_receiver;

        Ok(())
    }

    pub fn update_cosigner(ctx: Context<UpdateAdminRole>, new_cosigner: Pubkey) -> Result<()> {
        let admin_info = &mut ctx.accounts.admin_info;
        admin_info.cosigner = new_cosigner;

        Ok(())
    }

    pub fn update_operator(ctx: Context<UpdateAdminRole>, new_operator: Pubkey) -> Result<()> {
        let admin_info = &mut ctx.accounts.admin_info;
        admin_info.operator = new_operator;

        Ok(())
    }

    pub fn update_pool_admin(ctx: Context<UpdateAdminRole>, new_pool_admin: Pubkey) -> Result<()> {
        let admin_info = &mut ctx.accounts.admin_info;
        admin_info.pool_admin = new_pool_admin;

        Ok(())
    }


    pub fn set_admin_is_paused(ctx: Context<SetAdminIsPaused>, is_paused: bool) -> Result<()> {
        let admin_info = &mut ctx.accounts.admin_info;
        admin_info.is_paused = is_paused;

        Ok(())
    }

    pub fn set_pool_is_paused(ctx: Context<SetPoolIsPaused>, pool_id: u64, is_paused: bool) -> Result<()> {
        let pool = &mut ctx.accounts.pool;
        pool.is_paused = is_paused;

        Ok(())
    }

    pub fn stake(ctx: Context<Stake>, pool_id: u64, amount: u64) -> Result<()> {
        msg!("Instruction: Stake");
        // check paused status
        let admin_info = &ctx.accounts.admin_info;
        require!(!admin_info.is_paused, ErrorCode::ProtocolPaused);
        let pool = &mut ctx.accounts.pool;
        require!(!pool.is_paused, ErrorCode::PoolPaused);
        // check user token balance
        require!(amount  <= ctx.accounts.user_token_wallet.amount, ErrorCode::AmountOverBalance);

        require!(amount <= pool.stake_visible, ErrorCode::NotVisibleStakeAmount);

        // check stake time limit
        let clock = Clock::get()?;
        require!(clock.unix_timestamp > pool.stake_start_at, ErrorCode::NotStakeTime);
        require!(clock.unix_timestamp < pool.stake_end_at, ErrorCode::NotStakeTime);
        
        // Transfer BWB
        let cpi_accounts = Transfer {
            from: ctx.accounts.user_token_wallet.to_account_info(),
            to: ctx.accounts.vault_token_account.to_account_info(),
            authority: ctx.accounts.user.to_account_info(),
        };
        let cpi_program = ctx.accounts.token_program.to_account_info();
        let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);
        token::transfer(cpi_ctx, amount)?;

        // update order info
        let new_order = &mut ctx.accounts.new_order;
        new_order.order_id = ctx.accounts.user_info.next_order_id;
        new_order.pool_id = pool_id;
        new_order.staker = ctx.accounts.user.key();
        new_order.stake_amount = amount;

        let tmp: u128 = pool.reward_cap as u128 * amount as u128;
        new_order.reward_amount = (tmp / pool.stake_cap as u128) as u64;

        new_order.start_time = clock.unix_timestamp;
        new_order.unstake_time = clock.unix_timestamp + pool.duration as i64;
        

        // update user info
        let user_info = &mut ctx.accounts.user_info;
        user_info.next_order_id += 1;
        user_info.total_stake += amount;
        user_info.total_reward += new_order.reward_amount;

        // update pool info
        pool.stake_visible -= amount;
        pool.reward_visible -= new_order.reward_amount;

        // emit log
        msg!("Staker is {:?}",ctx.accounts.user.key());
        msg!("Amount is {:?}",amount);
        msg!("pool_id is {:?} days",pool_id);
        msg!("reward is {:?}",new_order.reward_amount);

        Ok(())
    }

    pub fn unstake(
        ctx: Context<Unstake>, 
        order_id: u64,
        unstake_amount: u64,
        reward_amount: u64
    ) -> Result<()> {
        msg!("Instruction: Unstake");

        // check paused status
        let admin_info = &ctx.accounts.admin_info;
        require!(!admin_info.is_paused, ErrorCode::ProtocolPaused);
        let pool = &mut ctx.accounts.pool;
        require!(!pool.is_paused, ErrorCode::PoolPaused);
        
        // check order_id
        let user_info = &mut ctx.accounts.user_info;
        require!(order_id < user_info.next_order_id, ErrorCode::InvalidOrderId);
        // check user == staker
        
        // check order info
        let clock = Clock::get()?;
        let order = &mut ctx.accounts.order;
        
        require!(clock.unix_timestamp > order.unstake_time, ErrorCode::NotReachUnstakeTime);
        require!(!order.is_unstake, ErrorCode::OrderAlreadyUnstake);

        // claim reward
        let reward = order.reward_amount - order.claimed_reward;
        require!(reward <= pool.reward_visible, ErrorCode::RewardExceed);
        msg!("reward is {:?}", reward);

        // check input params
        require!(unstake_amount == order.stake_amount, ErrorCode::InputStakeAmountNotEqualOrderAmount);
        require!(reward_amount == reward, ErrorCode::InputRewardAmountNotEqualOrderReward);

        let withdraw_amount = order.stake_amount + reward;
        msg!("withdraw_amount is {:?}", withdraw_amount);
        require!(withdraw_amount <= ctx.accounts.vault_token_account.amount, ErrorCode::AmountOverBalance);
        
        // unstake and claim
        let bump = ctx.bumps.admin_info;
        let seeds = &[b"admin_info".as_ref(), &[bump]];
        token::transfer(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                token::Transfer {
                    from: ctx.accounts.vault_token_account.to_account_info(),
                    to: ctx.accounts.user_token_wallet.to_account_info(),
                    authority: ctx.accounts.admin_info.to_account_info(),
                },
            )
            .with_signer(&[&seeds[..]]),
            withdraw_amount,
        )?;

        // update order
        order.claimed_reward = order.reward_amount ;
        msg!("order.claimed_reward is {:?}", order.claimed_reward);
        order.is_unstake = true;
        // update user info
        user_info.total_claimed_reward += reward;
        msg!("user_info.total_claimed_reward is {:?}", user_info.total_claimed_reward);

        Ok(())
    }

    pub fn claim_reward(
        ctx: Context<ClaimReward>, 
        order_id: u64,
        reward_amount: u64
    ) -> Result<()> {
        msg!("Instruction: Claim Reward");

        // check paused status
        let admin_info = &ctx.accounts.admin_info;
        require!(!admin_info.is_paused, ErrorCode::ProtocolPaused);
        let pool = &mut ctx.accounts.pool;
        require!(!pool.is_paused, ErrorCode::PoolPaused);
        
        // check order_id
        let user_info = &mut ctx.accounts.user_info;
        require!(order_id < user_info.next_order_id, ErrorCode::InvalidOrderId);
        
        // check order info
        let clock = Clock::get()?;
        let order = &mut ctx.accounts.order;
        require!(order.staker == ctx.accounts.user.key(), ErrorCode::InvalidUser);
        require!(clock.unix_timestamp >= order.start_time, ErrorCode::NotStartClaimReward);

        // claim reward
        let mut real_time: i64 = clock.unix_timestamp;
        if clock.unix_timestamp >= order.unstake_time {
            real_time = order.unstake_time;
        }
        let passed_days = (real_time - order.start_time) as u64 / ONE_DAY;
        let period_days = pool.duration / ONE_DAY;
        let reward = order.reward_amount * passed_days / period_days - order.claimed_reward;
        //(passed_days - claimed_days)
        msg!("passed_days is {:?}", passed_days);
        msg!("period_days is {:?}", period_days);
        msg!("reward is {:?}", reward);

        require!(reward <= pool.reward_visible, ErrorCode::RewardExceed);
        require!(reward <= ctx.accounts.vault_token_account.amount.into(), ErrorCode::AmountOverBalance);
        //check input params
        require!(reward_amount == reward, ErrorCode::InputRewardAmountNotEqualOrderReward);
        
        // claim reward
        let bump = ctx.bumps.admin_info;
        let seeds = &[b"admin_info".as_ref(), &[bump]];
        token::transfer(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                token::Transfer {
                    from: ctx.accounts.vault_token_account.to_account_info(),
                    to: ctx.accounts.user_token_wallet.to_account_info(),
                    authority: ctx.accounts.admin_info.to_account_info(),
                },
            )
            .with_signer(&[&seeds[..]]),
            reward ,
        )?;

        // update order
        order.claimed_reward += reward ;
        msg!("claimed_reward is {:?}", order.claimed_reward);
        // update user info
        user_info.total_claimed_reward += reward;
        msg!("total_claimed_reward is {:?}", user_info.total_claimed_reward);

        Ok(())
    }

    pub fn withdraw_bwb_token(ctx: Context<WithdrawBWBToken>, amount: u64) -> Result<()> {

        // Transfer tokens from taker to initializer
        let bump = ctx.bumps.admin_info;
        let seeds = &[b"MerkleDistributor".as_ref(), &[bump]];

        token::transfer(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                token::Transfer {
                    from: ctx.accounts.from_token_account.to_account_info(),
                    to: ctx.accounts.to_token_account.to_account_info(),
                    authority: ctx.accounts.admin_info.to_account_info(),
                },
            )
            .with_signer(&[&seeds[..]]),
            amount,
        )?;

        Ok(())
    }

    pub fn withdraw_other_token(ctx: Context<WithdrawOtherToken>, amount: u64) -> Result<()> {

        token::transfer(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                token::Transfer {
                    from: ctx.accounts.from_token_account.to_account_info(),
                    to: ctx.accounts.to_token_account.to_account_info(),
                    authority: ctx.accounts.from_ata_owner.to_account_info(),
                }
            ),
            amount
        )?;

        Ok(())
    }

}

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(
        init, payer = payer, space = 8 + AdminInfo::LEN,
        seeds=[b"admin_info"],
        bump
    )]
    pub admin_info: Account<'info, AdminInfo>,

    #[account(mut)]
    pub stake_token_mint: Account<'info, Mint>,

    #[account(
        init,
        payer = payer,
        seeds=[b"vault_token_account"],
        token::mint=stake_token_mint,
        token::authority=admin_info,
        bump
    )]
    vault_token_account: Account<'info, TokenAccount>,

    #[account(mut)]
    pub payer: Signer<'info>,
    pub token_program: Program<'info, Token>,
    system_program: Program<'info, System>
}

#[derive(Accounts)]
pub struct CreateNewPool<'info> {
    #[account(mut, seeds=[b"admin_info"],bump)]
    pub admin_info: Account<'info, AdminInfo>,

    #[account(
        init, payer = pool_admin, space = 8 + PoolInfo::LEN,
        seeds=[b"new_pool", &admin_info.next_pool_id.to_le_bytes()],
        bump
    )]
    pub new_pool: Account<'info, PoolInfo>,

    #[account(mut, address = admin_info.pool_admin @ ErrorCode::InvalidOperator)]
    pub pool_admin: Signer<'info>,
    system_program: Program<'info, System>,
    rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
#[instruction(pool_id: u64)]
pub struct UpdatePool<'info> {
    #[account(mut, seeds=[b"admin_info"],bump)]
    pub admin_info: Account<'info, AdminInfo>,

    #[account(
        mut,
        seeds=[b"new_pool", &pool_id.to_le_bytes()],
        bump
    )]
    pub pool: Account<'info, PoolInfo>,

    #[account(mut, address = admin_info.pool_admin @ ErrorCode::InvalidOperator)]
    pub pool_admin: Signer<'info>,
    system_program: Program<'info, System>,
    rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
#[instruction(pool_id: u64)]
pub struct SetPoolIsPaused<'info> {
    #[account(seeds=[b"admin_info"],bump)]
    pub admin_info: Account<'info, AdminInfo>,
    #[account(mut, address = admin_info.operator @ ErrorCode::InvalidOperator)]
    pub operator: Signer<'info>,

    #[account(mut, seeds=[b"new_pool", &pool_id.to_le_bytes()], bump)]
    pub pool: Account<'info, PoolInfo>, 
}

#[derive(Accounts)]
pub struct SetAdminIsPaused<'info> {
    #[account(mut, seeds=[b"admin_info"],bump)]
    pub admin_info: Account<'info, AdminInfo>,
    #[account(mut, address = admin_info.operator @ ErrorCode::InvalidOperator)]
    pub operator: Signer<'info>,
    
}

#[derive(Accounts)]
pub struct SetNextPoolId<'info> {
    #[account(mut, seeds=[b"admin_info"],bump)]
    pub admin_info: Account<'info, AdminInfo>,
    #[account(mut, address = admin_info.operator @ ErrorCode::InvalidOperator)]
    pub operator: Signer<'info>,
    
}

#[derive(Accounts)]
#[instruction(pool_id: u64, amount: u64)]
pub struct Stake<'info> {
    #[account(mut)]
    pub user: Signer<'info>,
    #[account(address = admin_info.cosigner)]
    pub cosigner: Signer<'info>,

    #[account(mut, seeds=[b"new_pool", &pool_id.to_le_bytes()], bump)]
    pub pool: Account<'info, PoolInfo>,

    #[account(seeds=[b"admin_info"],bump)]
    pub admin_info: Account<'info, AdminInfo>,

    #[account(
        init_if_needed, payer = user, space = 8 + UserInfo::LEN,
        seeds=[b"user_info",user.key().as_ref()],
        bump
    )]
    pub user_info: Account<'info, UserInfo>,
    #[account(
        init, payer = user, space = 8 + OrderInfo::LEN,
        seeds=[b"new_order", user.key().as_ref(), user_info.next_order_id.to_le_bytes().as_ref()], // order len = next_order_id, order id start from 0
        bump
    )]
    pub new_order: Account<'info, OrderInfo>,

    #[account(mut)]
    pub user_token_wallet: Account<'info, TokenAccount>,
    #[account(
        mut,
        seeds=[b"vault_token_account"],bump,
        token::mint=stake_token_mint,
        token::authority=admin_info
    )]
    vault_token_account: Account<'info, TokenAccount>,
    #[account(mut, address = admin_info.stake_token_mint)]
    pub stake_token_mint: Account<'info, Mint>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(order_id: u64)]
pub struct Unstake<'info> {
    #[account(mut)]
    pub user: Signer<'info>,
    #[account(address = admin_info.cosigner)]
    pub cosigner: Signer<'info>,

    #[account(seeds=[b"new_pool", &order.pool_id.to_le_bytes()], bump)]
    pub pool: Account<'info, PoolInfo>,

    #[account(seeds=[b"admin_info"],bump)]
    pub admin_info: Account<'info, AdminInfo>,

    #[account(mut, seeds=[b"user_info",user.key().as_ref()],bump)]
    pub user_info: Account<'info, UserInfo>,
    #[account(
        mut, 
        seeds=[b"new_order", user.key().as_ref(), order_id.to_le_bytes().as_ref()],
        bump
    )]
    pub order: Account<'info, OrderInfo>,

    #[account(mut)]
    pub user_token_wallet: Account<'info, TokenAccount>,
    #[account(
        mut,
        seeds=[b"vault_token_account"],bump,
        token::mint=stake_token_mint,
        token::authority=admin_info
    )]
    vault_token_account: Account<'info, TokenAccount>,
    #[account(mut, address = admin_info.stake_token_mint)]
    pub stake_token_mint: Account<'info, Mint>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(order_id: u64)]
pub struct ClaimReward<'info> {
    #[account(mut)]
    pub user: Signer<'info>,
    #[account(address = admin_info.cosigner)]
    pub cosigner: Signer<'info>,

    #[account(seeds=[b"new_pool", &order.pool_id.to_le_bytes()], bump)]
    pub pool: Account<'info, PoolInfo>,

    #[account(seeds=[b"admin_info"],bump)]
    pub admin_info: Account<'info, AdminInfo>,

    #[account(mut, seeds=[b"user_info",user.key().as_ref()],bump)]
    pub user_info: Account<'info, UserInfo>,
    #[account(
        mut, 
        seeds=[b"new_order", user.key().as_ref(), order_id.to_le_bytes().as_ref()],
        bump
    )]
    pub order: Account<'info, OrderInfo>,

    #[account(mut)]
    pub user_token_wallet: Account<'info, TokenAccount>,
    #[account(
        mut,
        seeds=[b"vault_token_account"],bump,
        token::mint=stake_token_mint,
        token::authority=admin_info,
    )]
    vault_token_account: Account<'info, TokenAccount>,
    #[account(mut, address = admin_info.stake_token_mint)]
    pub stake_token_mint: Account<'info, Mint>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct UpdateAdminRole<'info> {

    #[account(mut, seeds=[b"admin_info"],bump)]
    pub admin_info: Account<'info, AdminInfo>,

    #[account(mut, address = admin_info.admin @ ErrorCode::InvalidAdmin)]
    pub admin: Signer<'info>,
}

#[account]
pub struct AdminInfo {
    pub admin: Pubkey,
    pub cosigner:Pubkey,
    pub operator:Pubkey,
    pub receiver:Pubkey,
    pub pool_admin: Pubkey,
    pub stake_token_mint: Pubkey,
    pub next_pool_id: u64,
    pub is_paused: bool,
}
impl AdminInfo {
    pub const LEN: usize = 32*6 + 8 + 1;
}

#[account]
pub struct PoolInfo {// PDA
    pub is_paused: bool,
    pub pool_id: u64,
    pub stake_cap: u64,
    pub reward_cap: u64,
    pub stake_visible: u64,// ==  stake_cap - cur_total_stake
    pub reward_visible: u64,// == reward_cap - claimed_reward
    pub stake_start_at: i64,
    pub stake_end_at: i64,
    pub duration: u64,//seconds 
}
impl PoolInfo {
    pub const LEN: usize = 1 + 8 + 16*4 + 8*3;// PDA data size
}

#[account]
pub struct UserInfo {//PDA // stake next_order_id =>orderInfo(order_id) , claim, unstake(order_id)
    pub next_order_id: u64,//order_id=0,1,2,3
    pub total_stake:u64,
    pub total_reward: u64,
    pub total_claimed_reward: u64
}
impl UserInfo {
    pub const LEN: usize = 8 + 16*3;
}

#[account]
pub struct OrderInfo {// key(user,order_id,"new_order") => PDA
    pub order_id: u64,
    pub pool_id: u64,
    pub staker: Pubkey,
    pub stake_amount: u64,
    pub reward_amount: u64,
    pub start_time: i64,
    pub unstake_time: i64,// what time to unstake 
    pub claimed_reward: u64,
    pub is_unstake: bool
}
impl OrderInfo {
    pub const LEN: usize = 8 + 8 + 32 + 16*2 + 8*3 + 1;
}

#[derive(Accounts)]
pub struct WithdrawBWBToken<'info> {
    #[account(seeds=[b"admin_info"],bump)]
    pub admin_info: Account<'info, AdminInfo>,

    #[account(address = admin_info.operator)]
    pub operator: Signer<'info>,
    #[account(mut,token::mint=admin_info.stake_token_mint)]
    pub from_token_account: Account<'info, TokenAccount>,
    #[account(
        mut,
        token::mint=admin_info.stake_token_mint,
        token::authority=admin_info.receiver
    )]
    pub to_token_account: Account<'info, TokenAccount>,
    /// SPL [Token] program.
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct WithdrawOtherToken<'info> {
    
    #[account(seeds=[b"admin_info"],bump)]
    pub admin_info: Account<'info, AdminInfo>,

    #[account(address = admin_info.operator)]
    pub operator: Signer<'info>,
    /// The mint to distribute.
    pub mint: Account<'info, Mint>,// BWB token address
    #[account(mut, token::mint=mint)]
    pub from_token_account: Account<'info, TokenAccount>,
    #[account(
        mut,
        token::mint=mint,
        token::authority=admin_info.receiver
    )]
    pub to_token_account: Account<'info, TokenAccount>,
    #[account(address = from_token_account.owner)]
    pub from_ata_owner: Signer<'info>,// this program Id
    /// SPL [Token] program.
    pub token_program: Program<'info, Token>,
}