import { getNetworkConfig } from "../config";
import { Wallet } from "../utils/wallet";

export class Factory {
    public static async Create(wallet?: Wallet):Promise<Factory> {
        if(!wallet) {
            wallet = await Wallet.Create();
        }

        return new Factory(getNetworkConfig().factory, wallet);
    }

    public async queryMarketInfo(market_id: string):Promise<MarketInfo> {
        console.log("querying market info for", market_id, "on factory", this.addr);
        return await this.wallet.client.queryContractSmart(this.addr, {market_info:{market_id:market_id}});
    }

    private constructor(public readonly addr: string, public readonly wallet: Wallet) {
    }
}

export interface MarketInfo {
    market_addr: string,
    position_token: string,
    liquidity_token_lp: string,
    liquidity_token_xlp: string,
    price_admin: string,
}