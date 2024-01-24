import { ethers } from "ethers";

export const extractMetaMaskAccount =
  async (): Promise<ethers.providers.Web3Provider> => {
    const ethereum = (window as any).ethereum;

    if (!ethereum) {
      throw Error(
        "Missing or invalid Ethereum provider. Please install a Web3 wallet such as MetaMask."
      );
    }

    await ethereum.request({ method: "eth_requestAccounts" });
    return new ethers.providers.Web3Provider(ethereum, "any");
  };
