import { Coin } from "@cosmjs/proto-signing";
import { PYTH_ENDPOINT } from "../config";
import { Wallet } from "../utils/wallet";
import { ExecuteInstruction } from "@cosmjs/cosmwasm-stargate";
import axios from "axios";

export class Pyth {
    public static async Create(bridge_addr: string, market_id: string, wallet?: Wallet):Promise<Pyth> {
        if(!wallet) {
            wallet = await Wallet.Create();
        }

        // get the oracle address from the bridge, this is a once off per-market
        const oracle_addr = await wallet.queryContract<string>(bridge_addr, {pyth_address: {}});

        // get the price feed ids from the bridge, this is a once off per-market
        const feedsResponse = await wallet.queryContract<PythMarketPriceFeeds>(bridge_addr, {market_price_feeds: {market_id}});

        return new Pyth(market_id, bridge_addr, oracle_addr, feedsResponse.feeds, wallet, feedsResponse.feeds_usd || undefined);
    }

    public async getPriceUpdateInstructions():Promise<ExecuteInstruction[]> {
        return [
            // first update the pyth oracle itself
            await this.getOracleUpdateInstruction(),
            // then tell the bridge to update the market
            await this.getBridgeUpdateInstruction()
        ];
    }

    public async getOracleUpdateInstruction():Promise<ExecuteInstruction> {
        const vaas = await this.getWormholeProofs();

        // the fee shouldn't change, but we should query each time anyway just in case
        const coin = await this.wallet.queryContract<Coin>(this.oracle_addr, {get_update_fee: {vaas}});

        return {
            contractAddress: this.oracle_addr,
            msg: {
                update_price_feeds: {
                    data: vaas
                }
            },
            funds: [coin]
        }
    }

    public async getBridgeUpdateInstruction():Promise<ExecuteInstruction> {
        return {
            contractAddress: this.bridge_addr,
            msg: {
                update_price: {
                    market_id: this.market_id,
                    bail_on_error: false
                }
            },
        }
    }

    public async getWormholeProofs():Promise<string[]> {
        let ids = this.feeds.map(f => f.id);

        if(this.feeds_usd) {
            ids.push(...this.feeds_usd.map(f => f.id));
        }

        // dedupe, just in case
        ids = [...new Set(ids)];

        // construct the url to query for wormhole proofs
        let url = `${PYTH_ENDPOINT}api/latest_vaas`;
        ids.forEach((id, index) => {
            // pyth uses this format for array params: https://github.com/axios/axios/blob/9588fcdec8aca45c3ba2f7968988a5d03f23168c/test/specs/helpers/buildURL.spec.js#L31
            const delim = index == 0 ? "?" : "&";
            url += `${delim}ids[]=${id}`;
        });

        // fetch it
        const res = await axios(url, {
            method: "GET",
            headers: {
                "Content-Type": "application/json",
            }
        });
        const vaas = await res.data as string[];

        if(vaas.length !== ids.length) {
            throw new Error("failed to get all pyth wormhole proofs");
        }

        return vaas;
    }

    private constructor(
        public readonly market_id: string, 
        public readonly bridge_addr: string, 
        public readonly oracle_addr: string, 
        public readonly feeds: PythPriceFeed[], 
        public readonly wallet: Wallet, 
        public readonly feeds_usd?: PythPriceFeed[]
    ) {
    }
}

/**
 * Price feeds for a given market
 */
interface PythMarketPriceFeeds {
    /**
     * feed of the base asset in terms of the quote asset
     */
    feeds: PythPriceFeed[];
    /**
     * feed of the collateral asset in terms of USD
     *
     * This is used by the protocol to track USD values. This field is optional, as markets with USD as the quote asset do not need to provide it.
     */
    feeds_usd?: PythPriceFeed[] | null;
}

/**
 * Price feed
 */
interface PythPriceFeed {
    /**
     * The price feed id
     */
    id: string;
    /**
     * is this price feed inverted
     */
    inverted: boolean;
  }