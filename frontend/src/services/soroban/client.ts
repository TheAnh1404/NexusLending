import { Horizon, rpc } from '@stellar/stellar-sdk';
import { HORIZON_URL, RPC_URL } from './config';

export const sorobanRpc = new rpc.Server(RPC_URL);
export const horizonServer = new Horizon.Server(HORIZON_URL);
