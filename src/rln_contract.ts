import { ethers } from "ethers";

import { RLN_REGISTRY_ABI, RLN_STORAGE_ABI } from "./constants.js";
import { IdentityCredential, RLNInstance } from "./rln.js";
import { MerkleRootTracker } from "./root_tracker.js";

type Member = {
  pubkey: string;
  index: number;
};

type Provider = ethers.Signer | ethers.providers.Provider;

type ContractOptions = {
  address: string;
  provider: Provider;
};

type FetchMembersOptions = {
  fromBlock?: number;
  fetchRange?: number;
  fetchChunks?: number;
};

export class RLNContract {
  private registryContract: ethers.Contract;
  private merkleRootTracker: MerkleRootTracker;

  private deployBlock: undefined | number;
  private storageIndex: undefined | number;
  private storageContract: undefined | ethers.Contract;
  private _membersFilter: undefined | ethers.EventFilter;

  private _members: Member[] = [];

  public static async init(
    rlnInstance: RLNInstance,
    options: ContractOptions
  ): Promise<RLNContract> {
    const rlnContract = new RLNContract(rlnInstance, options);

    await rlnContract.initStorageContract(options.provider);
    await rlnContract.fetchMembers(rlnInstance);
    rlnContract.subscribeToMembers(rlnInstance);

    return rlnContract;
  }

  private constructor(
    rlnInstance: RLNInstance,
    { address, provider }: ContractOptions
  ) {
    const initialRoot = rlnInstance.getMerkleRoot();

    this.registryContract = new ethers.Contract(
      address,
      RLN_REGISTRY_ABI,
      provider
    );
    this.merkleRootTracker = new MerkleRootTracker(5, initialRoot);
  }

  private async initStorageContract(provider: Provider): Promise<void> {
    const index = await this.registryContract.usingStorageIndex();
    const address = await this.registryContract.storages(index);

    this.storageIndex = index;
    this.storageContract = new ethers.Contract(
      address,
      RLN_STORAGE_ABI,
      provider
    );
    this._membersFilter = this.storageContract.filters.MemberRegistered();

    this.deployBlock = await this.storageContract.deployedBlockNumber();
  }

  public get contract(): ethers.Contract {
    // since init is only way to create RLNContract class
    // it is guaranteed that this.storageContract is populated
    return this.storageContract as ethers.Contract;
  }

  public get members(): Member[] {
    return this._members;
  }

  private get membersFilter(): ethers.EventFilter {
    // since init is only way to create RLNContract class
    // it is guaranteed that this.storageContract is populated
    return this._membersFilter as ethers.EventFilter;
  }

  public async fetchMembers(
    rlnInstance: RLNInstance,
    options: FetchMembersOptions = {}
  ): Promise<void> {
    const registeredMemberEvents = await queryFilter(this.contract, {
      fromBlock: this.deployBlock,
      ...options,
      membersFilter: this.membersFilter,
    });
    this.processEvents(rlnInstance, registeredMemberEvents);
  }

  public processEvents(rlnInstance: RLNInstance, events: ethers.Event[]): void {
    const toRemoveTable = new Map<number, number[]>();
    const toInsertTable = new Map<number, ethers.Event[]>();

    events.forEach((evt) => {
      if (!evt.args) {
        return;
      }

      if (evt.removed) {
        const index: number = evt.args.index;
        const toRemoveVal = toRemoveTable.get(evt.blockNumber);
        if (toRemoveVal != undefined) {
          toRemoveVal.push(index);
          toRemoveTable.set(evt.blockNumber, toRemoveVal);
        } else {
          toRemoveTable.set(evt.blockNumber, [index]);
        }
      } else {
        let eventsPerBlock = toInsertTable.get(evt.blockNumber);
        if (eventsPerBlock == undefined) {
          eventsPerBlock = [];
        }

        eventsPerBlock.push(evt);
        toInsertTable.set(evt.blockNumber, eventsPerBlock);
      }

      this.removeMembers(rlnInstance, toRemoveTable);
      this.insertMembers(rlnInstance, toInsertTable);
    });
  }

  private insertMembers(
    rlnInstance: RLNInstance,
    toInsert: Map<number, ethers.Event[]>
  ): void {
    toInsert.forEach((events: ethers.Event[], blockNumber: number) => {
      events.forEach((evt) => {
        if (!evt.args) {
          return;
        }

        const pubkey = evt.args.pubkey;
        const index = evt.args.index;
        const idCommitment = ethers.utils.zeroPad(
          ethers.utils.arrayify(pubkey),
          32
        );
        rlnInstance.insertMember(idCommitment);
        this.members.push({ index, pubkey });
      });

      const currentRoot = rlnInstance.getMerkleRoot();
      this.merkleRootTracker.pushRoot(blockNumber, currentRoot);
    });
  }

  private removeMembers(
    rlnInstance: RLNInstance,
    toRemove: Map<number, number[]>
  ): void {
    const removeDescending = new Map([...toRemove].sort().reverse());
    removeDescending.forEach((indexes: number[], blockNumber: number) => {
      indexes.forEach((index) => {
        const idx = this.members.findIndex((m) => m.index === index);
        if (idx > -1) {
          this.members.splice(idx, 1);
        }
        rlnInstance.deleteMember(index);
      });

      this.merkleRootTracker.backFill(blockNumber);
    });
  }

  public subscribeToMembers(rlnInstance: RLNInstance): void {
    this.contract.on(this.membersFilter, (_pubkey, _index, event) =>
      this.processEvents(rlnInstance, event)
    );
  }

  public async registerWithSignature(
    rlnInstance: RLNInstance,
    signature: string
  ): Promise<ethers.Event | undefined> {
    const identityCredential =
      await rlnInstance.generateSeededIdentityCredential(signature);

    return this.registerWithKey(identityCredential);
  }

  public async registerWithKey(
    credential: IdentityCredential
  ): Promise<ethers.Event | undefined> {
    if (!this.storageIndex) {
      throw Error(
        "Cannot register credential, no storage contract index found."
      );
    }
    const txRegisterResponse: ethers.ContractTransaction =
      await this.registryContract.register(
        this.storageIndex,
        credential.IDCommitmentBigInt,
        {
          gasLimit: 100000,
        }
      );
    const txRegisterReceipt = await txRegisterResponse.wait();

    return txRegisterReceipt?.events?.[0];
  }

  public roots(): Uint8Array[] {
    return this.merkleRootTracker.roots();
  }
}

type CustomQueryOptions = FetchMembersOptions & {
  membersFilter: ethers.EventFilter;
};

// these value should be tested on other networks
const FETCH_CHUNK = 5;
const BLOCK_RANGE = 3000;

async function queryFilter(
  contract: ethers.Contract,
  options: CustomQueryOptions
): Promise<ethers.Event[]> {
  const {
    fromBlock,
    membersFilter,
    fetchRange = BLOCK_RANGE,
    fetchChunks = FETCH_CHUNK,
  } = options;

  if (!fromBlock) {
    return contract.queryFilter(membersFilter);
  }

  if (!contract.signer.provider) {
    throw Error("No provider found on the contract's signer.");
  }

  const toBlock = await contract.signer.provider.getBlockNumber();

  if (toBlock - fromBlock < fetchRange) {
    return contract.queryFilter(membersFilter);
  }

  const events: ethers.Event[][] = [];
  const chunks = splitToChunks(fromBlock, toBlock, fetchRange);

  for (const portion of takeN<[number, number]>(chunks, fetchChunks)) {
    const promises = portion.map(([left, right]) =>
      ignoreErrors(contract.queryFilter(membersFilter, left, right), [])
    );
    const fetchedEvents = await Promise.all(promises);
    events.push(fetchedEvents.flatMap((v) => v));
  }

  return events.flatMap((v) => v);
}

function splitToChunks(
  from: number,
  to: number,
  step: number
): Array<[number, number]> {
  const chunks = [];

  let left = from;
  while (left < to) {
    const right = left + step < to ? left + step : to;

    chunks.push([left, right] as [number, number]);

    left = right;
  }

  return chunks;
}

function* takeN<T>(array: T[], size: number): Iterable<T[]> {
  let start = 0;
  let skip = size;

  while (skip < array.length) {
    const portion = array.slice(start, skip);

    yield portion;

    start = skip;
    skip += size;
  }
}

function ignoreErrors<T>(promise: Promise<T>, defaultValue: T): Promise<T> {
  return promise.catch((err) => {
    console.error(`Ignoring an error during query: ${err?.message}`);
    return defaultValue;
  });
}
