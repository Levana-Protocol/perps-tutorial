import { getArg } from "../utils/cmd";
import { Factory } from "../wrappers/factory";
import { Market } from "../wrappers/market";

(async () => {
    const factory = await Factory.Create();
    const marketIds = await factory.allMarketIds();

    const markets = await Promise.all(marketIds.map(marketId => Market.Create(factory, marketId)));

    const oraclePrices = await Promise.all(markets.map(market => market.queryOraclePrice().then(price => ({ id: market.market_id, price }))));

    const usdPrices = oraclePrices.reduce((acc, { id, price }) => {
        acc[id] = Number(price.composed_price.price_usd)
        return acc
    }, {} as Record<string, number>)

    const balances = await Promise.all(markets.map(market => market.queryCollateralBalance(market.addr).then(x => {
        const balance = Number(x)
        const usdBalance = balance * usdPrices[market.market_id]
        return { id: market.market_id, balance, usdBalance }
    })));

    let totalUsd = 0;

    for(const {id, balance, usdBalance} of balances) {
        totalUsd += usdBalance;
        console.log(`${id}: ${balance} (COLLATERAL) ${usdBalance} (USD)`)
    }
    console.log(`\nTOTAL USD: ${totalUsd}\n`);
})();