import { getArg } from "../utils/cmd";
import { Factory } from "../wrappers/factory";
import { Market } from "../wrappers/market";

(async () => {
    const factory = await Factory.Create();

    const market = await Market.Create(factory, getArg("marketId"));

    console.log(market.market_id, market.addr);

    while(true) {
        const status = await market.queryStatus();
        if(status.next_crank) {
            console.log("crank required");
            console.log(status.next_crank);
            await market.execCrank();
        } else {
            break;
        }
    }

    console.log("no more crank work!");

    const price = await market.querySpotPrice();

    console.log(price)
})();