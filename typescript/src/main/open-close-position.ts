import { getNetworkConfig } from "../config";
import { Factory } from "../wrappers/factory";
import { Market } from "../wrappers/market";

(async () => {
    const factory = await Factory.Create();

    const market = await Market.Create(factory, getNetworkConfig().market_id);

    const collateralBalance = await market.queryCollateralBalance();
    console.log(`collateral balance before opening: ${collateralBalance}`);

    // deposit 10% of collateral balance or 10 collateral, whichever is smaller
    const collateralDeposit = Math.min(Number(collateralBalance) * 0.1, 10);

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
})();