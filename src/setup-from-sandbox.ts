import axios from 'axios'
import fs from 'node:fs'
import path from 'node:path'
import { waitFor } from './lib';

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const run = async () => {
  console.log('Requesting tenant')
  const baseUrl = 'https://traction-sandbox-tenant-proxy.apps.silver.devops.gov.bc.ca'
  //${baseUiUrl}/api/innkeeperReservation
  const request = await axios.post(`${baseUrl}/multitenancy/reservations`,
    {"contact_email":"abc@123.com","tenant_name":"abc","context_data":{"organization":"abc"}}
  ).then((response) => {return response.data})
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

  await axios.put(`${baseUrl}/ledger/bcovrin-test/set-write-ledger`,
    {}
  , {headers: {"Authorization": `Bearer ${checkin.token}`}})
  .then((response) => {return response.data})

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
  const config:any = {}
  if (fs.existsSync(path.resolve('./local.env.json'))){
     Object.assign(config, JSON.parse(fs.readFileSync(path.resolve('./local.env.json'), 'utf8')))
  }

  config['_new'] = config['default2']??{}
  config['_new']['base_url'] = baseUrl
  config['_new']['serviceEndpoint'] = baseUrl.replace('-tenant-proxy', '-acapy')
  config['_new']['tenant_id'] = tenant.tenant_id
  config['_new']['api_key'] = tenant.api_key
  config['_new']['wallet_id'] = checkin.wallet_id
  config['_new']['wallet_key'] = checkin.wallet_key
  fs.writeFileSync(path.resolve('./local.env.json'), JSON.stringify(config, undefined, 2), {encoding: 'utf8'})
}
run()
