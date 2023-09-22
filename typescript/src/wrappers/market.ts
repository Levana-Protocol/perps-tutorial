import { ExecuteInstruction, ExecuteResult } from "@cosmjs/cosmwasm-stargate";
import { Factory } from "./factory";
import { Wallet } from "../utils/wallet";
import { Pyth} from "./pyth";
import { Collateral, Config, CrankWorkInfo, DirectionToBase, ExecuteMsg, LeverageToBase, LpInfoResp, MaxGainsInQuote, OraclePriceResp, PricePoint, SlippageAssert, SpotPriceConfig, StatusResp } from "./contract_types";

export class Market {
    public static async Create(factory: Factory, market_id: string):Promise<Market> {
        const info = await factory.queryMarketInfo(market_id);
        const status:StatusResp = await factory.wallet.queryContract(info.market_addr, {status:{}});
        const collateral_addr = status.collateral["cw20"].addr;

        if(!collateral_addr || collateral_addr === "") {
            throw new Error("only cw20 collateral markets are supported for now");
        }

        const pythInfo = Pyth.extractSpotPriceConfig(status.config.spot_price);

        const pyth = pythInfo ? await Pyth.Create(market_id, pythInfo.config, pythInfo.priceFeedIds, factory.wallet) : undefined;

        if(pyth) {
            console.log("this is a pyth-enabled market, executions will include pyth price updates");
        } else {
            console.log("this is not a pyth-enabled market, executions will not include pyth price updates");
        }

        return new Market(
            factory.wallet,
            factory, 
            market_id, 
            info.market_addr,
            status.config,
            pyth,
            collateral_addr,
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
        // convert to micro-currency. 
        // the 6 decimal places is hardcoded but can be derived from status.collateral.cw20 too
        const collateral = Math.round((Number(amount) * 1000000)).toString();

        return this.execInstruction({
            contractAddress: this.collateral_addr,
            msg: { send: { 
                contract: this.addr, 
                amount: collateral.toString(), 
                // need to encode msg as base64 encoded JSON string
                // since it's a cw20 payload
                msg: Buffer.from(JSON.stringify(msg)).toString("base64")
            }},
        });
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

    public async queryCollateralBalance():Promise<Collateral> {
        const resp = await this.wallet.queryContract<{balance: string}>(this.collateral_addr, {
            balance: { address: this.wallet.address }
        });

        // convert from micro-currency. 
        // the 6 decimal places is hardcoded but can be derived from status.collateral.cw20 too
        return (Number(resp.balance) / 1000000).toString();
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
        public readonly collateral_addr: string,
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