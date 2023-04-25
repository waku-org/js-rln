import { ethers } from "ethers";

import { RLN_ABI } from "./constants.js";
import { RLNInstance } from "./rln.js";

type Member = {
  pubkey: string;
  index: number;
};

type ContractOptions = {
  address: string;
  provider: ethers.Signer | ethers.providers.Provider;
};

export class RLNContract {
  private _contract: ethers.Contract;
  private membersFilter: ethers.EventFilter;

  private _members: Member[] = [];

  public static async init(
    rlnInstance: RLNInstance,
    options: ContractOptions
  ): Promise<RLNContract> {
    const rlnContract = new RLNContract(options);

    await rlnContract.fetchMembers(rlnInstance);
    rlnContract.subscribeToMembers(rlnInstance);

    return rlnContract;
  }

  constructor({ address, provider }: ContractOptions) {
    this._contract = new ethers.Contract(address, RLN_ABI, provider);
    this.membersFilter = this.contract.filters.MemberRegistered();
  }

  public get contract(): ethers.Contract {
    return this._contract;
  }

  public get members(): Member[] {
    return this._members;
  }

  public async fetchMembers(
    rlnInstance: RLNInstance,
    fromBlock?: number
  ): Promise<void> {
    const registeredMemberEvents = await queryFilter(this.contract, {
      fromBlock,
      membersFilter: this.membersFilter,
    });

    for (const event of registeredMemberEvents) {
      this.addMemberFromEvent(rlnInstance, event);
    }
  }

  public subscribeToMembers(rlnInstance: RLNInstance): void {
    this.contract.on(this.membersFilter, (_pubkey, _index, event) =>
      this.addMemberFromEvent(rlnInstance, event)
    );
  }

  private addMemberFromEvent(
    rlnInstance: RLNInstance,
    event: ethers.Event
  ): void {
    if (!event.args) {
      return;
    }

    const pubkey: string = event.args.pubkey;
    const index: number = event.args.index;

    this.members.push({ index, pubkey });

    const idCommitment = ethers.utils.zeroPad(
      ethers.utils.arrayify(pubkey),
      32
    );
    rlnInstance.insertMember(idCommitment);
  }

  public async registerMember(
    rlnInstance: RLNInstance,
    signature: string
  ): Promise<ethers.Event | undefined> {
    const membershipKey = await rlnInstance.generateSeededMembershipKey(
      signature
    );
    const depositValue = await this.contract.MEMBERSHIP_DEPOSIT();

    const txRegisterResponse: ethers.ContractTransaction =
      await this.contract.register(membershipKey.IDCommitmentBigInt, {
        value: depositValue,
      });
    const txRegisterReceipt = await txRegisterResponse.wait();

    return txRegisterReceipt?.events?.[0];
  }
}

type CustomQueryOptions = {
  fromBlock?: number;
  membersFilter: ethers.EventFilter;
};

const STEP = 3000; // this value should be tested on other networks
async function queryFilter(
  contract: ethers.Contract,
  options: CustomQueryOptions
): Promise<ethers.Event[]> {
  const { fromBlock, membersFilter } = options;

  if (!fromBlock) {
    return contract.queryFilter(membersFilter);
  }

  if (!contract.signer.provider) {
    throw Error("No provider found on the contract's signer.");
  }

  const toBlock = await contract.signer.provider.getBlockNumber();

  if (toBlock - fromBlock < STEP) {
    return contract.queryFilter(membersFilter);
  }

  const events = await Promise.all(
    splitToChunks(fromBlock, toBlock, STEP).map(([left, right]) =>
      contract.queryFilter(membersFilter, left, right).catch((e) => {
        if (e?.data?.request?.method === "eth_getLogs") {
          return [];
        }
        throw e;
      })
    )
  );

  return events.flatMap((event) => event);
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
