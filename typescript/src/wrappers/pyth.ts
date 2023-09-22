import { Coin } from "@cosmjs/proto-signing";
import { PYTH_ENDPOINT_EDGE, PYTH_ENDPOINT_STABLE } from "../config";
import { Wallet } from "../utils/wallet";
import { ExecuteInstruction } from "@cosmjs/cosmwasm-stargate";
import axios from "axios";
import { Identifier, PythConfig, SpotPriceConfig, SpotPriceFeed } from "./contract_types";
import { PriceFeed } from "@pythnetwork/price-service-sdk"

export class Pyth {
    public static extractSpotPriceConfig(spot_price_config: SpotPriceConfig):{config: PythConfig, priceFeedIds: Identifier[]} | undefined {
        if(!spot_price_config["oracle"] || !spot_price_config["oracle"].pyth) {
          return undefined;
        } else {
          const oracleConfig = spot_price_config["oracle"]

          let idSet = new Set<string>();

          oracleConfig.feeds.concat(oracleConfig.feeds_usd).forEach(feed => {
              if(feed.data["pyth"]) {
                  idSet.add(feed.data["pyth"].id);
              }
          })

          const uniqueIds = [...idSet];
          if(uniqueIds.length === 0) {
            return undefined;
          } else {
            return {
              config: oracleConfig["pyth"],
              priceFeedIds: uniqueIds
            }
          }
        }
    }

    public static async Create(market_id: string, pythConfig: PythConfig, priceFeedIds: Identifier[], wallet?: Wallet):Promise<Pyth> {
        if(!wallet) {
            wallet = await Wallet.Create();
        }

        return new Pyth(market_id, wallet, pythConfig, priceFeedIds);
    }

    public endpoint():string {
        switch(this.config.network) {
            case "edge": return PYTH_ENDPOINT_EDGE
            case "stable": return PYTH_ENDPOINT_STABLE
        }
    }


    public async getPythOracleUpdateInstruction():Promise<ExecuteInstruction> {
        const proof = await this.fetchWormholeProof();

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

    public async fetchWormholeProof():Promise<string> {

        // construct the url to query for wormhole proofs
        const url = new URL(`${this.endpoint()}/api/latest_vaas`);
        this.priceFeedIds.forEach(id => {
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

    public async fetchLivePrices():Promise<Record<Identifier, number>> {

        // construct the url to query for prices 
        const url = new URL(`${this.endpoint()}/api/latest_price_feeds`)
        this.priceFeedIds.forEach(id => {
            url.searchParams.append("ids[]", id)
        });

        // fetch it
        const res = await axios(url.toString(), {
            method: "GET",
            headers: {
                "Content-Type": "application/json",
            }
        });

        if(!Array.isArray(res.data) || !res.data.length) {
            throw new Error("failed to get pyth prices");
        }

        const priceFeedList: PriceFeed[] = res.data.map(PriceFeed.fromJson)

        return this.priceFeedIds.reduce((priceFeeds, id) => {
            const feed = priceFeedList.find((feed) => feed.id === id)
            if (!feed) {
                throw new Error(`no price feed found for ${id}`)
            }

            const { price, expo } = feed.getPriceUnchecked()

            const priceNumber = Number(price) * (Math.pow(10, Number(expo)))

            priceFeeds[id] = priceNumber

            return priceFeeds
        }, {})
    }

    private constructor(
        public readonly market_id: string, 
        public readonly wallet: Wallet, 
        public readonly config: PythConfig, 
        public readonly priceFeedIds: Identifier[]
    ) {
    }
}