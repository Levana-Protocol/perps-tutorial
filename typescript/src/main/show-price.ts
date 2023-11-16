import { getArg } from "../utils/cmd";
import { Factory } from "../wrappers/factory";
import { Market } from "../wrappers/market";

(async () => {
    const factory = await Factory.Create();

    const market = await Market.Create(factory, getArg("marketId"));

    const contractPrice = await market.querySpotPrice();
    const oraclePriceInfo = await market.queryOraclePrice();

    let livePythPrices = {}
    const liveSpotPrice = await (async () => {
        if("manual" in market.config.spot_price) {
            // for manual markets, live spot price is identical to contract price
            return Number(contractPrice.price_base)
        } else if("oracle" in market.config.spot_price) {
            let pythPrices = market.pyth ? await market.pyth.fetchLivePrices() : {};
            // assigning this just so it appears nicely in the console log below
            livePythPrices = pythPrices

            let priceAcc: number | undefined

            for (const feed of market.config.spot_price.oracle.feeds) {
              let price = (() => {
                if ("sei" in feed.data) {
                  return Number(oraclePriceInfo.sei[feed.data.sei.denom])
                } else if ("stride" in feed.data) {
                  throw new Error("TODO - handle stride redemption value")
                } else if ("pyth" in feed.data) {
                  return pythPrices[feed.data.pyth.id] 
                } else {
                  // unreachable
                  throw new Error("Unknown price feed type")
                }
              })()
          
              if (feed.inverted) {
                price = 1 / price
              }
          
              priceAcc = priceAcc === undefined ? price : priceAcc * price
            }
          
            if (priceAcc === undefined) {
              throw new Error("No price found!")
            }
          
            return priceAcc
        } else {
            console.error(market.config.spot_price);
            throw new Error("unsupported spot price config");
        }
    })();

    console.log(`pyth contract price info: ${JSON.stringify(oraclePriceInfo.pyth, null, 2)}`);
    console.log(`live pyth price info: ${JSON.stringify(livePythPrices, null, 2)}`);
    console.log(`sei native oracle price info: ${JSON.stringify(oraclePriceInfo.sei, null, 2)}`);
    console.log(`stride contract price info: ${JSON.stringify(oraclePriceInfo.stride, null, 2)}`);
    console.log(`contract spot price info: ${JSON.stringify(contractPrice, null, 2)}`);
    console.log(`---------`);
    console.log(`\n${market.market_id} live potential spot price: ${liveSpotPrice}`);
    console.log(`${market.market_id} contract spot price: ${contractPrice.price_base}`);
    console.log(`diff of live vs contract is ${liveSpotPrice - Number(contractPrice.price_base)}\n`);
})();