# Tutorial code for Levana Perps

*This code is provided as-is with no warranty, implied or otherwise.*

### Getting started

1. Copy `env.sample` to `.env` and set your seed phrase
2. In `typescript`, run `npm install`
3. Edit `typescript/src/config.ts` to have the correct factory address

### Examples 

In `typescript`, run any of the available commands (see them in `package.json`).

The overall idea is:

* `*open-close-position*`: deposits liquidity, opens a position, closes the position, withdraws liquidity (unless in cooldown).
* `*crank-until-finished*`: runs the crank until there's no more crank work
* `*show-price*`: shows both the live potential spot price and the last spot price pushed into the contract

All the execution messages will send the Pyth oracle price updated if/as needed.

The wildcards are shorthands to make typical examples easy, e.g. running on a sei vs. osmosis chain and native vs. pyth oracle.

For example, `npm run osmosis-open-close-position` will go through an open/close cycle (and deposit liquidity) on an osmosis market with a pyth oracle
For example, `npm run sei-open-close-position-native` will go through an open/close cycle (and deposit liquidity) on a sei market with a native oracle

Of course, feel free to modify any of this as needed, the purpose of this repo is educational or to bootstrap your own custom project. Go for it!


