import { getArg } from "../utils/cmd";
import { Factory } from "../wrappers/factory";
import { Market } from "../wrappers/market";

(async () => {
    const factory = await Factory.Create();

    const market = await Market.Create(factory, getArg("marketId"));

    console.log(`market id: ${market.market_id}`);
    console.log(`collateral token config:`);
    console.log(market.collateral_token);
    const balance = await market.queryCollateralBalance();
    console.log(`\nWallet: ${market.wallet.address}`);
    console.log(`Balance: ${balance}\n`);
})();