-- SQLx checksum normalization (SAFE) - generated 2026-03-19T13:02:11
BEGIN;
CREATE TABLE IF NOT EXISTS _sqlx_migrations_checksum_backup (
    backup_id BIGSERIAL PRIMARY KEY,
    backup_ts TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    version BIGINT NOT NULL,
    description TEXT,
    checksum BYTEA,
    success BOOLEAN
);
INSERT INTO _sqlx_migrations_checksum_backup(version, description, checksum, success)
SELECT version, description, checksum, success
FROM _sqlx_migrations
WHERE version IN (0,1007,1018,1019,1024,1027,103,114,126,129,130,131,140,141,144,147,148,16,17,20250120,20250126001,20250126002,20250614,20250701053847,20251018,20251020006,20251021001,20251027003,20251031001,20251104003,20251114001,20251115002,20251124001,20251210,20260103,20260112,20260214,30,33,35,49,50,51,53,60,62,63,65,69,70,84,86,87,94,96,99);
UPDATE _sqlx_migrations
SET checksum = decode('0be05484c4de28579d3cde1f461a2acae070961c65caf038e906877c4d3e317e0e17bd8cf3908dbc65d26c0af0483af5', 'hex'),
    description = 'create all tables'
WHERE version = 0;
UPDATE _sqlx_migrations
SET checksum = decode('5094e89e928759d6f54f0350e712e29dc884fba40f41f0ad9bcc4d883ebbab6a80edc3e85fc27bda4ffcb5f2da936b73', 'hex'),
    description = 'optimize vector matching with similarity'
WHERE version = 1007;
UPDATE _sqlx_migrations
SET checksum = decode('f7de84a084da7fa90ba168c7dc6fe25b58853056baab7173ca958907e11ff83b08b0b0f6dce49e4f607ca481d052f308', 'hex'),
    description = 'create bourse livre advanced tables'
WHERE version = 1018;
UPDATE _sqlx_migrations
SET checksum = decode('1e5f96f4d00237639b9a5d2d24475906578ed0388d1fc44fa3b20ec63a8897bd858aa4c9d093f2e5e5cfcc8c840f3528', 'hex'),
    description = 'optimize flash blackfriday scalability'
WHERE version = 1019;
UPDATE _sqlx_migrations
SET checksum = decode('67e935f3c45c1999347729a5603092ec6c22927f1c7fa86e624624a996d3ebbcfcbb731f1235bab61b50b1280ffe5ba3', 'hex'),
    description = 'search specialized services with moment'
WHERE version = 1024;
UPDATE _sqlx_migrations
SET checksum = decode('8e67554ec8faec1e7ee68318c98ee3f22cbd732b091c0682ba2189f95e34e7ea6fb921a2edf52f6114a2fef7388768b4', 'hex'),
    description = 'create advertising tables'
WHERE version = 1027;
UPDATE _sqlx_migrations
SET checksum = decode('56ac4add5cac4f54d3033864dbb4d828299318e617700752d175137547b0693c5b6041ecf480404ef322f74e708c8863', 'hex'),
    description = 'scalability improvements'
WHERE version = 103;
UPDATE _sqlx_migrations
SET checksum = decode('fd2916c4c0c516029c1b75125859c37c6df8316f536ba26289b0731ca08050543128e5a2e48c9ec32217138692ec53b4', 'hex'),
    description = '002 search scalability improvements'
WHERE version = 114;
UPDATE _sqlx_migrations
SET checksum = decode('6d59a897c5c5e937de10d94db1747950fc45b6e727432bd51a8fa1ca3901c785d1ba5f5a65cafd6cd6185446912a3604', 'hex'),
    description = '012 create plugin marketplace'
WHERE version = 126;
UPDATE _sqlx_migrations
SET checksum = decode('52274cd12bfee330e1b0ddd9f92c58cbed245595342f85bd511f409b0c331a437989d4e6748ff22b923b023e582b4c13', 'hex'),
    description = 'add message reactions'
WHERE version = 129;
UPDATE _sqlx_migrations
SET checksum = decode('18c3b8898b66a76fa81be654e499bf41d5a50b7a14fc94e4575513c0e6cf90afadafe437758d2fa8ff4850f79c65ade6', 'hex'),
    description = 'add performance indexes specialized services'
WHERE version = 130;
UPDATE _sqlx_migrations
SET checksum = decode('81caf21622c85e7487237d13770da0a2b8a810684cbaaa0386b9c99ac68030c9c3a992760d658a26c233dc8100d6e2f9', 'hex'),
    description = 'create bourse livre advanced tables'
WHERE version = 131;
UPDATE _sqlx_migrations
SET checksum = decode('e18ac77376d04bfa68dd8de3e15d2d4f78c10b129b2f170b4c3fb4a6193cb4bd16aea3e29f106b7ed1a0f112ccb51e0c', 'hex'),
    description = 'phase1 delivery optimizations'
WHERE version = 140;
UPDATE _sqlx_migrations
SET checksum = decode('8748564a31a8e16693c103df7b06b67d8632ca641cc3553f67c62097cec3eb59b2c489989213038550e4eef9c8dce90f', 'hex'),
    description = 'phase2 delivery partitioning'
WHERE version = 141;
UPDATE _sqlx_migrations
SET checksum = decode('d3ec66272e832127b3c4db1af08492123199a416815ba580aa24ee631675755938908ded7f306a9c3e5e581d6a90e8a2', 'hex'),
    description = '002 add product stock management'
WHERE version = 144;
UPDATE _sqlx_migrations
SET checksum = decode('708ffa2310df521b198cdb7e7021801d00e4da7748ca703d2a1fc359d5e18bc9e4a9e896ae485c528c04998710b8f732', 'hex'),
    description = '004 optimize monitoring queries'
WHERE version = 147;
UPDATE _sqlx_migrations
SET checksum = decode('2d3bccca8c13dd12190ec7c013fed301f64d44ac49c1a73103d3fea4014a64ba00ecd62866f1c22856a53a9e6240cc8a', 'hex'),
    description = '005 optimize product search fallback'
WHERE version = 148;
UPDATE _sqlx_migrations
SET checksum = decode('8fa460d8784aa2f20055813a1a7c6e3801bbb030083ef8bc76b98bc46db79dc443bf03aa7a25b9479bdd640ffe87ed1a', 'hex'),
    description = 'create offres emploi'
WHERE version = 16;
UPDATE _sqlx_migrations
SET checksum = decode('0001a95f9f8250fc8a625d3c8276174a2f4c8dccf8d618ae06546f8f83b342aba8b807de2f5c7704a334108881b3c053', 'hex'),
    description = 'create orientation scolaire'
WHERE version = 17;
UPDATE _sqlx_migrations
SET checksum = decode('5254fe85d69b689f79622ad705d28dbc55e9d921634fd4f44e2b4a88a53623b1bfb938dc48df0094c98c07c1ab14d567', 'hex'),
    description = '001 add order preparation system'
WHERE version = 20250120;
UPDATE _sqlx_migrations
SET checksum = decode('f93673da7cac8c694302edc287542874fe679077af7f3003aa9594f206afa3c675dc597f23b3a6ee2cb693ef56b0e5f4', 'hex'),
    description = 'bus return trips system'
WHERE version = 20250126001;
UPDATE _sqlx_migrations
SET checksum = decode('adbb65f207714bf20fe788adaad6808c6c5133a5b3910f0b084f107087bde7a7d4bcdfbb1d43febe8b41661c698a8b30', 'hex'),
    description = 'user push tokens'
WHERE version = 20250126002;
UPDATE _sqlx_migrations
SET checksum = decode('9e1ad64e1ef975d5f0ff89176410fe9e3754de86169a6aec057a2fa470fdbdf4283909ef87fb38a7aa7273bc7dcdcc09', 'hex'),
    description = 'create programmes scolaires'
WHERE version = 20250614;
UPDATE _sqlx_migrations
SET checksum = decode('bc54e08d64b009d6e6fe9a1c54a63a38adbaa707e60c6621096fabcb6ea98e8064befd1162466ce9c759b114702425f8', 'hex'),
    description = 'add missing columns and tables'
WHERE version = 20250701053847;
UPDATE _sqlx_migrations
SET checksum = decode('120a61fbf340287e0d976c2a6e0d6394dc47b8894edca66198ee98dbae74a3ad6aa6d5d14ebccc87bdac9c9f241ffa78', 'hex'),
    description = 'create chat tables'
WHERE version = 20251018;
UPDATE _sqlx_migrations
SET checksum = decode('6b0c21239a140b618c52b6f6d9eb9beff3388c7463a0cae8aff56ce5f0f01c53dc2b0d3904709358a74a6bbe6195ceca', 'hex'),
    description = 'improve product search all fields'
WHERE version = 20251020006;
UPDATE _sqlx_migrations
SET checksum = decode('d53f4c23db13b5fced88adf671bf238d5cd12347e67b187cfb5cbc31a7496c6f1f925555e79095cd80d8e5b11c24cade', 'hex'),
    description = 'add ai image analysis'
WHERE version = 20251021001;
UPDATE _sqlx_migrations
SET checksum = decode('22f71680cb8f3014701f3721dd425f4dd21ed2a755ff6efaf27828c48583a274576159c3ea11a3c4a538142ff0ce3740', 'hex'),
    description = 'create hybrid image search function'
WHERE version = 20251027003;
UPDATE _sqlx_migrations
SET checksum = decode('cda64bc7a5da7288737352bead8b472b0ff7123e26b6e30c1a6b6dbf8ae86b5d09ea21553cd26e1429a410897356a7bd', 'hex'),
    description = '002 create search history'
WHERE version = 20251031001;
UPDATE _sqlx_migrations
SET checksum = decode('fda4ab05f308954e0fca058def1642b5907bd38c437aa2df479f5aa5a7608e1c78da9bc35a6eb6e2bfbca538a2845122', 'hex'),
    description = '004 add product reactions'
WHERE version = 20251104003;
UPDATE _sqlx_migrations
SET checksum = decode('0bfc6e91f36b2d7ac2ffb234377a3ee9f79f66d9c848d354b91a22eb36af7d3213d2a80c767034c629777cae186dcf9a', 'hex'),
    description = 'create voice profiles'
WHERE version = 20251114001;
UPDATE _sqlx_migrations
SET checksum = decode('bf7c42fb3009b6e1ed33405becb975e241dfcc2a485d856c5dcc5e4a80cbdce434d691eb3aba37eadb80823bb15bec0c', 'hex'),
    description = 'create global promo platform'
WHERE version = 20251115002;
UPDATE _sqlx_migrations
SET checksum = decode('7f39304e239a990058353183d962365a1f464a3f3c648194b9947fca155af4de5e095fb3cc53f8ed53bbc51414912ac4', 'hex'),
    description = 'migrate products to json'
WHERE version = 20251124001;
UPDATE _sqlx_migrations
SET checksum = decode('a423fe0a43db0b2517620907e391d4897451569a9c75374caeb5042470c094be03a4e6770d92ccf4e91734d927007c6f', 'hex'),
    description = 'fix u client name error'
WHERE version = 20251210;
UPDATE _sqlx_migrations
SET checksum = decode('8245a095edc8b644acb0b3a5130de8352d351cb2754bcd81626ceac2137c235a434d06f6a0050c1415bd805739aa9051', 'hex'),
    description = 'create products table'
WHERE version = 20260103;
UPDATE _sqlx_migrations
SET checksum = decode('71e77455f79b1decdcf5bc3712d1c83861cd64db5bacb27147de5d8f9d68d61ddcf3f3346a2d9705b1277b59324eb97f', 'hex'),
    description = 'optimize slow delivery queries'
WHERE version = 20260112;
UPDATE _sqlx_migrations
SET checksum = decode('02079dcd7cc1ff5dc71f181c0337d257c527a2c3bf6bd06f38f704cf5d184aaec90ce55a053356ed7cb1d80ac2fc92b5', 'hex'),
    description = 'create gpu scale actions table'
WHERE version = 20260214;
UPDATE _sqlx_migrations
SET checksum = decode('1e13fd33857bdaf54676d6c9f7d5fab7fe407e21ac4ea6c424fe187e18e7da4744d196bdcf9d2c05174ced0a2b46edcd', 'hex'),
    description = 'add delivery round trip'
WHERE version = 30;
UPDATE _sqlx_migrations
SET checksum = decode('5f828f08c40788f4b86280c19ef52d07a0ebf194593e9f2099c6b3ed3e974d6670a5762ed3cb0f35f6513c63faf46b83', 'hex'),
    description = '004 improve search with autocomplete'
WHERE version = 33;
UPDATE _sqlx_migrations
SET checksum = decode('ea6a71943886b0f29b7dfb499ff3366d3021c04c32cbdbea846f1c4a545963463c0d6d3032de9fc0a9139e1af2909cac', 'hex'),
    description = 'create pharmacy advanced tables'
WHERE version = 35;
UPDATE _sqlx_migrations
SET checksum = decode('1d381fd47ce5abae3a3aed8b92fd92ef570557d1f7726f9708307f26d47389365fb30298439a6d0d33917b2d55f2b6ae', 'hex'),
    description = 'scalability indexes'
WHERE version = 49;
UPDATE _sqlx_migrations
SET checksum = decode('1288693e0a95b9b1ff9f18784762aac293cb14eef111482147c38c4bf8981edffc435b4d43be17040b684d8007be6e13', 'hex'),
    description = 'add recurring trips covoiturage'
WHERE version = 50;
UPDATE _sqlx_migrations
SET checksum = decode('c8dad3c1c8b9f918cb57b34ce30164b20d323aa208055377e87e1267a8769f0337f5ff8a749a9122bd9b048e218d47f7', 'hex'),
    description = 'create user documents'
WHERE version = 51;
UPDATE _sqlx_migrations
SET checksum = decode('2a59abff7a2d163305b8f70c41b3bcc5fae677d5a8abd4206d4d8e18a49a88594174116eb7a7f9918e078b4c87d01fd7', 'hex'),
    description = 'optimize delivery queries performance'
WHERE version = 53;
UPDATE _sqlx_migrations
SET checksum = decode('36f830380399f716d0a3902fe59e31bdf31a6ba246408351b4db2aab325858fcede17e54dcec3674b2883d43b06eed5f', 'hex'),
    description = 'fix parcel types ids final'
WHERE version = 60;
UPDATE _sqlx_migrations
SET checksum = decode('8d8f78b7cd96c11983113088624f7cf3918e9a0f970939171cfd462c72fe9fe5aca34febb4af963eae179af2897253f8', 'hex'),
    description = 'fix parcel types ids v2'
WHERE version = 62;
UPDATE _sqlx_migrations
SET checksum = decode('f72bc631b3da72ae336ec61cb011f130f6c0483a6b99b80590ed536b04c85299473f229db7b1b5640fadbcb908ddc548', 'hex'),
    description = 'fix parcel types ids v3'
WHERE version = 63;
UPDATE _sqlx_migrations
SET checksum = decode('b7b39c8b9b8d2e322b9c875606234a008c41872cd71709f4e0e5d85b2969bdfbe67c3eb3d295e99bcb0ddc9efbee9937', 'hex'),
    description = 'optimize delivery indexes'
WHERE version = 65;
UPDATE _sqlx_migrations
SET checksum = decode('4bb1122c83727e64aee96e10a04ec3684c1fe338f1596a8d38ce9b0ee030cf5e65b247dcbba9310c259c4bd4c7df078e', 'hex'),
    description = 'fix all missing tables and functions'
WHERE version = 69;
UPDATE _sqlx_migrations
SET checksum = decode('a0df75e8e95f7eb2d437460d6af5c08c810745f550725089958f71189687b3b622ebfe904f6ede57a7395cba15e95f3d', 'hex'),
    description = 'optimize comments queries'
WHERE version = 70;
UPDATE _sqlx_migrations
SET checksum = decode('9dfdcf153d282332cd71ce09e11ee17cbc6327f21c71919f9784a6c60f1ae8697943f9fe31ac3b1f53b69321b88bb2f1', 'hex'),
    description = 'optimize hashtags scalability'
WHERE version = 84;
UPDATE _sqlx_migrations
SET checksum = decode('8b39fb360aed18b1ab93b2430474968eb73c5e0e54d3e7361076afadc726fcaf146cc08aca80d68f44d094a339038d3c', 'hex'),
    description = '120002 optimize slow queries'
WHERE version = 86;
UPDATE _sqlx_migrations
SET checksum = decode('ce30fc94f85f51bf5bf9bb1347943e1ab0031eba0521b052c736106fde6a7762f83bc250300bba971d8be9a2ab8b65f8', 'hex'),
    description = '120003 fix geo hierarchy unique constraint'
WHERE version = 87;
UPDATE _sqlx_migrations
SET checksum = decode('9f3536f9094554dc47473beb3d2677bf1d7932277bd1ee89c916f451f69316dc3e893664a6d7dcce2535edb051683ff3', 'hex'),
    description = 'bus manual seat blocks'
WHERE version = 94;
UPDATE _sqlx_migrations
SET checksum = decode('f65a8930f75debf349f86f438cb6e92087337312aa46089c17f955df94239215617e2fde33bd7492f296c89eea606787', 'hex'),
    description = 'create banques sang table'
WHERE version = 96;
UPDATE _sqlx_migrations
SET checksum = decode('8924a5a1ef1289a3b72b2d64e175c4f1f0dba1a556f2ccc0f2a97577b4b32976f00184212d3cea7f106dde93be74f08a', 'hex'),
    description = 'integrate bus tickets with agences voyage'
WHERE version = 99;
COMMIT;
