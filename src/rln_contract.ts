import { ethers } from "ethers";

import { RLN_ABI } from "./constants.js";
import { MembershipKey, RLNInstance } from "./rln.js";

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
    const registeredMemberEvents = await this.contract.queryFilter(
      this.membersFilter,
      fromBlock
    );

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

  public async registerWithSignature(
    rlnInstance: RLNInstance,
    signature: string
  ): Promise<ethers.Event | undefined> {
    const membershipKey = await rlnInstance.generateSeededMembershipKey(
      signature
    );

    return this.registerWithKey(membershipKey);
  }

  public async registerWithKey(
    membershipKey: MembershipKey
  ): Promise<ethers.Event | undefined> {
    const depositValue = await this.contract.MEMBERSHIP_DEPOSIT();

    const txRegisterResponse: ethers.ContractTransaction =
      await this.contract.register(membershipKey.IDCommitmentBigInt, {
        value: depositValue,
      });
    const txRegisterReceipt = await txRegisterResponse.wait();

    return txRegisterReceipt?.events?.[0];
  }
}
