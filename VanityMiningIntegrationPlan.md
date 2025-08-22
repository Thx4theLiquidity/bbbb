# Vanity Miner ⇆ Bribed Token Launch – Integration Plan

> **Goal**: Before a bribed token is deployed we want to hit our GPU vanity‐miner cluster (running the modified `create2crunch`) and receive back a `salt` that makes the CREATE2 deployment address start with **exactly eight leading `b` nibbles** (`0xBBBBBBBB…`).  Eight is the minimum/target – if we somehow get more that’s still fine, but we don’t mine for anything < eight.  If mining exceeds the timeout we **abort and fall back to the regular (non-vanity) launch path** so the user experience is never blocked indefinitely.

---

## 0 High-Level Flow (bird’s-eye)

1. **tokenService** detects a token launch is imminent → _status_ = `awaiting_salt`.
2. It **POSTs** a **mining request** to the **Vanity Miner API** with:
   * `tokenId`, `deployerAddress`, `initCodeHash`, optional scoring parameters.
3. **Mining-Coordinator** creates a `jobId`, enqueues work in Redis/PG/Queue and replies `202 Accepted`.
4. One of the **GPU workers** (vast.ai boxes running `create2crunch`) polls `/jobs/next` (or listens on Redis channel) → receives the goal → mines → finds `salt`.
5. Worker `POSTs /jobs/{jobId}/result` (or publishes) with `{salt, vanityAddress}`.
6. Coordinator marks job **DONE**, pushes WebSocket/event → **tokenService** (or tokenService polls) retrieves `{salt}`.
7. **tokenService** proceeds to deploy via Bond factory: `createToken(tp, bp, salt)` – the factory forwards our mined salt to `Clones.cloneDeterministic`, emitting the pretty address.
8. Normal bundling / Flashbots path continues.

Why this matters? It decouples heavy GPU work from the API thread **and** keeps `tokenService` stateless regarding mining progress.

---

## 1 Components & Changes — *Simplified*

We already have **Redis + Bull queue** infrastructure (`transactionQueueService`, `workers/transactionProcessor`).  Rather than bolting on a brand-new HTTP coordinator, we can treat vanity mining as just **one more job type** and reuse the queue, auth, and persistence we already trust.

**Key idea:**
* `tokenService` → enqueue **`vanitySalt`** job (payload includes `tokenId`, `deployerAddress`, `initCodeHash`, `minLeadingBs:8`, `timeout`).
* **GPU workers** run `vanitySalt` queue (BullMQ) and pop jobs directly from Redis (no HTTP).  They mine, then `return {salt, vanityAddress}` which Bull stores.
* A lightweight **queue event listener** in `bid-api-server` subscribes to `completed` events for `vanitySalt` jobs and, on success, pushes a follow-up **`createToken`** job automatically.
* If job `failed` or `stalled` (timeout), listener enqueues `createToken` with `randomSalt` so launch is never blocked.

This eliminates custom REST endpoints, reduces moving parts, and leverages our existing queue persistence/requeue logic.

### 0.9 On-chain patch (must happen first)

| Modification | Why it matters |
| --- | --- |
| Add `bytes32 vanitySalt` arg to `createToken(TokenParams tp, BondParams bp, bytes32 vanitySalt)` | Lets backend supply mined salt; passing `0x00…00` keeps current deterministic behaviour. |
| Inside `_clone` calculation use:<br/>`bytes32 salt = vanitySalt == bytes32(0) ? keccak256(abi.encodePacked(address(this), tp.symbol)) : vanitySalt;` | Backward compatible. |

Deploy patched `Bond` contract and update `BOND_CONTRACT_ADDRESS` env var.

### 1.1 Queue additions

| Item | Why it matters |
| --- | --- |
| Add Bull queue **`vanitySaltQueue`** | Same Redis connection, easy monitoring via Bull-board UI. |
| Modify `transactionProcessor` (or dedicated `vanitySaltProcessor`) to run GPU-less handler that only listens for results (since actual mining happens inside GPU container). | Keeps separation of concerns. |
| `vanitySalt` job options: `{ attempts: 1, removeOnComplete: true, timeout: 300_000 }` | Enforces 5-min mining cap. |

### 1.2 GPU Worker container (`fourfourfourfour`) mods

… (unchanged **except** now it connects to Redis to `vanitySaltQueue` instead of polling HTTP). In practice easiest is to wrap the miner with a Node script that: `const job = await vanitySaltQueue.getNextJob(); … job.updateProgress(%) … job.moveToCompleted(result)`. This requires only Redis URL + AUTH.

### 1.3 `tokenService.js` changes

Same as before but simpler: instead of waiting for HTTP, we:

```js
await vanitySaltQueue.add('mine', {
  tokenId,
  deployerAddress: factoryAddress,
  initCodeHash,
  minLeadingBs: 8
});

await pool.query('UPDATE tokens SET status=$1 WHERE token_id=$2', ['awaiting_salt', tokenId]);
return { tokenId }; // return immediately, front-end shows “Mining Salt…”
```

A **queue listener** (small new file) handles the rest.

After miner returns:
```js
// inside queue listener when vanitySalt job completes
await transactionQueue.queueTransaction({
  type: 'createToken',
  data: { tokenId, salt } // salt forwarded
});
```

### 1.4 Security

Redis is already behind VPC + password.  No salt leaves infra until after deployment: listener injects salt directly into `createToken` job; it is never exposed via WebSocket/API.  GPU containers only see job payload after authenticated Redis handshake.

### 1.5 Init-code hash helper (resolved)

Utility added in backend:
```js
const getInitCodeHash = (implAddr) => {
  const impl = implAddr.toLowerCase().replace(/^0x/, '');
  const bytecode = '0x3d602d80600a3d3981f3' +
                  '363d3d373d3d3d363d73' +
                  impl +
                  '5af43d82803e903d91602b57fd5bf3';
  return ethers.keccak256(bytecode);
};
```
Used when enqueueing mining job.

---

## 2 API Contract (draft)

### 2.1 Create Job

```
POST /vanity/jobs
Content-Type: application/json
{
  "tokenId": "f3d0d10e",
  "deployerAddress": "0x123…",
  "initCodeHash": "0xabc…",   // keccak256(initCode)
  "minLeadingBs": 8,            // must be 8
  "timeout": 600                // seconds (optional)
}
```
Response `202`:
```
{ "jobId": "7be2c9", "status": "queued" }
```

### 2.2 Worker Poll
```
GET /vanity/jobs/next?workerKey=APIKEY
→ 204 No Content  // if no work
→ 200
  { jobId, deployerAddress, initCodeHash, prefix:"b", minLeadingBs }
```

### 2.3 Submit Result
```
POST /vanity/jobs/:jobId/result?workerKey=APIKEY
{ "salt": "0x…", "vanityAddress": "0xbBBB…" }
```

### 2.4 Query / WebSocket
* `GET /vanity/jobs/:id` → `{ status, salt?, vanityAddress? }`
* WS channel `vanity:<jobId>` emits `{status}` transitions.

Security: HMAC header or Bearer token shared with vast.ai boxes; public endpoints rate-limited.

---

## 3 Database Schema Sketch

```sql
CREATE TABLE vanity_jobs (
  job_id        uuid PRIMARY KEY,
  token_id      text NOT NULL,
  deployer_addr bytea NOT NULL,
  init_code_hash bytea NOT NULL,
  min_leading_bs int  DEFAULT 8,
  salt          bytea,
  vanity_addr   bytea,
  status        text CHECK (status IN ('queued','mining','done','timeout','failed')),
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now()
);
-- index on (status) for fast worker fetch
```

Plus add `vanity_salt bytea` to `tokens` table.

---

## 4 Sequence Diagram (text)

```
 tokenService        Miner API      Redis/DB       GPU Worker
      |                 |              |              |
      | POST /jobs ---->|              |              |
      |<-- 202 jobId ---|              |              |
      |                 | INSERT job   |              |
      |                 |------------->|              |
      |                 |              |  GET /next --|
      |                 |              |<---- job ----|
      |                 |              |  mine…       |
      |                 |              | POST result -|
      |                 | UPDATE job   |--------------|
      |  WS / polling <-- salt ready --|              |
      | deploy token                    |              |
```

---

## 5 Open Questions / Action Items

1. **Exact address pattern – RESOLVED**: Always mine for _exactly eight leading `b` nibbles_. Anything shorter is rejected; anything longer is acceptable but we stop at first ≥8 match.
2. **Timeout policy – RESOLVED**: Queue job `timeout` (default 5 min).  On expiry listener proceeds with non-vanity salt.
3. **How to compute `initCodeHash` – RESOLVED**: Helper implemented (`utils/initCode.js`) deriving hash from `TOKEN_IMPLEMENTATION` minimal proxy byte-code.
4. **GPU worker authentication – RESOLVED**: Workers connect to private Redis using strong password + IP allow-list. No extra JWT necessary.
5. **Back-pressure – RESOLVED**: Any number of concurrent `vanitySalt` jobs; Redis + Bull handle FIFO; rate-limit job creation per account.
6. **Side-channel security – OPEN**: Ensure salt never written to logs; consider encrypting progress updates.

**NEW security note**: All result payloads must be signed `(HMAC(jobId‖salt))` with a secret known only by Coordinator and workers. HTTPS only.  `vanityAddress` MUST NOT be exposed publicly until after successful deployment to avoid sniping.

---

## 6 Implementation Checklist (who-does-what)

### 6.1 Smart-Contract layer

```solidity
// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.20;

// … imports …

contract MCV2_Bond is MCV2_Royalty {
    // … state vars …

    // NEW createToken signature
    function createToken(
        TokenParams calldata tp,
        BondParams  calldata bp,
        bytes32      vanitySalt   // ← added arg
    ) external payable returns (address) {
        if (msg.value != creationFee) revert MCV2_Bond__InvalidCreationFee();
        _validateTokenParams(tp);
        _validateBondParams(bp);

        // choose salt
        bytes32 salt = vanitySalt == bytes32(0)
            ? keccak256(abi.encodePacked(address(this), tp.symbol))
            : vanitySalt;

        address token = Clones.cloneDeterministic(TOKEN_IMPLEMENTATION, salt);
        // … rest of existing body unchanged …
    }
}
```

Regenerate ABI (`npx hardhat typechain`) so backend sees:

```ts
function createToken(tp: TokenParams, bp: BondParams, vanitySalt: BytesLike, overrides?: Overrides & { value?: BigNumberish }): Promise<ContractTransaction>;
```

### 6.2 Backend (Node – bid-api-server)

`utils/initCode.js`
```js
const { ethers } = require('ethers');

function getMinimalProxyBytecode(impl) {
  impl = impl.toLowerCase().replace(/^0x/, '');
  return '0x3d602d80600a3d3981f3' +
         '363d3d373d3d3d363d73' +
         impl +
         '5af43d82803e903d91602b57fd5bf3';
}

function getInitCodeHash(impl) {
  return ethers.keccak256(getMinimalProxyBytecode(impl));
}

module.exports = { getInitCodeHash };
```

Enqueue mining job in `tokenService.launchToken()` **before COMMIT**:
```js
const { getInitCodeHash } = require('../utils/initCode');
const vanitySaltQueue = require('../queues/vanitySaltQueue');

const initCodeHash = getInitCodeHash(process.env.TOKEN_IMPLEMENTATION);

await vanitySaltQueue.add('mine', {
  tokenId,
  deployerAddress: process.env.BOND_CONTRACT_ADDRESS,
  initCodeHash,
  minLeadingBs: 8
}, { timeout: 300_000 });

await pool.query('UPDATE tokens SET status=$1 WHERE token_id=$2', ['awaiting_salt', tokenId]);
```

`listeners/vanitySaltListener.js`
```js
const vanitySaltQueue = require('../queues/vanitySaltQueue');
const transactionQueue = require('../services/transactionQueueService');
const { pool } = require('../db');

vanitySaltQueue.on('completed', async (job, { salt }) => {
  const { tokenId } = job.data;
  await pool.query('UPDATE tokens SET vanity_salt=$1 WHERE token_id=$2', [salt, tokenId]);
  await transactionQueue.queueTransaction({ type: 'createToken', data: { tokenId, salt } });
});

vanitySaltQueue.on('failed', async job => {
  const { tokenId } = job.data;
  await transactionQueue.queueTransaction({ type: 'createToken', data: { tokenId } });
});
```

`transactionProcessor.processCreateToken`
```js
const bondContract = new ethers.Contract(
  process.env.BOND_CONTRACT_ADDRESS,
  BOND_CONTRACT_ABI,
  wallet
);

const tp = [tokenData.token_name, tokenData.token_symbol];
const bp = prepareBondParams(tokenData); // existing helper

const salt = job.data.salt || ethers.ZeroHash;
const createTokenTx = await bondContract.createToken.populateTransaction(tp, bp, salt);
```

### 6.3 GPU Miner Fleet

`worker.js`
```js
const Queue = require('bullmq').Queue;
const { spawn } = require('child_process');

const queue = new Queue('vanitySalt', { connection: { host: process.env.REDIS_HOST, password: process.env.REDIS_PASS } });

async function loop(idx) {
  while (true) {
    const job = await queue.getNextJob('miner');
    if (!job) { await new Promise(r => setTimeout(r, 2000)); continue; }

    const { deployerAddress, initCodeHash } = job.data;
    const proc = spawn('/home/target/release/fourfourfourfour', [
      deployerAddress,
      '0x0000000000000000000000000000000000000000',
      initCodeHash,
      idx.toString(),
      '' // log url optional
    ]);

    let found;
    proc.stdout.on('data', d => {
      const m = d.toString().match(/SALT: (0x[0-9a-fA-F]{64}) ADDRESS: (0x[0-9a-fA-F]{40})/);
      if (m) found = { salt: m[1], vanityAddress: m[2] };
    });

    const timeout = setTimeout(() => proc.kill('SIGINT'), 295000);
    proc.on('exit', async () => {
      clearTimeout(timeout);
      if (found) await job.moveToCompleted(found, true);
      else await job.moveToFailed({ message: 'timeout' });
    });
  }
}

loop(parseInt(process.env.DEVICE_ID || '0'));
```

### 6.4 Front-end (snippet)
```ts
if (auction.status === 'awaiting_salt') {
  return <Chip color="warning">Mining vanity address…</Chip>;
}
```

> After these steps vanity-address launches are fully automated and backward compatible.  🎉
