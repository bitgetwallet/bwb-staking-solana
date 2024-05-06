use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, TokenAccount, Token, Transfer};
use crate::error::ErrorCode;
use num::*;

pub mod error;

declare_id!("7MHr6ZPGTWZkRk6m52GfEWoMxSV7EoDjYyoXAYf3MBwS");

#[program]
pub mod bwb_stake {
    use super::*;
    const ONE_DAY: u64 = 86400;

    pub fn initialize(ctx: Context<Initialize>, cosigner: Pubkey) -> Result<()> {
        msg!("Instruction: Initialize");
        let admin_info = &mut ctx.accounts.admin_info;
        admin_info.admin = ctx.accounts.admin.key();
        admin_info.cosigner = cosigner;
        admin_info.stake_token_mint = ctx.accounts.stake_token_mint.key();

        Ok(())
    }

    pub fn set_admin_is_paused(ctx: Context<SetAdminIsPaused>, is_paused: bool) -> Result<()> {
        let admin_info = &mut ctx.accounts.admin_info;
        admin_info.is_paused = is_paused;

        Ok(())
    }

    // CreateNewPool
    pub fn create_new_pool(
        ctx: Context<CreateNewPool>, 
        stake_cap: u64,
        reward_cap: u64,
        stake_start_at: i64,
        stake_end_at: i64,
        duration: u64,
    ) -> Result<()> {
        msg!("Instruction: Initialize");
        let admin_info = &mut ctx.accounts.admin_info;
        let new_pool = &mut ctx.accounts.new_pool;
        new_pool.pool_id = admin_info.next_pool_id;
        new_pool.stake_cap = stake_cap;
        new_pool.reward_cap = reward_cap;
        new_pool.stake_start_at = stake_start_at;
        new_pool.stake_end_at = stake_end_at;
        new_pool.duration = duration;

        // next_pool_id++
        admin_info.next_pool_id += 1;

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
        new_order.stake_amount = amount;
        new_order.reward_amount = pool.reward_cap.checked_mul(amount).checked_div(pool.stake_cap);
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
        msg!("duration is {:?} days",pool.duration / ONE_DAY);
        msg!("reward is {:?}",new_order.reward_amount);

        Ok(())
    }

    pub fn unstake(ctx: Context<Unstake>, order_id: u64) -> Result<()> {
        msg!("Instruction: Unstake");

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
        
        require!(clock.unix_timestamp > order.unstake_time, ErrorCode::NotReachUnstakeTime);

        // claim reward
        let reward = order.reward_amount - order.claimed_reward;
        require!(reward <= pool.reward_visible, ErrorCode::RewardExceed);

        let withdraw_amount = order.stake_amount + reward;
        require!(withdraw_amount <= ctx.accounts.vault_token_account.amount, ErrorCode::AmountOverBalance);
        
        // unstake and claim
        let bump = ctx.accounts.admin_info.bump;
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
        order.is_unstake = true;
        // update user info
        user_info.total_claimed_reward += reward;

        Ok(())
    }

    pub fn claim_reward(ctx: Context<ClaimReward>, order_id: u64) -> Result<()> {//order_id == 1,2,3,4,5,6,7
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
        
        require!(clock.unix_timestamp >= order.start_time, ErrorCode::NotStartClaimReward);

        // claim reward
        let passed_days = (clock.unix_timestamp - order.start_time) / ONE_DAY;
        let period_days = pool.duration / ONE_DAY;
        let reward = order.reward_amount * passed_days / period_days - order.claimed_reward;
        require!(reward <= pool.reward_visible, ErrorCode::RewardExceed);

        require!(reward <= ctx.accounts.vault_token_account.amount.into(), ErrorCode::AmountOverBalance);
        
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
        // update user info
        user_info.total_claimed_reward += reward;

        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(
        init, payer = admin, space = 8 + AdminInfo::LEN,
        seeds=[b"admin_info"],
        bump
    )]
    pub admin_info: Account<'info, AdminInfo>,

    #[account(mut)]
    pub stake_token_mint: Account<'info, Mint>,

    #[account(
        init,
        payer = admin,
        seeds=[b"vault_token_account"],
        token::mint=stake_token_mint,
        token::authority=admin_info,
        bump
    )]
    vault_token_account: Account<'info, TokenAccount>,

    #[account(mut)]
    pub admin: Signer<'info>,
    pub token_program: Program<'info, Token>,
    system_program: Program<'info, System>,
    rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct CreateNewPool<'info> {
    #[account(seeds=[b"admin_info"],bump)]
    pub admin_info: Account<'info, AdminInfo>,

    #[account(
        init, payer = admin, space = 8 + PoolInfo::LEN,
        seeds=[b"new_pool", &admin_info.next_pool_id.to_le_bytes()],
        bump
    )]
    pub new_pool: Account<'info, PoolInfo>,

    #[account(mut, address = admin_info.admin @ ErrorCode::InvalidAdmin)]
    pub admin: Signer<'info>,
    system_program: Program<'info, System>,
    rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
#[instruction(pool_id: u64)]
pub struct SetPoolIsPaused<'info> {
    #[account(seeds=[b"admin_info"],bump)]
    pub admin_info: Account<'info, AdminInfo>,
    #[account(mut, address = admin_info.admin @ ErrorCode::InvalidAdmin)]
    pub admin: Signer<'info>,

    #[account(seeds=[b"new_pool", &pool_id.to_le_bytes()], bump)]
    pub pool: Account<'info, PoolInfo>, 
}

#[derive(Accounts)]
pub struct SetAdminIsPaused<'info> {
    #[account(seeds=[b"admin_info"],bump)]
    pub admin_info: Account<'info, AdminInfo>,
    #[account(mut, address = admin_info.admin @ ErrorCode::InvalidAdmin)]
    pub admin: Signer<'info>,
    
}

#[derive(Accounts)]
#[instruction(pool_id: u64, amount: u64)]
pub struct Stake<'info> {
    #[account(mut)]
    pub user: Signer<'info>,

    #[account(seeds=[b"new_pool", &pool_id.to_le_bytes()], bump)]
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

    #[account(seeds=[b"new_pool", &order.pool_id.to_le_bytes()], bump)]
    pub pool: Account<'info, PoolInfo>,

    #[account(seeds=[b"admin_info"],bump)]
    pub admin_info: Account<'info, AdminInfo>,

    #[account(seeds=[b"user_info",user.key().as_ref()],bump)]
    pub user_info: Account<'info, UserInfo>,
    #[account(
        seeds=[b"new_order", user.key().as_ref(), order_id.to_le_bytes().as_ref()],
        bump
    )]
    pub order: Account<'info, OrderInfo>,

    #[account(mut)]
    pub user_token_wallet: Account<'info, TokenAccount>,
    #[account(
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

    #[account(seeds=[b"new_pool", &order.pool_id.to_le_bytes()], bump)]
    pub pool: Account<'info, PoolInfo>,

    #[account(seeds=[b"admin_info"],bump)]
    pub admin_info: Account<'info, AdminInfo>,

    #[account(seeds=[b"user_info",user.key().as_ref()],bump)]
    pub user_info: Account<'info, UserInfo>,
    #[account(
        seeds=[b"new_order", user.key().as_ref(), order_id.to_le_bytes().as_ref()],
        bump
    )]
    pub order: Account<'info, OrderInfo>,

    #[account(mut)]
    pub user_token_wallet: Account<'info, TokenAccount>,
    #[account(
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


#[account]
pub struct AdminInfo {
    pub admin: Pubkey,
    pub cosigner:Pubkey,
    pub stake_token_mint: Pubkey,
    pub next_pool_id: u64,
    pub is_paused: bool,
}
impl AdminInfo {
    pub const LEN: usize = 32*3 + 8 + 1;
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
pub struct UserInfo {//PDA
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