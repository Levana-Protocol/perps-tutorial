import * as fs from "fs/promises"; 
import { ExecuteInstruction, ExecuteResult, SigningCosmWasmClient } from "@cosmjs/cosmwasm-stargate"
import { 
    Account,
    GasPrice,
    StdFee
} from "@cosmjs/stargate"
import { Coin, DirectSecp256k1HdWallet, Registry } from "@cosmjs/proto-signing"
import { getNetworkConfig } from "../config";

export class Wallet {
    public static async Create():Promise<Wallet> {
        const {
            addr_prefix,
            rpc_url,
            denom,
            gas_price,
        } = getNetworkConfig();

        const seed_phrase = process.env.COSMOS_WALLET;
        if (!seed_phrase || seed_phrase === "") {
            throw new Error("Please set COSMOS_WALLET in .env");
        }

        const signer = await DirectSecp256k1HdWallet.fromMnemonic(
            seed_phrase, 
            { 
                prefix: addr_prefix,
            }
        );


        const accounts = await signer.getAccounts()
        const address = accounts[0].address

        const client = await SigningCosmWasmClient.connectWithSigner(
            rpc_url,
            signer,
            { 
                gasPrice: GasPrice.fromString(gas_price+denom), 
            }
        );

        const account = await client.getAccount(address);
        if(!account) {
            console.warn(`Account ${address} does not exist - please fund it`);
        }

        return new Wallet(signer, client, address);
    }


    public async instantiateContract(codeId, contract_name, instantiate_msg) {

        const instantiateReceipt = await this.client.instantiate(
            this.address,
            codeId,
            instantiate_msg,
            contract_name,
            "auto",
            {
                admin: this.address
            }
        )

        const { contractAddress } = instantiateReceipt
        if(!contractAddress || contractAddress === "") {
            throw new Error("Failed to instantiate contract");
        }

        console.log("instantiated", contract_name, "at", contractAddress);

        return contractAddress;
    }

    public async uploadContract(contract_path) {
        const contents = await fs.readFile(contract_path);
        const uploadReceipt = await this.client.upload(this.address, contents, "auto");
        const {codeId} = uploadReceipt;

        if(Number.isNaN(codeId)) {
            throw new Error("Failed to upload contract");
        }

        console.log(`Contract uploaded with code ID ${codeId}`);

        return codeId;
    }


    public async queryContract<T>(contractAddress, msg):Promise<T> {
        return await this.client.queryContractSmart(contractAddress, msg);
    }

    public async execContract(contractAddress, msg, fee: StdFee | "auto" | number = "auto", memo?: string, funds?: readonly Coin[]):Promise<ExecuteResult> {
        return await this.client.execute(this.address, contractAddress, msg, fee, memo, funds);
    }

    public async execContracts(instructions: ExecuteInstruction[], fee: StdFee | "auto" | number = "auto", memo?: string):Promise<ExecuteResult> {
        return await this.client.executeMultiple(this.address, instructions, fee, memo);
    }

    private constructor(public readonly signer: DirectSecp256k1HdWallet, public readonly client: SigningCosmWasmClient, public readonly address: string) {
    }
}