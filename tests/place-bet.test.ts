import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { PredictionMarket } from "../target/types/prediction_market";
import { PublicKey, SystemProgram } from "@solana/web3.js";
import * as assert from "assert";
import {
  setupTestContext,
  deriveMarketPda,
  deriveVaultPda,
  derivePositionPda,
  getTimeValues,
  generateOracleFeedHash,
} from "./utils";
import { getAccount, getAssociatedTokenAddressSync } from "@solana/spl-token";

describe("Place Bet", () => {
  let context: Awaited<ReturnType<typeof setupTestContext>>;
  let program: Program<PredictionMarket>;
  let marketPda: PublicKey;
  let vaultPda: PublicKey;
  const gameKey = "GAME_BET_001";

  before(async () => {
    context = await setupTestContext();
    program = context.program;

    // Create a market for testing
    const { startTime, endTime, resolutionTime } = getTimeValues(2); // 2 hours in the future
    const oracleFeedHash = generateOracleFeedHash();

    await program.methods
      .createFootballMarket(
        "Will home team win?",
        "Team A",
        "Team B",
        gameKey,
        startTime,
        endTime,
        resolutionTime,
        oracleFeedHash,
      )
      .accountsPartial({
        authority: context.authority.publicKey,
        mint: context.mint,
        tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      } as any)
      .signers([context.authority])
      .rpc();

    [marketPda] = deriveMarketPda(program.programId, gameKey);
    [vaultPda] = deriveVaultPda(program.programId, marketPda);
  });

  it("places a bet on Home successfully", async () => {
    const betAmount = new anchor.BN(100_000_000); // 100 tokens (6 decimals)
    const [positionPda] = derivePositionPda(
      program.programId,
      marketPda,
      context.user1.publicKey
    );

    // Get initial balances
    const userTokenAccountBefore = await getAccount(
      context.provider.connection,
      context.user1TokenAccount
    );
    const vaultBefore = await getAccount(
      context.provider.connection,
      vaultPda
    );

    const tx = await program.methods
      .placeBetOnMarket(betAmount, { home: {} })
      .accountsPartial({
        market: marketPda,
        user: context.user1.publicKey,
        userTokenAccount: context.user1TokenAccount,
        tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      } as any)
      .signers([context.user1])
      .rpc();

    // Verify market pools updated
    const market = await program.account.market.fetch(marketPda);
    assert.strictEqual(market.yesPool.toString(), betAmount.toString());
    assert.strictEqual(market.noPool.toString(), "0");
    assert.strictEqual(market.drawPool.toString(), "0");

    // Verify position created
    const position = await program.account.position.fetch(positionPda);
    assert.strictEqual(position.user.toString(), context.user1.publicKey.toString());
    assert.strictEqual(position.market.toString(), marketPda.toString());
    assert.strictEqual(position.yesAmount.toString(), betAmount.toString());
    assert.strictEqual(position.noAmount.toString(), "0");
    assert.strictEqual(position.drawAmount.toString(), "0");

    // Verify token balances (fee is 0.5% = 50 basis points)
    const feeAmount = betAmount.mul(new anchor.BN(50)).div(new anchor.BN(10_000));
    const totalDeducted = betAmount.add(feeAmount);
    const userTokenAccountAfter = await getAccount(
      context.provider.connection,
      context.user1TokenAccount
    );
    const vaultAfter = await getAccount(context.provider.connection, vaultPda);

    assert.strictEqual(
      userTokenAccountBefore.amount - BigInt(totalDeducted.toString()),
      userTokenAccountAfter.amount
    );
    assert.strictEqual(
      vaultBefore.amount + BigInt(totalDeducted.toString()),
      vaultAfter.amount
    );
  });

  it("places a bet on Away successfully", async () => {
    const betAmount = new anchor.BN(50_000_000); // 50 tokens
    const [positionPda] = derivePositionPda(
      program.programId,
      marketPda,
      context.user2.publicKey
    );

    const tx = await program.methods
      .placeBetOnMarket(betAmount, { away: {} })
      .accountsPartial({
        market: marketPda,
        user: context.user2.publicKey,
        userTokenAccount: context.user2TokenAccount,
        tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      } as any)
      .signers([context.user2])
      .rpc();

    // Verify market pools updated
    const market = await program.account.market.fetch(marketPda);
    assert.strictEqual(market.noPool.toString(), betAmount.toString());

    // Verify position created
    const position = await program.account.position.fetch(positionPda);
    assert.strictEqual(position.noAmount.toString(), betAmount.toString());
    assert.strictEqual(position.yesAmount.toString(), "0");
    assert.strictEqual(position.drawAmount.toString(), "0");
  });

  it("places a bet on Draw successfully", async () => {
    const betAmount = new anchor.BN(75_000_000); // 75 tokens
    const [positionPda] = derivePositionPda(
      program.programId,
      marketPda,
      context.user1.publicKey
    );

    const tx = await program.methods
      .placeBetOnMarket(betAmount, { draw: {} })
      .accountsPartial({
        market: marketPda,
        user: context.user1.publicKey,
        userTokenAccount: context.user1TokenAccount,
        tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      } as any)
      .signers([context.user1])
      .rpc();

    // Verify market pools updated
    const market = await program.account.market.fetch(marketPda);
    assert.strictEqual(market.drawPool.toString(), betAmount.toString());

    // Verify position updated (user1 already had a Home bet)
    const position = await program.account.position.fetch(positionPda);
    assert.strictEqual(position.drawAmount.toString(), betAmount.toString());
    // Previous Home bet should still be there
    assert.ok(position.yesAmount.gt(new anchor.BN(0)));
  });

  it("fails when placing bet with zero amount", async () => {
    try {
      await program.methods
        .placeBetOnMarket(new anchor.BN(0), { home: {} })
        .accountsPartial({
          market: marketPda,
          user: context.user1.publicKey,
          userTokenAccount: context.user1TokenAccount,
          tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        } as any)
        .signers([context.user1])
        .rpc();

      assert.fail("Should have thrown an error");
    } catch (error: any) {
      assert.ok(error.message.includes("InvalidAmount") || error.message.includes("2006"));
    }
  });

  it("fails when market has already started", async () => {
    // Create a market that starts immediately
    const immediateGameKey = "GAME_IMMEDIATE";
    const now = Math.floor(Date.now() / 1000);
    const { endTime, resolutionTime } = getTimeValues(2);
    const oracleFeedHash = generateOracleFeedHash();

    await program.methods
      .createFootballMarket(
        "Immediate market",
        "Team X",
        "Team Y",
        immediateGameKey,
        new anchor.BN(now - 100), // Started 100 seconds ago
        endTime,
        resolutionTime,
        oracleFeedHash,
      )
      .accountsPartial({
        authority: context.authority.publicKey,
        mint: context.mint,
        tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      } as any)
      .signers([context.authority])
      .rpc();

    const [immediateMarketPda] = deriveMarketPda(program.programId, immediateGameKey);

    try {
      await program.methods
        .placeBetOnMarket(new anchor.BN(100_000_000), { home: {} })
        .accountsPartial({
          market: immediateMarketPda,
          user: context.user1.publicKey,
          userTokenAccount: context.user1TokenAccount,
          tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        } as any)
        .signers([context.user1])
        .rpc();

      assert.fail("Should have thrown an error");
    } catch (error: any) {
      assert.ok(
        error.message.includes("MarketAlreadyStarted") ||
        error.message.includes("2006")
      );
    }
  });
});
