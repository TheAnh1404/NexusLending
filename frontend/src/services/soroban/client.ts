import { rpc } from '@stellar/stellar-sdk';
import { RPC_URL } from './config';

export const sorobanRpc = new rpc.Server(RPC_URL);
