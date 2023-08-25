import * as dotenv from "dotenv";
import * as path from "path";
import { getArg} from "./utils/cmd";

dotenv.config({ path: path.resolve(__dirname, "../../.env") });

export const PYTH_ENDPOINT = "https://hermes.pyth.network/";

export const NETWORKS: Record<NetworkId, NetworkConfig> = {
    "sei-testnet": {
        "factory": "sei1xmpv0ledn5rv46hkyzqjdgc20yyqldlwjv66vc7u4vw5h7fadfssnks3y6",
        "rpc_url": "https://sei-testnet-2-rpc.brocha.in",
        "rest_url": "https://sei-testnet-2-rest.brocha.in",
        "gas_price": "0.1",
        "full_denom": "SEI",
        "denom": "usei",
        "chain_id": "atlantic-2",
        "addr_prefix": "sei",
    },
    "osmosis-testnet": {
        "factory": "osmo165nre6njgve474xa4m2xvfgjln77xgcn4jgyltgmy2h3tyggsmjsyl9qrs",
        "rpc_url": "https://rpc.osmotest5.osmosis.zone",
        "rest_url": "https://lcd.osmotest5.osmosis.zone",
        "gas_price": "0.025",
        "full_denom": "OSMO",
        "denom": "uosmo",
        "chain_id": "osmo-test-5",
        "addr_prefix": "osmo",
    }
}

export function getNetworkConfig():NetworkConfig {
    const config = NETWORKS[getArg("networkId")];

    if (!config) {
        const availableNetworkIds = Object.keys(NETWORKS);
        throw new Error(`Please specify a networkId with --networkId=[${availableNetworkIds.join(" | ")}]`);
    }

    return config;
}

export interface NetworkConfig {
    "factory": string,
    "rpc_url": string,
    "rest_url": string,
    "gas_price": string,
    "full_denom": string,
    "denom": string,
    "chain_id": string, 
    "addr_prefix": string,
}

export type NetworkId = "sei-testnet" | "osmosis-testnet";
