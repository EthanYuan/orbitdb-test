// node2.js
import { create } from 'ipfs-core'
import OrbitDB from 'orbit-db'
import readline from 'readline'
import { multiaddr } from 'multiaddr'

const SHARED_DB_ADDR = '/orbitdb/zdpuAmdeCMg8Aa1hRPLHg7x55vFdjMrYWjkqZPuArgncSA35H/shared-db'
const PUBLIC_BOOTSTRAP = multiaddr('/ip4/35.220.212.56/tcp/4001/p2p/12D3KooWJ6MTkNM8Bu8DzNiRm1GY3Wqh8U8Pp1zRWap6xY3MvsNw')

async function waitForPeers(ipfs, minPeers = 1) {
  return new Promise((resolve) => {
    const interval = setInterval(async () => {
      const peers = await ipfs.swarm.peers()
      if (peers.length >= minPeers) {
        console.log(`✅ 已连接到 ${peers.length} 个 peer，继续加载数据库`)
        clearInterval(interval)
        resolve()
      } else {
        console.log(`⌛ 当前连接 Peer 数: ${peers.length}，等待中...`)
      }
    }, 1000)
  })
}

async function main() {
  const ipfs = await create({
    repo: './ipfs-node2',
    config: {
      Bootstrap: [PUBLIC_BOOTSTRAP],
      Addresses: {
        Swarm: [
          '/ip4/0.0.0.0/tcp/0/ws',
          '/ip4/0.0.0.0/udp/0/quic'
        ]
      }
    }
  })

  const id = await ipfs.id()
  console.log(`🆔 [Node2] IPFS ID: ${id.id}`)

  // ✅ 等待至少一个 peer 再打开数据库
  await waitForPeers(ipfs, 1)

  const orbitdb = await OrbitDB.createInstance(ipfs)
  const db = await orbitdb.open(SHARED_DB_ADDR, {
    accessController: { write: [] } // 只读
  })
  await db.load()

  console.log('📡 [Node2] 成功连接数据库:', db.address.toString())
  console.log('📦 当前数据:', db.all)

  db.events.on('replicated', () => {
    console.log('\n🔁 [Node2] 数据同步完成:')
    console.log('📦 最新数据:', db.all)
  })

  // 打印 peer 数
  setInterval(async () => {
    const peers = await ipfs.swarm.peers()
    readline.clearLine(process.stdout, 0)
    readline.cursorTo(process.stdout, 0)
    process.stdout.write(`🔌 [Node2] 当前连接 Peer 数: ${peers.length}`)
  }, 3000)
}

main().catch(console.error)
