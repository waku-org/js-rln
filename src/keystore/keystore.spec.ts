import chai, { expect } from "chai";
import chaiSubset from "chai-subset";
import deepEqualInAnyOrder from "deep-equal-in-any-order";

chai.use(chaiSubset);
chai.use(deepEqualInAnyOrder);

import { Keystore } from "./keystore";

const NWAKU_KEYSTORE = {
  application: "waku-rln-relay",
  appIdentifier: "01234567890abcdef",
  credentials: {
    "9DB2B4718A97485B9F70F68D1CC19F4E10F0B4CE943418838E94956CB8E57548": {
      crypto: {
        cipher: "aes-128-ctr",
        cipherparams: {
          iv: "fd6b39eb71d44c59f6bf5ff3d8945c80",
        },
        ciphertext:
          "9c72f47ce95de03ed34502d0288e7576b66b51b9e7d5ae882c27bd89f94e6a03c2c44c2ddf0c982e72003d67212105f1b64614f57cabb0ceadab7e07be165eee1121ad6b81951368a9f3be2dd99ea294515f6013d5f2bd4702a40e36cfde2ea298b23b31e5ce719d8040c3331f73d6bf44f88bca39bac0e917d8bf545500e4f40d321c235426a80f315ac70666acbd3bdf803fbc1e7e7103fed466525ed332b25d72b2dbedf6fa383b2305987c1fe276b029570519b3e79930edf08c1029868d05c2c08ab61d7c64f63c054b4f6a5a12d43cdc79751b6fe58d3ed26b69443eb7c9f7efce27912340129c91b6b813ac94efd5776a40b1dda896d61357de208c7c47a14af911cc231355c8093ee6626e89c07e1037f9e0b22c690e3e049014399ca0212c509cb04c71c7860d1b17a0c47711c490c27bad2825926148a1f15a507f36ba2cdaa04897fce2914e53caed0beaf1bebd2a83af76511cc15bff2165ff0860ad6eca1f30022d7739b2a6b6a72f2feeef0f5941183cda015b4631469e1f4cf27003cab9a90920301cb30d95e4554686922dc5a05c13dfb575cdf113c700d607896011970e6ee7d6edb61210ab28ac8f0c84c606c097e3e300f0a5f5341edfd15432bef6225a498726b62a98283829ad51023b2987f30686cfb4ea3951f3957654035ec291f9b0964a3a8665d81b16cec20fb40f944d5f9bf03ac1e444ad45bae3fa85e7465ce620c0966d8148d6e2856f676c4fbbe3ebe470453efb4bbda1866680037917e37765f680e3da96ef3991f3fe5cda80c523996c2234758bf5f7b6d052dc6942f5a92c8b8eec5d2d8940203bbb6b1cba7b7ebc1334334ca69cdb509a5ea58ec6b2ebaea52307589eaae9430eb15ad234c0c39c83accdf3b77e52a616e345209c5bc9b442f9f0fa96836d9342f983a7",
        kdf: "pbkdf2",
        kdfparams: {
          dklen: 32,
          c: 1000000,
          prf: "hmac-sha256",
          salt: "60f0aa92fbf63a8356dfdbed2ab18058",
        },
        mac: "51a227ac6db7f2797c63925880b3db664e034231a4c68daa919ab42d8df38bc6",
      },
    },
    "263335559F0578FD785F9CDFEDBB45CFF276799A27580B8F580CDFDCB990257C": {
      crypto: {
        cipher: "aes-128-ctr",
        cipherparams: {
          iv: "69f95461f811ac35a21987b1fdaa605e",
        },
        ciphertext:
          "edfe844f8e2aedd62f26753e7247554920352b6b167f54ea4f728cd715577e9d2b7192b782471914870794205e77c2708b6db2d0ada19fec6b3533098cb2b7350bbaf81526d6bde7f1d0e83c366e3a2ddcced942cfb09a3c7704db7041132c3b511fed2f6d8599e6cddf649250b240687c2c335bf0aa75c892bc97f81c537898aefed20d1488e816d54eec72572acf36f140dc98cba0430cdeb8a00b8e8c8edf9b1292ca0e9c9a606acec51ea3dbe46438cb74b95d708cec18f8f126aecabbff11dd068d9194b25803f959f0bb62d49785dbc694486754f46bfe084cfa780cae27eca48cdcc88f4083d166d1747b8e2e637619e5d3848b9b6cdf7c7161eda8e476edfc083d417691d47b84fb224bfd26bf7713958893b934388e50783e49c5c84999971538ccda14c54b48b0d4aa37503e2a40212e9a1407d5a1ea4e96760de3d87e1b2287465a4e51cf330b7f1d14e3f2fb6521d10d32c798856464927b1e0286086a78f07a8f6f436d8c0c7b530f585320515e276d82c7b1f244702fa9ca6e6ad164fd2b1d9badcbdc17e01e95abf58e6825d8eeba5bc22db3a66dd41c64887d4c862298e921b3bae17d9fb7be1f619c60c82bd60dee351b77514d36e25d4092d6cde8ab613c40a117f7b784c80d65310e5b9cf1a31ba555f848e6984cc0c2d48315167d60131f3ffaaca5c81e359134bbfc81fa217f29b533868604ced4a2c5da8c89bd1238147b9f348168864ebea40c36a6abbf3d59d43086f26777104ce0a9f60cbf350058a337bc66abd5e4976950e5908192f98a9a8c1913abbc0d918479aeaa99e89a0e5cd65fd84a347d73df1d9c829863728a6fcd90150e52ecdec48bd07802110384f6c0aff0ca05ad42feb521223b58719fd4fc4ae88df8225ea58e303e4c61e8288e80f854bf0b",
        kdf: "pbkdf2",
        kdfparams: {
          dklen: 32,
          c: 1000000,
          prf: "hmac-sha256",
          salt: "3cf796e4857f296bef3bdb9ca844b1bf",
        },
        mac: "3d6cb0492afcf89c891365f097ae8989dc50038010c419b18228be6816c24c32",
      },
    },
    F62A7FCE85E5B796AFCB38F54A44210515CB688EA0224E9A436CCA0A542F2C9D: {
      crypto: {
        cipher: "aes-128-ctr",
        cipherparams: {
          iv: "49816dacf881c85db9f11f7f068dcf71",
        },
        ciphertext:
          "d7d805ee24dd34368e3d1829aa6d0856ca2ea54d9bcdc2655f8f197af0d293aff56c6e06de3137b0eddffbcad7cc0b8e3f6ba761ac7983d8e59ce04c8936868297b9f70238cb295e17567f2404b278b93c985496a6e1e46185965491449ccbc1e7155224acdba354ed18b1b9867ff6f1a833a77c9b21e2e9c4b6af27d5bd6303efd574465920928e5c467bd3c7888c3f31e8bece6af2e0c35fa03661399e9b420eeecd4376cb2b3266692f46c03161bb32cc2c79521f7b19cb0e6ec911213e105967f8887d94c73e793b18e4c14ee045dca13fcfb62ae267d3175f8a4fefd0e8bd636bd9431cc0cc7119e75f116a16dcbdcac1c15a3dcec57e1c49dbf5dccd1c75c0cfcb3473e81e8546048ce5231a4d4c8dd5d66311354e9ab70ad5745d5be27746954a08b0b29218562bfb632ae0a498cf09d7955a27377ed7a50fc1b4adaa0a3fb3e87a3b4d923136be0767a1428050944b9fd247332dea1b5016dfa1ec4da167e70e11e07cd58034b8470366dc16d77978b49a61e213ab5a7817fd69af26c2a8c3cd3a488d6e1491e0215071e1f3e9d49d0dfab3a7e324644c98a088e20259980495dcc379dcdce2e61752711bdf8abf057a2e696624078601245828193d838cc806065ee3f2bb138302ec72c70f34f14c0ab816211011f0ac55423732875e220175c717f6bc86f071bb4fab51c1963eb5c5d70d504c1e4d2307a8c8c4b8b5a84566a4606deb3fc6d7a420adc2b2b37c0ef3018f82a3ce0044e082407e8e7cb6214a3abc139b7f75b2c36c6902080e7696c730ab062e75e597274e0c945b6a7a366d20bd210dd02b097071142d033597e2fc4174be683a866510fa1c2fe150a2fb81dbd2b5da25da27f29367fb22dd4e9d4785856e4deea56219f9495fb3ab772f7867db11cb14026b",
        kdf: "pbkdf2",
        kdfparams: {
          dklen: 32,
          c: 1000000,
          prf: "hmac-sha256",
          salt: "2dcb5ba5c98fe5e46d961dad36e79a5b",
        },
        mac: "2d6e9de6440f52c5db64b13f80399967c8770e82616294e14f40a2e213e7d925",
      },
    },
    "8479C6B9125D43E7B7739F1BAB41779F2F5A4D27FF0E2B6F6CA353032010A22C": {
      crypto: {
        cipher: "aes-128-ctr",
        cipherparams: {
          iv: "b0eef2c385a04909c4ae9b318e179fa7",
        },
        ciphertext:
          "90b982222072366566fa194be5c170506888e184cadbd52aa38f184ac4e9bc160cc719d809fb6a128e0cbd908e70a71efdc5d51c4dab8aab71e3e6a2ebd9ea4238cb47585137990e896dfa53961bb2b328abfbba82f49db6a9b6e3790cf9e29c145796c6dbf409dc875e7998db827c944a835a29ab4192a11ad1efde5ebdd1a775ecbfefd139c50fbdcbebd6c124d9d65ba6ddaaa83e57695293e7c85dfd6f418d58fa5ffb9ab9b2395c84b57da796d31b6351fde3f1dbab29da6c3f259859bd0719c34f5111a9a12075b53ee91b4598fb2f452dbea823ec094cb757f370b5386a8e5db25cf732681d0cd9bda651ae55cdd125138fd2c8f1ffe87a5eea14df7d355762b37e3e71c33c6fe46a10c2083538910fec12e294de84ff587cab2dd268203699cb180e481f4a3a093b86854cea64341dd9482305abd4a9d7bb304b078bc255bf7cde78689225f17006f24c2cd82d38a59f1e0899965c38fcfd1ec67069143ee05a34922963a527549a002e3221e1461463f573e5f66ba87dcb83a63cb8e3a721c13cd9d4d0c9a0334a558f32027424a5bc9fc12b91981a3f74ac4b62eea3aae8be6c44504696b96afadce5d9222bb67dddf5a7d98dd43d544d79f8720a946c37eba8eb5ae6d70f4bdbbe554cbd4b3abb35ed357c8cb8f55e016ab83bef12bf5c0cdf26c7624c86f16437f545d796addb1aa7370de329930c68b174c871706e7afdf78cc07e0f0c58e45495d0d3bcf3faf9fb6d20369b0adc89766b0c9132677e52112770d017da7658f2a0c0eaeac57416f203700f98bf7b30119407733d4f0bd4322c622120cdf81646c4a1adfb80e757954e41ba0e7816c403b2e4b9ceb2d36e4198921ea719a410ae6f6983e49e7b99c266deb0465af716799e36a5bab70923291da808edeba54267e31e8b64c37123fd45d86e0638",
        kdf: "pbkdf2",
        kdfparams: {
          dklen: 32,
          c: 1000000,
          prf: "hmac-sha256",
          salt: "142a0a65b7f6f480546cc4ef743d7ef9",
        },
        mac: "7119b7b78598850de5f6af742e42748a3b005394b6b8b272490f24527ebd8b15",
      },
    },
  },
  version: "0.2",
};

describe.only("Keystore", () => {
  it("shoud create empty store with predefined values", () => {
    const store = Keystore.create();

    expect(store.toObject()).to.deep.eq({
      application: "waku-rln-relay",
      version: "01234567890abcdef",
      appIdentifier: "0.2",
      credentials: {},
    });
  });

  // TODO: add more thorow credentials testing
  [
    {
      some: "3123",
      dadw: "1212",
    },
    {
      application: 123,
      version: "01234567890abcdef",
      appIdentifier: "0.2",
      credentials: {},
    },
    {
      application: "waku-rln-relay",
      version: 213,
      appIdentifier: "0.2",
      credentials: {},
    },
    {
      application: "waku-rln-relay",
      version: "01234567890abcdef",
      appIdentifier: 12,
      credentials: {},
    },
    {
      application: "waku-rln-relay",
      version: "01234567890abcdef",
      appIdentifier: "12",
      credentials: [],
    },
    {
      application: "waku-rln-relay",
      version: "01234567890abcdef",
      appIdentifier: "12",
      credentials: 123,
    },
    {
      application: "waku-rln-relay",
      version: "01234567890abcdef",
      appIdentifier: "12",
      credentials: "123",
    },
    {
      application: "waku-rln-relay",
      version: "01234567890abcdef",
      appIdentifier: "12",
      credentials: {
        hash: {
          invalid: "here",
        },
      },
    },
  ].map((options) => {
    it("should fail to create store from invalid object", () => {
      try {
        Keystore.fromObject(options as any);
        expect(false).to.eq(true);
      } catch (e) {
        expect(e.message).to.eq(
          "Invalid object, does not match Nwaku Keystore format."
        );
      }
    });
  });

  it("shoud create store from valid object", () => {
    const store = Keystore.fromObject(NWAKU_KEYSTORE as any);
    expect(store.toObject()).to.deep.eq(NWAKU_KEYSTORE);
  });

  it("should fail to create store from invalid string", () => {
    try {
      Keystore.fromString("/asdq}");
    } catch (e) {
      expect(e.message).to.contain("Cannot create Keystore from string:");
    }

    try {
      Keystore.fromString("{ name: 'it' }");
    } catch (e) {
      expect(e.message).to.contain(
        "Invalid string, does not match Nwaku Keystore format."
      );
    }
  });

  it("shoud create store from valid string", async () => {
    const store = Keystore.fromObject(NWAKU_KEYSTORE as any);
    expect(store.toObject()).to.deep.eq(NWAKU_KEYSTORE);
  });

  it("should convert keystore to string", async () => {
    let store = Keystore.create();
    expect(store.toString()).to.eq(
      JSON.stringify({
        application: "waku-rln-relay",
        version: "01234567890abcdef",
        appIdentifier: "0.2",
        credentials: {},
      })
    );

    store = Keystore.fromObject(NWAKU_KEYSTORE as any);
    expect(store.toString()).to.eq(JSON.stringify(NWAKU_KEYSTORE));
  });

  // it("shoud add new credentials", async function () {});

  // it("shoud fail to add credentials if already exist", async function () {});

  // it("shoud read credentials with valid password", async function () {});

  // it("shoud fail to read credentials with wrong password", async function () {});

  // it("shoud fail to read missing credentials", async function () {});
});
