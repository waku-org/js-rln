export const RLN_ABI = [
  "function MEMBERSHIP_DEPOSIT() public view returns(uint256)",
  "function register(uint256 pubkey) external payable",
  "function withdraw(uint256 secret, uint256 _pubkeyIndex, address payable receiver) external",
  "event MemberRegistered(uint256 pubkey, uint256 index)",
  "event MemberWithdrawn(uint256 pubkey, uint256 index)",
];

export const SEPOLIA_CONTRACT = {
  chainId: 11155111,
  startBlock: 3193048,
  address: "0x9C09146844C1326c2dBC41c451766C7138F88155",
  abi: RLN_ABI,
};
