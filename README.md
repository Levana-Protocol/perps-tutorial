# Tutorial code for Levana Perps

*This code is provided as-is with no warranty, implied or otherwise.*

### Getting started

1. Copy `env.sample` to `.env` and set your seed phrase
2. In `typescript`, run `npm install`
3. Edit `typescript/src/config.ts` to have the correct factory address

### Examples 

In `typescript`, run any of the available commands (see them in `package.json`).

* `open-close-position`: deposits liquidity, opens a position, closes the position, withdraws liquidity (unless in cooldown).
* `crank-until-finished`: runs the crank until there's no more crank work
* `show-price`: shows both the live potential spot price and the last spot price pushed into the contract
* `show-collateral`: shows the collateral balance and information about the collateral token
* `show-tvl`: shows the collateral balance and information about the collateral token

You must supply a `networkId` of either `sei-testnet` or `osmosis-testnet`, and a `marketId` for all except `show-tvl`. NPM syntax requires these after a `--`

So for example, from in the `typescript` directory, here's how to run the open-close-position script on Sei testnet and the BTC_USD market:

```
npm run open-close-position -- --networkId="sei-testnet" --marketId="BTC_USD"
```

And here's how to do the same thing on Osmosis testnet and the ATOM_USD market:

```
npm run open-close-position -- --networkId="osmosis-testnet" --marketId="ATOM_USD"
```

And to calculate TVL for Osmosis mainnet
```
npm run show-tvl -- --networkId="osmosis-mainnet"
```

Of course, feel free to modify any of this as needed, the purpose of this repo is educational or to bootstrap your own custom project. Go for it!


