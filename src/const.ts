export const RLN_ABI = [
  "function MEMBERSHIP_DEPOSIT() public view returns(uint256)",
  "function register(uint256 pubkey) external payable",
  "function withdraw(uint256 secret, uint256 _pubkeyIndex, address payable receiver) external",
  "event MemberRegistered(uint256 pubkey, uint256 index)",
  "event MemberWithdrawn(uint256 pubkey, uint256 index)",
];

export const GOERLI_CONTRACT = {
  chainId: 5,
  startBlock: 7109391,
  address: "0x4252105670fe33d2947e8ead304969849e64f2a6",
  abi: RLN_ABI,
};
