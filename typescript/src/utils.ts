export function getArg(key:string):string {
    for (const arg of process.argv) {
        if (arg.startsWith(`--${key}=`)) {
            const value = arg.substring(key.length + 3);
            if (value && value !== "") {
                return value;
            }
        }
    }

    throw new Error(`Please specify a value for --${key}`);
}