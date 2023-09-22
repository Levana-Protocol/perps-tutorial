import * as dotenv from "dotenv";
import * as path from "path";
import { getArg} from "./utils/cmd";

dotenv.config({ path: path.resolve(__dirname, "../../.env") });

export const PYTH_ENDPOINT_STABLE = "https://hermes.pyth.network";
export const PYTH_ENDPOINT_EDGE = "https://hermes-beta.pyth.network";

export const NETWORKS: Record<NetworkId, NetworkConfig> = {
    "sei-testnet": {
        "factory": "sei1tjrm0sslecgd5u7cejetp97h9uuxe0yfrac0a5ux4ynuuzus30gqpt2sn2",
        "rpc_url": "https://test-sei.kingnodes.com",
        "rest_url": "https://sei-testnet-2-rest.brocha.in",
        "gas_price": "0.1",
        "full_denom": "SEI",
        "denom": "usei",
        "chain_id": "atlantic-2",
        "addr_prefix": "sei",
    },
    "osmosis-testnet": {
        "factory": "osmo1fudxt2vez3zy9d9rz8qz986p43f9xnpjcv0k0zz0enrp885q6fwqmkt99s",
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
