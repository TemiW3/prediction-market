import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { PredictionMarket } from "../target/types/prediction_market";
import { Keypair, PublicKey, SystemProgram } from "@solana/web3.js";
import {
  createMint,
  createAccount,
  mintTo,
} from "@solana/spl-token";

export interface TestContext {
  provider: anchor.AnchorProvider;
  program: Program<PredictionMarket>;
  authority: Keypair;
  mint: PublicKey;
  user1: Keypair;
  user1TokenAccount: PublicKey;
  user2: Keypair;
  user2TokenAccount: PublicKey;
}

export async function setupTestContext(): Promise<TestContext> {
  // Configure the client to use the local cluster
  anchor.setProvider(anchor.AnchorProvider.env());
  const provider = anchor.getProvider() as anchor.AnchorProvider;
  
  // Load the program from workspace
  const program = anchor.workspace.PredictionMarket as Program<PredictionMarket>;
  
  if (!program) {
    throw new Error(
      "Program not found in workspace. Make sure to run 'anchor build' first."
    );
  }

  const authority = (provider.wallet as any).payer as Keypair;

  // Create mint
  const mint = await createMint(
    provider.connection,
    authority,
    authority.publicKey,
    null,
    6
  );

  // Create test users
  const user1 = Keypair.generate();
  const user2 = Keypair.generate();

  // Airdrop SOL to users
  const airdropAmount = 10 * anchor.web3.LAMPORTS_PER_SOL;
  
  try {
    const sig1 = await provider.connection.requestAirdrop(user1.publicKey, airdropAmount);
    await provider.connection.confirmTransaction(sig1, "confirmed");
    
    const sig2 = await provider.connection.requestAirdrop(user2.publicKey, airdropAmount);
    await provider.connection.confirmTransaction(sig2, "confirmed");
    
    // Wait a bit for transactions to settle
    await new Promise(resolve => setTimeout(resolve, 500));
  } catch (error) {
    console.warn("Airdrop failed, continuing anyway:", error);
  }

  // Create token accounts for users
  const user1TokenAccount = await createAccount(
    provider.connection,
    authority,
    mint,
    user1.publicKey
  );
  const user2TokenAccount = await createAccount(
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

  return {
    provider,
    program,
    authority,
    mint,
    user1,
    user1TokenAccount,
    user2,
    user2TokenAccount,
  };
}

export function deriveMarketPda(
  programId: PublicKey,
  gameKey: string
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("market"), Buffer.from(gameKey, "utf8")],
    programId
  );
}

export function deriveVaultPda(
  programId: PublicKey,
  marketPda: PublicKey
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("vault"), marketPda.toBuffer()],
    programId
  );
}

export function getTimeValues(offsetHours: number = 1) {
  const now = Math.floor(Date.now() / 1000);
  return {
    startTime: new anchor.BN(now + offsetHours * 3600),
    endTime: new anchor.BN(now + (offsetHours + 2) * 3600),
    resolutionTime: new anchor.BN(now + (offsetHours + 3) * 3600),
  };
}

export function generateOracleFeedHash(): number[] {
  // Generate a random 32-byte array for oracle feed hash
  // Anchor expects number[] for [u8; 32] types
  return Array.from({ length: 32 }, () => Math.floor(Math.random() * 256));
}
