export const RLN_ABI = [
  "function register(uint256[] calldata commitments) external payable",
  "event MemberRegistered(uint256 idCommitment, uint256 idCommitmentIndex)",
];

export const SEPOLIA_CONTRACT = {
  chainId: 11155111,
  startBlock: 4230713,
  address: "0xF1935b338321013f11068abCafC548A7B0db732C",
  abi: RLN_ABI,
};
