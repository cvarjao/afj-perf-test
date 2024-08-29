import axios from 'axios'
import fs from 'node:fs'
import path from 'node:path'
import { extractResponseData, waitFor } from './lib';

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const checkTransactions = async (baseUrl:string, token:string) => {
  const transactions = await axios.get(`${baseUrl}/transactions`, {
      headers:{
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
      }
  })
  //.then(printResponse)
  .then(extractResponseData)
  .then(data => {
      const results:any[] = data.results
      const transactions = results.map((value) => {
          let _txn = value.messages_attach[0].data.json
          if (typeof _txn === 'string') {
              _txn= JSON.parse(_txn)
          }
          return {state: value.state, created_at:value.created_at, updated_at:value.updated_at, txn_type:_txn?.operation?.type??_txn.result?.txn?.type}
      })
      return transactions
  })
  console.dir(['transactions', transactions], {depth: 5})
  return transactions
}

const getNewTenant = async () => {
  console.log('Requesting tenant')
  const baseUrl = 'https://traction-sandbox-tenant-proxy.apps.silver.devops.gov.bc.ca'
  //${baseUiUrl}/api/innkeeperReservation
  const request = await axios.post(`${baseUrl}/multitenancy/reservations`, {
    contact_email: "not.applicable@example.com",
    tenant_name: "BC Wallet (afj-perf-test)",
    context_data: { organization: "BC Wallet" },
  }).then((response) => {return response.data})
  //{reservation_id, reservation_pwd}

  let checkin:any = {}
  while(!checkin.token){
    console.log('Waiting for tenant approval')
    checkin = await axios.post(`${baseUrl}/multitenancy/reservations/${request.reservation_id}/check-in`,
      {"reservation_pwd":request.reservation_pwd}
    ).then((response) => {return response.data})
    console.dir(['checkin', checkin])
    await delay(1000)
  }
  

  const tenant = await axios.get(`${baseUrl}/tenant`, {headers: {"Authorization": `Bearer ${checkin.token}`}})
  .then((response) => {return response.data})
  //{tenant_id, wallet_id}
  console.dir(['tenant', tenant])

  const requestApiKey = await axios.post(`${baseUrl}/tenant/authentications/api`,
    {"alias":"test"}
  , {headers: {"Authorization": `Bearer ${checkin.token}`}})
  .then((response) => {return response.data})
  //{tenant_authentication_api_id, api_key}
  console.dir(['requestApiKey', requestApiKey])

  /*
  await axios.put(`${baseUrl}/ledger/bcovrin-test/set-write-ledger`,
    {}
  , {headers: {"Authorization": `Bearer ${checkin.token}`}})
  .then((response) => {return response.data})
  */
  await checkTransactions(baseUrl,checkin.token )

  console.log('Connecting to Endorser')
  const endorserConn = await axios.post(`${baseUrl}/tenant/endorser-connection`,
    {}
  , {headers: {"Authorization": `Bearer ${checkin.token}`}})
  .then((response) => {return response.data})

  console.log('Waiting for Endorser connection ...')
  let endorserConnStatus = undefined
  while (endorserConnStatus===undefined || endorserConnStatus.state !== 'active'){
    endorserConnStatus = await axios.get(`${baseUrl}/connections/${endorserConn.connection_id}`
    , {headers: {"Authorization": `Bearer ${checkin.token}`}})
    .then((response) => {return response.data})
     waitFor(2000)
  }

  await checkTransactions(baseUrl,checkin.token )
  console.log('Creating DID')
  const walletDid = await axios.post(`${baseUrl}/wallet/did/create`,
    {"method":"sov","options":{"key_type":"ed25519"}}
  , {headers: {"Authorization": `Bearer ${checkin.token}`}})
  .then((response) => {return response.data})

  console.log('Registering as public DID')
  const walletRegisterDid = await axios.post(`${baseUrl}/ledger/register-nym`,
    {}
  , {
    params: {
      "did": walletDid.result.did,
      "verkey": walletDid.result.verkey,
      "alias": "abc",
    },
    headers: {"Authorization": `Bearer ${checkin.token}`}
  })
  .then((response) => {return response.data})

  console.log('Waiting for registration ...')
  let registerDidStatus = undefined
  while (registerDidStatus===undefined || registerDidStatus.state !== 'transaction_acked'){
    registerDidStatus = await axios.get(`${baseUrl}/transactions/${walletRegisterDid.txn.transaction_id}`
    , {headers: {"Authorization": `Bearer ${checkin.token}`}})
    .then((response) => {return response.data})
     waitFor(2000)
  }
  await checkTransactions(baseUrl,checkin.token )
  console.log('Set as public DID')
  await axios.post(`${baseUrl}/wallet/did/public`,
  {}
  , {
    params: { "did": walletDid.result.did},
    headers: {"Authorization": `Bearer ${checkin.token}`}
  })

  console.log('Set ledger')
  await axios.put(`${baseUrl}/tenant/config/set-ledger-id`,
    {"ledger_id":"bcovrin-test"}
    , {headers: {"Authorization": `Bearer ${checkin.token}`}})
  .then((response) => {return response.data})

  let maxTransactionsChecks = 40
  while (maxTransactionsChecks>0) {
    await checkTransactions(baseUrl,checkin.token )
    waitFor(2000)
    maxTransactionsChecks--
  }

  return {
    base_url: baseUrl,
    serviceEndpoint: baseUrl.replace('-tenant-proxy', '-acapy'),
    tenant_id: tenant.tenant_id,
    api_key: tenant.api_key,
    wallet_id: checkin.wallet_id,
    wallet_key: checkin.wallet_key
  }
}
const run = async () => {

  const keys = ['schema_owner', 'issuer', 'verifier', 'holder']
  const config:any = {}
  if (fs.existsSync(path.resolve('./local.env.json'))){
     Object.assign(config, JSON.parse(fs.readFileSync(path.resolve('./local.env.json'), 'utf8')))
  }

  for (const key of keys) {
    const teant = await getNewTenant()
    const conf = config[key]??{}
    //const config = {config[key]??{}, ...teant}
    config[key] = {...conf, ...teant}
    await new Promise(resolve => setTimeout(resolve, 2000))
  }
  fs.writeFileSync(path.resolve('./local.env.json'), JSON.stringify(config, undefined, 2), {encoding: 'utf8'})
}
run()
