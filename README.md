# js-rln

Browser library providing the cryptographic functions for Waku RLN Relay
https://rfc.vac.dev/spec/17/

### Install
```
npm install @waku/rln

# or with yarn

yarn add @waku/rln
```

### Running example app
```
git clone https://github.com/waku-org/js-rln

cd js-rln/example

npm install  # or yarn

npm start

```

Browse http://localhost:8080 and open the dev tools console to see the proof being generated and its verification


### Usage

#### Initializing the library
```js
import * as rln from "@waku/rln";

const rlnInstance = wait rln.create();
```

#### Generating RLN membership keypair
```js
let memKeys = rlnInstance.generateMembershipKey();
```


#### Adding membership keys into merkle tree
```js
rlnInstance.insertMember(memKeys.IDCommitment);
```

#### Generating a proof
```js
// prepare the message
const uint8Msg = Uint8Array.from("Hello World".split("").map(x => x.charCodeAt()));

// setting up the epoch (With 0s for the test)
const epoch = new Uint8Array(32);

// generating a proof
const proof = await rlnInstance.generateProof(uint8Msg, index, epoch, memKeys.IDKey)
```

#### Verifying a proof
```js
try {
    // verify the proof
    const verificationResult = rlnInstance.verifyProof(proof);
    console.log("Is proof verified?", verificationResult ? "yes" : "no");
} catch (err) {
    console.log("Invalid proof")
}
```



### Updating circuit, verification key and zkey
The RLN specs defines the defaults. These values are fixed and should not
change. Currently, these [resources](https://github.com/vacp2p/zerokit/tree/master/rln/resources/tree_height_20) are being used.
If they change, this file needs to be updated in `resources.ts` which 
contains these values encoded in base64 in this format:

```
const verification_key = "...";
const circuit = "..."; // wasm file generated by circom
const zkey = "...";
export {verification_key, circuit, zkey};
```

A tool like GNU's `base64` could be used to encode this data. 

### Updating zerokit
1. Make sure you have nodejs installed and a C compiler
2. Install wasm-pack
```
curl https://rustwasm.github.io/wasm-pack/installer/init.sh -sSf | sh
```
3. Compile RLN for wasm
```
git clone https://github.com/vacp2p/zerokit
cd zerokit/rln-wasm
wasm-pack build --release
```
4. Copy `pkg/rln*` into `src/zerokit`


## Bugs, Questions & Features

If you encounter any bug or would like to propose new features, feel free to [open an issue](https://github.com/waku-org/js-rln/issues/new/).

For more general discussion, help and latest news,  join [Vac Discord](https://discord.gg/PQFdubGt6d) or [Telegram](https://t.me/vacp2p).


## License
Licensed and distributed under either of

* MIT license: [LICENSE-MIT](LICENSE-MIT) or http://opensource.org/licenses/MIT

or

* Apache License, Version 2.0, ([LICENSE-APACHEv2](LICENSE-APACHEv2) or http://www.apache.org/licenses/LICENSE-2.0)

at your option. These files may not be copied, modified, or distributed except according to those terms.
