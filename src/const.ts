export const RLN_ABI = [
  "function MEMBERSHIP_DEPOSIT() public view returns(uint256)",
  "function register(uint256 pubkey) external payable",
  "function withdraw(uint256 secret, uint256 _pubkeyIndex, address payable receiver) external",
  "event MemberRegistered(uint256 pubkey, uint256 index)",
  "event MemberWithdrawn(uint256 pubkey, uint256 index)",
];

export const DEV_CONTRACT = {
  chainId: 5,
  startBlock: 7109391,
  address: "0x4252105670fe33d2947e8ead304969849e64f2a6",
  abi: RLN_ABI,
};

export const DEFAULT_SIGNATURE_MESSAGE =
  "The signature of this message will be used to generate your RLN credentials. Anyone accessing it may send messages on your behalf, please only share with the RLN dApp";
