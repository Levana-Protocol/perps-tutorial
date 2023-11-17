import { ExecuteInstruction, ExecuteResult } from "@cosmjs/cosmwasm-stargate";
import { Factory } from "./factory";
import { Wallet } from "../utils/wallet";
import { Pyth} from "./pyth";
import { Collateral, Config, CrankWorkInfo, DirectionToBase, ExecuteMsg, LeverageToBase, LpInfoResp, MaxGainsInQuote, OraclePriceResp, PricePoint, SlippageAssert, SpotPriceConfig, StatusResp, Token } from "./contract_types";

export class Market {
    public static async Create(factory: Factory, market_id: string):Promise<Market> {
        const info = await factory.queryMarketInfo(market_id);
        const status:StatusResp = await factory.wallet.queryContract(info.market_addr, {status:{}});

        const pythInfo = Pyth.extractSpotPriceConfig(status.config.spot_price);

        // pyth is optional, will only be included if the market uses it
        const pyth = pythInfo ? await Pyth.Create(market_id, pythInfo.config, pythInfo.priceFeedIds, factory.wallet) : undefined;

        return new Market(
            factory.wallet,
            factory, 
            market_id, 
            info.market_addr,
            status.config,
            pyth,
            status.collateral,
            info.position_token,
            info.liquidity_token_lp,
            info.liquidity_token_xlp,
        );
    }

    // called for any executions, mixes in the pyth price update if needed
    async execInstruction(instruction: ExecuteInstruction):Promise<ExecuteResult> {
        const instructions:ExecuteInstruction[] = [];
        
        if(this.pyth) {
            console.log(`pyth update needed for ${this.market_id} market`);
            instructions.push(await this.pyth.getPythOracleUpdateInstruction());
        } else {
            console.log(`no pyth updated needed for ${this.market_id} market`);
        }

        instructions.push(instruction);

        return await this.wallet.execContracts(instructions);
    }

    // called for any execution to the market contract, mixes in the pyth price update if needed
    async execMessage(msg: ExecuteMsg):Promise<ExecuteResult> {
        return this.execInstruction({
            contractAddress: this.addr,
            msg
        });
    }

    // called for any execution to the market contract by way of cw20 (i.e. deposits), mixes in the pyth price update if needed
    async execCollateralMessage(amount: Collateral, msg: ExecuteMsg):Promise<ExecuteResult> {
        if("cw20" in this.collateral_token) {
            // convert the amount to micro-units, based on the decimal places of the cw20 token
            const exp = (10 ** this.collateral_token.cw20.decimal_places);
            const collateral = Math.round(Number(amount) * exp).toString();
            return this.execInstruction({
                contractAddress: this.collateral_token.cw20.addr,
                msg: { send: { 
                    contract: this.addr, 
                    amount: collateral.toString(), 
                    // need to encode msg as base64 encoded JSON string
                    // since it's a cw20 payload
                    msg: Buffer.from(JSON.stringify(msg)).toString("base64")
                }},
            });
        } else if("native" in this.collateral_token) {
            // convert the amount to micro-units, based on the decimal places of the native token
            const exp = (10 ** this.collateral_token.native.decimal_places);
            const denom = this.collateral_token.native.denom;
            const collateral = Math.round(Number(amount) * exp).toString();

            return this.execInstruction({
                contractAddress: this.addr,
                msg,
                funds: [{ denom, amount: collateral }]
            });
        } else {
            throw new Error("unknown collateral type");
        }
    }

    public async queryLpInfo():Promise<LpInfoResp> {
        return this.wallet.queryContract(this.addr, {
            lp_info: { liquidity_provider: this.wallet.address}
        });
    }

    // opens a position and returns the id
    public async execOpenPosition(props:OpenPositionProps):Promise<{positionId: string, res: ExecuteResult}> {
        const {collateral, ...rest} = props;
       
        const res = await this.execCollateralMessage(collateral, {
            open_position: rest
        });

        const positionId = res.events.find(e => e.type === "wasm-position-open")?.attributes.find(a => a.key === "pos-id")?.value;

        if(!positionId || positionId === "") {
            throw new Error("no position id found");
        }

        return {
            positionId,
            res
        };
    }

    // closes a position
    public async execClosePosition(props:ClosePositionProps):Promise<ExecuteResult> {
        return this.execMessage(
            {close_position: props},
        );
    }

    // cranks 
    public async execCrank():Promise<ExecuteResult> {
        return this.execMessage(
            {crank: {}},
        );
    }

    // deposit liquidity
    public async execDepositLiquidity(collateral: string):Promise<{res: ExecuteResult}> {
        const res = await this.execCollateralMessage(collateral, {deposit_liquidity: {}});

        return {
            res
        };
    }

    // deposit liquidity
    public async execWithdrawLiquidity():Promise<{res: ExecuteResult}> {
        const res = await this.execMessage({
            withdraw_liquidity: {}, 
        });

        return {
            res
        };
    }

    // Queries
    public async queryStatus():Promise<StatusResp> {
        return this.wallet.queryContract<StatusResp>(this.addr, {status:{}});
    }

    public async queryCollateralBalance(queryAddress?: string):Promise<Collateral> {
        const address = queryAddress || this.wallet.address;
        if("cw20" in this.collateral_token) {
            const resp = await this.wallet.queryContract<{balance: string}>(this.collateral_token.cw20.addr, {
                balance: { address }
            });
            // convert from micro-currency based on the number of decimal places in cw20 contract
            const exp = (10 ** this.collateral_token.cw20.decimal_places);
            return (Number(resp.balance) / exp).toString();
        } else if("native" in this.collateral_token) {
            const denom = this.collateral_token.native.denom;
            const balanceInfo = await this.wallet.client.getBalance(address, denom);
            // convert from micro-currency based on the number of decimal places in the native denom 
            const exp = (10 ** this.collateral_token.native.decimal_places);
            return (Number(balanceInfo.amount) / exp).toString();
        } else {
            throw new Error("unknown collateral type");
        }
    }

    public async querySpotPrice():Promise<PricePoint> {
        return this.wallet.queryContract(this.addr, {
            spot_price: { timestamp: null }
        });
    }

    public async queryOraclePrice():Promise<OraclePriceResp> {
        return this.wallet.queryContract(this.addr, {
            oracle_price: { }
        });
    }

    private constructor(
        public readonly wallet: Wallet,
        public readonly factory: Factory, 
        public readonly market_id: string,
        public readonly addr: string,
        public readonly config: Config,
        public readonly pyth: Pyth | undefined,
        public readonly collateral_token: Token,
        public readonly position_token_addr: string,
        public readonly liquidity_token_lp_addr: string,
        public readonly liquidity_token_xlp_addr: string,
        ) { }
}

export interface ClosePositionProps {
    id: string,
    slippage_assert?: SlippageAssert | null;
}
export interface OpenPositionProps {
    collateral: string,
    direction: DirectionToBase;
    leverage: LeverageToBase;
    max_gains: MaxGainsInQuote;
    slippage_assert?: SlippageAssert | null;
}