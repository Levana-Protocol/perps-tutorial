import { getNetworkConfig } from "../config";
import { Wallet } from "../utils/wallet";

export class Factory {
    public static async Create(wallet?: Wallet):Promise<Factory> {
        return new Factory(getNetworkConfig().factory, wallet || await Wallet.Create());
    }

    public async queryMarketInfo(market_id: string):Promise<MarketInfo> {
        return await this.wallet.client.queryContractSmart(this.addr, {market_info:{market_id:market_id}});
    }

    public async allMarketIds():Promise<string[]> {
        const resp = await this.wallet.client.queryContractSmart(this.addr, {markets:{}});
        return resp.markets
    }

    private constructor(public readonly addr: string, public readonly wallet: Wallet) {
    }
}

export interface MarketInfo {
    market_addr: string,
    position_token: string,
    liquidity_token_lp: string,
    liquidity_token_xlp: string,
}