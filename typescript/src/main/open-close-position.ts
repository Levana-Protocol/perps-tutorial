import { getArg } from "../utils/cmd";
import { Factory } from "../wrappers/factory";
import { Market } from "../wrappers/market";

(async () => {
    const factory = await Factory.Create();

    const market = await Market.Create(factory, getArg("marketId"));

    const collateralBalance = await market.queryCollateralBalance();
    console.log(`collateral balance before opening: ${collateralBalance}`);

    // deposit 10% of collateral balance or 20 collateral, whichever is smaller
    // note - this may need to be adjusted so that the minimum is above
    // the market minimum, which is in terms of 5 USD
    const collateralDeposit = Math.min(Number(collateralBalance) * 0.1, 20);

    const liquidityDeposit = collateralDeposit * 2;  

    console.log(`depositing ${liquidityDeposit} liquidity`);
    const {res: depositLiquidityRes} = await market.execDepositLiquidity(liquidityDeposit.toString());

    console.log(`depositing ${collateralDeposit} collateral`);
    const {positionId, res: openRes} = await market.execOpenPosition({
        collateral: collateralDeposit.toString(),
        direction: "long",
        leverage: "1.5",
        max_gains: "1",
    });

    console.log(`opened position id: ${positionId}, tx hash: ${openRes.transactionHash}`);
    console.log(`collateral balance after opening: ${await market.queryCollateralBalance()}`);

    const closeRes = await market.execClosePosition({
        id: positionId,
    });

    console.log(`close tx hash: ${closeRes.transactionHash}`);

    console.log(`collateral balance after closing: ${await market.queryCollateralBalance()}`);

    const lpInfo = await market.queryLpInfo();

    if(lpInfo.liquidity_cooldown) {
        console.log(`not withdrawing liquidity due to cooldown`);
    } else {
        console.log(`withdrawing liquidity`);
        const {res: withdrawLiquidityRes} = await market.execWithdrawLiquidity();
        
        console.log(`collateral balance after withdrawing lp: ${await market.queryCollateralBalance()}`);
    }
})();