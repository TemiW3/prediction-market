import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { PredictionMarket } from "../target/types/prediction_market";
import { PublicKey, SystemProgram, Keypair } from "@solana/web3.js";
import * as assert from "assert";
import {
  setupTestContext,
  deriveMarketPda,
  deriveVaultPda,
  getTimeValues,
  generateOracleFeedHash,
} from "./utils";
import {
  getAccount,
  createAccount,
  getAssociatedTokenAddressSync,
  createAssociatedTokenAccount,
} from "@solana/spl-token";

describe("Collect Fees", () => {
  let context: Awaited<ReturnType<typeof setupTestContext>>;
  let program: Program<PredictionMarket>;
  let marketPda: PublicKey;
  let vaultPda: PublicKey;
  const gameKey = "GAME_FEES_001";

  before(async () => {
    context = await setupTestContext();
    program = context.program;

    // Create a market for testing
    const { startTime, endTime, resolutionTime } = getTimeValues(2);
    const oracleFeedHash = generateOracleFeedHash();

    await program.methods
      .createFootballMarket(
        "Collect fees test",
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

    // Place some bets to generate fees (0.5% fee on each bet)
    const betAmount1 = new anchor.BN(100_000_000); // 100 tokens
    const betAmount2 = new anchor.BN(50_000_000); // 50 tokens

    // User1 bets on Home
    await program.methods
      .placeBetOnMarket(betAmount1, { home: {} })
      .accountsPartial({
        market: marketPda,
        user: context.user1.publicKey,
        userTokenAccount: context.user1TokenAccount,
        tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      } as any)
      .signers([context.user1])
      .rpc();

    // User2 bets on Away
    await program.methods
      .placeBetOnMarket(betAmount2, { away: {} })
      .accountsPartial({
        market: marketPda,
        user: context.user2.publicKey,
        userTokenAccount: context.user2TokenAccount,
        tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      } as any)
      .signers([context.user2])
      .rpc();
  });

  it("collects fees successfully", async () => {
    // Get initial state
    const marketBefore = await program.account.market.fetch(marketPda);
    const vaultBefore = await getAccount(context.provider.connection, vaultPda);

    // Create a fee receiver token account for the authority (use associated token account)
    const feeReceiver = getAssociatedTokenAddressSync(
      context.mint,
      context.authority.publicKey
    );
    
    // Create the associated token account if it doesn't exist
    try {
      await createAssociatedTokenAccount(
        context.provider.connection,
        context.authority,
        context.mint,
        context.authority.publicKey
      );
    } catch (error) {
      // Account might already exist, that's okay
    }

    const feeReceiverBefore = await getAccount(
      context.provider.connection,
      feeReceiver
    );

    // Calculate expected fees
    // Fee is 0.5% = 50 basis points
    // Bet 1: 100 tokens -> fee = 100 * 50 / 10000 = 0.5 tokens = 500_000 (6 decimals)
    // Bet 2: 50 tokens -> fee = 50 * 50 / 10000 = 0.25 tokens = 250_000 (6 decimals)
    // Total fees = 750_000
    const expectedFees = marketBefore.feesCollected;

    assert.ok(expectedFees.gt(new anchor.BN(0)), "Should have collected fees");

    // Collect fees
    const tx = await program.methods
      .collectFeesFromMarket()
      .accounts({
        market: marketPda,
        authority: context.authority.publicKey,
        feeReceiver: feeReceiver,
        tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
      } as any)
      .signers([context.authority])
      .rpc();

    // Verify fees were transferred
    const feeReceiverAfter = await getAccount(
      context.provider.connection,
      feeReceiver
    );
    assert.strictEqual(
      feeReceiverAfter.amount - feeReceiverBefore.amount,
      BigInt(expectedFees.toString())
    );

    // Verify vault balance decreased
    const vaultAfter = await getAccount(context.provider.connection, vaultPda);
    assert.strictEqual(
      vaultBefore.amount - vaultAfter.amount,
      BigInt(expectedFees.toString())
    );

    // Verify fees_collected was reset to 0
    const marketAfter = await program.account.market.fetch(marketPda);
    assert.strictEqual(marketAfter.feesCollected.toString(), "0");
  });

  it("fails when not the market authority", async () => {
    // Create a fee receiver for user1 (not the authority) - use associated token account
    const feeReceiver = getAssociatedTokenAddressSync(
      context.mint,
      context.user1.publicKey
    );
    
    // Create the associated token account if it doesn't exist
    try {
      await createAssociatedTokenAccount(
        context.provider.connection,
        context.authority,
        context.mint,
        context.user1.publicKey
      );
    } catch (error) {
      // Account might already exist, that's okay
    }

    // Create a new market with fees
    const newGameKey = "GAME_FEES_UNAUTHORIZED";
    const { startTime, endTime, resolutionTime } = getTimeValues(2);
    const oracleFeedHash = generateOracleFeedHash();

    await program.methods
      .createFootballMarket(
        "Unauthorized test",
        "Team X",
        "Team Y",
        newGameKey,
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

    const [newMarketPda] = deriveMarketPda(program.programId, newGameKey);

    // Place a bet to generate fees
    await program.methods
      .placeBetOnMarket(new anchor.BN(100_000_000), { home: {} })
      .accountsPartial({
        market: newMarketPda,
        user: context.user1.publicKey,
        userTokenAccount: context.user1TokenAccount,
        tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      } as any)
      .signers([context.user1])
      .rpc();

    // Try to collect fees as user1 (not the authority)
    try {
      await program.methods
        .collectFeesFromMarket()
        .accounts({
          market: newMarketPda,
          authority: context.user1.publicKey,
          feeReceiver: feeReceiver,
          tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
        } as any)
        .signers([context.user1])
        .rpc();

      assert.fail("Should have thrown an error");
    } catch (error: any) {
      assert.ok(
        error.message.includes("UnauthorizedFeeCollector") ||
        error.message.includes("2006")
      );
    }
  });

  it("fails when there are no fees to collect", async () => {
    // Create a market with no bets (no fees)
    const noFeesGameKey = "GAME_NO_FEES";
    const { startTime, endTime, resolutionTime } = getTimeValues(2);
    const oracleFeedHash = generateOracleFeedHash();

    await program.methods
      .createFootballMarket(
        "No fees test",
        "Team X",
        "Team Y",
        noFeesGameKey,
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

    const [noFeesMarketPda] = deriveMarketPda(program.programId, noFeesGameKey);

    // Create a fee receiver (use associated token account)
    const feeReceiver = getAssociatedTokenAddressSync(
      context.mint,
      context.authority.publicKey
    );
    
    // Create the associated token account if it doesn't exist
    try {
      await createAssociatedTokenAccount(
        context.provider.connection,
        context.authority,
        context.mint,
        context.authority.publicKey
      );
    } catch (error) {
      // Account might already exist, that's okay
    }

    // Try to collect fees when there are none
    try {
      await program.methods
        .collectFeesFromMarket()
        .accounts({
          market: noFeesMarketPda,
          authority: context.authority.publicKey,
          feeReceiver: feeReceiver,
          tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
        } as any)
        .signers([context.authority])
        .rpc();

      assert.fail("Should have thrown an error");
    } catch (error: any) {
      assert.ok(
        error.message.includes("NoFeesToCollect") ||
        error.message.includes("2006")
      );
    }
  });

  it("fails when fee receiver mint doesn't match vault mint", async () => {
    // Create a different mint
    const differentMint = await import("@solana/spl-token").then(
      (spl) =>
        spl.createMint(
          context.provider.connection,
          context.authority,
          context.authority.publicKey,
          null,
          6
        )
    );

    // Create a fee receiver with the wrong mint (use associated token account)
    const wrongMintFeeReceiver = getAssociatedTokenAddressSync(
      differentMint,
      context.authority.publicKey
    );
    
    // Create the associated token account if it doesn't exist
    try {
      await createAssociatedTokenAccount(
        context.provider.connection,
        context.authority,
        differentMint,
        context.authority.publicKey
      );
    } catch (error) {
      // Account might already exist, that's okay
    }

    // Create a new market with fees
    const wrongMintGameKey = "GAME_WRONG_MINT";
    const { startTime, endTime, resolutionTime } = getTimeValues(2);
    const oracleFeedHash = generateOracleFeedHash();

    await program.methods
      .createFootballMarket(
        "Wrong mint test",
        "Team X",
        "Team Y",
        wrongMintGameKey,
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

    const [wrongMintMarketPda] = deriveMarketPda(
      program.programId,
      wrongMintGameKey
    );

    // Place a bet to generate fees
    await program.methods
      .placeBetOnMarket(new anchor.BN(100_000_000), { home: {} })
      .accountsPartial({
        market: wrongMintMarketPda,
        user: context.user1.publicKey,
        userTokenAccount: context.user1TokenAccount,
        tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      } as any)
      .signers([context.user1])
      .rpc();

    // Try to collect fees with wrong mint
    try {
      await program.methods
        .collectFeesFromMarket()
        .accounts({
          market: wrongMintMarketPda,
          authority: context.authority.publicKey,
          feeReceiver: wrongMintFeeReceiver,
          tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
        } as any)
        .signers([context.authority])
        .rpc();

      assert.fail("Should have thrown an error");
    } catch (error: any) {
      assert.ok(
        error.message.includes("InvalidVault") ||
        error.message.includes("2006")
      );
    }
  });
});
