import { Coin } from "@cosmjs/proto-signing";
import { PYTH_ENDPOINT } from "../config";
import { Wallet } from "../utils/wallet";
import { ExecuteInstruction } from "@cosmjs/cosmwasm-stargate";
import axios from "axios";
import { PythConfig, SpotPriceConfig, SpotPriceFeed } from "./contract_types";

export class Pyth {
    public static async Create(market_id: string, spot_price_config: SpotPriceConfig, wallet?: Wallet):Promise<Pyth> {
        if(!wallet) {
            wallet = await Wallet.Create();
        }

        if(!spot_price_config["oracle"].pyth) {
            throw new Error("pyth config is required");
        }

        const oracleConfig = spot_price_config["oracle"]

        return new Pyth(market_id, wallet, oracleConfig.pyth, oracleConfig.feeds, oracleConfig.feeds_usd);
    }


    public async getPythOracleUpdateInstruction():Promise<ExecuteInstruction> {
        const proof = await this.getWormholeProof();

        // pyth's new hermes endpoint returns only one string containing all the proofs
        // but the contracts accept a 1-element vec of "vaas" for backwards-compatibility
        const vaas = [proof]

        // the fee shouldn't change, but we should query each time anyway just in case
        const coin = await this.wallet.queryContract<Coin>(this.config.contract_address, {get_update_fee: {vaas}});

        return {
            contractAddress: this.config.contract_address,
            msg: {
                update_price_feeds: {
                    data: vaas 
                }
            },
            funds: [coin]
        }
    }

    public async getWormholeProof():Promise<string> {
        let idSet = new Set<string>();

        this.feeds.concat(this.feeds_usd).forEach(feed => {
            if(feed.data["pyth"]) {
                idSet.add(feed.data["pyth"].id);
            }
        })

        const ids = [...idSet];

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
        public readonly wallet: Wallet, 
        public readonly config: PythConfig, 
        public readonly feeds: SpotPriceFeed[],
        public readonly feeds_usd: SpotPriceFeed[]
    ) {
    }
}