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

        // get the pyth bridge configuration, this is a once off per-market
        const config = await wallet.queryContract<PythBridgeConfig>(bridge_addr, {config: {}});

        return new Pyth(market_id, bridge_addr, config.pyth, config.feeds, wallet, config.feeds_usd || undefined);
    }

    public async getPriceUpdateInstructions():Promise<ExecuteInstruction[]> {
        // first update the pyth oracle itself
        const oracleInstruction = await this.getOracleUpdateInstruction();
        const bridgeInstruction = this.getBridgeUpdateInstruction();

        return [
            // first update the pyth oracle itself
            oracleInstruction,
            // then tell the bridge to update the market
            bridgeInstruction,
        ];
    }

    public async getOracleUpdateInstruction():Promise<ExecuteInstruction> {
        const proof = await this.getWormholeProof();

        // pyth's new hermes endpoint returns only one string containing all the proofs
        // but the contracts accept a 1-element vec of "vaas" for backwards-compatibility
        const vaas = [proof]

        // the fee shouldn't change, but we should query each time anyway just in case
        const coin = await this.wallet.queryContract<Coin>(this.oracle_addr, {get_update_fee: {vaas}});

        console.log(coin)

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

    public getBridgeUpdateInstruction():ExecuteInstruction {
        return {
            contractAddress: this.bridge_addr,
            msg: {
                update_price: {
                    bail_on_error: false
                }
            },
        }
    }

    public async getWormholeProof():Promise<string> {
        let ids = this.feeds.map(f => f.id);

        if(this.feeds_usd) {
            ids.push(...this.feeds_usd.map(f => f.id));
        }

        // dedupe, just in case
        ids = [...new Set(ids)];

        // construct the url to query for wormhole proofs
        let url = new URL(`${PYTH_ENDPOINT}api/latest_vaas`);
        ids.forEach((id, index) => {
            url.searchParams.append("ids[]", id)
        });

        // fetch it
        const res = await axios(url.toString(), {
            method: "GET",
            headers: {
                "Content-Type": "application/json",
            }
        });
        const resp = await res.data as string[];

        if(resp.length !== 1) {
            throw new Error("failed to get all pyth wormhole proofs");
        }

        return resp[0];
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

interface PythBridgeConfig {
    pyth: string
    feed_type: "stable" | "edge"
    feeds: PythPriceFeed[]
    feeds_usd: PythPriceFeed[] | null
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