import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { PredictionMarket } from "../target/types/prediction_market";
import { Keypair, PublicKey, SystemProgram } from "@solana/web3.js";
import { createMint } from "@solana/spl-token";
import * as assert from "assert";

describe("prediction-market", () => {
  anchor.setProvider(anchor.AnchorProvider.env());
  const provider = anchor.getProvider() as anchor.AnchorProvider;
  const program = anchor.workspace
    .PredictionMarket as Program<PredictionMarket>;

  it("test creating a prediction market", async () => {
    const authority = (provider.wallet as any).payer as Keypair;

    const question = "Will home team win?";
    const homeTeam = "Team A";
    const awayTeam = "Team B";
    const gameKey = "GAME_001";
    const now = Math.floor(Date.now() / 1000);
    const startTime = new anchor.BN(now + 3600);
    const endTime = new anchor.BN(now + 3600 + 7200);
    const resolutionTime = new anchor.BN(now + 3600 + 7200 + 3600);

    // Derive PDAs
    const [marketPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("market"), Buffer.from(gameKey)],
      program.programId
    );
    const [vaultPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("vault"), marketPda.toBuffer()],
      program.programId
    );

    // Create a mint for the market vault
    const mint = await createMint(
      provider.connection,
      authority,
      authority.publicKey,
      null,
      6
    );

    // Create a dummy oracle account owned by Switchboard program id
    // Using Switchboard v2 Mainnet program ID (matches switchboard_solana crate)
    const switchboardProgramId = new PublicKey(
      "SW1TCH7qEPTdLsDHRgPuMQjbQxKdH2aBStViMFnt64f"
    );
    const oracleKeypair = Keypair.generate();

    const lamports =
      await provider.connection.getMinimumBalanceForRentExemption(0);
    const createIx = SystemProgram.createAccount({
      fromPubkey: authority.publicKey,
      newAccountPubkey: oracleKeypair.publicKey,
      lamports,
      space: 0,
      programId: switchboardProgramId,
    });
    await provider.sendAndConfirm(new anchor.web3.Transaction().add(createIx), [
      authority,
      oracleKeypair,
    ]);

    await program.methods
      .createFootballMarket(
        question,
        homeTeam,
        awayTeam,
        gameKey,
        startTime,
        endTime,
        resolutionTime
      )
      .accounts({
        market: marketPda,
        authority: authority.publicKey,
        oracleFeed: oracleKeypair.publicKey,
        vault: vaultPda,
        mint,
        tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .signers([authority])
      .rpc();

    const market = await program.account.market.fetch(marketPda);
    assert.strictEqual(market.question, question);
    assert.strictEqual(market.homeTeam, homeTeam);
    assert.strictEqual(market.awayTeam, awayTeam);
    assert.strictEqual(market.gameKey, gameKey);
    assert.strictEqual(market.yesPool.toString(), "0");
    assert.strictEqual(market.noPool.toString(), "0");
    assert.strictEqual(market.resolved, false);
    assert.strictEqual(market.isDraw, false);
  });
});
