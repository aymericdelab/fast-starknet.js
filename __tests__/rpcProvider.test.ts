import { isBN } from 'bn.js';

import { Account, Contract, RpcProvider } from '../src';
import { toBN } from '../src/utils/number';
import { compiledErc20, describeIfRpc, getTestAccount, getTestProvider } from './fixtures';

describeIfRpc('RPCProvider', () => {
  let provider: RpcProvider;

  beforeAll(async () => {
    provider = getTestProvider() as RpcProvider;
  });

  describe('RPC methods', () => {
    test('getChainId', async () => {
      const chainId = await provider.getChainId();
      expect(chainId).toBe('0x534e5f474f45524c49');
    });
  });

  describe('Account', () => {
    let account: Account;
    let erc20Address: string;
    let erc20: Contract;

    beforeAll(async () => {
      account = getTestAccount(provider);
      expect(account).toBeInstanceOf(Account);

      const erc20Response = await provider.deployContract({
        contract: compiledErc20,
      });

      erc20Address = erc20Response.contract_address;
      erc20 = new Contract(compiledErc20.abi, erc20Address, provider);

      await provider.waitForTransaction(erc20Response.transaction_hash);
      erc20 = new Contract(compiledErc20.abi, erc20Address, provider);

      const mintResponse = await account.execute({
        contractAddress: erc20Address,
        entrypoint: 'mint',
        calldata: [account.address, '1000'],
      });

      await provider.waitForTransaction(mintResponse.transaction_hash);
    });

    test('estimate fee', async () => {
      const { overall_fee, gas_consumed, gas_price } = await account.estimateFee({
        contractAddress: erc20Address,
        entrypoint: 'transfer',
        calldata: [erc20.address, '10'],
      });

      expect(isBN(overall_fee)).toBe(true);
      expect(isBN(gas_consumed)).toBe(true);
      expect(isBN(gas_price)).toBe(true);
    });

    test('execute by wallet owner', async () => {
      const { res: before } = await erc20.balance_of(account.address);

      const { transaction_hash } = await account.execute({
        contractAddress: erc20Address,
        entrypoint: 'transfer',
        calldata: [erc20.address, '10'],
      });

      await account.waitForTransaction(transaction_hash);

      const { res: after } = await erc20.balance_of(account.address);

      expect(toBN(before).sub(toBN(after)).toString(10)).toBe('10');
    });
  });
});