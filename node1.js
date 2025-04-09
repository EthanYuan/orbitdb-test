// node1.js
import { create } from 'ipfs-core'
import OrbitDB from 'orbit-db'
import readline from 'readline'
import { CID } from 'multiformats/cid'
import { kadDHT } from '@libp2p/kad-dht'

const BOOTSTRAPS = [
  // PUBLIC_BOOTSTRAP
  '/ip4/35.220.212.56/tcp/4001/p2p/12D3KooWJ6MTkNM8Bu8DzNiRm1GY3Wqh8U8Pp1zRWap6xY3MvsNw',

  // IPFS_OFFICIAL_BOOTSTRAPS
  '/dnsaddr/va1.bootstrap.libp2p.io/p2p/12D3KooWKnDdG3iXw9eTFijk3EWSunZcFi54Zka4wmtqtt6rPxc8',
  '/ip4/104.131.131.82/tcp/4001/p2p/QmaCpDMGvV2BGHeYERUEnRQAwe3N8SzbUtfsmvsqQLuvuJ',
  '/ip4/104.131.131.82/udp/4001/quic-v1/p2p/QmaCpDMGvV2BGHeYERUEnRQAwe3N8SzbUtfsmvsqQLuvuJ',
  '/dnsaddr/bootstrap.libp2p.io/p2p/QmNnooDu7bfjPFoTZYxMNLWUQJyrVwtbZg5gBMjTezGAJN',
  '/dnsaddr/bootstrap.libp2p.io/p2p/QmQCU2EcMqAqQPR2i9bChDtGNJchTbq5TbXJJ16u19uLTa',
  '/dnsaddr/bootstrap.libp2p.io/p2p/QmbLHAnMoJPWSCR5Zhtx6BHJX9KiKNN6tpvbUcqanj75Nb',
  '/dnsaddr/bootstrap.libp2p.io/p2p/QmcZf59bWwK5XFi76CZX8cbJ4BhTzzA3gU1ZjYZcYW3dwt',

  // LIBP2P_BOOTSTRAP
  "/dnsaddr/bootstrap.libp2p.io/p2p/12D3KooWQiJMV63WiHBbmdZr3jPrr7ZrH1WAM5VTiZ7bSk2fwzvm",
  "/dnsaddr/bootstrap.libp2p.io/p2p/12D3KooWEzx6rCWrb1R3dAk6urW6X1XH3NwQZz9fktZu4rhQa3j3",
  "/dnsaddr/bootstrap.libp2p.io/p2p/12D3KooWD71WtxGTVKa2EgaX21kh2RXHHyNwX6u1k7bTWbtSA3UQ",
  "/dnsaddr/bootstrap.libp2p.io/p2p/12D3KooWEtp8K2npfkiZBVG1ELvLyBrHrA4rdToZ5znniS6T7Gbn"
]

async function main() {
  const ipfs = await create({
    repo: './ipfs-node1',
    config: {
      Bootstrap: BOOTSTRAPS,
      Addresses: {
        Swarm: [
          '/ip4/0.0.0.0/tcp/0/ws',
          '/ip4/0.0.0.0/udp/0/quic'
        ]
      }
    },
    libp2p: {
      config: {
        dht: {
          clientMode: false, // ✅ full DHT mode
          enabled: true
        }
      },
      modules: {
        dht: kadDHT
      }
    }
  })

  const id = await ipfs.id()
  console.log(`🆔 [Node1] IPFS ID: ${id.id}`)

  const orbitdb = await OrbitDB.createInstance(ipfs)
  const db = await orbitdb.keyvalue('shared-db', {
    accessController: { write: ['*'] }
  })
  await db.load({ timeout: 60000 })

  console.log('📡 [Node1] OrbitDB 地址:', db.address.toString())
  console.log('🧾 [Node1] Manifest CID:', db.address.root)
  const manifest = await ipfs.block.stat(db.address.root)
  console.log('📦 本地 manifest:', manifest)

  // 试广播该 CID 到 DHT
  const manifestCid = CID.parse(db.address.root)
  try {
    console.time('dht.provide')
    await ipfs.dht.provide(manifestCid)
    console.timeEnd('dht.provide')
    console.log(`📣 已广播 manifest CID: ${manifestCid}`)
  } catch (err) {
    console.warn('⚠️ 提供 CID 失败（非致命）:', err.message || err)
  }

  // console.log('🔍 查找 provider（本地 DHT 路由结果）:')
  // try {
  //   for await (const prov of ipfs.dht.findProvs(manifestCid, { numProviders: 10 })) {
  //     console.log(`  ✅ 找到 provider: ${prov}`)
  //   }
  // } catch (err) {
  //   console.warn('⚠️ 查找 provider 出错:', err.message || err)
  // }

  // 打印可连接地址（for node2 或 Kubo）
  console.log('🌐 可连接地址:')
  id.addresses.forEach(addr => {
    console.log(`  - ${addr.toString()}`)
  })

  db.events.on('replicated', () => {
    console.log('\n🔁 [Node1] 数据同步完成:', db.all)
  })

  await db.put('node1-msg', 'hello from node1')
  console.log('📦 [Node1] 当前数据:', db.all)

  // console.log('📜 [Node1] 操作日志 entry:')
  // for (const entry of db._oplog.values) {
  //   const { op, key, value } = entry.payload
  //   console.log(`  🧾 ${op.toUpperCase()} ${key} = ${value}`)
  // }

  setInterval(async () => {
    const peers = await ipfs.swarm.peers()
    // peers.forEach(p => {
    //   console.log(`  - ${p.addr.toString()}`)
    // })
    readline.clearLine(process.stdout, 0)
    readline.cursorTo(process.stdout, 0)
    process.stdout.write(`🔌 [Node1] 当前连接 Peer 数: ${peers.length}`)
  }, 3000)

  setInterval(async () => {
    try {
      // console.time('dht.provide')
      await ipfs.dht.provide(manifestCid)
      // console.timeEnd('dht.provide')
    } catch (err) {
      console.warn('\n⚠️ [定时广播失败]:', err.message || err)
    }
  }, 60 * 1000)
}

main().catch(console.error)
