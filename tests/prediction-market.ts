import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { PredictionMarket } from "../target/types/prediction_market";
import { Keypair, PublicKey, SystemProgram } from "@solana/web3.js";
import {
  createMint,
  createAccount,
  mintTo,
  getAccount,
} from "@solana/spl-token";
import * as assert from "assert";

describe("prediction-market", () => {
  anchor.setProvider(anchor.AnchorProvider.env());
  const provider = anchor.getProvider() as anchor.AnchorProvider;
  const program = anchor.workspace
    .PredictionMarket as Program<PredictionMarket>;

  // Setup state
  const authority = (provider.wallet as any).payer as Keypair;
  let mint: PublicKey;
  let oracleKeypair: Keypair;
  let user1: Keypair;
  let user1TokenAccount: PublicKey;
  let user2: Keypair;
  let user2TokenAccount: PublicKey;
  const switchboardProgramId = new PublicKey(
    "SW1TCH7qEPTdLsDHRgPuMQjbQxKdH2aBStViMFnt64f"
  );

  const question = "Will home team win?";
  const homeTeam = "Team A";
  const awayTeam = "Team B";
  const gameKey = "GAME_001";
  const now = Math.floor(Date.now() / 1000);
  const startTime = new anchor.BN(now + 3600);
  const endTime = new anchor.BN(now + 3600 + 7200);
  const resolutionTime = new anchor.BN(now + 3600 + 7200 + 3600);

  const [marketPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("market"), Buffer.from(gameKey)],
    program.programId
  );
  const [vaultPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("vault"), marketPda.toBuffer()],
    program.programId
  );

  before(async () => {
    // Create a mint for the market vault
    mint = await createMint(
      provider.connection,
      authority,
      authority.publicKey,
      null,
      6
    );

    // Create a dummy oracle account owned by Switchboard program id
    oracleKeypair = Keypair.generate();
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

    // Create test users with token accounts
    user1 = Keypair.generate();
    user2 = Keypair.generate();

    // Airdrop SOL to users
    await provider.connection.confirmTransaction(
      await provider.connection.requestAirdrop(
        user1.publicKey,
        10 * anchor.web3.LAMPORTS_PER_SOL
      )
    );
    await provider.connection.confirmTransaction(
      await provider.connection.requestAirdrop(
        user2.publicKey,
        10 * anchor.web3.LAMPORTS_PER_SOL
      )
    );

    // Create token accounts for users
    user1TokenAccount = await createAccount(
      provider.connection,
      authority,
      mint,
      user1.publicKey
    );
    user2TokenAccount = await createAccount(
      provider.connection,
      authority,
      mint,
      user2.publicKey
    );

    // Mint tokens to users
    await mintTo(
      provider.connection,
      authority,
      mint,
      user1TokenAccount,
      authority.publicKey,
      1_000_000_000 // 1000 tokens (6 decimals)
    );
    await mintTo(
      provider.connection,
      authority,
      mint,
      user2TokenAccount,
      authority.publicKey,
      1_000_000_000
    );
  });

  it("test creating a prediction market", async () => {
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

  it("fails to create duplicate market with same game_key", async () => {
    try {
      await program.methods
        .createFootballMarket(
          question,
          homeTeam,
          awayTeam,
          gameKey, // Same game_key as first test
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

      assert.fail("Should have thrown an error");
    } catch (err: any) {
      assert.ok(err.message.includes("already in use"));
    }
  });

  it("fails with oracle account not owned by Switchboard", async () => {
    const invalidOracle = Keypair.generate();
    const gameKey2 = "GAME_002";
    const [marketPda2] = PublicKey.findProgramAddressSync(
      [Buffer.from("market"), Buffer.from(gameKey2)],
      program.programId
    );
    const [vaultPda2] = PublicKey.findProgramAddressSync(
      [Buffer.from("vault"), marketPda2.toBuffer()],
      program.programId
    );

    // Create account owned by system program (not Switchboard)
    const lamports =
      await provider.connection.getMinimumBalanceForRentExemption(0);
    const createIx = SystemProgram.createAccount({
      fromPubkey: authority.publicKey,
      newAccountPubkey: invalidOracle.publicKey,
      lamports,
      space: 0,
      programId: SystemProgram.programId, // Wrong owner!
    });
    await provider.sendAndConfirm(new anchor.web3.Transaction().add(createIx), [
      authority,
      invalidOracle,
    ]);

    try {
      await program.methods
        .createFootballMarket(
          question,
          homeTeam,
          awayTeam,
          gameKey2,
          startTime,
          endTime,
          resolutionTime
        )
        .accounts({
          market: marketPda2,
          authority: authority.publicKey,
          oracleFeed: invalidOracle.publicKey,
          vault: vaultPda2,
          mint,
          tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .signers([authority])
        .rpc();

      assert.fail("Should have thrown an error");
    } catch (err: any) {
      assert.ok(
        err.message.includes("ConstraintOwner") || err.message.includes("owner")
      );
    }
  });

  it("creates market with different game_key successfully", async () => {
    const gameKey3 = "GAME_003";
    const [marketPda3] = PublicKey.findProgramAddressSync(
      [Buffer.from("market"), Buffer.from(gameKey3)],
      program.programId
    );
    const [vaultPda3] = PublicKey.findProgramAddressSync(
      [Buffer.from("vault"), marketPda3.toBuffer()],
      program.programId
    );

    await program.methods
      .createFootballMarket(
        "Will away team win?",
        "Team C",
        "Team D",
        gameKey3,
        startTime,
        endTime,
        resolutionTime
      )
      .accounts({
        market: marketPda3,
        authority: authority.publicKey,
        oracleFeed: oracleKeypair.publicKey,
        vault: vaultPda3,
        mint,
        tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .signers([authority])
      .rpc();

    const market = await program.account.market.fetch(marketPda3);
    assert.strictEqual(market.gameKey, gameKey3);
    assert.strictEqual(market.homeTeam, "Team C");
  });

  describe("place bet on market", () => {
    it("places a bet on home team winning (yes)", async () => {
      const betAmount = new anchor.BN(100_000_000); // 100 tokens
      const [positionPda] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("position"),
          marketPda.toBuffer(),
          user1.publicKey.toBuffer(),
        ],
        program.programId
      );

      const vaultBefore = await getAccount(provider.connection, vaultPda);
      const userBalanceBefore = await getAccount(
        provider.connection,
        user1TokenAccount
      );

      await program.methods
        .placeBetOnMarket(betAmount, true) // true = bet home wins
        .accounts({
          market: marketPda,
          position: positionPda,
          user: user1.publicKey,
          userTokenAccount: user1TokenAccount,
          marketVault: vaultPda,
          systemProgram: SystemProgram.programId,
          tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
        })
        .signers([user1])
        .rpc();

      // Check position was created
      const position = await program.account.position.fetch(positionPda);
      assert.strictEqual(position.user.toString(), user1.publicKey.toString());
      assert.strictEqual(position.market.toString(), marketPda.toString());
      assert.strictEqual(position.yesAmount.toString(), betAmount.toString());
      assert.strictEqual(position.noAmount.toString(), "0");

      // Check market pools updated (amount without fee)
      const market = await program.account.market.fetch(marketPda);
      assert.strictEqual(market.yesPool.toString(), betAmount.toString());
      assert.strictEqual(market.noPool.toString(), "0");

      // Check fees collected (0.5% = 50 basis points)
      const expectedFee = (betAmount.toNumber() * 50) / 10_000;
      assert.strictEqual(
        market.feesCollected.toString(),
        expectedFee.toString()
      );

      // Check vault received tokens (amount + fee)
      const vaultAfter = await getAccount(provider.connection, vaultPda);
      const expectedTransfer = betAmount.toNumber() + expectedFee;
      assert.strictEqual(
        vaultAfter.amount.toString(),
        (Number(vaultBefore.amount) + expectedTransfer).toString()
      );

      // Check user balance decreased
      const userBalanceAfter = await getAccount(
        provider.connection,
        user1TokenAccount
      );
      assert.strictEqual(
        userBalanceAfter.amount.toString(),
        (Number(userBalanceBefore.amount) - expectedTransfer).toString()
      );
    });

    it("places a bet on away team winning (no)", async () => {
      const betAmount = new anchor.BN(50_000_000); // 50 tokens
      const [positionPda] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("position"),
          marketPda.toBuffer(),
          user2.publicKey.toBuffer(),
        ],
        program.programId
      );

      await program.methods
        .placeBetOnMarket(betAmount, false) // false = bet away wins
        .accounts({
          market: marketPda,
          position: positionPda,
          user: user2.publicKey,
          userTokenAccount: user2TokenAccount,
          marketVault: vaultPda,
          systemProgram: SystemProgram.programId,
          tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
        })
        .signers([user2])
        .rpc();

      const position = await program.account.position.fetch(positionPda);
      assert.strictEqual(position.yesAmount.toString(), "0");
      assert.strictEqual(position.noAmount.toString(), betAmount.toString());

      const market = await program.account.market.fetch(marketPda);
      assert.strictEqual(market.noPool.toString(), betAmount.toString());
    });

    it("allows same user to place multiple bets", async () => {
      const betAmount1 = new anchor.BN(25_000_000); // 25 tokens
      const betAmount2 = new anchor.BN(30_000_000); // 30 tokens
      const [positionPda] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("position"),
          marketPda.toBuffer(),
          user1.publicKey.toBuffer(),
        ],
        program.programId
      );

      const positionBefore = await program.account.position.fetch(positionPda);

      // Place another yes bet
      await program.methods
        .placeBetOnMarket(betAmount1, true)
        .accounts({
          market: marketPda,
          position: positionPda,
          user: user1.publicKey,
          userTokenAccount: user1TokenAccount,
          marketVault: vaultPda,
          systemProgram: SystemProgram.programId,
          tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
        })
        .signers([user1])
        .rpc();

      // Place a no bet
      await program.methods
        .placeBetOnMarket(betAmount2, false)
        .accounts({
          market: marketPda,
          position: positionPda,
          user: user1.publicKey,
          userTokenAccount: user1TokenAccount,
          marketVault: vaultPda,
          systemProgram: SystemProgram.programId,
          tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
        })
        .signers([user1])
        .rpc();

      const positionAfter = await program.account.position.fetch(positionPda);
      assert.strictEqual(
        positionAfter.yesAmount.toString(),
        (positionBefore.yesAmount.toNumber() + betAmount1.toNumber()).toString()
      );
      assert.strictEqual(
        positionAfter.noAmount.toString(),
        betAmount2.toString()
      );
    });
  });
});
