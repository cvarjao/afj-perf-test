import axios from 'axios'
import fs from 'node:fs'
import path from 'node:path'

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
  const config:any = {}
  if (fs.existsSync(path.resolve('./local.env.json'))){
     Object.assign(config, JSON.parse(fs.readFileSync(path.resolve('./local.env.json'), 'utf8')))
  }
  config['_new'] = config['default2']??{}
  config['_new']['base_url'] = baseUrl
  config['_new']['serviceEndpoint'] = baseUrl.replace('-proxy', '-acapy')
  config['_new']['tenant_id'] = tenant.tenant_id
  config['_new']['api_key'] = tenant.api_key
  config['_new']['wallet_id'] = checkin.wallet_id
  config['_new']['wallet_key'] = checkin.wallet_key
  fs.writeFileSync(path.resolve('./local.env.json'), JSON.stringify(config, undefined, 2), {encoding: 'utf8'})
}
run()
