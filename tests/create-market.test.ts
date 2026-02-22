import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { PredictionMarket } from "../target/types/prediction_market";
import { PublicKey, SystemProgram } from "@solana/web3.js";
import * as assert from "assert";
import {
  setupTestContext,
  deriveMarketPda,
  deriveVaultPda,
  getTimeValues,
  generateOracleFeedHash,
} from "./utils";

describe("Create Market", () => {
  let context: Awaited<ReturnType<typeof setupTestContext>>;
  let program: Program<PredictionMarket>;

  before(async () => {
    context = await setupTestContext();
    program = context.program;
  });

  it("creates a market successfully", async () => {
    const gameKey = "GAME_001";
    const { startTime, endTime, resolutionTime } = getTimeValues();
    const oracleFeedHash = generateOracleFeedHash();

    const tx = await program.methods
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

    // Derive PDAs after market creation (Anchor auto-derived them)
    const [marketPda] = deriveMarketPda(program.programId, gameKey);

    // Derive vault PDA after market creation
    const [vaultPda] = deriveVaultPda(program.programId, marketPda);
    
    // Fetch and verify the market account
    const market = await program.account.market.fetch(marketPda);
    
    assert.strictEqual(market.question, "Will home team win?");
    assert.strictEqual(market.homeTeam, "Team A");
    assert.strictEqual(market.awayTeam, "Team B");
    assert.strictEqual(market.gameKey, gameKey);
    assert.strictEqual(market.yesPool.toString(), "0");
    assert.strictEqual(market.noPool.toString(), "0");
    assert.strictEqual(market.drawPool.toString(), "0");
    assert.strictEqual(market.resolved, false);
    assert.strictEqual(market.vault.toString(), vaultPda.toString());
  });
});
