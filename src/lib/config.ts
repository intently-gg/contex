export const CONTEX_CONFIG_VERSION = "0.14"
export const CONTEX_VERSION = "0.26.0"

export const RELEASE_NOTES = {
  "0.26": {
    "whatsnew": {
      "Import Calldata": [
        "Raw calldata can be imported into any function's parameters",
        "Transaction hashes can be supplied to clone any on-chain tx"
      ],
      "Integer Helper": [
        "New tool available from the top-right Menu and on any integer input param",
        "Parse uint/int values from decimals and units",
        "Now Supports Unix Seconds, Chain Ids, Block Numbers, and Block Timestamps"
      ],
    },
  },
  "0.25": {
    "whatsnew": {
      "Function Encoding": [
        "Functions can now be encoded to a Clipboard or to another function's bytes parameter",
        "bytes[] params can also receive encoded bytes, with a prompt to select the list position",
        "This can be used to construct complex multicalls"
      ],
      "Bytes Helper": [
        "Allows decoding, viewing, & editing of bytes fields",
        "Enabled for any bytes input param whose function is registered somewhere in contex",
        "Activated by clicking the Helper button on enabled bytes input params"
      ],
      "Hex Converter": [
        "New tool available from the top-right Menu",
        "Convert easily between hex bytes, integers, and strings"
      ],
      "Function Viewer": [
        "'Show Function JSON' button added",
      ],
      "General": [
        "Function overloads now supported",
      ],
    },
  },
}