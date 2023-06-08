import { ExecuteInstruction, ExecuteResult } from "@cosmjs/cosmwasm-stargate";
import { Factory } from "./factory";
import { Wallet } from "../utils/wallet";
import { Pyth } from "./pyth";

export class Market {
    public static async Create(factory: Factory, market_id: string):Promise<Market> {
        const info = await factory.queryMarketInfo(market_id);
        const status = await factory.wallet.queryContract(info.market_addr, {status:{}});
        const collateral_addr = status.collateral.cw20.addr;

        if(!collateral_addr || collateral_addr === "") {
            throw new Error("only cw20 collateral markets are supported for now");
        }

        // we're assuming that price_admin is *always* pyth here
        // this is a safe assumption for now, but may change in the future
        const pyth = await Pyth.Create(info.price_admin, market_id, factory.wallet);

        return new Market(
            factory.wallet,
            factory, 
            market_id, 
            info.market_addr,
            pyth,
            collateral_addr,
            info.position_token,
            info.liquidity_token_lp,
            info.liquidity_token_xlp,
            info.price_admin
        );
    }

    public async queryCollateralBalance():Promise<string> {
        const resp = await this.wallet.queryContract<{balance: string}>(this.collateral_addr, {
            balance: { address: this.wallet.address }
        });

        // convert from micro-currency. 
        // the 6 decimal places is hardcoded but can be derived from status.collateral.cw20 too
        return (Number(resp.balance) / 1000000).toString();
    }

    // opens a position and returns the id
    public async execOpenPosition(props:OpenPositionProps):Promise<{positionId: string, res: ExecuteResult}> {
        const {collateral: collateralString, ignore_price_update, ...rest} = props;

        // convert to micro-currency. 
        // the 6 decimal places is hardcoded but can be derived from status.collateral.cw20 too
        const collateral = Math.round((Number(collateralString) * 1000000)).toString();
       
        const instructions:ExecuteInstruction[] = [];

        if(!ignore_price_update) {
            // update the pyth prices, as part of this single transaction
            const pythInstructions = await this.pyth.getPriceUpdateInstructions();
            instructions.push(...pythInstructions);
        }

        instructions.push({
            contractAddress: this.collateral_addr,
            msg: { send: { 
                contract: this.addr, 
                amount: collateral.toString(), 
                // need to encode msg as base64 encoded JSON string
                // since it's a cw20 payload
                msg: Buffer.from(JSON.stringify({open_position: rest})).toString("base64")
            }},
        });

        const res = await this.wallet.execContracts(instructions);

        const positionId = res.events.find(e => e.type === "wasm-position-open")?.attributes.find(a => a.key === "pos-id")?.value;

        if(!positionId || positionId == "") {
            throw new Error("no position id found");
        }

        return {
            positionId,
            res
        };
    }

    // closes a position
    public async execClosePosition(props:ClosePositionProps):Promise<ExecuteResult> {
        const res = await this.wallet.execContract(
            this.addr,
            {close_position: props},
        );

        return res;
    }

    private constructor(
        public readonly wallet: Wallet,
        public readonly factory: Factory, 
        public readonly market_id: string,
        public readonly addr: string,
        public readonly pyth: Pyth,
        public readonly collateral_addr: string,
        public readonly position_token_addr: string,
        public readonly liquidity_token_lp_addr: string,
        public readonly liquidity_token_xlp_addr: string,
        public readonly price_admin_addr: string,
        ) { }
}

export interface ClosePositionProps {
    id: string,
    slippage_assert?: SlippageAssert | null;
}
export interface OpenPositionProps {
    ignore_price_update?: boolean,
    collateral: string,
    direction: DirectionToBase;
    leverage: RawLeverage;
    max_gains: MaxGainsInQuote;
    slippage_assert?: SlippageAssert | null;
}

/**
 * Direction in terms of base
 */
export type DirectionToBase = "long" | "short";

/**
 * The user-specified leverage for a position as a raw directionless value
 */
export type RawLeverage = string;

/**
 * The maximum gains in quote asset percentage that a position can realize before being liquidated
 */
export type MaxGainsInQuote = string;

export interface SlippageAssert {
    /**
     * Expected price from the sender.
     */
    price: string;
    /**
     * Max ratio tolerance of actual trade price differing in an unfavorable direction from expected price. Tolerance of 0.01 means max 1% difference.
     */
    tolerance: string;
  }
  